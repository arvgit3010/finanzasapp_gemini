import { z } from "zod";
const id = z.number().int().positive();
const number = z.number().finite();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
export const BancoSchema = z.object({
  id,
  name: z.string().trim().min(1),
  number: z.string().default(""),
  color: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#5b8cfa"),
});
export const MovimientoSchema = z.object({
  id,
  type: z.enum(["ingreso", "egreso"]),
  desc: z.string().trim().min(1),
  amount: number.refine((n) => n !== 0),
  bankId: id,
  date,
  cat: z.string().default(""),
  person: z.string().default(""),
});
export const CuotaSchema = z.object({
  num: id,
  dueDate: date,
  capital: number,
  interest: number,
  cuota: number,
  paid: z.boolean(),
});
export const PrestamoSchema = z.object({
  id,
  person: z.string().trim().min(1),
  amount: number.positive(),
  installments: id.max(1000),
  startDate: date,
  freqDays: id.max(3650),
  desc: z.string().default(""),
  interestType: z.enum(["none", "simple", "fixed"]),
  rate: number.nonnegative(),
  schedule: z.array(CuotaSchema),
  totalInterest: number,
  createdAt: z.string(),
});
export const PagoSchema = z.object({
  id,
  concepto: z.string().trim().min(1),
  estimado: number,
  real: number.nullable().default(null),
  fecha: z.union([date, z.literal("")]),
  pagado: z.boolean(),
  nota: z.string().default(""),
  createdAt: z.string(),
});
export const EstadoSchema = z
  .object({
    banks: z.array(BancoSchema).max(10000),
    movs: z.array(MovimientoSchema).max(100000),
    loans: z.array(PrestamoSchema).max(10000).default([]),
    pagos: z.array(PagoSchema).max(100000).default([]),
    categories: z
      .array(z.string().trim().min(1))
      .max(10000)
      .default([
        "Sueldo",
        "Freelance",
        "Bono",
        "Inversión",
        "Alquiler",
        "Alimentación",
        "Transporte",
        "Salud",
        "Educación",
        "Servicios",
        "Entretenimiento",
        "Ropa",
        "Otro",
      ]),
    personas: z.array(z.string().trim().min(1)).max(10000).default(["Yo"]),
  })
  .superRefine((s, ctx) => {
    for (const key of ["banks", "movs", "loans", "pagos"] as const)
      if (new Set(s[key].map((x) => x.id)).size !== s[key].length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "IDs duplicados",
        });
    for (const m of s.movs)
      if (!s.banks.some((b) => b.id === m.bankId))
        ctx.addIssue({
          code: "custom",
          path: ["movs"],
          message: "Banco inexistente",
        });
    for (const l of s.loans)
      if (
        l.schedule.length !== l.installments ||
        l.schedule.some((s, i) => s.num !== i + 1)
      )
        ctx.addIssue({
          code: "custom",
          path: ["loans"],
          message: "Cronograma inconsistente",
        });
  });
export type Estado = z.infer<typeof EstadoSchema>;
export type Banco = z.infer<typeof BancoSchema>;
export type Movimiento = z.infer<typeof MovimientoSchema>;
export type Prestamo = z.infer<typeof PrestamoSchema>;
export type Pago = z.infer<typeof PagoSchema>;
export type Entidad =
  | "banks"
  | "movs"
  | "loans"
  | "pagos"
  | "categories"
  | "personas";
export const ComandoSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    entity: z.enum(["banks", "movs", "loans", "pagos"]),
    data: z.record(z.unknown()),
  }),
  z.object({
    action: z.literal("delete"),
    entity: z.enum(["banks", "movs", "loans", "pagos"]),
    id,
  }),
  z.object({ action: z.literal("togglePago"), id }),
  z.object({ action: z.literal("toggleCuota"), id, num: id }),
  z.object({
    action: z.literal("catalogo"),
    entity: z.enum(["categories", "personas"]),
    operation: z.enum(["add", "delete"]),
    value: z.string().trim().min(1),
  }),
  z.object({ action: z.literal("import"), data: EstadoSchema }),
]);
export type Comando = z.infer<typeof ComandoSchema>;
export function estadoInicial(): Estado {
  return EstadoSchema.parse({ banks: [], movs: [], loans: [], pagos: [] });
}
export function nextId(arr: { id: number }[]) {
  return arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}
