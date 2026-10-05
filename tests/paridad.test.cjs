const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const d = require("../packages/dominio/dist");
const {
  FinanzasService,
} = require("../apps/api/dist/aplicacion/finanzas.service");
const {
  SqliteRepository,
} = require("../apps/api/dist/infraestructura/sqlite.repository");
const { totp } = require("../apps/api/dist/aplicacion/autenticacion.service");
const original = fs.readFileSync("docs/original.html", "utf8");
const fn = original.match(/function calcLoanSchedule\(.*?\n}\n/s)[0];
const ctx = vm.createContext({});
vm.runInContext(fn, ctx);
test("216 cronogramas idénticos al algoritmo original", () => {
  let count = 0;
  for (const amount of [0.01, 100, 1000.01, 30000])
    for (const n of [1, 3, 7])
      for (const type of ["none", "simple", "fixed"])
        for (const rate of [0, 2.5])
          for (const date of ["2026-01-31", "2028-02-29", "2026-12-25"]) {
            assert.deepEqual(
              d.calcLoanSchedule(amount, n, rate, type, date, 30),
              JSON.parse(
                JSON.stringify(
                  ctx.calcLoanSchedule(amount, n, rate, type, date, 30),
                ),
              ),
            );
            count++;
          }
  assert.equal(count, 216);
});
test("TOTP compatible con vector RFC 6238 (seis dígitos)", () =>
  assert.equal(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000), "287082"));
function fixture() {
  return d.EstadoSchema.parse({
    banks: [
      { id: 1, name: "BCP", number: "001", color: "#5b8cfa" },
      { id: 2, name: "BBVA", color: "#f5a623" },
    ],
    movs: [
      {
        id: 1,
        type: "ingreso",
        desc: "Sueldo",
        amount: 1000,
        bankId: 1,
        date: "2026-10-01",
        cat: "Sueldo",
        person: "Yo",
      },
      {
        id: 2,
        type: "egreso",
        desc: "Alquiler",
        amount: 300,
        bankId: 1,
        date: "2026-10-02",
        cat: "Alquiler",
      },
      {
        id: 3,
        type: "egreso",
        desc: "Servicios",
        amount: 80,
        bankId: 2,
        date: "2026-09-02",
      },
    ],
    pagos: [
      {
        id: 1,
        concepto: "Internet",
        estimado: 95,
        real: null,
        pagado: false,
        fecha: "2026-10-15",
        nota: "",
        createdAt: "2026-10-01",
      },
    ],
  });
}
test("Saldos, filtros y pagos conservan reglas originales", () => {
  const s = fixture();
  assert.equal(d.bankBalance(s, 1), 700);
  assert.equal(d.bankBalance(s, 2), -80);
  assert.equal(d.resumen(s).saldo, 620);
  assert.deepEqual(
    d
      .filtrarMovimientos(s, { type: "egreso", bankId: "1", month: "2026-10" })
      .map((m) => m.id),
    [2],
  );
  assert.equal(d.filtrarMovimientos(s, { person: "Yo" }).length, 1);
  assert.equal(d.filtrarPagos(s, "pendiente", "2026-10").length, 1);
});
test("CRUD, paridad de cuotas/pagos, conflictos y persistencia SQLite", () => {
  const os = require("node:os"),
    path = require("node:path");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "finanzapp-unit-"));
  process.env.DATABASE_PATH = path.join(temp, "test.sqlite");
  const repo = new SqliteRepository();
  const app = new FinanzasService(repo);
  let rev = 0;
  const run = (c) => {
    const r = app.ejecutar(c, rev);
    rev = r.revision;
    return r.state;
  };
  try {
    run({ action: "import", data: fixture() });
    let s = run({ action: "togglePago", id: 1 });
    assert.equal(s.pagos[0].real, 95);
    assert.equal(s.movs.length, 3);
    s = run({ action: "togglePago", id: 1 });
    assert.equal(s.pagos[0].real, 95);
    assert.equal(s.pagos[0].pagado, false);
    s = run({
      action: "save",
      entity: "loans",
      data: {
        person: "Alex",
        amount: 100,
        installments: 3,
        startDate: "2026-10-01",
        freqDays: 30,
        desc: "",
        interestType: "simple",
        rate: 2,
      },
    });
    run({ action: "toggleCuota", id: 1, num: 2 });
    s = run({
      action: "save",
      entity: "loans",
      data: { ...s.loans[0], amount: 120 },
    });
    assert.equal(s.loans[0].schedule[1].paid, true);
    assert.equal(s.movs.length, 3);
    const before = repo.leer();
    assert.throws(
      () => app.ejecutar({ action: "delete", entity: "banks", id: 1 }, rev - 1),
      (e) => e.getStatus() === 409,
    );
    assert.deepEqual(repo.leer(), before);
    s = run({ action: "delete", entity: "banks", id: 1 });
    assert.equal(s.movs.length, 1);
    assert.equal(s.movs[0].bankId, 2);
    run({
      action: "catalogo",
      entity: "categories",
      operation: "add",
      value: "Delivery",
    });
    assert.throws(() =>
      run({
        action: "catalogo",
        entity: "categories",
        operation: "add",
        value: "Delivery",
      }),
    );
    const after = repo.leer();
    assert.throws(() =>
      run({
        action: "save",
        entity: "loans",
        data: { person: "x", amount: 100, installments: Infinity },
      }),
    );
    assert.deepEqual(repo.leer(), after);
    repo.cerrar();
    const reopened = new SqliteRepository();
    assert.deepEqual(reopened.leer(), after);
    reopened.cerrar();
  } finally {
    try {
      repo.cerrar();
    } catch {}
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test("Respaldos heredados compatibles y datos inválidos rechazados", () => {
  const raw = fixture();
  delete raw.loans;
  delete raw.pagos;
  delete raw.categories;
  delete raw.personas;
  assert.equal(d.EstadoSchema.parse(raw).personas[0], "Yo");
  const s = fixture();
  s.movs[0].bankId = 999;
  assert.equal(d.EstadoSchema.safeParse(s).success, false);
  s.movs[0].bankId = 1;
  s.banks.push(s.banks[0]);
  assert.equal(d.EstadoSchema.safeParse(s).success, false);
});
