import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import {
  clickSaveAndWait,
  requireMutations,
  searchRow,
  selectOptionValues,
} from './support/ui.js';
import {
  createStockProduct,
  createSale,
  applySaleCreditNote,
  openSaleCreditNote,
  configureSaleCreditNote,
  deleteSale,
  deleteUnusedStockProduct,
} from './support/flows.js';

const CREDIT_NOTE_MOTIVES = [
  'DEVOLUCION_MERCADERIA',
  'ANULACION_TOTAL',
  'DESCUENTO',
  'BONIFICACION',
  'DIFERENCIA_PRECIO',
  'OTRO',
];

const IVA_VALUES = ['0', '10.5', '21', '27'];

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
  let stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('9');

  // Los ajustes sin stock comparten una rama distinta. Deben exponer todas las
  // opciones, usar el selector cerrado de IVA y conservar el stock.
  await page.goto('/panel/ventas');
  const { dialog } = await openSaleCreditNote(page, productName);
  const motiveSelect = dialog
    .locator('.gm-field')
    .filter({ hasText: /Motivo/i })
    .locator('select')
    .first();
  await expect((await selectOptionValues(motiveSelect)).sort()).toEqual([...CREDIT_NOTE_MOTIVES].sort());

  await configureSaleCreditNote(dialog, {
    motive: 'DIFERENCIA_PRECIO',
    amount: 10,
    ivaPct: 21,
  });

  const ivaSelect = dialog
    .locator('.gm-field')
    .filter({ hasText: /IVA % incluido/i })
    .locator('select')
    .first();
  await expect(await selectOptionValues(ivaSelect)).toEqual(IVA_VALUES);
  await clickSaveAndWait(dialog, /Aplicar nota de crédito/i, { timeout: 60_000 });

  await page.goto('/panel/stock');
  stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('9');

  // La eliminación conjunta debe revertir venta y todas sus NC, dejando el stock original.
  await page.goto('/panel/ventas');
  await deleteSale(page, productName);
  await page.goto('/panel/stock');
  const restoredRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(restoredRow.locator('[role="cell"]').nth(2)).toContainText('10');
  await deleteUnusedStockProduct(page, productName);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /imagen/i] });
});

test('@crud @critical NC venta: repetir la misma petición no duplica nota ni stock', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('VENTA-NC-IDEMPOTENCIA');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('VENTANCIDEM'),
    stock: 10,
    cost: 100,
    price: 200,
  });
  await createSale(page, { productName, quantity: 2, price: 200 });

  let firstBody = null;
  let duplicateBody = null;
  let duplicateStatus = 0;

  await page.route('**/api.php?action=ventas_nota_credito_crear**', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }

    const payload = request.postDataJSON();
    const firstResponse = await route.fetch();
    firstBody = await firstResponse.json().catch(() => ({}));

    const requestHeaders = request.headers();
    const duplicateHeaders = {};
    for (const name of ['content-type', 'x-session', 'authorization']) {
      if (requestHeaders[name]) duplicateHeaders[name] = requestHeaders[name];
    }

    const duplicateResponse = await page.request.post(request.url(), {
      headers: duplicateHeaders,
      data: payload,
    });
    duplicateStatus = duplicateResponse.status();
    duplicateBody = await duplicateResponse.json().catch(() => ({}));

    await route.fulfill({ response: firstResponse });
  });

  await applySaleCreditNote(page, productName, 1);

  expect(duplicateStatus).toBeLessThan(400);
  const firstId = Number(
    firstBody?.id_nota_credito ??
      firstBody?.data?.id_nota_credito ??
      firstBody?.id_movimiento_nota_credito ??
      firstBody?.data?.id_movimiento_nota_credito ??
      0,
  );
  const duplicateId = Number(
    duplicateBody?.id_nota_credito ??
      duplicateBody?.data?.id_nota_credito ??
      duplicateBody?.id_movimiento_nota_credito ??
      duplicateBody?.data?.id_movimiento_nota_credito ??
      0,
  );
  expect(firstId, 'La primera petición debe crear o recuperar una nota').toBeGreaterThan(0);
  expect(duplicateId, 'La petición repetida debe devolver la misma nota').toBe(firstId);

  await page.goto('/panel/stock');
  const stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(
    stockRow.locator('[role="cell"]').nth(2),
    'La devolución de una unidad debe impactar una sola vez',
  ).toContainText('9');

  await page.unroute('**/api.php?action=ventas_nota_credito_crear**');
  await page.goto('/panel/ventas');
  await deleteSale(page, productName);
  await page.goto('/panel/stock');
  await deleteUnusedStockProduct(page, productName);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /imagen/i] });
});
