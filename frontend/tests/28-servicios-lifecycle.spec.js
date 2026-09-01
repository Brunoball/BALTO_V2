const { test, expect } = require('@playwright/test');

test.describe('Modulo Servicios - Lifecycle simple', () => {
  test('permite abrir el formulario de creacion de servicio', async ({ page }) => {
    await page.goto('/panel/servicios');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/panel\/servicios(?:[/?#]|$)/, {
      timeout: 15000,
    });

    await expect(page.getByRole('heading', { name: /INICIAR SESIÓN/i })).toHaveCount(0);

    const nuevoServicio = page
      .getByRole('button', {
        name: /nuevo\s+servicio|crear\s+servicio|agregar\s+servicio/i,
      })
      .first();

    await expect(nuevoServicio).toBeVisible({ timeout: 15000 });
    await nuevoServicio.click();

    const superficieEdicion = page
      .locator('[role="dialog"], form, [class*="modal"], [class*="Modal"]')
      .filter({ has: page.locator('input, textarea, select') })
      .first();

    await expect(superficieEdicion).toBeVisible({ timeout: 10000 });
  });
});
