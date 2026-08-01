import { expect } from '@playwright/test';
import { ENV, assertSafeMutationConfiguration } from './env.js';

export async function gotoAndWait(page, path, expected) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/$/);
  if (expected) {
    await expect(page.getByText(expected, { exact: false }).first()).toBeVisible();
  }
  await waitForBusyToFinish(page);
}

export async function waitForBusyToFinish(scope) {
  const busy = scope.locator('[aria-busy="true"], .mov-skeletonWrap, .gif-carga-container');
  try {
    await busy.first().waitFor({ state: 'hidden', timeout: 15_000 });
  } catch {
    // Algunas pantallas no renderizan loaders o los reemplazan muy rápido.
  }
}

export function dialogByTitle(page, title) {
  return page
    .getByRole('dialog')
    .filter({ has: page.getByText(title, { exact: false }) })
    .last();
}

export async function waitDialog(page, title) {
  const dialog = dialogByTitle(page, title);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function closeDialog(dialog) {
  const cancel = dialog.getByRole('button', { name: /cancelar/i }).last();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await expect(dialog).toBeHidden();
    return;
  }

  const close = dialog.getByRole('button', { name: /cerrar/i }).last();
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(dialog).toBeHidden();
  }
}


export async function selectOptionValues(select) {
  await expect(select).toBeVisible();
  return select.locator('option').evaluateAll((nodes) =>
    nodes
      .filter((node) => node.value !== '')
      .map((node) => String(node.value))
  );
}

export async function selectFirstNonEmpty(select, preferredPattern) {
  await expect(select).toBeVisible();
  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({ value: node.value, text: (node.textContent || '').trim(), disabled: node.disabled }))
  );

  let candidate = null;
  if (preferredPattern) {
    candidate = options.find(
      (option) => option.value && !option.disabled && preferredPattern.test(option.text)
    );
  }
  if (!candidate) {
    candidate = options.find((option) => option.value && !option.disabled);
  }
  if (!candidate) throw new Error('El selector no tiene opciones utilizables.');

  await select.selectOption(candidate.value);
  return candidate;
}

export async function selectSafePaymentMethod(scope) {
  const select = scope.locator('.gm-payment-row--method select').first();
  await expect(select).toBeVisible();

  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({ value: node.value, text: (node.textContent || '').trim(), disabled: node.disabled }))
  );
  const usable = options.filter((option) => option.value && !option.disabled);
  const candidate =
    usable.find((option) => /EFECTIVO|TRANSFERENCIA|BANCO|TARJETA/i.test(option.text) && !/CHEQ/i.test(option.text)) ||
    usable.find((option) => !/CHEQ/i.test(option.text)) ||
    usable[0];

  if (!candidate) throw new Error('No hay medios de pago disponibles.');
  await select.selectOption(candidate.value);
  return candidate;
}

export async function completeRemainingAmount(scope) {
  const complete = scope.getByTitle(/Completar importe restante/i).first();
  if (await complete.isVisible().catch(() => false)) {
    await complete.click();
    return;
  }

  const amount = scope.locator('.gm-payment-row--amount input').first();
  await expect(amount).toBeVisible();
  await amount.fill('100');
  await amount.blur();
}

export async function fillPayment(scope) {
  await selectSafePaymentMethod(scope);
  await completeRemainingAmount(scope);
}

export async function selectFirstAutocomplete(scope, labelText) {
  const candidates = scope.locator('.ga-wrap');
  const count = await candidates.count();
  let wrap = null;

  for (let index = 0; index < count; index += 1) {
    const current = candidates.nth(index);
    const parentText = await current.locator('xpath=..').innerText().catch(() => '');
    const ownText = await current.innerText().catch(() => '');
    if (new RegExp(labelText, 'i').test(`${parentText} ${ownText}`)) {
      wrap = current;
      break;
    }
  }
  if (!wrap) wrap = candidates.first();

  const input = wrap.locator('input').first();
  await expect(input).toBeVisible();
  await input.click();
  const options = scope.page().locator('#ga-portal-list .ga-item:not(.is-empty)');
  await expect(options.first()).toBeVisible({ timeout: 10_000 });

  const countOptions = await options.count();
  let option = null;
  let text = '';
  for (let index = 0; index < countOptions; index += 1) {
    const current = options.nth(index);
    const currentText = (await current.innerText()).trim();
    if (!/agregar/i.test(currentText)) {
      option = current;
      text = currentText;
      break;
    }
  }

  if (!option) {
    throw new Error(`No hay ${labelText} existentes para seleccionar; sólo aparece la opción de alta.`);
  }

  await option.click();
  return text;
}

export async function selectProduct(scope, productName, options = {}) {
  const productInput = scope
    .locator([
      'input[placeholder*="producto" i]',
      'input[placeholder*="material" i]',
      'input[placeholder*="descripción" i]',
      'input[placeholder*="detalle" i]',
    ].join(','))
    .first();

  await expect(productInput).toBeVisible();
  await productInput.fill(productName);

  const list = scope.page().locator('#psa-portal-list');
  await expect(list).toBeVisible({ timeout: 12_000 });
  const item = list.locator('.psa-item, li').filter({ hasText: productName }).first();
  if (await item.isVisible().catch(() => false)) {
    await item.click();
  } else {
    await productInput.press('Enter');
  }

  if (options.expectSelected !== false) {
    await expect(productInput).toHaveValue(new RegExp(productName, 'i'));
  }
  return productInput;
}

function parseDisplayedDecimal(value) {
  const clean = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/\$/g, '');

  if (!clean) return 0;

  // Los inputs monetarios de Balto muestran formato argentino al perder foco
  // (1.234,56), pero durante la edición también pueden exponer 1234.56.
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  return Number(normalized);
}

