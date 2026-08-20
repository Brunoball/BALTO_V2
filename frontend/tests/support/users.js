import { expect } from '@playwright/test';
import { authenticatedApi, expectApiSuccess } from './api.js';
import { ENV } from './env.js';

export async function createEmployeeTestUser(page, username, password) {
  // authenticatedApi lee la sesión desde localStorage. Un Page recién creado puede
  // seguir en about:blank, donde Chromium bloquea localStorage con SecurityError.
  // Entramos primero al origen de Balto para usar la sesión del storageState.
  if (!/^https?:/i.test(String(page.url() || ''))) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  const list = await authenticatedApi(page, 'configuracion_usuarios_listar');
  const body = expectApiSuccess(list, 'No se pudieron listar roles para crear el empleado E2E');
  const employeeRole = (Array.isArray(body?.roles) ? body.roles : []).find(
    (role) => String(role?.tipo_rol || '').toLowerCase() === 'empleado_basico',
  );
  const roleId = Number(employeeRole?.id_rol || 0);
  expect(roleId, 'Debe existir el rol empleado_basico').toBeGreaterThan(0);

  const create = await authenticatedApi(page, 'configuracion_usuarios_guardar', {
    method: 'POST',
    body: {
      usuario: username,
      email_recuperacion: `${String(username).toLowerCase()}@example.test`,
      id_rol: roleId,
      idRolMaster: roleId,
      tema: 'claro',
      activo: 1,
      contrasena: password,
    },
  });
  expectApiSuccess(create, 'No se pudo crear el empleado E2E');
  return create.body;
}

export async function cleanupTestUser(page, username) {
  try {
    const list = await authenticatedApi(page, 'configuracion_usuarios_listar');
    if (!list.ok || list.body?.exito === false) return;
    const user = (Array.isArray(list.body?.usuarios) ? list.body.usuarios : []).find(
      (row) => String(row?.usuario || '').trim().toUpperCase() === String(username).trim().toUpperCase(),
    );
    const id = Number(user?.idUsuarioMaster || user?.id_usuario_master || 0);
    if (!id) return;
    await authenticatedApi(page, 'configuracion_usuarios_eliminar', {
      method: 'POST',
      body: { idUsuarioMaster: id },
    });
  } catch {
    // El cleanup global PW también identifica y elimina usuarios de prueba.
  }
}

export async function loginTestUserInNewContext(browser, username, password) {
  const context = await browser.newContext({
    baseURL: ENV.baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByPlaceholder('Usuario').fill(username);
  await page.getByPlaceholder('Contraseña').fill(password);
  await Promise.all([
    page.waitForURL(/\/panel(?:\/|$)/, { timeout: 30_000 }),
    page.getByRole('button', { name: /ACCEDER/i }).click(),
  ]);
  return { context, page };
}
