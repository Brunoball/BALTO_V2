import { expect } from '@playwright/test';
import {
  clickSaveAndWait,
  completeRemainingAmount,
  fillMovementRow,
  fillPayment,
  searchRow,
  selectFirstAutocomplete,
  selectFirstNonEmpty,
  selectMovementMode,
  waitDialog,
  waitForBusyToFinish,
} from './ui.js';

export async function createStockProduct(page, product) {
  await page.goto('/panel/stock');
  await waitForBusyToFinish(page);
  await page.getByRole('button', { name: /Agregar producto/i }).first().click();

  const dialog = await waitDialog(page, 'Productos');
  await dialog.locator('input[name="nombre"]').fill(product.name);
  await dialog.locator('input[name="sku"]').fill(product.sku);
  await dialog.locator('input[name="stock"]').fill(String(product.stock ?? 10));
  await dialog.locator('input[name="precio_costo"]').fill(String(product.cost ?? 100));
  await dialog.locator('input[name="precio_costo"]').blur();
  await dialog.locator('input[name="precio"]').fill(String(product.price ?? 150));
  await dialog.locator('input[name="precio"]').blur();

  await clickSaveAndWait(dialog, /Guardar producto/i, { timeout: 90_000 });
  const row = await searchRow(page, product.name, /Buscar por nombre, SKU o variante/i);
  await expect(row).toContainText(product.sku);
  return row;
}

export async function editStockProduct(page, productName, updates) {
  const row = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await row.getByTitle('Editar').click();
  const dialog = await waitDialog(page, 'Editar producto');

  if (updates.name) await dialog.locator('input[name="nombre"]').fill(updates.name);
  if (updates.stock !== undefined) await dialog.locator('input[name="stock"]').fill(String(updates.stock));
  if (updates.price !== undefined) {
    await dialog.locator('input[name="precio"]').fill(String(updates.price));
    await dialog.locator('input[name="precio"]').blur();
  }

  await clickSaveAndWait(dialog, /Guardar cambios/i, { timeout: 90_000 });
  return searchRow(page, updates.name || productName, /Buscar por nombre, SKU o variante/i);
}

function requestAction(request) {
  const actionFromUrl = new URL(request.url()).searchParams.get('action');
  if (actionFromUrl) return actionFromUrl;

  try {
    const body = request.postDataJSON();
    if (body && typeof body.action === 'string') return body.action;
  } catch {
    // Puede ser application/x-www-form-urlencoded o multipart/form-data.
  }

  const rawBody = request.postData() || '';
  const match = rawBody.match(/(?:^|[&\r\n])action(?:=|%3D)([^&\r\n]+)/i);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
}

