import { useEffect, useState, useRef } from "react";
import { Estado, Comando } from "@finanzapp/dominio";
import { api, ApiError } from "../infraestructura/api";
export interface Snapshot {
  state: Estado;
  revision: number;
}
export function useFinanzas(onExpired: () => void) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const current = useRef(snapshot);
  current.current = snapshot;
  useEffect(() => {
    let live = true;
    api<Snapshot>("finanzas")
      .then((s) => {
        if (live) setSnapshot(s);
      })
      .catch((e) => {
        if (live) {
          if (e.status === 401) onExpired();
          else setError(e.message);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  async function ejecutar(command: Comando) {
    if (active.current || !current.current)
      throw new Error("Espera a que termine la operación");
    active.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<Snapshot>("finanzas/comandos", {
        command,
        revision: current.current.revision,
      });
      setSnapshot(result);
      current.current = result;
      return result.state;
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) onExpired();
      if (err.status === 409) {
        const fresh = await api<Snapshot>("finanzas");
        setSnapshot(fresh);
        current.current = fresh;
      }
      setError(err.message);
      throw err;
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return { snapshot, error, setError, busy, ejecutar };
}
