import { useState, FormEvent } from "react";
import { Estado, Entidad, calcLoanSchedule } from "@finanzapp/dominio";
export interface Edit {
  entity: Exclude<Entidad, "categories" | "personas">;
  data?: Record<string, unknown>;
}
const today = () => new Date().toISOString().slice(0, 10);
export function Editor({
  edit,
  state,
  onSave,
  onClose,
  busy,
}: {
  edit: Edit;
  state: Estado;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const defaults = {
    banks: { name: "", number: "", color: "#5b8cfa" },
    movs: {
      type: "egreso",
      desc: "",
      amount: "",
      date: today(),
      bankId: state.banks[0]?.id || "",
      cat: "",
      person: "",
    },
    pagos: {
      concepto: "",
      estimado: "",
      real: "",
      fecha: today(),
      pagado: false,
      nota: "",
    },
    loans: {
      person: "",
      amount: "",
      installments: 1,
      startDate: today(),
      freqDays: 30,
      desc: "",
      interestType: "none",
      rate: 0,
    },
  };
  const [data, setData] = useState<Record<string, any>>({
      ...defaults[edit.entity],
      ...edit.data,
    }),
    [error, setError] = useState("");
  function field(
    name: string,
    label: string,
    type = "text",
    options?: { value: string; label: string }[],
    required = false,
  ) {
    return (
      <label key={name}>
        {label}
        {options ? (
          <select
            value={String(data[name] ?? "")}
            onChange={(e) => setData({ ...data, [name]: e.target.value })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            required={required}
            step={type === "number" ? "any" : undefined}
            value={data[name] ?? ""}
            onChange={(e) => setData({ ...data, [name]: e.target.value })}
          />
        )}
      </label>
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const d = { ...data };
    for (const k of [
      "amount",
      "bankId",
      "estimado",
      "rate",
      "installments",
      "freqDays",
    ])
      if (k in d) d[k] = Number(d[k]);
    if (edit.entity === "pagos") {
      d.real = d.real === "" || d.real === null ? null : Number(d.real);
      d.pagado = d.pagado === true || d.pagado === "true";
    }
    try {
      await onSave(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  let preview = null;
  if (
    edit.entity === "loans" &&
    Number(data.amount) > 0 &&
    Number(data.installments) > 0 &&
    Number(data.installments) <= 1000 &&
    data.startDate
  ) {
    try {
      const r = calcLoanSchedule(
        Number(data.amount),
        Number(data.installments),
        Number(data.rate),
        data.interestType,
        data.startDate,
        Number(data.freqDays),
      );
      preview = (
        <p className="preview">
          Primera cuota: S/ {r.schedule[0].cuota.toFixed(2)} · Interés total: S/{" "}
          {r.totalInterest.toFixed(2)}
        </p>
      );
    } catch {}
  }
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        className="panel dialog"
      >
        <div className="section-head">
          <h2 id="editor-title">
            {edit.data ? "Editar" : "Nuevo"}{" "}
            {
              {
                banks: "banco",
                movs: "movimiento",
                pagos: "pago",
                loans: "préstamo",
              }[edit.entity]
            }
          </h2>
          <button aria-label="Cerrar" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {edit.entity === "banks" && (
              <>
                {field("name", "Nombre", "text", undefined, true)}
                {field("number", "Número de cuenta")}
                {field("color", "Color", "color")}
              </>
            )}
            {edit.entity === "movs" && (
              <>
                {field("type", "Tipo", "text", [
                  { value: "ingreso", label: "Ingreso" },
                  { value: "egreso", label: "Egreso" },
                ])}
                {field("date", "Fecha", "date", undefined, true)}
                {field("desc", "Descripción", "text", undefined, true)}
                {field("amount", "Monto (S/)", "number", undefined, true)}
                {field(
                  "bankId",
                  "Banco",
                  "text",
                  state.banks.map((b) => ({
                    value: String(b.id),
                    label: b.name,
                  })),
                )}
                {field("cat", "Categoría", "text", [
                  { value: "", label: "Sin categoría" },
                  ...state.categories.map((c) => ({ value: c, label: c })),
                ])}
                {field("person", "Persona", "text", [
                  { value: "", label: "Sin persona" },
                  ...state.personas.map((c) => ({ value: c, label: c })),
                ])}
              </>
            )}
            {edit.entity === "pagos" && (
              <>
                {field("concepto", "Concepto", "text", undefined, true)}
                {field("fecha", "Fecha", "date")}
                {field(
                  "estimado",
                  "Monto estimado (S/)",
                  "number",
                  undefined,
                  true,
                )}
                {field("real", "Monto real (S/)", "number")}
                {field("pagado", "Estado", "text", [
                  { value: "false", label: "Pendiente" },
                  { value: "true", label: "Pagado" },
                ])}
                {field("nota", "Nota")}
              </>
            )}
            {edit.entity === "loans" && (
              <>
                {field("person", "Deudor", "text", undefined, true)}
                {field("amount", "Capital (S/)", "number", undefined, true)}
                {field(
                  "installments",
                  "Número de cuotas",
                  "number",
                  undefined,
                  true,
                )}
                {field("startDate", "Primera cuota", "date", undefined, true)}
                {field(
                  "freqDays",
                  "Frecuencia (días)",
                  "number",
                  undefined,
                  true,
                )}
                {field("interestType", "Tipo de interés", "text", [
                  { value: "none", label: "Sin interés" },
                  { value: "simple", label: "Interés simple sobre saldo" },
                  { value: "fixed", label: "Monto fijo por cuota" },
                ])}
                {field(
                  "rate",
                  data.interestType === "fixed"
                    ? "Interés por cuota (S/)"
                    : "Tasa por cuota (%)",
                  "number",
                )}
                {field("desc", "Descripción")}
              </>
            )}
          </div>
          {preview}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
