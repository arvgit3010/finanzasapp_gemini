const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { totp } = require("../apps/api/dist/aplicacion/autenticacion.service");
test("API real: 2FA, cookies, CRUD, importación, CSRF, bloqueo y logout", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "finanzapp-http-"));
  const port = 3137,
    origin = "http://127.0.0.1:" + port;
  const child = spawn(process.execPath, ["apps/api/dist/main.js"], {
    env: {
      ...process.env,
      DATABASE_PATH: path.join(dir, "test.sqlite"),
      PORT: String(port),
      FRONTEND_ORIGIN: origin,
    },
    stdio: "pipe",
  });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  let cookie = "";
  async function req(route, body, extra = {}) {
    const response = await fetch(origin + "/api/" + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Finanzapp": "1",
        Cookie: cookie,
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie"),
    };
  }
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await req("health")).status === 200) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
      if (i === 99) throw new Error(output);
    }
    assert.equal((await req("finanzas")).status, 401);
    assert.equal((await req("auth/status")).data.configured, false);
    assert.equal((await req("auth/prepare", { password: "123" })).status, 400);
    const p = await req("auth/prepare", { password: "PruebaSegura123" });
    assert.equal(p.status, 201);
    assert.equal(
      (await req("auth/setup", { challenge: p.data.challenge, code: "abcdef" }))
        .status,
      401,
    );
    const setup = await req("auth/setup", {
      challenge: p.data.challenge,
      code: totp(p.data.secret),
    });
    assert.equal(setup.status, 201);
    assert.match(setup.cookie, /HttpOnly/);
    cookie = setup.cookie.split(";")[0];
    assert.equal((await req("finanzas")).status, 200);
    const initial = (await req("finanzas")).data;
    let rev = initial.revision;
    const save = await req("finanzas/comandos", {
      revision: rev,
      command: {
        action: "save",
        entity: "banks",
        data: { name: "BCP", number: "123", color: "#5b8cfa" },
      },
    });
    assert.equal(save.status, 201);
    rev = save.data.revision;
    const mov = await req("finanzas/comandos", {
      revision: rev,
      command: {
        action: "save",
        entity: "movs",
        data: {
          type: "ingreso",
          desc: "Sueldo",
          amount: 4500,
          bankId: 1,
          date: "2026-10-01",
        },
      },
    });
    assert.equal(mov.status, 201);
    rev = mov.data.revision;
    assert.equal(
      (
        await req("finanzas/comandos", {
          revision: rev - 1,
          command: { action: "delete", entity: "banks", id: 1 },
        })
      ).status,
      409,
    );
    assert.equal((await req("finanzas")).data.state.banks.length, 1);
    assert.equal(
      (
        await req("finanzas/comandos", {
          revision: rev,
          command: { action: "import", data: { banks: [], movs: [{ id: 1 }] } },
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("finanzas/comandos", {}, { "X-Finanzapp": "" })).status,
      403,
    );
    assert.equal(
      (
        await req(
          "finanzas/comandos",
          {},
          { Origin: "https://malicioso.example" },
        )
      ).status,
      403,
    );
    assert.equal((await req("auth/logout", {})).status, 201);
    assert.equal((await req("finanzas")).status, 401);
    const login = await req("auth/login", {
      password: "PruebaSegura123",
      code: totp(p.data.secret),
    });
    assert.equal(login.status, 201);
    cookie = login.cookie.split(";")[0];
    assert.equal((await req("finanzas")).data.state.movs[0].amount, 4500);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await req("auth/login", { password: "incorrecta", code: "000000" }))
          .status,
        401,
      );
    assert.equal(
      (
        await req("auth/login", {
          password: "PruebaSegura123",
          code: totp(p.data.secret),
        })
      ).status,
      429,
    );
  } finally {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
