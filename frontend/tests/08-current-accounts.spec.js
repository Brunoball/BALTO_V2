import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import { requireMutations, searchRow } from './support/ui.js';
import {
  createStockProduct,
  createSale,
  createPurchase,
  payReceivable,
  payPayable,
} from './support/flows.js';

test('@crud @critical cuenta corriente cliente: venta pendiente y recibo completo', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('CC-CLIENTE');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('CCCLI'),
    stock: 5,
    cost: 100,
    price: 220,
  });
  await createSale(page, { productName, quantity: 1, price: 220 });
  await payReceivable(page, productName);

  await page.goto('/panel/recibos');
  const row = await searchRow(page, productName, /Buscar por descripción, cliente/i);
  await expect(row).toContainText(/PAGADO|COBRADO|SALDADO/i);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/PDF/i, /recibo/i, /Tienda Nube/i] });
});

test('@crud @critical cuenta corriente proveedor: compra pendiente y orden de pago completa', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('CC-PROVEEDOR');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('CCPROV'),
    stock: 2,
    cost: 90,
    price: 170,
  });
  await createPurchase(page, { productName, quantity: 1, price: 90 });
  await payPayable(page, productName);

  await page.goto('/panel/OrdenesPago');
  const row = await searchRow(page, productName, /Buscar por descripción, proveedor/i);
  await expect(row).toContainText(/PAGADO|SALDADO/i);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/PDF/i, /orden/i, /Tienda Nube/i] });
});
