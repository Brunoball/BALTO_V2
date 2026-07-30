import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { AUTH_FILE, ENV, assertCredentialsConfigured } from '../support/env.js';

setup('autenticar administrador de Balto', async ({ page }) => {
  assertCredentialsConfigured();
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

  const sessionKey = await page.evaluate(() => localStorage.getItem('session_key'));
  expect(sessionKey, 'El login debe guardar session_key').toBeTruthy();

  await page.context().storageState({ path: AUTH_FILE });
});
