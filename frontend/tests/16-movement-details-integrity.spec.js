import { test, expect } from '@playwright/test';
import { uniqueName, uniqueSku } from './support/data.js';
import { closeDialog, requireMutations, searchRow, waitForBusyToFinish } from './support/ui.js';
import {
  createBudget,
  createOtherExpense,
  createOtherIncome,
  createPurchase,
  createSale,
  createStockProduct,
} from './support/flows.js';

function parseDisplayedNumber(value) {
  let normalized = String(value || '').replace(/[^0-9,.-]/g, '');
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

async function expectMoney(locator, expected, label) {
  const text = await locator.innerText();
  expect(parseDisplayedNumber(text), `${label}: se mostró "${text}"`).toBeCloseTo(expected, 2);
}

async function expectMovementDetail(dialog, expected) {
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog, 'El modal debe mostrar el concepto/producto exacto').toContainText(expected.description);
  if (expected.thirdParty) {
    await expect(dialog, 'El modal debe mostrar el cliente/proveedor correcto').toContainText(expected.thirdParty);
  }

  const itemRow = dialog
    .locator('.mdm-table--items .mdm-table__row:not(.mdm-table__row--head)')
    .filter({ hasText: expected.description })
    .first();
  await expect(itemRow, `Debe existir la línea de detalle ${expected.description}`).toBeVisible({ timeout: 20_000 });
  const cells = itemRow.locator(':scope > span');
  await expect(cells).toHaveCount(6);
  expect(
    parseDisplayedNumber(await cells.nth(1).innerText()),
    'La cantidad del modal debe coincidir con la guardada',
  ).toBeCloseTo(expected.quantity, 3);
  await expectMoney(cells.nth(2), expected.price, 'Precio incorrecto en el modal');
  await expectMoney(cells.nth(5), expected.total, 'Total incorrecto en el modal');
}

async function openModuleDetail(row, expected, title = /Ver información completa/i) {
  await row.getByTitle(title).click();
  const dialog = row.page().getByRole('dialog').last();
  await expectMovementDetail(dialog, expected);
  await closeDialog(dialog);
}

async function assertGlobalDetail(page, query, expected) {
  await page.goto('/panel/movimientos');
  await waitForBusyToFinish(page);
  const search = page.getByPlaceholder(
    /Buscar por descripción, cliente, proveedor, medio de pago/i,
  ).first();
  await expect(search).toBeVisible();

  const responsePromise = page.waitForResponse(
    (response) => {
      if (response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.searchParams.get('action') === 'movimientos_listar' && url.searchParams.get('q') === query;
    },
    { timeout: 45_000 },
  );

  await search.fill(query);
  await search.press('Enter');
  const response = await responsePromise;
  const body = await response.json().catch(() => ({}));
  expect(response.status(), JSON.stringify(body)).toBeLessThan(400);

  const returned = Array.isArray(body?.movimientos) ? body.movimientos : [];
  const exactMovement = returned.find((movement) => {
    const items = Array.isArray(movement?.items_detalle) ? movement.items_detalle : [];
    return items.some((item) =>
      [item?.descripcion, item?.detalle, item?.nombre, item?.producto_nombre, item?.stock_producto_nombre]
        .some((value) => String(value || '').includes(expected.description)),
    );
  });
  expect(
    exactMovement,
    `La búsqueda global debe devolver el movimiento que contiene ${expected.description}`,
  ).toBeTruthy();

  await waitForBusyToFinish(page);
  const rows = page.locator('.mov-gridTable--row:visible:not(.mov-row--skeleton)');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const row = rows.first();
  await openModuleDetail(row, expected, /Ver información completa del movimiento/i);
}

test('@crud @critical modales: cada módulo y Movimientos muestran los datos exactos guardados', async ({ page }) => {
  await requireMutations(test, page);
  test.setTimeout(8 * 60_000);

  const purchaseProduct = uniqueName('DETALLE-COMPRA');
  const saleProduct = uniqueName('DETALLE-VENTA');
  const incomeDescription = uniqueName('DETALLE-INGRESO');
  const expenseDescription = uniqueName('DETALLE-EGRESO');
  const budgetProduct = uniqueName('DETALLE-PRESUPUESTO');

  await createStockProduct(page, {
    name: purchaseProduct,
    sku: uniqueSku('DETCOMPRA'),
    stock: 3,
    cost: 137,
    price: 190,
  });
  await createStockProduct(page, {
    name: saleProduct,
    sku: uniqueSku('DETVENTA'),
    stock: 10,
    cost: 120,
    price: 211,
  });
  await createStockProduct(page, {
    name: budgetProduct,
    sku: uniqueSku('DETPRESU'),
    stock: 10,
    cost: 100,
    price: 199,
  });

  const purchaseData = { productName: purchaseProduct, quantity: 2, price: 137 };
  const purchaseRow = await createPurchase(page, purchaseData);
  const purchaseExpected = {
    description: purchaseProduct,
    thirdParty: String(purchaseData.providerName || '').split('\n')[0].trim(),
    quantity: 2,
    price: 137,
    total: 274,
  };
  await openModuleDetail(purchaseRow, purchaseExpected);

  const saleData = { productName: saleProduct, quantity: 3, price: 211 };
  const saleRow = await createSale(page, saleData);
  const saleExpected = {
    description: saleProduct,
    thirdParty: String(saleData.clientName || '').split('\n')[0].trim(),
    quantity: 3,
    price: 211,
    total: 633,
  };
  await openModuleDetail(saleRow, saleExpected);

  const incomeRow = await createOtherIncome(page, {
    description: incomeDescription,
    quantity: 2,
    amount: 83,
  });
  const incomeExpected = {
    description: incomeDescription,
    quantity: 2,
    price: 83,
    total: 166,
  };
  await openModuleDetail(incomeRow, incomeExpected);

  const expenseRow = await createOtherExpense(page, {
    description: expenseDescription,
    quantity: 3,
    amount: 47,
  });
  const expenseExpected = {
    description: expenseDescription,
    quantity: 3,
    price: 47,
    total: 141,
  };
  await openModuleDetail(expenseRow, expenseExpected);

  const budgetData = { productName: budgetProduct, quantity: 4, price: 199, ivaPct: 0 };
  const budgetRow = await createBudget(page, budgetData);
  const budgetExpected = {
    description: budgetProduct,
    thirdParty: String(budgetData.clientName || '').split('\n')[0].trim(),
    quantity: 4,
    price: 199,
    total: 796,
  };
  await openModuleDetail(budgetRow, budgetExpected, /Ver información completa del presupuesto/i);

  // Recibos y Órdenes de Pago deben mostrar el mismo detalle exacto de la deuda origen.
  await page.goto('/panel/recibos');
  const receiptDebt = await searchRow(page, saleProduct, /Buscar por descripción, cliente/i);
  await openModuleDetail(receiptDebt, saleExpected, /Ver detalle de la deuda/i);

  await page.goto('/panel/OrdenesPago');
  const payableDebt = await searchRow(page, purchaseProduct, /Buscar por descripción, proveedor/i);
  await openModuleDetail(payableDebt, purchaseExpected, /Ver detalle de la deuda/i);

  // La vista central debe conservar exactamente los mismos datos, no una descripción mezclada.
  await assertGlobalDetail(page, purchaseProduct, purchaseExpected);
  await assertGlobalDetail(page, saleProduct, saleExpected);
  await assertGlobalDetail(page, incomeDescription, incomeExpected);
  await assertGlobalDetail(page, expenseDescription, expenseExpected);
  await assertGlobalDetail(page, budgetProduct, budgetExpected);
});
