import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  BancoSchema,
  MovimientoSchema,
  PagoSchema,
  PrestamoSchema,
  EstadoSchema,
  ComandoSchema,
  calcLoanSchedule,
  nextId,
} from "@finanzapp/dominio";
import { RepositorioFinanzas } from "../dominio/repositorio";
@Injectable()
export class FinanzasService {
  constructor(private readonly repo: RepositorioFinanzas) {}
  leer() {
    return this.repo.leer();
  }
  ejecutar(raw: unknown, revision: number) {
    const parsed = ComandoSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((x) => x.message).join("; "),
      );
    if (!Number.isInteger(revision) || revision < 0)
      throw new BadRequestException("Revisión inválida");
    const c = parsed.data;
    let s = this.repo.leer().state;
    try {
      if (c.action === "import") s = c.data;
      else if (c.action === "save") {
        const list = s[c.entity];
        const data = { ...c.data };
        const given = data.id;
        const target = given ? list.find((x) => x.id === given) : undefined;
        if (given && !target)
          throw new NotFoundException("Registro no encontrado");
        data.id = given || nextId(list);
        if (c.entity === "banks") {
          const b = BancoSchema.parse(data);
          s.banks = target
            ? s.banks.map((x) => (x.id === b.id ? b : x))
            : [...s.banks, b];
        }
        if (c.entity === "movs") {
          const m = MovimientoSchema.parse(data);
          if (!s.banks.some((b) => b.id === m.bankId))
            throw new BadRequestException("Selecciona un banco existente");
          s.movs = target
            ? s.movs.map((x) => (x.id === m.id ? m : x))
            : [...s.movs, m];
        }
        if (c.entity === "pagos") {
          const p = PagoSchema.parse({
            ...data,
            createdAt: (target as any)?.createdAt || new Date().toISOString(),
          });
          s.pagos = target
            ? s.pagos.map((x) => (x.id === p.id ? p : x))
            : [...s.pagos, p];
        }
        if (c.entity === "loans") {
          // Validar parámetros antes de calcular para limitar cronogramas y evitar bucles arbitrarios.
          const base = PrestamoSchema.omit({
            schedule: true,
            totalInterest: true,
            createdAt: true,
          }).parse(data);
          const { schedule, totalInterest } = calcLoanSchedule(
            base.amount,
            base.installments,
            base.rate,
            base.interestType,
            base.startDate,
            base.freqDays,
          );
          const old = s.loans.find((x) => x.id === base.id);
          schedule.forEach((x, i) => {
            if (old?.schedule[i]?.paid) x.paid = true;
          });
          const loan = PrestamoSchema.parse({
            ...base,
            schedule,
            totalInterest,
            createdAt: old?.createdAt || new Date().toISOString().slice(0, 10),
          });
          s.loans = target
            ? s.loans.map((x) => (x.id === loan.id ? loan : x))
            : [...s.loans, loan];
        }
      } else if (c.action === "delete") {
        if (!s[c.entity].some((x) => x.id === c.id))
          throw new NotFoundException();
        if (c.entity === "banks") {
          s.banks = s.banks.filter((x) => x.id !== c.id);
          s.movs = s.movs.filter((x) => x.bankId !== c.id);
        } else if (c.entity === "movs")
          s.movs = s.movs.filter((x) => x.id !== c.id);
        else if (c.entity === "loans")
          s.loans = s.loans.filter((x) => x.id !== c.id);
        else s.pagos = s.pagos.filter((x) => x.id !== c.id);
      } else if (c.action === "togglePago") {
        const p = s.pagos.find((x) => x.id === c.id);
        if (!p) throw new NotFoundException();
        p.pagado = !p.pagado;
        if (p.pagado && p.real === null) p.real = p.estimado;
      } else if (c.action === "toggleCuota") {
        const p = s.loans
          .find((x) => x.id === c.id)
          ?.schedule.find((x) => x.num === c.num);
        if (!p) throw new NotFoundException();
        p.paid = !p.paid;
      } else if (c.action === "catalogo") {
        const list = s[c.entity];
        if (c.operation === "add") {
          if (list.includes(c.value))
            throw new BadRequestException("Ya existe");
          list.push(c.value);
        } else s[c.entity] = list.filter((x) => x !== c.value);
      }
      const valid = EstadoSchema.safeParse(s);
      if (!valid.success)
        throw new BadRequestException(
          valid.error.issues.map((x) => x.message).join("; "),
        );
      return this.repo.guardar(valid.data, revision);
    } catch (e) {
      if (e instanceof Error && e.name === "ZodError")
        throw new BadRequestException("Datos inválidos: " + e.message);
      throw e;
    }
  }
}
