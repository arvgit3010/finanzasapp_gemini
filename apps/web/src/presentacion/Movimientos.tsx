import { Estado, filtrarMovimientos } from "@finanzapp/dominio";
import { Edit } from "./Editor";
export function Movimientos({
  state,
  filters,
  setFilters,
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
  filters: {
    type: string;
    bankId: string;
    month: string;
    person: string;
    search: string;
  };
  setFilters: (f: {
    type: string;
    bankId: string;
    month: string;
    person: string;
    search: string;
  }) => void;
}) {
  return (
    <>
      <section className="panel filters">
        <label>
          Tipo
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </label>
        <label>
          Banco
          <select
            value={filters.bankId}
            onChange={(e) => setFilters({ ...filters, bankId: e.target.value })}
          >
            <option value="">Todos</option>
            {state.banks.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mes
          <input
            type="month"
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
          />
        </label>
        <label>
          Persona
          <select
            value={filters.person}
            onChange={(e) => setFilters({ ...filters, person: e.target.value })}
          >
            <option value="">Todas</option>
            {[
              ...new Set([
                ...state.personas,
                ...state.movs.map((m) => m.person).filter(Boolean),
              ]),
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </label>
        <button
          onClick={() =>
            setFilters({
              type: "",
              bankId: "",
              month: "",
              person: "",
              search: "",
            })
          }
        >
          Limpiar
        </button>
      </section>
      <section className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Banco</th>
              <th>Categoría</th>
              <th>Persona</th>
              <th>Monto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrarMovimientos(state, filters).map((m) => (
              <tr key={m.id}>
                <td>{m.date}</td>
                <td>{m.desc}</td>
                <td className={m.type}>{m.type}</td>
                <td>{state.banks.find((b) => b.id === m.bankId)?.name}</td>
                <td>{m.cat}</td>
                <td>{m.person}</td>
                <td>{fmt(m.amount)}</td>
                <td className="nowrap">
                  <button
                    disabled={busy}
                    onClick={() => setEdit({ entity: "movs", data: m })}
                  >
                    Editar
                  </button>{" "}
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => remove("movs", m.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtrarMovimientos(state, filters).length && (
          <p className="empty">Sin movimientos para estos filtros.</p>
        )}
      </section>
    </>
  );
}
