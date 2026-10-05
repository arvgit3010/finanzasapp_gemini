import { useEffect, useState, FormEvent } from "react";
import QRCode from "qrcode";
import { api } from "../infraestructura/api";
export function Auth({ onEnter }: { onEnter: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [code, setCode] = useState(""),
    [pending, setPending] = useState<{
      challenge: string;
      secret: string;
      uri: string;
    } | null>(null),
    [qr, setQr] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ configured: boolean }>("auth/status")
      .then((x) => setConfigured(x.configured))
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (configured) {
        await api("auth/login", { password, code });
        onEnter();
      } else if (pending) {
        await api("auth/setup", { challenge: pending.challenge, code });
        onEnter();
      } else {
        if (password !== confirm)
          throw new Error("Las contraseñas no coinciden");
        const p = await api<{ challenge: string; secret: string; uri: string }>(
          "auth/prepare",
          { password },
        );
        setPending(p);
        setPassword("");
        setConfirm("");
        setQr(await QRCode.toDataURL(p.uri));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <form onSubmit={submit} className="panel auth-card">
        <div className="brand">◈ FinanzApp</div>
        <h1>{configured ? "Bienvenido de nuevo" : "Configura tu acceso"}</h1>
        <p className="muted">
          Tus cuentas, movimientos y pagos en un solo lugar.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {configured === null ? (
          <p>Conectando al servidor…</p>
        ) : (
          <>
            {!pending && (
              <>
                <label>
                  Contraseña
                  <input
                    type="password"
                    autoComplete={
                      configured ? "current-password" : "new-password"
                    }
                    required
                    minLength={8}
                    maxLength={256}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                {!configured && (
                  <label>
                    Repite la contraseña
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            {pending && (
              <>
                <p>
                  Escanea este QR con Google Authenticator, Microsoft
                  Authenticator u otra aplicación TOTP.
                </p>
                <img
                  className="qr"
                  src={qr}
                  alt="QR para configurar el autenticador"
                />
                <label>
                  Clave manual<code className="secret">{pending.secret}</code>
                </label>
                <p className="muted">
                  Guarda esta clave en un lugar seguro antes de continuar.
                </p>
              </>
            )}
            {(configured || pending) && (
              <label>
                Código del autenticador
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? "Procesando…"
                : pending
                  ? "Validar y entrar"
                  : configured
                    ? "Entrar"
                    : "Continuar"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
