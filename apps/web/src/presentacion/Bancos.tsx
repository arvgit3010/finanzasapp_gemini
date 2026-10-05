import { Estado, bankBalance } from "@finanzapp/dominio";
import { Edit } from "./Editor";
export function Bancos({
  state,
  fmt,
  busy,
  setEdit,
  remove,
}: {
  state: Estado;
  fmt: (n: number) => string;
  busy: boolean;
  setEdit: (e: Edit) => void;
  remove: (entity: Edit["entity"], id: number) => void;
}) {
  return (
    <div className="bank-grid">
      {state.banks.map((b) => (
        <article
          className="panel bank"
          style={{ borderTopColor: b.color }}
          key={b.id}
        >
          <h2>{b.name}</h2>
          <p className="muted">{b.number || "Sin número de cuenta"}</p>
          <strong>{fmt(bankBalance(state, b.id))}</strong>
          <p>
            {state.movs.filter((m) => m.bankId === b.id).length} movimientos
          </p>
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => setEdit({ entity: "banks", data: b })}
            >
              Editar
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => remove("banks", b.id)}
            >
              Eliminar
            </button>
          </div>
        </article>
      ))}
      {!state.banks.length && <p className="empty">Agrega tu primer banco.</p>}
    </div>
  );
}