async function fillControlledDecimal(input, value) {
  const expected = Number(value);
  expect(Number.isFinite(expected), `El valor decimal ${value} debe ser numérico`).toBe(true);

  await expect(input).toBeVisible();
  await input.click();
  await expect(input).toBeFocused();

  // Los componentes monetarios cambian de `monto` formateado a `montoDraft`
  // dentro de onFocus. Si Playwright escribe antes de que React confirme ese
  // cambio, el valor anterior puede reaparecer o concatenarse (p. ej. 100100).
  // Dos frames esperan el commit y el repintado sin introducir un sleep fijo.
  await input.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));

  await input.fill(String(value));
  await expect(input).toHaveValue(String(value));
  await input.blur();

  await expect
    .poll(
      async () => parseDisplayedDecimal(await input.inputValue()),
      {
        message: `El input debe conservar el importe ${value} después del recálculo de React`,
        timeout: 10_000,
      },
    )
    .toBeCloseTo(expected, 2);
}

export async function fillMovementRow(dialog, data) {
  const row = dialog.locator('.gm-table-body .gm-table-row').first();
  await expect(row).toBeVisible();

  if (data.productName) {
    await selectProduct(row, data.productName);
  } else if (data.description) {
    const input = row
      .locator('input[placeholder*="descripción" i], input[placeholder*="detalle" i]')
      .first();
    await input.fill(data.description);
  }

  const qty = row.locator('input[type="number"]').first();
  if (await qty.isVisible().catch(() => false)) {
    await qty.fill(String(data.quantity ?? 1));
    await qty.blur();
  }

  if (data.price !== undefined) {
    const price = row.locator('input[inputmode="decimal"]').first();
    if (await price.isVisible().catch(() => false)) {
      await fillControlledDecimal(price, data.price);
    }
  }

  return row;
}

export async function selectMovementMode(dialog, labelText, preferredPattern) {
  const field = dialog.locator('.gm-field').filter({ hasText: labelText }).first();
  const select = field.locator('select').first();
  return selectFirstNonEmpty(select, preferredPattern);
}

export async function searchRow(page, query, placeholderPattern = /Buscar/i) {
  const search = page.getByPlaceholder(placeholderPattern).first();
  await expect(search).toBeVisible();
  await search.fill(query);
  await search.press('Enter');

  // Stock y algunos listados disparan la consulta con debounce. Si se busca el
  // loader inmediatamente, todavía no existe y Playwright puede devolver una fila
  // skeleton (sin texto) como si fuera el resultado real.
  await page.waitForTimeout(450);
  await waitForBusyToFinish(page);

  // Algunos listados permiten buscar por datos internos del detalle (por ejemplo,
  // el nombre de un producto), aunque la grilla solo muestre "1 PRODUCTO".
  // Primero intentamos encontrar una fila que exponga el texto buscado y, si no
  // aparece visualmente, usamos la primera fila devuelta por el filtro del backend.
  const rows = page.locator('.mov-gridTable--row:visible:not(.mov-row--skeleton)');
  const rowWithVisibleText = rows.filter({ hasText: query }).first();

  if (await rowWithVisibleText.isVisible({ timeout: 2_000 }).catch(() => false)) {
    return rowWithVisibleText;
  }

  const backendError = page.locator('body').getByText(
    /SQLSTATE|Invalid parameter number|Error interno|Fatal error/i,
  ).first();
  await expect(backendError).toHaveCount(0);

  const firstFilteredRow = rows.first();
  await expect(firstFilteredRow).toBeVisible({ timeout: 20_000 });
  return firstFilteredRow;
}

export async function clickAndWaitForDialog(button, page, title) {
  await button.click();
  return waitDialog(page, title);
}

export async function clickSaveAndWait(dialog, buttonName, options = {}) {
  const button = dialog.getByRole('button', { name: buttonName }).last();
  await expect(button).toBeEnabled();
  await button.click();
  if (options.waitForClose !== false) {
    await expect(dialog).toBeHidden({ timeout: options.timeout || 45_000 });
  }
}

export async function requireMutations(test, page) {
  test.skip(!ENV.allowMutations, 'PW_ALLOW_MUTATIONS no está habilitado.');
  assertSafeMutationConfiguration();

  // Por defecto los E2E modifican datos reales de Balto, pero NO crean jobs ni
  // cambios remotos en Tienda Nube. El backend ya reconoce este parámetro en
  // su integrador; se agrega desde Playwright sin tocar el código productivo.
  if (ENV.skipTiendaNube && page) {
    await page.context().route('**/api.php**', async (route) => {
      const request = route.request();
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
        await route.continue();
        return;
      }

      const url = new URL(request.url());
      url.searchParams.set('skip_tiendanube_sync', '1');
      await route.continue({ url: url.toString() });
    });
  }
}

export async function assertFrontendUsesConfiguredBackend(page) {
  const expectedHost = new URL(ENV.apiURL).host;
  await page.goto('/panel/dashboard', { waitUntil: 'domcontentloaded' });

  const apiResource = await expect
    .poll(
      async () => {
        const resources = await page.evaluate(() =>
          performance.getEntriesByType('resource').map((entry) => entry.name)
        );
        return resources.find((url) => url.includes('/api.php')) || '';
      },
      {
        message: 'El frontend debe realizar al menos una petición a api.php',
        timeout: 15_000,
      }
    )
    .not.toBe('')
    .then(async () => {
      const resources = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name)
      );
      return resources.find((url) => url.includes('/api.php')) || '';
    });

  expect(new URL(apiResource).host).toBe(expectedHost);
}
