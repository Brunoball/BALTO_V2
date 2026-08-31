import { test, expect } from './support/test.js';
import { authenticatedApi, expectApiSuccess } from './support/api.js';

async function ensureAuthenticatedOrigin(page) {
  // authenticatedApi lee token/session desde localStorage. En una Page nueva
  // Playwright arranca en about:blank, donde localStorage no está disponible.
  // Navegar primero al frontend aplica el storageState del proyecto y deja la
  // página en un origen válido antes de consultar la API.
  if (!/^https?:/i.test(page.url())) {
    await page.goto('/panel/servicios', { waitUntil: 'domcontentloaded' });
  }
}

const readActions = [
  ['servicios_ping', 'module'],
  ['servicios_resumen', 'resumen'],
  ['servicios_unidades_listar', 'unidades'],
  ['servicios_categorias_listar', 'categorias'],
  ['servicios_insumos_categorias_listar', 'categorias'],
  ['servicios_insumos_listar', 'insumos'],
  ['servicios_stock_categorias_listar', 'categorias'],
  ['servicios_stock_listar', 'stock'],
  ['servicios_catalogo_listar', 'servicios'],
];

for (const [action, expectedKey] of readActions) {
  test(`@servicios @smoke backend ${action}`, async ({ page }) => {
    await ensureAuthenticatedOrigin(page);
    const result = await authenticatedApi(page, action, {
      query: { activo: 'todos', limit: 20 },
    });
    const body = expectApiSuccess(result, `Falló ${action}`);
    expect(body).toHaveProperty(expectedKey);
  });
}

test('@servicios @smoke frontend Servicios limpio y composición buscable', async ({ page }) => {
  await page.goto('/panel/servicios');
  await expect(page.getByRole('heading', { name: 'Servicios', level: 1, exact: true })).toBeVisible();

  await expect(page.getByLabel('Sección')).toHaveCount(0);
  await expect(page.locator('.servicios-section-switch')).toHaveCount(0);
  await expect(page.locator('.servicios-tabs')).toHaveCount(0);
  await expect(page.locator('.servicios-summary')).toHaveCount(0);
  await expect(page.getByText('Servicios activos')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Actualizar' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Agregar servicio' }).click();
  await expect(page.getByText('COMPOSICIÓN DEL SERVICIO')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insumos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Productos de Stock' })).toBeVisible();

  const ivaSelect = page
    .locator('.servicios-field')
    .filter({ hasText: /^IVA %/ })
    .locator('select')
    .first();
  await expect(ivaSelect.locator('option')).toHaveCount(4);
  expect(await ivaSelect.locator('option').evaluateAll((options) => options.map((option) => option.value)))
    .toEqual(['0', '10.5', '21', '27']);

  await page.getByRole('button', { name: 'SELECCIONAR INSUMO' }).click();
  await expect(page.getByPlaceholder('BUSCAR INSUMO...')).toBeVisible();

  await page.getByRole('button', { name: 'SELECCIONAR PRODUCTO DE STOCK' }).click();
  await expect(page.getByPlaceholder('BUSCAR PRODUCTO DE STOCK...')).toBeVisible();
});