export async function deleteUnusedStockProduct(page, productName) {
  // Cada prueba crea un producto temporal y lo elimina al final. El modal de
  // confirmación se cierra apenas comienza el request, no cuando termina el
  // DELETE en la base. Esperar solo el cierre del modal generaba una carrera:
  // la prueba buscaba el producto mientras la eliminación todavía seguía en curso.
  await page.goto('/panel/stock');
  await waitForBusyToFinish(page);

  const row = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  const productId = Number(await row.getAttribute('data-stock-product-id'));
  expect(productId, `La fila de ${productName} debe exponer su ID real`).toBeGreaterThan(0);

  const deleteButton = row.getByTitle('Eliminar producto definitivamente');
  await expect(deleteButton, `Debe existir la acción de eliminar para ${productName}`).toBeVisible({ timeout: 20_000 });
  await deleteButton.click();

  const first = await waitDialog(page, 'Eliminar producto definitivamente');
  const continueButton = first.getByRole('button', { name: /Eliminar/i }).last();
  await expect(continueButton).toBeEnabled({ timeout: 20_000 });
  await continueButton.click();

  const finalDialog = await waitDialog(page, 'Confirmación final');
  const confirmButton = finalDialog.getByRole('button', { name: /Sí, eliminar para siempre/i }).last();
  await expect(confirmButton).toBeEnabled({ timeout: 20_000 });

  const deleteResponsePromise = page.waitForResponse(
    (response) => {
      const request = response.request();
      if (request.method() !== 'POST') return false;
      return [
        'stock_producto_eliminar_permanente',
        'stock_productos_eliminar_permanente',
      ].includes(requestAction(request));
    },
    { timeout: 120_000 },
  );

  await confirmButton.click();
  await expect(finalDialog).toBeHidden({ timeout: 20_000 });

  const deleteResponse = await deleteResponsePromise;
  expect(
    deleteResponse.ok(),
    `La eliminación definitiva de ${productName} respondió HTTP ${deleteResponse.status()}`,
  ).toBeTruthy();

  const deletePayload = await deleteResponse.json().catch(() => null);
  expect(
    deletePayload?.exito === true || deletePayload?.success === true,
    deletePayload?.mensaje || `El backend no confirmó la eliminación definitiva de ${productName}`,
  ).toBeTruthy();

  const deleteData = deletePayload?.data || deletePayload || {};
  const deletedProductId = Number(
    deletePayload?.id_stock_producto ?? deleteData?.id_stock_producto ?? 0,
  );
  expect(
    deletedProductId,
    `El backend debe confirmar el ID eliminado de ${productName}`,
  ).toBe(productId);
  expect(
    deletePayload?.eliminado_permanente === true || deleteData?.eliminado_permanente === true,
    `El backend respondió, pero no confirmó la eliminación permanente de ${productName}`,
  ).toBeTruthy();

  const deleteDb = deletePayload?.db || deleteData?.db || {};
  expect(
    Number(deleteDb?.producto_eliminado ?? 0),
    `La transacción no informó la eliminación física de ${productName}`,
  ).toBe(1);

  // La respuesta anterior confirma que la transacción terminó. Una recarga evita
  // validar contra la fila React que estaba renderizada antes del COMMIT.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBusyToFinish(page);

  const search = page.getByPlaceholder(/Buscar por nombre, SKU o variante/i).first();
  await expect(search).toBeVisible({ timeout: 20_000 });
  await search.fill(productName);
  await search.press('Enter');
  await page.waitForTimeout(450);
  await waitForBusyToFinish(page);

  await expect(
    page.locator(`.mov-gridTable--row:visible:not(.mov-row--skeleton)[data-stock-product-id="${productId}"]`),
    `El producto ${productName} no debe seguir visible después de la eliminación confirmada por el backend`,
  ).toHaveCount(0, { timeout: 30_000 });
}

export async function createPurchase(page, data) {
  await page.goto('/panel/compras');
  await waitForBusyToFinish(page);
  await page.getByTitle('Crear nueva compra').click();
  const dialog = await waitDialog(page, 'Nueva Compra');

  await fillMovementRow(dialog, {
    productName: data.productName,
    quantity: data.quantity ?? 2,
    price: data.price ?? 100,
  });
  data.providerName = await selectFirstAutocomplete(dialog, 'Proveedor');
  const mode = await selectMovementMode(dialog, 'Forma de compra', /CUENTA\s*CORRIENTE/i);
  if (/CONTADO/i.test(mode.text)) await fillPayment(dialog);

  await clickSaveAndWait(dialog, /Guardar compra/i, { timeout: 60_000 });
  return searchRow(page, data.productName, /Buscar por descripción, proveedor/i);
}

export async function editPurchaseQuantity(page, productName, quantity) {
  const row = await searchRow(page, productName, /Buscar por descripción, proveedor/i);
  await row.getByTitle('Editar').click();
  const dialog = await waitDialog(page, 'Editar compra');
  const itemRow = dialog.locator('.gm-table-body .gm-table-row').first();
  const qty = itemRow.locator('input[type="number"]').first();
  await qty.fill(String(quantity));
  await qty.blur();
  await clickSaveAndWait(dialog, /Guardar cambios/i, { timeout: 60_000 });
  return searchRow(page, productName, /Buscar por descripción, proveedor/i);
}

export async function openPurchaseCreditNote(page, productName) {
  const row = await searchRow(page, productName, /Buscar por descripción, proveedor/i);
  await row.getByTitle(/Aplicar nota de crédito/i).click();
  const dialog = await waitDialog(page, 'Aplicar nota de crédito del proveedor');
  return { row, dialog };
}

export async function configurePurchaseCreditNote(dialog, options = {}) {
  const normalized = typeof options === 'number' ? { quantity: options } : options;
  const motive = normalized.motive || 'DEVOLUCION_MERCADERIA';

  const motiveSelect = dialog
    .locator('.gm-field')
    .filter({ hasText: /Motivo/i })
    .locator('select')
    .first();
  await expect(motiveSelect).toBeVisible();
  await motiveSelect.selectOption(motive);

  if (['DESCUENTO', 'BONIFICACION', 'DIFERENCIA_PRECIO', 'OTRO'].includes(motive)) {
    const amount = dialog
      .locator('.gm-field')
      .filter({ hasText: /Importe final/i })
      .locator('input[type="number"]')
      .first();
    await expect(amount).toBeVisible();
    await amount.fill(String(normalized.amount ?? 10));

    const ivaSelect = dialog
      .locator('.gm-field')
      .filter({ hasText: /IVA % incluido/i })
      .locator('select')
      .first();
    await expect(ivaSelect).toBeVisible();
    await ivaSelect.selectOption(String(normalized.ivaPct ?? 21));
  } else if (motive !== 'ANULACION_TOTAL') {
    const qty = dialog.locator('.ncp-quantity-input, table tbody input[type="number"]').first();
    await expect(qty).toBeVisible();
    await qty.fill(String(normalized.quantity ?? 1));
  }

  return { motiveSelect };
}

