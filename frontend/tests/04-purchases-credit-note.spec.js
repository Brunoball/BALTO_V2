import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import { requireMutations, searchRow } from './support/ui.js';
import {
  createStockProduct,
  createPurchase,
  editPurchaseQuantity,
  applyPurchaseCreditNote,
} from './support/flows.js';

test('@crud @critical compra: ingresa stock, edita cantidad y NC de proveedor resta stock', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('COMPRA-NC');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('COMPRA'),
    stock: 10,
    cost: 100,
    price: 160,
  });

  await createPurchase(page, { productName, quantity: 3, price: 100 });
  await editPurchaseQuantity(page, productName, 4);
  await applyPurchaseCreditNote(page, productName, 1);

  await page.goto('/panel/stock');
  const stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('13');

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /imagen/i] });
});
