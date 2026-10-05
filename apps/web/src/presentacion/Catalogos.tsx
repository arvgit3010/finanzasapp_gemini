import { useState } from "react";
import { Estado, Comando } from "@finanzapp/dominio";
export function Catalogos({
  state,
  run,
  busy,
}: {
  state: Estado;
  run: (c: Comando) => Promise<void>;
  busy: boolean;
}) {
  const [cat, setCat] = useState(""),
    [person, setPerson] = useState("");
  return (
    <div className="chart-grid">
      {(["categories", "personas"] as const).map((entity) => (
        <section className="panel" key={entity}>
          <h2>{entity === "categories" ? "Categorías" : "Personas"}</h2>
          <form
            className="actions"
            onSubmit={async (e) => {
              e.preventDefault();
              const value = entity === "categories" ? cat : person;
              try {
                await run({
                  action: "catalogo",
                  entity,
                  operation: "add",
                  value,
                });
                entity === "categories" ? setCat("") : setPerson("");
              } catch {}
            }}
          >
            <input
              aria-label={
                entity === "categories" ? "Nueva categoría" : "Nueva persona"
              }
              required
              value={entity === "categories" ? cat : person}
              onChange={(e) =>
                entity === "categories"
                  ? setCat(e.target.value)
                  : setPerson(e.target.value)
              }
            />
            <button disabled={busy}>Agregar</button>
          </form>
          {state[entity].map((value) => (
            <div className="line" key={value}>
              <span>{value}</span>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `¿Eliminar ${value} del catálogo? Los movimientos conservan su texto.`,
                    )
                  )
                    void run({
                      action: "catalogo",
                      entity,
                      operation: "delete",
                      value,
                    }).catch(() => {});
                }}
              >
                Eliminar
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