export async function applyPurchaseCreditNote(page, productName, options = 1) {
  const { dialog } = await openPurchaseCreditNote(page, productName);
  await configurePurchaseCreditNote(dialog, options);
  await clickSaveAndWait(dialog, /Aplicar nota de crédito/i, { timeout: 60_000 });
  return searchRow(page, productName, /Buscar por descripción, proveedor/i);
}

export async function createSale(page, data) {
  await page.goto('/panel/ventas');
  await waitForBusyToFinish(page);
  await page.getByRole('button', { name: /Nueva Venta/i }).click();
  const dialog = await waitDialog(page, 'Nueva Venta');

  await fillMovementRow(dialog, {
    productName: data.productName,
    quantity: data.quantity ?? 2,
    price: data.price ?? 150,
  });
  data.clientName = await selectFirstAutocomplete(dialog, 'Cliente');

  const typeField = dialog.locator('.gm-field').filter({ hasText: 'Forma de venta' }).first();
  const typeSelect = typeField.locator('select');
  const selected = await selectFirstNonEmpty(typeSelect, /CUENTA\s*CORRIENTE/i);
  if (/CONTADO/i.test(selected.text)) await fillPayment(dialog);

  await clickSaveAndWait(dialog, /Guardar venta/i, { timeout: 60_000 });
  return searchRow(page, data.productName, /Buscar por descripción, cliente/i);
}

export async function openSaleCreditNote(page, productName) {
  const row = await searchRow(page, productName, /Buscar por descripción, cliente/i);
  await row.getByTitle('Emitir nota de crédito').click();
  const dialog = await waitDialog(page, 'Nota de crédito');
  return { row, dialog };
}

export async function configureSaleCreditNote(dialog, options = {}) {
  const normalized = typeof options === 'number' ? { quantity: options } : options;
  const motive = normalized.motive || 'DEVOLUCION_MERCADERIA';

  const motiveSelect = dialog
    .locator('.gm-field')
    .filter({ hasText: /Motivo/i })
    .locator('select')
    .first();
  await expect(motiveSelect).toBeVisible();
  await motiveSelect.selectOption(motive);

  if (['DESCUENTO', 'BONIFICACION', 'DIFERENCIA_PRECIO', 'OTRO'].includes(motive)) {
    const amount = dialog
      .locator('.gm-field')
      .filter({ hasText: /Importe total/i })
      .locator('input[type="number"]')
      .first();
    await expect(amount).toBeVisible();
    await amount.fill(String(normalized.amount ?? 10));

    const ivaSelect = dialog
      .locator('.gm-field')
      .filter({ hasText: /IVA % incluido/i })
      .locator('select')
      .first();
    await expect(ivaSelect).toBeVisible();
    await ivaSelect.selectOption(String(normalized.ivaPct ?? 21));
  } else if (motive !== 'ANULACION_TOTAL') {
    const qty = dialog.locator('input[aria-label^="Cantidad a acreditar"]').first();
    await expect(qty).toBeVisible({ timeout: 20_000 });
    await qty.fill(String(normalized.quantity ?? 1));
    const stockCheck = dialog.locator('input[aria-label^="Reingresar"]').first();
    if (await stockCheck.isVisible().catch(() => false)) {
      if (!(await stockCheck.isChecked())) await stockCheck.check();
    }
  }

  return { motiveSelect };
}

export async function applySaleCreditNote(page, productName, options = 1) {
  const { dialog } = await openSaleCreditNote(page, productName);
  await configureSaleCreditNote(dialog, options);
  await clickSaveAndWait(dialog, /Aplicar nota de crédito/i, { timeout: 60_000 });
  return searchRow(page, productName, /Buscar por descripción, cliente/i);
}


