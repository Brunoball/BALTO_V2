const { test, expect } = require('@playwright/test');

async function abrirServicios(page) {
  // Esta es la ruta canónica que ya usa la propia suite de navegación de Balto.
  await page.goto('/panel/servicios');
  await page.waitForLoadState('domcontentloaded');

  await expect(page).toHaveURL(/\/panel\/servicios(?:[/?#]|$)/, {
    timeout: 15000,
  });

  // Si storageState no estuviera aplicado, esta aserción falla con un mensaje
  // mucho más claro que esperar 15 s por un botón inexistente.
  await expect(page.getByRole('heading', { name: /INICIAR SESIÓN/i })).toHaveCount(0);

  const root = page.locator('#root');
  await expect(root).toBeVisible();

  const nuevoServicio = page
    .getByRole('button', {
      name: /nuevo\s+servicio|crear\s+servicio|agregar\s+servicio/i,
    })
    .first();

  await expect(nuevoServicio).toBeVisible({ timeout: 15000 });

  return { root, nuevoServicio };
}

test.describe('Modulo Servicios - Smoke simple', () => {
  test('carga la pantalla de Servicios autenticada', async ({ page }) => {
    const { root, nuevoServicio } = await abrirServicios(page);

    const texto = (await root.innerText()).trim();

    expect(texto.length).toBeGreaterThan(20);
    expect(texto).toMatch(/BALTO\s*·?\s*SERVICIOS|servicios?/i);
    await expect(nuevoServicio).toBeVisible();
  });

  test('muestra contenido util del modulo sin depender de tabla HTML', async ({ page }) => {
    const { root } = await abrirServicios(page);

    const texto = (await root.innerText()).trim();

    expect(texto).toMatch(/BALTO\s*·?\s*SERVICIOS|servicios?/i);
    expect(texto).not.toMatch(/INICIAR SESIÓN/i);
    expect(texto).not.toMatch(/error de import\/export/i);
  });
});
