import { Estado, bankBalance, resumen } from "@finanzapp/dominio";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
export function Metrics({
  items,
  fmt,
}: {
  items: [string, number, string][];
  fmt: (n: number) => string;
}) {
  return (
    <div className="metrics">
      {items.map(([label, value, color]) => (
        <article className="panel metric" key={label}>
          <span className="muted">{label}</span>
          <strong style={{ color }}>{fmt(value)}</strong>
        </article>
      ))}
    </div>
  );
}
export function Dashboard({
  state,
  hidden,
  fmt,
}: {
  state: Estado;
  hidden: boolean;
  fmt: (n: number) => string;
}) {
  const r = resumen(state);
  const months = [...new Set(state.movs.map((m) => m.date.slice(0, 7)))]
    .sort()
    .slice(-6);
  const monthData = months.map((month) => ({
    name: month,
    Ingresos: state.movs
      .filter((m) => m.type === "ingreso" && m.date.startsWith(month))
      .reduce((a, m) => a + m.amount, 0),
    Egresos: state.movs
      .filter((m) => m.type === "egreso" && m.date.startsWith(month))
      .reduce((a, m) => a + m.amount, 0),
  }));
  const cats = [
    ...new Set(
      state.movs
        .filter((m) => m.type === "egreso")
        .map((m) => m.cat || "Sin categoría"),
    ),
  ];
  const catData = cats.map((name) => ({
    name,
    value: state.movs
      .filter((m) => m.type === "egreso" && (m.cat || "Sin categoría") === name)
      .reduce((a, m) => a + m.amount, 0),
  }));
  const personas = [
    ...new Set(state.movs.map((m) => m.person).filter(Boolean)),
  ];
  const people = personas.map((name) => ({
    name,
    Ingresos: state.movs
      .filter((m) => m.type === "ingreso" && m.person === name)
      .reduce((a, m) => a + m.amount, 0),
    Egresos: state.movs
      .filter((m) => m.type === "egreso" && m.person === name)
      .reduce((a, m) => a + m.amount, 0),
  }));
  return (
    <>
      <Metrics
        fmt={fmt}
        items={[
          ["Ingresos", r.ingreso, "#22d17a"],
          ["Egresos", r.egreso, "#f25c5c"],
          ["Balance neto", r.saldo, "#5b8cfa"],
        ]}
      />
      <section className="panel">
        <h2>Saldos por banco</h2>
        <div className="bank-summary">
          {state.banks.map((b) => (
            <article key={b.id}>
              <span style={{ color: b.color }}>{b.name}</span>
              <strong>{fmt(bankBalance(state, b.id))}</strong>
            </article>
          ))}
          {!state.banks.length && (
            <p className="muted">
              Agrega tu primer banco para registrar movimientos.
            </p>
          )}
        </div>
      </section>
      <div className="chart-grid">
        <section className="panel">
          <h2>Ingresos y egresos · últimos 6 meses</h2>
          {hidden ? (
            <p className="chart-hidden">
              Muestra los montos para ver el gráfico.
            </p>
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={monthData}>
                  <XAxis tick={{ fill: "#9198aa" }} dataKey="name" />
                  <YAxis tick={{ fill: "#9198aa" }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Ingresos"
                    fill="#22d17a"
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Egresos"
                    fill="#f25c5c"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Egresos por categoría</h2>
          {hidden ? (
            <p className="chart-hidden">Montos ocultos.</p>
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={catData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                  >
                    {catData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          [
                            "#5b8cfa",
                            "#22d17a",
                            "#f25c5c",
                            "#f5a623",
                            "#a78bfa",
                          ][i % 5]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Ingresos y egresos por persona</h2>
        {hidden ? (
          <p className="chart-hidden">Montos ocultos.</p>
        ) : (
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={people}>
                <XAxis tick={{ fill: "#9198aa" }} dataKey="name" />
                <YAxis tick={{ fill: "#9198aa" }} />
                <Tooltip />
                <Legend />
                <Bar
                  isAnimationActive={false}
                  dataKey="Ingresos"
                  fill="#22d17a"
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="Egresos"
                  fill="#f25c5c"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Últimos movimientos</h2>
        {[...state.movs]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 8)
          .map((m) => (
            <div className="line" key={m.id}>
              <span>
                {m.desc}
                <small>
                  {m.date} · {state.banks.find((b) => b.id === m.bankId)?.name}
                </small>
              </span>
              <strong className={m.type}>{fmt(m.amount)}</strong>
            </div>
          ))}
        {!state.movs.length && (
          <p className="muted">Aún no tienes movimientos.</p>
        )}
      </section>
    </>
  );
}
