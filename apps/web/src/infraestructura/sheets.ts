import { Estado } from "@finanzapp/dominio";
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (o: {
            client_id: string;
            scope: string;
            callback: (r: {
              error?: string;
              access_token: string;
              expires_in: number;
            }) => void;
            error_callback: () => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}
let loading: Promise<void> | null = null;
function loadGoogle() {
  if (window.google) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        reject(new Error("No se pudo cargar Google"));
      };
      document.head.append(s);
    });
  return loading;
}
type Row = (string | number | boolean)[];
export class SheetsAdapter {
  private token = "";
  private expires = 0;
  sheetId = localStorage.getItem("fapp_sheet_id") || "";
  connected() {
    return !!this.token && Date.now() < this.expires;
  }
  async connect(clientId: string) {
    await loadGoogle();
    await new Promise<void>((resolve, reject) => {
      window
        .google!.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope:
            "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
          callback: (r) => {
            if (r.error) return reject(new Error(r.error));
            this.token = r.access_token;
            this.expires = Date.now() + (r.expires_in - 60) * 1000;
            resolve();
          },
          error_callback: () => reject(new Error("Autorización cancelada")),
        })
        .requestAccessToken();
    });
    await this.ensure();
  }
  private async request(path: string, method = "GET", body?: unknown) {
    if (!this.connected()) throw new Error("Conecta Google Sheets nuevamente");
    const r = await fetch(
      "https://sheets.googleapis.com/v4/spreadsheets/" + path,
      {
        method,
        headers: {
          Authorization: "Bearer " + this.token,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || "Error en Google Sheets");
    return d;
  }
  private async ensure() {
    const required = [
      "Movimientos",
      "Bancos",
      "Resumen",
      "Prestamos",
      "Pagos",
      "Categorias",
      "Personas",
    ];
    if (!this.sheetId) {
      const q = encodeURIComponent(
        "name='FinanzApp — Mis Finanzas' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      );
      const r = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=" +
          q +
          "&fields=files(id,name)",
        { headers: { Authorization: "Bearer " + this.token } },
      );
      if (!r.ok) throw new Error("No se pudo buscar tu hoja en Drive");
      const result = await r.json();
      this.sheetId = result.files?.[0]?.id || "";
      if (!this.sheetId) {
        const created = await this.request("", "POST", {
          properties: { title: "FinanzApp — Mis Finanzas" },
          sheets: required.map((title) => ({ properties: { title } })),
        });
        this.sheetId = created.spreadsheetId;
      }
    }
    const meta = await this.request(
      this.sheetId + "?fields=sheets.properties.title",
    );
    const names = meta.sheets.map((s: any) => s.properties.title);
    const missing = required.filter((t) => !names.includes(t));
    if (missing.length)
      await this.request(this.sheetId + ":batchUpdate", "POST", {
        requests: missing.map((title) => ({
          addSheet: { properties: { title } },
        })),
      });
    localStorage.setItem("fapp_sheet_id", this.sheetId);
  }
  async write(state: Estado) {
    await this.ensure();
    const rows: Record<string, Row[]> = {
      Movimientos: [
        [
          "ID",
          "Fecha",
          "Descripción",
          "Tipo",
          "Monto",
          "Banco",
          "Categoría",
          "Persona",
        ],
        ...state.movs.map((m) => [
          m.id,
          m.date,
          m.desc,
          m.type,
          m.amount,
          state.banks.find((b) => b.id === m.bankId)?.name || "",
          m.cat,
          m.person,
        ]),
      ],
      Bancos: [
        ["ID", "Nombre", "Número de cuenta", "Color"],
        ...state.banks.map((b) => [b.id, b.name, b.number, b.color]),
      ],
      Prestamos: [
        [
          "ID",
          "Deudor",
          "Monto",
          "Cuotas",
          "Fecha Inicio",
          "Frec. Días",
          "Tipo Interés",
          "Tasa",
          "Interés Total",
          "Descripción",
          "Pagado",
          "Datos_JSON",
        ],
        ...state.loans.map((l) => [
          l.id,
          l.person,
          l.amount,
          l.installments,
          l.startDate,
          l.freqDays,
          l.interestType,
          l.rate,
          l.totalInterest,
          l.desc,
          l.schedule.filter((c) => c.paid).reduce((a, c) => a + c.cuota, 0),
          JSON.stringify(l),
        ]),
      ],
      Pagos: [
        [
          "ID",
          "Concepto",
          "Estimado",
          "Real",
          "Fecha",
          "Pagado",
          "Nota",
          "Creado",
        ],
        ...state.pagos.map((p) => [
          p.id,
          p.concepto,
          p.estimado,
          p.real ?? "",
          p.fecha,
          p.pagado,
          p.nota,
          p.createdAt,
        ]),
      ],
      Categorias: [["Nombre"], ...state.categories.map((x) => [x])],
      Personas: [["Nombre"], ...state.personas.map((x) => [x])],
      Resumen: [
        ["Concepto", "Valor"],
        [
          "Total Ingresos",
          state.movs
            .filter((m) => m.type === "ingreso")
            .reduce((a, m) => a + m.amount, 0),
        ],
        [
          "Total Egresos",
          state.movs
            .filter((m) => m.type === "egreso")
            .reduce((a, m) => a + m.amount, 0),
        ],
        ["Ultima sincronizacion", new Date().toISOString()],
      ],
    };
    // Escribir todo antes de quitar filas sobrantes. RAW conserva texto y evita fórmulas involuntarias.
    await this.request(this.sheetId + "/values:batchUpdate", "POST", {
      valueInputOption: "RAW",
      data: Object.entries(rows).map(([name, values]) => ({
        range: `${name}!A1`,
        values,
      })),
    });
    const meta = await this.request(this.sheetId + "?fields=sheets.properties");
    const maxRows: Record<string, number> = {};
    for (const s of meta.sheets)
      maxRows[s.properties.title] = s.properties.gridProperties.rowCount;
    const ranges = Object.entries(rows)
      .filter(([name, values]) => maxRows[name] > values.length)
      .map(
        ([name, values]) => `${name}!A${values.length + 1}:Z${maxRows[name]}`,
      );
    if (ranges.length)
      await this.request(this.sheetId + "/values:batchClear", "POST", {
        ranges,
      });
  }
  async read(current: Estado): Promise<Estado> {
    await this.ensure();
    const sheets = [
      "Bancos",
      "Movimientos",
      "Prestamos",
      "Pagos",
      "Categorias",
      "Personas",
    ];
    const results = await Promise.all(
      sheets.map(async (name) => {
        const r = await this.request(
          this.sheetId + "/values/" + name + "!A1:Z",
        );
        return (r.values || []) as Row[];
      }),
    );
    const [br, mr, lr, pr, cr, pe] = results.map((rows) => rows.slice(1));
    const banks = br
      .filter((r) => r[0])
      .map((r) => ({
        id: Number(r[0]),
        name: String(r[1] || ""),
        number: String(r[2] || ""),
        color: String(r[3] || "#5b8cfa"),
      }));
    const movs = mr
      .filter((r) => r[0])
      .map((r) => ({
        id: Number(r[0]),
        date: String(r[1]),
        desc: String(r[2]),
        type: String(r[3]) as "ingreso" | "egreso",
        amount: Number(r[4]),
        bankId: (banks.find((b) => b.name === r[5]) || banks[0])?.id || 1,
        cat: String(r[6] || ""),
        person: String(r[7] || ""),
      }));
    const loans = lr.filter((r) => r[11]).map((r) => JSON.parse(String(r[11])));
    // Sin cabecera = hoja nueva de una versión anterior. Con cabecera y cero filas = borrado explícito.
    const pagos = results[3].length
      ? pr
          .filter((r) => r[0])
          .map((r) => ({
            id: Number(r[0]),
            concepto: String(r[1] || ""),
            estimado: Number(r[2]),
            real: r[3] === "" || r[3] === undefined ? null : Number(r[3]),
            fecha: String(r[4] || ""),
            pagado: r[5] === true || String(r[5]).toLowerCase() === "true",
            nota: String(r[6] || ""),
            createdAt: String(r[7] || new Date().toISOString()),
          }))
      : current.pagos;
    return {
      ...current,
      banks,
      movs,
      loans,
      pagos,
      categories: results[4].length
        ? cr.map((r) => String(r[0]))
        : current.categories,
      personas: results[5].length
        ? pe.map((r) => String(r[0]))
        : current.personas,
    };
  }
  disconnect() {
    this.token = "";
    this.expires = 0;
  }
}
