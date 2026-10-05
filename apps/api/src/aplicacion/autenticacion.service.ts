import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  HttpException,
} from "@nestjs/common";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { RepositorioFinanzas } from "../dominio/repositorio";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Buffer) {
  let bits = 0,
    value = 0,
    result = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
export function totp(secret: string, time = Date.now()) {
  let bits = 0,
    v = 0;
  const bytes = [];
  for (const c of secret) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw new Error("Clave inválida");
    v = (v << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((v >>> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)));
  const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = hash[19] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
export function validTotp(secret: string, code: string) {
  return (
    /^\d{6}$/.test(code) &&
    [-30000, 0, 30000].some((d) => totp(secret, Date.now() + d) === code)
  );
}
interface Security {
  salt: string;
  hash: string;
  secret: string;
  attempts: number;
  lockedUntil: number;
}
@Injectable()
export class AutenticacionService {
  private pending = new Map<
    string,
    { cfg: Security; expires: number; attempts: number }
  >();
  private sessions = new Map<string, number>();
  constructor(private repo: RepositorioFinanzas) {}
  estado() {
    return { configured: !!this.repo.obtenerSeguridad() };
  }
  preparar(password: unknown) {
    if (this.repo.obtenerSeguridad())
      throw new ConflictException("La cuenta ya existe");
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 256
    )
      throw new BadRequestException("Contraseña de 8 a 256 caracteres");
    for (const [k, v] of this.pending)
      if (v.expires < Date.now()) this.pending.delete(k);
    if (this.pending.size >= 10)
      throw new HttpException("Demasiadas configuraciones pendientes", 429);
    const salt = randomBytes(16).toString("hex");
    const secret = base32(randomBytes(20));
    const challenge = randomBytes(32).toString("hex");
    this.pending.set(challenge, {
      cfg: {
        salt,
        hash: scryptSync(password, salt, 64).toString("hex"),
        secret,
        attempts: 0,
        lockedUntil: 0,
      },
      expires: Date.now() + 600000,
      attempts: 0,
    });
    return {
      challenge,
      secret,
      uri: `otpauth://totp/FinanzApp:Usuario?secret=${secret}&issuer=FinanzApp`,
    };
  }
  finalizar(challenge: string, code: string) {
    const p = this.pending.get(challenge);
    if (!p || p.expires < Date.now() || p.attempts >= 5)
      throw new UnauthorizedException("Configuración caducada");
    p.attempts++;
    if (!validTotp(p.cfg.secret, code))
      throw new UnauthorizedException("Código incorrecto");
    if (!this.repo.crearSeguridad(JSON.stringify(p.cfg)))
      throw new ConflictException("La cuenta ya existe");
    this.pending.clear();
    return this.session();
  }
  login(password: string, code: string) {
    const raw = this.repo.obtenerSeguridad();
    if (!raw) throw new BadRequestException("Primero configura la cuenta");
    const cfg = JSON.parse(raw) as Security;
    if (cfg.lockedUntil > Date.now())
      throw new HttpException(
        "Espera cinco minutos antes de intentar nuevamente",
        429,
      );
    if (cfg.lockedUntil) {
      cfg.attempts = 0;
      cfg.lockedUntil = 0;
    }
    const valid =
      typeof password === "string" &&
      password.length <= 256 &&
      timingSafeEqual(
        scryptSync(password, cfg.salt, 64),
        Buffer.from(cfg.hash, "hex"),
      ) &&
      validTotp(cfg.secret, code);
    if (!valid) {
      cfg.attempts++;
      if (cfg.attempts >= 5) cfg.lockedUntil = Date.now() + 300000;
      this.repo.guardarSeguridad(JSON.stringify(cfg));
      throw new UnauthorizedException("Contraseña o código incorrectos");
    }
    cfg.attempts = 0;
    cfg.lockedUntil = 0;
    this.repo.guardarSeguridad(JSON.stringify(cfg));
    return this.session();
  }
  private session() {
    for (const [k, t] of this.sessions)
      if (t < Date.now()) this.sessions.delete(k);
    const token = randomBytes(32).toString("hex");
    this.sessions.set(token, Date.now() + 8 * 3600000);
    return token;
  }
  verificar(token: string) {
    const t = this.sessions.get(token);
    if (!t || t < Date.now()) throw new UnauthorizedException("Inicia sesión");
  }
  salir(token: string) {
    this.sessions.delete(token);
  }
}
