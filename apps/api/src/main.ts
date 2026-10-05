import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { RepositorioFinanzas } from "./dominio/repositorio";
import { SqliteRepository } from "./infraestructura/sqlite.repository";
import { FinanzasService } from "./aplicacion/finanzas.service";
import { AutenticacionService } from "./aplicacion/autenticacion.service";
import {
  AuthController,
  FinanzasController,
  SaludController,
  SessionGuard,
} from "./presentacion/api.controller";
@Module({
  controllers: [AuthController, FinanzasController, SaludController],
  providers: [
    { provide: RepositorioFinanzas, useClass: SqliteRepository },
    FinanzasService,
    AutenticacionService,
    SessionGuard,
  ],
})
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "https://accounts.google.com"],
          "frame-src": ["https://accounts.google.com"],
          "connect-src": [
            "'self'",
            "https://accounts.google.com",
            "https://sheets.googleapis.com",
            "https://www.googleapis.com",
          ],
          "img-src": ["'self'", "data:"],
        },
      },
    }),
  );
  app.enableCors({ origin, credentials: true });
  app.use(express.json({ limit: "20mb" }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.path.startsWith("/api/")
    ) {
      if (req.headers["x-finanzapp"] !== "1")
        return res
          .status(403)
          .json({ message: "Cabecera de aplicación requerida" });
      if (req.headers.origin && req.headers.origin !== origin)
        return res.status(403).json({ message: "Origen no permitido" });
    }
    next();
  });
  const web = resolve(__dirname, "../../web/dist");
  if (existsSync(web)) app.use(express.static(web));
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
  );
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
