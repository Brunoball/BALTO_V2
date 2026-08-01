import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import {
  clickSaveAndWait,
  closeDialog,
  requireMutations,
  searchRow,
  selectOptionValues,
} from './support/ui.js';
import {
  createStockProduct,
  createPurchase,
  editPurchaseQuantity,
  applyPurchaseCreditNote,
  applyPurchaseCreditNoteAndCapture,
  openPurchaseCreditNote,
  configurePurchaseCreditNote,
  deletePurchase,
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

function creditNoteId(body) {
  return Number(
    body?.id_nota_credito ??
      body?.data?.id_nota_credito ??
      body?.id_movimiento_nota_credito ??
      body?.data?.id_movimiento_nota_credito ??
      0,
  );
}

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
  let stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('13');

  // La rama de ajustes económicos debe ofrecer todos los motivos, usar selector
  // cerrado de IVA y no modificar el stock.
  await page.goto('/panel/compras');
  const { dialog } = await openPurchaseCreditNote(page, productName);
  const motiveSelect = dialog
    .locator('.gm-field')
    .filter({ hasText: /Motivo/i })
    .locator('select')
    .first();
  await expect((await selectOptionValues(motiveSelect)).sort()).toEqual([...CREDIT_NOTE_MOTIVES].sort());

  await configurePurchaseCreditNote(dialog, {
    motive: 'DESCUENTO',
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
  await expect(stockRow.locator('[role="cell"]').nth(2)).toContainText('13');

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /imagen/i] });
});

test('@crud @critical NC compra: backend rechaza IVA manipulado fuera del selector', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('COMPRA-NC-IVA');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('COMPRAIVA'),
    stock: 5,
    cost: 100,
    price: 160,
  });
  await createPurchase(page, { productName, quantity: 2, price: 100 });

  let intercepted = false;
  await page.route('**/api.php?action=compras_nota_credito_crear**', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }

    const payload = request.postDataJSON();
    payload.iva_pct_ajuste = 15;
    intercepted = true;
    await route.continue({ postData: JSON.stringify(payload) });
  });

  const { dialog } = await openPurchaseCreditNote(page, productName);
  await configurePurchaseCreditNote(dialog, {
    motive: 'BONIFICACION',
    amount: 10,
    ivaPct: 21,
  });

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('action=compras_nota_credito_crear') &&
      response.request().method() === 'POST',
  );

  await dialog.getByRole('button', { name: /Aplicar nota de crédito/i }).last().click();
  const response = await responsePromise;
  const body = await response.json().catch(() => ({}));

  expect(intercepted, 'La prueba debe haber manipulado el IVA enviado al backend').toBe(true);
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(String(body?.mensaje || body?.message || '')).toMatch(/IVA|10,5|21|27/i);
  await expect(dialog).toBeVisible();
  await closeDialog(dialog);

  await page.unroute('**/api.php?action=compras_nota_credito_crear**');
  await page.goto('/panel/compras');
  await deletePurchase(page, productName);
  await page.goto('/panel/stock');
  await deleteUnusedStockProduct(page, productName);

  await assertNoCriticalErrors(diagnostics, testInfo, {
    allowConsole: [
      /Tienda Nube/i,
      /imagen/i,
      // Esta respuesta 422 es el resultado esperado de la manipulación intencional de IVA.
      /Failed to load resource: the server responded with a status of 422/i,
    ],
  });
});

test('@crud @critical NC compra: ejecuta realmente los seis motivos y valida su impacto de stock', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  test.setTimeout(9 * 60_000);
  const diagnostics = installDiagnostics(page);
  const productName = uniqueName('COMPRA-NC-SEIS-MOTIVOS');
  const totalProductName = uniqueName('COMPRA-NC-ANULACION-TOTAL');

  await createStockProduct(page, {
    name: productName,
    sku: uniqueSku('COMPRANC6'),
    stock: 12,
    cost: 100,
    price: 160,
  });
  await createStockProduct(page, {
    name: totalProductName,
    sku: uniqueSku('COMPRANCTOTAL'),
    stock: 4,
    cost: 100,
    price: 160,
  });
  await createPurchase(page, { productName, quantity: 6, price: 100 });
  await createPurchase(page, { productName: totalProductName, quantity: 2, price: 100 });

  const applied = [];
  const apply = async (targetProduct, options) => {
    await page.goto('/panel/compras');
    const result = await applyPurchaseCreditNoteAndCapture(page, targetProduct, options);
    expect(creditNoteId(result.body), `El motivo ${options.motive} debe crear una nota identificable`).toBeGreaterThan(0);
    applied.push(options.motive);
  };

  await apply(productName, { motive: 'DEVOLUCION_MERCADERIA', quantity: 1 });
  for (const motive of ['DESCUENTO', 'BONIFICACION', 'DIFERENCIA_PRECIO', 'OTRO']) {
    await apply(productName, { motive, amount: 5, ivaPct: 21 });
  }

  await page.goto('/panel/stock');
  let stockRow = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await expect(
    stockRow.locator('[role="cell"]').nth(2),
    'Sólo DEVOLUCION_MERCADERIA debe restar stock; los cuatro ajustes económicos no deben tocarlo',
  ).toContainText('17');

  // ANULACION_TOTAL se prueba sobre una compra independiente. Si se aplica
  // después de ajustes económicos sobre la misma compra, el modal selecciona
  // todas las unidades pero el saldo monetario ya es menor y la UI la bloquea
  // correctamente por exceder el disponible.
  await apply(totalProductName, { motive: 'ANULACION_TOTAL' });
  expect([...applied].sort()).toEqual([...CREDIT_NOTE_MOTIVES].sort());

  await page.goto('/panel/stock');
  stockRow = await searchRow(page, totalProductName, /Buscar por nombre, SKU o variante/i);
  await expect(
    stockRow.locator('[role="cell"]').nth(2),
    'La anulación total debe retirar toda la compra independiente y dejar su stock original',
  ).toContainText('4');

  await page.goto('/panel/compras');
  await deletePurchase(page, productName);
  await deletePurchase(page, totalProductName);
  await page.goto('/panel/stock');
  await deleteUnusedStockProduct(page, productName);
  await deleteUnusedStockProduct(page, totalProductName);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/Tienda Nube/i, /imagen/i] });
});