export async function deletePurchase(page, productName) {
  const row = await searchRow(page, productName, /Buscar por descripción, proveedor/i);
  await row.getByTitle('Eliminar').click();
  const dialog = await waitDialog(page, 'Eliminar compra');
  await clickSaveAndWait(dialog, /^Eliminar$/i, { timeout: 60_000 });
}

export async function deleteSale(page, productName) {
  const row = await searchRow(page, productName, /Buscar por descripción, cliente/i);
  await row.getByTitle('Eliminar').click();
  const dialog = page.getByRole('dialog').filter({ hasText: /Eliminar venta/i }).last();
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole('button', { name: /Eliminar todo|^Eliminar$/i }).last();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
}

export async function openMovementDetail(page, productName, kind) {
  const placeholder = kind === 'purchase'
    ? /Buscar por descripción, proveedor/i
    : /Buscar por descripción, cliente/i;
  const row = await searchRow(page, productName, placeholder);
  await row.getByTitle(/Ver información completa del movimiento/i).click();
  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(productName);
  return dialog;
}

export async function prepareBudget(page, data) {
  await page.goto('/panel/presupuesto');
  await waitForBusyToFinish(page);
  await page.getByTitle('Crear nuevo presupuesto').click();
  const dialog = await waitDialog(page, 'Nuevo presupuesto');

  const itemRow = await fillMovementRow(dialog, {
    productName: data.productName,
    quantity: data.quantity ?? 1,
    price: data.price ?? 150,
  });

  const ivaSelect = itemRow.locator('select.gm-cell-input--select').first();
  await expect(ivaSelect).toBeVisible();
  await ivaSelect.selectOption(String(data.ivaPct ?? 0));

  data.clientName = await selectFirstAutocomplete(dialog, 'Cliente');
  return { dialog, itemRow, ivaSelect };
}

export async function createBudget(page, data) {
  const { dialog } = await prepareBudget(page, data);
  await clickSaveAndWait(dialog, /^Guardar$/i, { timeout: 60_000 });
  return searchRow(page, data.productName, /Buscar por descripción/i);
}

export async function prepareBudgetConversion(page, productName) {
  const row = await searchRow(page, productName, /Buscar por descripción/i);
  await row.getByTitle(/Asignar presupuesto como venta/i).click();
  const dialog = await waitDialog(page, 'Asignar como venta');

  const typeField = dialog.locator('.gm-field').filter({ hasText: 'Tipo de pago' }).first();
  const typeSelect = typeField.locator('select');
  const selected = await selectFirstNonEmpty(typeSelect, /CUENTA\s*CORRIENTE/i);
  if (/CONTADO/i.test(selected.text)) await fillPayment(dialog);

  const action = dialog.getByRole('button', { name: /Asignar como venta|Guardar venta|Confirmar/i }).last();
  await expect(action).toBeEnabled();
  return { row, dialog, action };
}

export async function convertBudgetToSale(page, productName) {
  const { row, dialog, action } = await prepareBudgetConversion(page, productName);
  await action.click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect(row.getByTitle(/Presupuesto ya asignado como venta/i)).toBeVisible({ timeout: 20_000 });
}

export async function deleteBudget(page, productName) {
  const row = await searchRow(page, productName, /Buscar por descripción/i);
  await row.getByTitle('Eliminar').click();
  const dialog = await waitDialog(page, 'Eliminar presupuesto');
  await clickSaveAndWait(dialog, /Eliminar/i, { timeout: 45_000 });
}

export async function createCatalogDescription(dialog, description) {
  const row = dialog.locator('.gm-table-body .gm-table-row').first();
  const input = row.locator('input[placeholder*="descripción" i]').first();
  await input.click();
  const add = dialog.page().locator('#ga-portal-list .ga-item').filter({ hasText: /Agregar nueva descripción/i }).first();
  await expect(add).toBeVisible();
  await add.click();

  const mini = await waitDialog(dialog.page(), 'Nueva descripción');
  await mini.locator('#nueva-descripcion-input').fill(description);
  await clickSaveAndWait(mini, /^Guardar$/i, { timeout: 30_000 });
  await expect(input).toHaveValue(new RegExp(description, 'i'));
  return row;
}

export async function createOtherIncome(page, data) {
  await page.goto('/panel/Otrosingresos');
  await waitForBusyToFinish(page);
  await page.getByTitle('Crear nuevo ingreso').click();
  const dialog = await waitDialog(page, 'Nuevo Ingreso');
  const row = await createCatalogDescription(dialog, data.description);
  const qty = row.locator('input[type="number"]').first();
  await qty.fill(String(data.quantity ?? 1));
  const price = row.locator('input[inputmode="decimal"]').first();
  await price.fill(String(data.amount ?? 100));
  await price.blur();
  await fillPayment(dialog);
  await clickSaveAndWait(dialog, /Guardar ingreso/i, { timeout: 60_000 });
  return searchRow(page, data.description, /Buscar por descripción/i);
}

