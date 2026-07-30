import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import { requireMutations, searchRow } from './support/ui.js';
import {
  createStockProduct,
  createSale,
  applySaleCreditNote,
  deleteSale,
  deleteUnusedStockProduct,
} from './support/flows.js';

test('@crud @critical venta: descuenta stock y NC interna reingresa stock', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('VENTA-NC');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('VENTA'),
    stock: 10,
    cost: 100,
    price: 200,
  });

  await createSale(page, { productName, quantity: 2, price: 200 });
  await applySaleCreditNote(page, productName, 1);

  await page.goto('/panel/stock');
  const stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('9');

  // La eliminación conjunta debe revertir venta y NC, dejando el stock original.
  await page.goto('/panel/ventas');
  await deleteSale(page, productName);
  await page.goto('/panel/stock');
  const restoredRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(restoredRow.locator('[role="cell"]').nth(2)).toContainText('10');
  await deleteUnusedStockProduct(page, productName);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /imagen/i] });
});
