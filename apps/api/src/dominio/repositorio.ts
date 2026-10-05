import { Estado } from "@finanzapp/dominio";
export interface Snapshot {
  state: Estado;
  revision: number;
}
export abstract class RepositorioFinanzas {
  abstract leer(): Snapshot;
  abstract guardar(state: Estado, revision: number): Snapshot;
  abstract obtenerSeguridad(): string | null;
  abstract guardarSeguridad(value: string): void;
  abstract crearSeguridad(value: string): boolean;
  abstract cerrar(): void;
}