export async function createOtherExpense(page, data) {
  await page.goto('/panel/Otrosegresos');
  await waitForBusyToFinish(page);
  await page.getByTitle('Crear nuevo egreso').click();
  const dialog = await waitDialog(page, 'Nuevo Egreso');
  const row = await createCatalogDescription(dialog, data.description);
  const qty = row.locator('input[type="number"]').first();
  await qty.fill(String(data.quantity ?? 1));
  const price = row.locator('input[inputmode="decimal"]').first();
  await price.fill(String(data.amount ?? 100));
  await price.blur();

  const classification = dialog.locator('.gm-field').filter({ hasText: 'Clasificación' }).locator('select');
  await selectFirstNonEmpty(classification);
  await fillPayment(dialog);
  await clickSaveAndWait(dialog, /Guardar egreso/i, { timeout: 60_000 });
  return searchRow(page, data.description, /Buscar por descripción/i);
}

export async function editOtherMovement(page, kind, query, newAmount) {
  const placeholder = /Buscar por descripción/i;
  const row = await searchRow(page, query, placeholder);
  await row.getByTitle('Editar').click();
  const title = kind === 'income' ? 'Editar ingreso' : 'Editar egreso';
  const dialog = await waitDialog(page, title);
  const price = dialog.locator('.gm-table-body .gm-table-row input[inputmode="decimal"]').first();
  await price.fill(String(newAmount));
  await price.blur();
  await completeRemainingAmount(dialog);
  await clickSaveAndWait(dialog, /Guardar cambios/i, { timeout: 60_000 });
  return searchRow(page, query, placeholder);
}

export async function deleteOtherMovement(page, kind, query) {
  const row = await searchRow(page, query, /Buscar por descripción/i);
  await row.getByTitle('Eliminar').click();
  const dialog = await waitDialog(page, kind === 'income' ? 'Eliminar ingreso' : 'Eliminar egreso');
  await clickSaveAndWait(dialog, /Eliminar/i, { timeout: 60_000 });
}

export async function payReceivable(page, productName) {
  await page.goto('/panel/recibos');
  await waitForBusyToFinish(page);
  const row = await searchRow(page, productName, /Buscar por descripción, cliente/i);
  const movementId = await row.getAttribute('data-movement-id');
  if (!movementId) throw new Error('La fila del recibo no expone data-movement-id.');

  await row.getByTitle('Cobrar').click();
  const dialog = await waitDialog(page, 'Pagar recibo');

  const debtRow = dialog.locator(`.gm-receipt-row[data-movement-id="${movementId}"]`).first();
  await expect(debtRow).toBeVisible({ timeout: 20_000 });
  const checkbox = debtRow.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
  await fillPayment(dialog);

  const confirm = dialog.getByRole('button', { name: /Confirmar cobro/i });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  const finalizar = page.getByRole('button', { name: /^Finalizar$/i }).last();
  await expect(finalizar).toBeVisible({ timeout: 45_000 });
  await finalizar.click();
  await expect(finalizar).toBeHidden({ timeout: 45_000 });
}

export async function payPayable(page, productName) {
  await page.goto('/panel/OrdenesPago');
  await waitForBusyToFinish(page);
  const row = await searchRow(page, productName, /Buscar por descripción, proveedor/i);
  const movementId = await row.getAttribute('data-movement-id');
  if (!movementId) throw new Error('La fila de la orden no expone data-movement-id.');

  await row.getByTitle('Pagar').click();
  const dialog = await waitDialog(page, 'Pagar orden');

  const debtRow = dialog.locator(`.gm-order-row[data-movement-id="${movementId}"]`).first();
  await expect(debtRow).toBeVisible({ timeout: 20_000 });
  const checkbox = debtRow.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) await checkbox.check({ force: true });
  await fillPayment(dialog);

  const confirm = dialog.getByRole('button', { name: /Confirmar pago/i });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  const finalizar = page.getByRole('button', { name: /^Finalizar$/i }).last();
  await expect(finalizar).toBeVisible({ timeout: 45_000 });
  await finalizar.click();
  await expect(finalizar).toBeHidden({ timeout: 45_000 });
}
