import { test, expect } from './support/test.js';
import { authenticatedApi, expectApiSuccess } from './support/api.js';

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
    const result = await authenticatedApi(page, action, {
      query: { activo: 'todos', limit: 20 },
    });
    const body = expectApiSuccess(result, `Falló ${action}`);
    expect(body).toHaveProperty(expectedKey);
  });
}

test('@servicios @smoke frontend Servicios / Insumos / Stock separados', async ({ page }) => {
  await page.goto('/panel/servicios');
  await expect(page.getByRole('heading', { name: 'Servicios' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Servicios', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Insumos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stock', exact: true })).toBeVisible();
  await expect(page.getByText('Artículos / insumos')).toHaveCount(0);
  await expect(page.getByText('Historial de stock')).toHaveCount(0);
  await expect(page.getByText('MOVIMIENTOS DE STOCK')).toHaveCount(0);
  await expect(page.getByText('Stock mínimo')).toHaveCount(0);
  await expect(page.getByText('Permitir negativo')).toHaveCount(0);
});
