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

export async function deleteUnusedStockProduct(page, productName) {
  const row = await searchRow(page, productName, /Buscar por nombre, SKU o variante/i);
  await row.getByTitle('Eliminar producto definitivamente').click();
  const first = await waitDialog(page, 'Eliminar producto definitivamente');
  await expect(first.getByRole('button', { name: /Eliminar/i }).last()).toBeEnabled({ timeout: 20_000 });
  await first.getByRole('button', { name: /Eliminar/i }).last().click();

  const finalDialog = await waitDialog(page, 'Confirmación final');
  await clickSaveAndWait(finalDialog, /Sí, eliminar para siempre/i, { timeout: 90_000 });

  const search = page.getByPlaceholder(/Buscar por nombre, SKU o variante/i);
  await search.fill(productName);
  await search.press('Enter');
  await expect(page.locator('.mov-gridTable--row').filter({ hasText: productName })).toHaveCount(0);
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

export async function applyPurchaseCreditNote(page, productName, quantity = 1) {
  const row = await searchRow(page, productName, /Buscar por descripción, proveedor/i);
  await row.getByTitle(/Aplicar nota de crédito/i).click();
  const dialog = await waitDialog(page, 'Aplicar nota de crédito del proveedor');
  const qty = dialog.locator('table tbody input[type="number"]').first();
  await expect(qty).toBeVisible();
  await qty.fill(String(quantity));
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

export async function applySaleCreditNote(page, productName, quantity = 1) {
  const row = await searchRow(page, productName, /Buscar por descripción, cliente/i);
  await row.getByTitle('Emitir nota de crédito').click();
  const dialog = await waitDialog(page, 'Nota de crédito');
  const qty = dialog.locator('input[aria-label^="Cantidad a acreditar"]').first();
  await expect(qty).toBeVisible({ timeout: 20_000 });
  await qty.fill(String(quantity));
  const stockCheck = dialog.locator('input[aria-label^="Reingresar"]').first();
  if (!(await stockCheck.isChecked())) await stockCheck.check();
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

export async function createBudget(page, data) {
  await page.goto('/panel/presupuesto');
  await waitForBusyToFinish(page);
  await page.getByTitle('Crear nuevo presupuesto').click();
  const dialog = await waitDialog(page, 'Nuevo presupuesto');

  await fillMovementRow(dialog, {
    productName: data.productName,
    quantity: data.quantity ?? 1,
    price: data.price ?? 150,
  });
  data.clientName = await selectFirstAutocomplete(dialog, 'Cliente');
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
  await row.getByTitle('Cobrar').click();
  const dialog = await waitDialog(page, 'Pagar recibo');

  const debtRow = dialog.locator('.gm-receipt-row').filter({ hasText: productName }).first();
  await expect(debtRow).toBeVisible();
  const checkbox = debtRow.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) await checkbox.check();
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
  await row.getByTitle('Pagar').click();
  const dialog = await waitDialog(page, 'Pagar orden');

  const debtRow = dialog.locator('.gm-order-row').filter({ hasText: productName }).first();
  await expect(debtRow).toBeVisible();
  const checkbox = debtRow.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) await checkbox.check();
  await fillPayment(dialog);

  const confirm = dialog.getByRole('button', { name: /Confirmar pago/i });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  const finalizar = page.getByRole('button', { name: /^Finalizar$/i }).last();
  await expect(finalizar).toBeVisible({ timeout: 45_000 });
  await finalizar.click();
  await expect(finalizar).toBeHidden({ timeout: 45_000 });
}
