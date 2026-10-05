import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  Injectable,
  CanActivate,
  ExecutionContext,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { FinanzasService } from "../aplicacion/finanzas.service";
import { AutenticacionService } from "../aplicacion/autenticacion.service";
function cookie(req: Request) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("finanzapp_session="))
      ?.slice("finanzapp_session=".length) || ""
  );
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AutenticacionService) {}
  canActivate(ctx: ExecutionContext) {
    this.auth.verificar(cookie(ctx.switchToHttp().getRequest()));
    return true;
  }
}
@Controller("api/auth")
export class AuthController {
  constructor(private auth: AutenticacionService) {}
  @Get("status") status() {
    return this.auth.estado();
  }
  @Post("prepare") prepare(@Body() b: { password: unknown }) {
    return this.auth.preparar(b.password);
  }
  @Post("setup") setup(
    @Body() b: { challenge: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setCookie(res, this.auth.finalizar(b.challenge, b.code));
    return { ok: true };
  }
  @Post("login") login(
    @Body() b: { password: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.setCookie(res, this.auth.login(b.password, b.code));
    return { ok: true };
  }
  @Post("logout") logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.auth.salir(cookie(req));
    res.clearCookie("finanzapp_session", { path: "/" });
    return { ok: true };
  }
  private setCookie(res: Response, token: string) {
    res.cookie("finanzapp_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 8 * 3600000,
      path: "/",
    });
  }
}
@Controller("api/finanzas")
@UseGuards(SessionGuard)
export class FinanzasController {
  constructor(private app: FinanzasService) {}
  @Get() leer() {
    return this.app.leer();
  }
  @Post("comandos") ejecutar(
    @Body() b: { command: unknown; revision: number },
  ) {
    return this.app.ejecutar(b.command, b.revision);
  }
}
@Controller("api")
export class SaludController {
  @Get("health") health() {
    return { status: "ok" };
  }
}
