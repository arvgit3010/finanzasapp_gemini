import { useEffect, useRef, useState } from "react";
import { Comando, Estado, resumen } from "@finanzapp/dominio";
import { api } from "../infraestructura/api";
import { SheetsAdapter } from "../infraestructura/sheets";
import { useFinanzas } from "../aplicacion/useFinanzas";
import { Auth } from "./Auth";
import { Dashboard } from "./Dashboard";
import { Editor, Edit } from "./Editor";
import { Prestamos } from "./Prestamos";
import { Movimientos } from "./Movimientos";
import { Bancos } from "./Bancos";
import { Pagos } from "./Pagos";
import { Catalogos } from "./Catalogos";
export function App() {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    api("finanzas")
      .then(() => setEntered(true))
      .catch(() => {});
  }, []);
  return entered ? (
    <Finanzas onExit={() => setEntered(false)} />
  ) : (
    <Auth onEnter={() => setEntered(true)} />
  );
}
function Finanzas({ onExit }: { onExit: () => void }) {
  const { snapshot, error, setError, busy, ejecutar } = useFinanzas(onExit);
  const [page, setPage] = useState("Resumen"),
    [hidden, setHidden] = useState(true),
    [sidebar, setSidebar] = useState(true),
    [edit, setEdit] = useState<Edit | null>(null),
    [message, setMessage] = useState(""),
    [filters, setFilters] = useState({
      type: "",
      bankId: "",
      month: "",
      person: "",
      search: "",
    }),
    [status, setStatus] = useState(""),
    [month, setMonth] = useState(""),
    [clientId, setClientId] = useState(() => {
      try {
        return (
          localStorage.getItem("fapp_client_id") ||
          JSON.parse(localStorage.getItem("fapp_sec") || "{}").clientId ||
          ""
        );
      } catch {
        return "";
      }
    }),
    [syncStatus, setSyncStatus] = useState("Google Sheets desconectado"),
    [syncBusy, setSyncBusy] = useState(false);
  const sheets = useRef(new SheetsAdapter()),
    syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    syncChain = useRef(Promise.resolve());
  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      sheets.current.disconnect();
    },
    [],
  );
  function scheduleSync(state: Estado) {
    if (!sheets.current.connected()) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      syncChain.current = syncChain.current.then(async () => {
        try {
          setSyncStatus("Sincronizando…");
          await sheets.current.write(state);
          setSyncStatus(
            "Sincronizado " + new Date().toLocaleTimeString("es-PE"),
          );
        } catch (e) {
          setSyncStatus("Error: " + (e as Error).message);
        }
      });
    }, 1500);
  }
  async function run(c: Comando) {
    if (syncBusy) throw new Error("Espera a que termine la sincronización");
    const state = await ejecutar(c);
    setMessage("Cambios guardados");
    scheduleSync(state);
  }
  function act(c: Comando) {
    void run(c).catch(() => {});
  }
  if (!snapshot)
    return (
      <main className="auth">
        <div className="panel">
          {error || "Cargando tus finanzas…"}
          {error && (
            <button onClick={() => location.reload()}>Reintentar</button>
          )}
        </div>
      </main>
    );
  const state = snapshot.state,
    r = resumen(state),
    fmt = (n: number) =>
      hidden
        ? "S/ •••••"
        : new Intl.NumberFormat("es-PE", {
            style: "currency",
            currency: "PEN",
          }).format(n);
  function remove(entity: Edit["entity"], id: number) {
    const extra =
      entity === "banks"
        ? ` También se eliminarán ${state.movs.filter((m) => m.bankId === id).length} movimientos de este banco.`
        : "";
    if (confirm("¿Eliminar este registro?" + extra))
      act({ action: "delete", entity, id });
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "finanzapp-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(data: unknown) {
    if (!confirm("La restauración reemplazará tus datos actuales. ¿Continuar?"))
      return;
    try {
      await run({ action: "import", data: data as Estado });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function sync(direction: "read" | "write") {
    if (syncBusy) return;
    setSyncBusy(true);
    try {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      await syncChain.current;
      if (direction === "read") {
        if (
          !confirm(
            "Leer Sheets reemplazará bancos, movimientos y préstamos. ¿Continuar?",
          )
        )
          return;
        const data = await sheets.current.read(state);
        await ejecutar({ action: "import", data });
      } else await sheets.current.write(state);
      setSyncStatus("Sincronizado " + new Date().toLocaleTimeString("es-PE"));
    } catch (e) {
      setSyncStatus("Error: " + (e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }
  const pages = [
    "Resumen",
    "Movimientos",
    "Bancos",
    "Préstamos",
    "Cuentas por pagar",
    "Catálogos",
    "Configuración",
  ];
  const entity = (
    {
      Movimientos: "movs",
      Bancos: "banks",
      Préstamos: "loans",
      "Cuentas por pagar": "pagos",
    } as Record<string, Edit["entity"]>
  )[page];
  return (
    <div className={"layout " + (!sidebar ? "collapsed" : "")}>
      <aside>
        <div className="brand">◈ FinanzApp</div>
        <p className="muted">Gestión personal</p>
        <nav>
          {pages.map((p, i) => (
            <button
              className={page === p ? "selected" : ""}
              key={p}
              onClick={() => setPage(p)}
            >
              <span aria-hidden="true">
                {["◉", "⇄", "▣", "◷", "✓", "≡", "⚙"][i]}
              </span>
              {p}
              {p === "Cuentas por pagar" && (
                <small aria-hidden="true">
                  {state.pagos.filter((x) => !x.pagado).length}
                </small>
              )}
            </button>
          ))}
        </nav>
        <p className="muted">React + NestJS</p>
      </aside>
      <main className="content">
        <header>
          <div>
            <button onClick={() => setSidebar(!sidebar)}>
              {sidebar ? "Ocultar menú" : "Mostrar menú"}
            </button>
            <h1>{page}</h1>
          </div>
          <div className="actions">
            <button onClick={() => setHidden(!hidden)}>
              {hidden ? "Mostrar montos" : "Ocultar montos"}
            </button>
            <button
              onClick={async () => {
                await api("auth/logout", {});
                onExit();
              }}
            >
              Bloquear
            </button>
            {entity && (
              <button
                className="primary"
                disabled={
                  busy || syncBusy || (entity === "movs" && !state.banks.length)
                }
                onClick={() => setEdit({ entity })}
              >
                + Nuevo
              </button>
            )}
          </div>
        </header>
        <div className="status-bar">
          <span>{syncStatus}</span>
          <span>
            Revisión {snapshot.revision} ·{" "}
            {message || "Datos guardados en el servidor"}
          </span>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {page === "Resumen" && (
          <Dashboard state={state} hidden={hidden} fmt={fmt} />
        )}
        {page === "Movimientos" && (
          <Movimientos
            state={state}
            filters={filters}
            setFilters={setFilters}
            fmt={fmt}
            busy={busy}
            setEdit={setEdit}
            remove={remove}
          />
        )}
        {page === "Bancos" && (
          <Bancos
            state={state}
            fmt={fmt}
            busy={busy}
            setEdit={setEdit}
            remove={remove}
          />
        )}
        {page === "Préstamos" && (
          <Prestamos
            state={state}
            fmt={fmt}
            busy={busy}
            edit={(l) => setEdit({ entity: "loans", data: l })}
            remove={(id) => remove("loans", id)}
            toggle={(id, num) => act({ action: "toggleCuota", id, num })}
          />
        )}
        {page === "Cuentas por pagar" && (
          <Pagos
            state={state}
            fmt={fmt}
            busy={busy}
            setEdit={setEdit}
            remove={remove}
            status={status}
            setStatus={setStatus}
            month={month}
            setMonth={setMonth}
            act={act}
          />
        )}
        {page === "Catálogos" && (
          <Catalogos state={state} run={run} busy={busy} />
        )}
        {page === "Configuración" && (
          <>
            <section className="panel">
              <h2>Respaldos e importación</h2>
              <p>
                El respaldo incluye bancos, movimientos, préstamos, pagos,
                categorías y personas. Exporta antes de restaurar.
              </p>
              <div className="actions">
                <button onClick={exportData}>Exportar JSON</button>
                <label className="file-button">
                  Restaurar JSON
                  <input
                    aria-label="Archivo de respaldo"
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        try {
                          await importData(JSON.parse(await f.text()));
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => {
                    try {
                      const raw = localStorage.getItem("fapp_data");
                      if (!raw)
                        throw new Error(
                          "No se encontraron datos anteriores en este navegador. Exporta el JSON desde la aplicación anterior e impórtalo aquí.",
                        );
                      void importData(JSON.parse(raw));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Importar datos del navegador anterior
                </button>
              </div>
            </section>
            <section className="panel">
              <h2>Google Sheets</h2>
              <p>
                Usa el mismo ID de cliente OAuth de tu versión anterior.
                Autoriza este origen en Google Cloud. La sincronización
                automática se activa después de conectar.
              </p>
              <label>
                ID de cliente OAuth
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </label>
              <div className="actions">
                <button
                  disabled={syncBusy || !clientId}
                  onClick={async () => {
                    setSyncBusy(true);
                    try {
                      await sheets.current.connect(clientId.trim());
                      localStorage.setItem("fapp_client_id", clientId.trim());
                      setSyncStatus("Google Sheets conectado");
                    } catch (e) {
                      setSyncStatus("Error: " + (e as Error).message);
                    } finally {
                      setSyncBusy(false);
                    }
                  }}
                >
                  Conectar Google
                </button>
                <button
                  disabled={busy || syncBusy || !sheets.current.connected()}
                  onClick={() => void sync("read")}
                >
                  Leer desde Sheets
                </button>
                <button
                  disabled={busy || syncBusy || !sheets.current.connected()}
                  onClick={() => {
                    if (
                      confirm(
                        "¿Reemplazar los datos de la hoja con los de esta aplicación?",
                      )
                    )
                      void sync("write");
                  }}
                >
                  Guardar en Sheets
                </button>
                {sheets.current.sheetId && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={
                      "https://docs.google.com/spreadsheets/d/" +
                      sheets.current.sheetId +
                      "/edit"
                    }
                  >
                    Abrir hoja ↗
                  </a>
                )}
              </div>
              <p className="muted">{syncStatus}</p>
            </section>
            <section className="panel">
              <h2>Persistencia y acceso</h2>
              <p>
                Los datos se guardan en SQLite mediante el backend. La
                contraseña y la verificación de dos pasos se validan en el
                servidor. Al cerrar la sesión, vuelves a la pantalla de acceso.
              </p>
            </section>
          </>
        )}
        {edit && (
          <Editor
            key={edit.entity + String(edit.data?.id || "new")}
            edit={edit}
            state={state}
            busy={busy}
            onClose={() => setEdit(null)}
            onSave={async (data) => {
              await run({ action: "save", entity: edit.entity, data });
              setEdit(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
