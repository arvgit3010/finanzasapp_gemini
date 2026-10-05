import { test, expect } from "@playwright/test";
const {
  totp,
} = require("../../apps/api/dist/aplicacion/autenticacion.service");
test("Recorrido completo por React y Nest: acceso, bancos, movimientos, pagos, préstamos y respaldo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Configura tu acceso" }),
  ).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("AccesoPrueba123");
  await page.getByLabel("Repite la contraseña").fill("AccesoPrueba123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator(".secret")).toBeVisible();
  const secret = (await page.locator(".secret").textContent())!;
  await page.getByLabel("Código del autenticador").fill(totp(secret));
  await page.getByRole("button", { name: "Validar y entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bancos", exact: true }).click();
  await page.getByRole("button", { name: "+ Nuevo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("BCP");
  await page.getByLabel("Número de cuenta").fill("123-456");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "BCP" })).toBeVisible();
  await page.getByRole("button", { name: "Movimientos", exact: true }).click();
  await page.getByRole("button", { name: "+ Nuevo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Tipo", exact: true })
    .selectOption("ingreso");
  await dialog.getByLabel("Descripción").fill("Salario de octubre");
  await dialog.getByLabel("Monto (S/)").fill("4500");
  await dialog
    .getByRole("combobox", { name: "Categoría", exact: true })
    .selectOption("Sueldo");
  await dialog
    .getByRole("combobox", { name: "Persona", exact: true })
    .selectOption("Yo");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Salario de octubre", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mostrar montos" }).click();
  await expect(page.getByRole("cell", { name: /4,500/ })).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog.getByLabel("Monto (S/)").fill("4600");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("cell", { name: /4,600/ })).toBeVisible();
  await page.getByRole("button", { name: /Cuentas por pagar/ }).click();
  await page.getByRole("button", { name: "+ Nuevo" }).click();
  await dialog.getByLabel("Concepto").fill("Internet");
  await dialog.getByLabel("Monto estimado (S/)").fill("95");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Internet", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").click();
  await expect(
    page.getByRole("cell", { name: "Pagado", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Internet" })
      .getByRole("cell", { name: /95/ }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Préstamos", exact: true }).click();
  await page.getByRole("button", { name: "+ Nuevo" }).click();
  await dialog.getByLabel("Deudor").fill("Alex");
  await dialog.getByLabel("Capital (S/)").fill("1000");
  await dialog.getByLabel("Número de cuotas").fill("3");
  await dialog
    .getByRole("combobox", { name: "Tipo de interés", exact: true })
    .selectOption("simple");
  await dialog.getByLabel("Tasa por cuota (%)").fill("2");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
  await page.getByText("Ver cronograma y registrar cuotas").click();
  await page.getByRole("checkbox", { name: "Cuota 1 de Alex" }).click();
  await expect(page.getByText("1/3 cuotas pagadas")).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await dialog.getByLabel("Capital (S/)").fill("1200");
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Cuota 1 de Alex" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Catálogos", exact: true }).click();
  await page.getByLabel("Nueva categoría").fill("Delivery");
  await page
    .getByRole("button", { name: "Agregar", exact: true })
    .first()
    .click();
  await expect(page.getByText("Delivery", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^finanzapp-backup-/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.banks[0].name).toBe("BCP");
  expect(backup.movs[0].amount).toBe(4600);
  expect(backup.loans[0].schedule[0].paid).toBe(true);
  expect(backup.pagos[0].real).toBe(95);
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.screenshot({
    path: "test-results/resumen-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/resumen-movil.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Bloquear", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("AccesoPrueba123");
  await page.getByLabel("Código del autenticador").fill(totp(secret));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
