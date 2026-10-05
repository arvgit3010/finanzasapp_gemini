import { Injectable, ConflictException, OnModuleDestroy } from "@nestjs/common";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { estadoInicial } from "@finanzapp/dominio";
import { RepositorioFinanzas, Snapshot } from "../dominio/repositorio";
@Injectable()
export class SqliteRepository
  extends RepositorioFinanzas
  implements OnModuleDestroy
{
  private db: DatabaseSync;
  constructor() {
    super();
    const path = resolve(
      process.env.DATABASE_PATH || "../../data/finanzapp.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS estado(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL,revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS seguridad(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL)",
    );
    this.db
      .prepare("INSERT OR IGNORE INTO estado VALUES(1,?,0)")
      .run(JSON.stringify(estadoInicial()));
  }
  leer(): Snapshot {
    const row = this.db
      .prepare("SELECT json,revision FROM estado WHERE id=1")
      .get()!;
    return {
      state: JSON.parse(String(row.json)),
      revision: Number(row.revision),
    };
  }
  guardar(state: Snapshot["state"], revision: number): Snapshot {
    const r = this.db
      .prepare(
        "UPDATE estado SET json=?,revision=revision+1 WHERE id=1 AND revision=?",
      )
      .run(JSON.stringify(state), revision);
    if (!r.changes)
      throw new ConflictException(
        "Los datos cambiaron en otra sesión. Recarga antes de guardar.",
      );
    return { state, revision: revision + 1 };
  }
  obtenerSeguridad() {
    const r = this.db.prepare("SELECT json FROM seguridad WHERE id=1").get();
    return r ? String(r.json) : null;
  }
  guardarSeguridad(v: string) {
    this.db.prepare("UPDATE seguridad SET json=? WHERE id=1").run(v);
  }
  crearSeguridad(v: string) {
    return !!this.db
      .prepare("INSERT OR IGNORE INTO seguridad VALUES(1,?)")
      .run(v).changes;
  }
  cerrar() {
    this.db.close();
  }
  onModuleDestroy() {
    this.cerrar();
  }
}