export function bankBalance(s: Estado, id: number) {
  return s.movs
    .filter((m) => m.bankId === id)
    .reduce((a, m) => a + (m.type === "ingreso" ? m.amount : -m.amount), 0);
}
export function resumen(s: Estado) {
  const ingreso = s.movs
    .filter((m) => m.type === "ingreso")
    .reduce((a, m) => a + m.amount, 0);
  const egreso = s.movs
    .filter((m) => m.type === "egreso")
    .reduce((a, m) => a + m.amount, 0);
  return {
    ingreso,
    egreso,
    saldo: ingreso - egreso,
    previsto: s.pagos.reduce((a, p) => a + p.estimado, 0),
    pagado: s.pagos
      .filter((p) => p.pagado)
      .reduce((a, p) => a + (p.real ?? p.estimado), 0),
    pendiente: s.pagos
      .filter((p) => !p.pagado)
      .reduce((a, p) => a + p.estimado, 0),
    prestado: s.loans.reduce((a, l) => a + l.amount, 0),
    cobrado: s.loans
      .flatMap((l) => l.schedule)
      .filter((c) => c.paid)
      .reduce((a, c) => a + c.cuota, 0),
    porCobrar: s.loans
      .flatMap((l) => l.schedule)
      .filter((c) => !c.paid)
      .reduce((a, c) => a + c.cuota, 0),
  };
}
export function filtrarMovimientos(
  s: Estado,
  f: {
    type?: string;
    bankId?: string;
    month?: string;
    person?: string;
    search?: string;
  },
) {
  return s.movs
    .filter(
      (m) =>
        (!f.type || m.type === f.type) &&
        (!f.bankId || m.bankId === Number(f.bankId)) &&
        (!f.month || m.date.startsWith(f.month)) &&
        (!f.person || m.person === f.person) &&
        (!f.search || m.desc.toLowerCase().includes(f.search.toLowerCase())),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function filtrarPagos(s: Estado, status: string, month: string) {
  return s.pagos
    .filter(
      (p) =>
        (!status || (status === "pagado" ? p.pagado : !p.pagado)) &&
        (!month || p.fecha.startsWith(month)),
    )
    .sort(
      (a, b) =>
        Number(a.pagado) - Number(b.pagado) ||
        String(a.fecha || "9999").localeCompare(String(b.fecha || "9999")),
    );
}

// Algoritmo original preservado, incluyendo redondeo de la última cuota.
export function calcLoanSchedule(
  amount: number,
  installments: number,
  rate: number,
  type: "none" | "simple" | "fixed",
  startDate: string,
  freqDays: number,
) {
  const schedule = [];
  let balance = amount;
  let totalInterest = 0;

  for (let i = 1; i <= installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + freqDays * (i - 1));
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    let interest = 0;
    let capital = 0;
    let cuota = 0;

    if (type === "none") {
      capital = +(amount / installments).toFixed(2);
      if (i === installments) capital = +balance.toFixed(2);
      cuota = capital;
      interest = 0;
    } else if (type === "simple") {
      interest = +(balance * (rate / 100)).toFixed(2);
      capital = +(amount / installments).toFixed(2);
      if (i === installments) capital = +balance.toFixed(2);
      cuota = +(capital + interest).toFixed(2);
    } else if (type === "fixed") {
      interest = +rate.toFixed(2);
      capital = +(amount / installments).toFixed(2);
      if (i === installments) capital = +balance.toFixed(2);
      cuota = +(capital + interest).toFixed(2);
    }

    balance = +(balance - capital).toFixed(2);
    totalInterest = +(totalInterest + interest).toFixed(2);
    schedule.push({
      num: i,
      dueDate: dueDateStr,
      capital,
      interest,
      cuota,
      paid: false,
    });
  }
  return { schedule, totalInterest };
}
