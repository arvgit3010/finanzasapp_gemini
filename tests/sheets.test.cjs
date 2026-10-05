const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { transformSync } = require("esbuild");
const { estadoInicial } = require("../packages/dominio/dist");
const code = transformSync(
  fs.readFileSync("apps/web/src/infraestructura/sheets.ts", "utf8"),
  { loader: "ts", format: "cjs" },
).code;
function create(responses = {}) {
  const calls = [];
  const names = [
    "Movimientos",
    "Bancos",
    "Resumen",
    "Prestamos",
    "Pagos",
    "Categorias",
    "Personas",
  ];
  const storage = new Map([["fapp_sheet_id", "test-sheet"]]);
  const exported = { exports: {} };
  const sandbox = {
    module: exported,
    exports: exported.exports,
    require,
    Date,
    Promise,
    Error,
    JSON,
    String,
    Number,
    encodeURIComponent,
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
    },
    window: {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (o) => ({
              requestAccessToken: () =>
                o.callback({ access_token: "fake-token", expires_in: 3600 }),
            }),
          },
        },
      },
    },
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      const key = url.split("/values/")[1];
      const failure = responses.failure && url.includes(responses.failure);
      const data = key
        ? { values: responses[key] || [] }
        : url.includes("?fields=sheets")
          ? {
              sheets: names.map((title) => ({
                properties: { title, gridProperties: { rowCount: 1000 } },
              })),
            }
          : {};
      return {
        ok: !failure,
        json: async () =>
          failure ? { error: { message: "Fallo simulado" } } : data,
      };
    },
  };
  vm.runInNewContext(code, sandbox);
  return { adapter: new exported.exports.SheetsAdapter(), calls };
}
test("Sheets preserva columnas originales y añade pagos/catálogos sin borrar antes de escribir", async () => {
  const { adapter, calls } = create();
  await adapter.connect("client-test");
  const state = estadoInicial();
  state.banks = [{ id: 1, name: "BCP", number: "001", color: "#5b8cfa" }];
  state.movs = [
    {
      id: 1,
      date: "2026-10-01",
      type: "ingreso",
      desc: "=texto literal",
      amount: 100,
      bankId: 1,
      cat: "Sueldo",
      person: "Yo",
    },
  ];
  await adapter.write(state);
  const write = calls.find((c) => c.url.endsWith("values:batchUpdate"));
  assert.ok(write);
  const payload = JSON.parse(write.options.body);
  assert.equal(payload.valueInputOption, "RAW");
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        payload.data.find((x) => x.range === "Movimientos!A1").values[1],
      ),
    ),
    [1, "2026-10-01", "=texto literal", "ingreso", 100, "BCP", "Sueldo", "Yo"],
  );
  assert.equal(payload.data.length, 7);
  assert.ok(
    calls.findIndex((x) => x.url.endsWith("values:batchClear")) >
      calls.indexOf(write),
  );
  adapter.disconnect();
  assert.equal(adapter.connected(), false);
});
test("Sheets lee versión antigua preservando pagos/personas/categorías locales sin cabeceras nuevas", async () => {
  const { adapter } = create({
    "Bancos!A1:Z": [
      ["ID", "Nombre", "Número", "Color"],
      [1, "BCP", "001", "#5b8cfa"],
    ],
    "Movimientos!A1:Z": [
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
      [1, "2026-10-01", "Ingreso", "ingreso", 100, "BCP", "Sueldo", "Alex"],
    ],
  });
  await adapter.connect("test");
  const state = estadoInicial();
  state.categories = ["Personalizada"];
  const data = await adapter.read(state);
  assert.equal(data.movs[0].bankId, 1);
  assert.equal(data.movs[0].person, "Alex");
  assert.deepEqual(data.categories, ["Personalizada"]);
});
test("Sheets distingue catálogos vacíos explícitos y propaga errores de escritura", async () => {
  const { adapter } = create({
    "Categorias!A1:Z": [["Nombre"]],
    "Personas!A1:Z": [["Nombre"]],
    "Pagos!A1:Z": [["ID", "Concepto"]],
  });
  await adapter.connect("test");
  const data = await adapter.read(estadoInicial());
  assert.equal(data.categories.length, 0);
  assert.equal(data.personas.length, 0);
  const fail = create({ failure: "values:batchUpdate" });
  await fail.adapter.connect("test");
  await assert.rejects(
    () => fail.adapter.write(estadoInicial()),
    /Fallo simulado/,
  );
  assert.ok(!fail.calls.some((x) => x.url.endsWith("values:batchClear")));
});
