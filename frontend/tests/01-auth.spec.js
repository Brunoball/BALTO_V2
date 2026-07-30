import { test, expect } from '@playwright/test';
import { ENV } from './support/env.js';

// Verifica el login real desde la pantalla pública con un contexto limpio.
test('@smoke login válido', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/');
  await expect(page.getByPlaceholder('Usuario')).toBeVisible();
  await expect(page.getByPlaceholder('Contraseña')).toBeVisible();

  await page.getByPlaceholder('Usuario').fill(ENV.user);
  await page.getByPlaceholder('Contraseña').fill(ENV.password);
  await page.getByRole('button', { name: /ACCEDER/i }).click();
  await expect(page).toHaveURL(/\/panel(?:\/dashboard)?/);

  await context.close();
});
