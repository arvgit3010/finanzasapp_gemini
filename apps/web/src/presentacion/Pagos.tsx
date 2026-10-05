import { Estado, Comando, resumen, filtrarPagos } from "@finanzapp/dominio";
import { Edit } from "./Editor";
import { Metrics } from "./Dashboard";
export function Pagos({
  state,
  fmt,
  busy,
  setEdit,
  remove,
  status,
  setStatus,
  month,
  setMonth,
  act,
}: {
  state: Estado;
  fmt: (n: number) => string;
  busy: boolean;
  setEdit: (e: Edit) => void;
  remove: (entity: Edit["entity"], id: number) => void;
  status: string;
  setStatus: (v: string) => void;
  month: string;
  setMonth: (v: string) => void;
  act: (c: Comando) => void;
}) {
  const r = resumen(state);
  return (
    <>
      <Metrics
        fmt={fmt}
        items={[
          ["Total previsto", r.previsto, "#5b8cfa"],
          ["Pagado", r.pagado, "#22d17a"],
          ["Pendiente", r.pendiente, "#f5a623"],
        ]}
      />
      <section className="panel filters">
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
        </label>
        <label>
          Mes
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            setStatus("");
            setMonth("");
          }}
        >
          Limpiar
        </button>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Fecha</th>
              <th>Estimado</th>
              <th>Real</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrarPagos(state, status, month).map((p) => (
              <tr key={p.id}>
                <td>
                  {p.concepto}
                  <small>{p.nota}</small>
                </td>
                <td>{p.fecha || "—"}</td>
                <td>{fmt(p.estimado)}</td>
                <td>{p.real === null ? "—" : fmt(p.real)}</td>
                <td>{p.real === null ? "—" : fmt(p.real - p.estimado)}</td>
                <td>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={p.pagado}
                      disabled={busy}
                      onChange={() => act({ action: "togglePago", id: p.id })}
                    />
                    {p.pagado ? "Pagado" : "Pendiente"}
                  </label>
                </td>
                <td className="nowrap">
                  <button
                    disabled={busy}
                    onClick={() => setEdit({ entity: "pagos", data: p })}
                  >
                    Editar
                  </button>{" "}
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => remove("pagos", p.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtrarPagos(state, status, month).length && (
          <p className="empty">Sin pagos para mostrar.</p>
        )}
      </section>
    </>
  );
}
