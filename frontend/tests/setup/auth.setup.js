import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import {
  AUTH_FILE,
  ENV,
  assertCredentialsConfigured,
  assertExpectedTenant,
  assertSafeMutationConfiguration,
} from '../support/env.js';

setup('autenticar administrador de Balto', async ({ page }) => {
  assertCredentialsConfigured();
  if (ENV.allowMutations) assertSafeMutationConfiguration();
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Usuario').fill(ENV.user);
  await page.getByPlaceholder('Contraseña').fill(ENV.password);

  await Promise.all([
    page.waitForURL(/\/panel(?:\/|$)/, { timeout: 30_000 }),
    page.getByRole('button', { name: 'ACCEDER' }).click(),
  ]);

  await expect(page).toHaveURL(/\/panel(?:\/|$)/);
  await expect(page.locator('body')).not.toContainText(/Usuario o contraseña incorrectos/i);

  await page.waitForFunction(() => Boolean(localStorage.getItem('session_key')), undefined, {
    timeout: 15_000,
  });
  const sessionKey = await page.evaluate(() => localStorage.getItem('session_key'));
  expect(sessionKey, 'El login debe guardar session_key').toBeTruthy();

  // Espera también los datos del usuario/tenant antes de guardar la sesión.
  // Sin esto, el setup podía guardar solo session_key y todos los CRUD fallaban
  // en menos de un segundo al intentar validar el tenant.
  await assertExpectedTenant(page);
  await page.context().storageState({ path: AUTH_FILE });
});
