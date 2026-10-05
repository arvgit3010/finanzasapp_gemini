import { Estado, Prestamo, resumen } from "@finanzapp/dominio";
import { Metrics } from "./Dashboard";
export function Prestamos({
  state,
  fmt,
  edit,
  remove,
  toggle,
  busy,
}: {
  state: Estado;
  fmt: (n: number) => string;
  edit: (l: Prestamo) => void;
  remove: (id: number) => void;
  toggle: (id: number, num: number) => void;
  busy: boolean;
}) {
  const r = resumen(state);
  function card(l: Prestamo) {
    const paid = l.schedule.filter((c) => c.paid).length;
    return (
      <article className="panel" key={l.id}>
        <div className="section-head">
          <div>
            <h2>{l.person}</h2>
            <p className="muted">
              {l.desc} ·{" "}
              {
                {
                  none: "Sin interés",
                  simple: "Interés simple",
                  fixed: "Monto fijo",
                }[l.interestType]
              }
            </p>
          </div>
          <div className="actions">
            <button disabled={busy} onClick={() => edit(l)}>
              Editar
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => remove(l.id)}
            >
              Eliminar
            </button>
          </div>
        </div>
        <div className="line">
          <span>
            Capital {fmt(l.amount)} · Interés {fmt(l.totalInterest)}
          </span>
          <span>
            {paid}/{l.installments} cuotas pagadas
          </span>
        </div>
        <progress value={paid} max={l.installments} />
        <p className="muted">
          Cobrado:{" "}
          {fmt(
            l.schedule.filter((c) => c.paid).reduce((a, c) => a + c.cuota, 0),
          )}{" "}
          · Pendiente:{" "}
          {fmt(
            l.schedule.filter((c) => !c.paid).reduce((a, c) => a + c.cuota, 0),
          )}
        </p>
        <details>
          <summary>Ver cronograma y registrar cuotas</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cuota</th>
                  <th>Vencimiento</th>
                  <th>Capital</th>
                  <th>Interés</th>
                  <th>Total</th>
                  <th>Pagada</th>
                </tr>
              </thead>
              <tbody>
                {l.schedule.map((c) => (
                  <tr key={c.num}>
                    <td>{c.num}</td>
                    <td>{c.dueDate}</td>
                    <td>{fmt(c.capital)}</td>
                    <td>{fmt(c.interest)}</td>
                    <td>{fmt(c.cuota)}</td>
                    <td>
                      <input
                        aria-label={`Cuota ${c.num} de ${l.person}`}
                        type="checkbox"
                        checked={c.paid}
                        disabled={busy}
                        onChange={() => toggle(l.id, c.num)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </article>
    );
  }
  const active = state.loans.filter((l) => l.schedule.some((c) => !c.paid)),
    done = state.loans.filter((l) => l.schedule.every((c) => c.paid));
  return (
    <>
      <Metrics
        fmt={fmt}
        items={[
          ["Total prestado", r.prestado, "#5b8cfa"],
          ["Cobrado", r.cobrado, "#22d17a"],
          ["Por cobrar", r.porCobrar, "#f5a623"],
        ]}
      />
      <h2>Préstamos activos ({active.length})</h2>
      {active.map(card)}
      {!active.length && <p className="muted">No hay préstamos activos.</p>}
      <details className="panel">
        <summary>Préstamos completados ({done.length})</summary>
        {done.map(card)}
      </details>
    </>
  );
}
