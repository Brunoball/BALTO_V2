import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import { requireMutations, searchRow } from './support/ui.js';
import {
  createStockProduct,
  createBudget,
  convertBudgetToSale,
  deleteBudget,
  prepareBudgetConversion,
  deleteSale,
  deleteUnusedStockProduct,
} from './support/flows.js';

test('@crud @critical presupuesto: crear, eliminar y convertir sin doble impacto', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('PRESUPUESTO-CONVERTIR');
  const disposableName = uniqueName('PRESUPUESTO-ELIMINAR');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('PRESU'),
    stock: 10,
    cost: 100,
    price: 180,
  });
  await createStockProduct(page, {
    name: disposableName,
    sku: uniqueSku('PRESUDEL'),
    stock: 3,
    cost: 80,
    price: 140,
  });

  await createBudget(page, { productName: disposableName, quantity: 1, price: 140 });
  await deleteBudget(page, disposableName);

  await createBudget(page, { productName, quantity: 1, price: 180 });
  await convertBudgetToSale(page, productName);

  // Segundo intento: el botón debe quedar marcado como ya convertido y no crear otra venta.
  const convertedRow = await searchRow(page, productName, /Buscar por descripción/i);
  await expect(convertedRow.getByTitle(/Presupuesto ya asignado como venta/i)).toBeVisible();

  await page.goto('/panel/stock');
  const stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('9');

  // Eliminar la venta libera la conversión; luego se limpian presupuesto y productos de prueba.
  await page.goto('/panel/ventas');
  await deleteSale(page, productName);
  await page.goto('/panel/presupuesto');
  await deleteBudget(page, productName);
  await page.goto('/panel/stock');
  await deleteUnusedStockProduct(page, productName);
  await deleteUnusedStockProduct(page, disposableName);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /PDF/i, /imagen/i] });
});


test('@crud @critical presupuesto: dos pestañas no pueden convertirlo dos veces', async ({ page, context }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('PRESUPUESTO-CONCURRENCIA');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('PRESUCONC'),
    stock: 10,
    cost: 100,
    price: 180,
  });
  await createBudget(page, { productName, quantity: 1, price: 180 });

  const secondPage = await context.newPage();
  const first = await prepareBudgetConversion(page, productName);
  await secondPage.goto('/panel/presupuesto');
  const second = await prepareBudgetConversion(secondPage, productName);

  await Promise.allSettled([first.action.click(), second.action.click()]);
  await page.waitForTimeout(4_000);

  const verifier = await context.newPage();
  await verifier.goto('/panel/ventas');
  const search = verifier.getByPlaceholder(/Buscar por descripción, cliente/i);
  await search.fill(productName);
  await search.press('Enter');
  const sales = verifier.locator('.mov-gridTable--row').filter({ hasText: productName });
  await expect(sales, 'El presupuesto debe originar exactamente una venta').toHaveCount(1, { timeout: 30_000 });

  await verifier.goto('/panel/stock');
  const stockRow = await searchRow(verifier, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('9');

  // Limpieza controlada: borrar la única venta libera el presupuesto.
  await verifier.goto('/panel/ventas');
  await deleteSale(verifier, productName);
  await verifier.goto('/panel/presupuesto');
  await deleteBudget(verifier, productName);
  await verifier.goto('/panel/stock');
  await deleteUnusedStockProduct(verifier, productName);

  await secondPage.close();
  await verifier.close();
  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/ya fue convertido/i, /Tienda Nube/i, /PDF/i, /imagen/i] });
});
