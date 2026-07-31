import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import { requireMutations } from './support/ui.js';
import {
  createStockProduct,
  createSale,
  createPurchase,
  payReceivable,
  payPayable,
} from './support/flows.js';

async function expectDebtSettledOrRemoved(page, {
  url,
  productName,
  searchPlaceholder,
  settledPattern,
}) {
  await expect.poll(async () => {
    await page.goto(url);

    const search = page.getByPlaceholder(searchPlaceholder).first();
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill(productName);

    // El backend puede quitar del listado una deuda saldada o conservarla
    // mostrando su estado final. Ambos comportamientos son válidos.
    await page.waitForTimeout(800);
    const rows = page.locator('.mov-gridTable--row:visible');
    const count = await rows.count();
    if (count === 0) return 'REMOVED';

    return (await rows.first().innerText()).toUpperCase();
  }, {
    timeout: 30_000,
    intervals: [1_000, 2_000, 3_000],
    message: `La deuda de ${productName} siguió pendiente después de finalizar el pago.`,
  }).toMatch(settledPattern);
}

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

  await expectDebtSettledOrRemoved(page, {
    url: '/panel/recibos',
    productName,
    searchPlaceholder: /Buscar por descripción, cliente/i,
    settledPattern: /REMOVED|PAGADO|COBRADO|SALDADO|SALDO\s*\$?\s*0(?:[,.]00)?/i,
  });

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

  await expectDebtSettledOrRemoved(page, {
    url: '/panel/OrdenesPago',
    productName,
    searchPlaceholder: /Buscar por descripción, proveedor/i,
    settledPattern: /REMOVED|PAGADO|SALDADO|SALDO\s*\$?\s*0(?:[,.]00)?/i,
  });

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/PDF/i, /orden/i, /Tienda Nube/i] });
});
