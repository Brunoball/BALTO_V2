import fs from 'node:fs';
import path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import {
  AUTH_FILE,
  ENV,
  assertCredentialsConfigured,
} from '../support/env.js';
import { runCleanupWithPage } from '../support/cleanup.js';

setup('authenticate and cleanup', async ({ page, request }) => {
  assertCredentialsConfigured();

  // Conservamos el cleanup existente. Si el backend no expone ese endpoint,
  // no debe ocultar ni falsear el resultado del login.
  try {
    await runCleanupWithPage(page, request);
  } catch (error) {
    console.warn(
      'Advertencia durante la limpieza inicial (continuando ejecucion):',
      error.message,
    );
  }

  // El login real de Balto vive en la raíz pública.
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const usuario = page.getByPlaceholder('Usuario');
  const password = page.getByPlaceholder('Contraseña');

  // El proyecto setup usa un contexto nuevo. Normalmente entra por acá.
  // Si en algún entorno ya existe sesión, simplemente validamos /panel.
  if (await usuario.isVisible().catch(() => false)) {
    await usuario.fill(ENV.user);
    await password.fill(ENV.password);

    await page.getByRole('button', { name: /ACCEDER/i }).click();
  }

  // Antes se tragaba este error con .catch(() => {}), por eso el setup podía
  // aparecer verde aunque el login hubiera fallado.
  await expect(page).toHaveURL(/\/panel(?:\/|$)/, { timeout: 20_000 });

  const session = await page.evaluate(() => ({
    usuario: localStorage.getItem('usuario'),
    sessionKey:
      localStorage.getItem('session_key') ||
      localStorage.getItem('sessionKey') ||
      localStorage.getItem('X-Session') ||
      localStorage.getItem('x_session') ||
      '',
  }));

  expect(session.usuario, 'El login debe guardar el usuario en localStorage').toBeTruthy();
  expect(session.sessionKey, 'El login debe guardar una session_key').toBeTruthy();

  // MUY IMPORTANTE:
  // playwright.config.js lee exactamente AUTH_FILE = tests/.auth/user.json.
  // El setup anterior guardaba en playwright/.auth/user.json y Chromium
  // terminaba usando una sesión vieja o vacía.
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
