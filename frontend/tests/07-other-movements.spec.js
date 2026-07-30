import { test } from '@playwright/test';
import { uniqueName } from './support/data.js';
import { installDiagnostics, assertNoCriticalErrors } from './support/diagnostics.js';
import { requireMutations } from './support/ui.js';
import {
  createOtherIncome,
  createOtherExpense,
  editOtherMovement,
  deleteOtherMovement,
} from './support/flows.js';

test('@crud otros ingresos: crea descripción, registra, edita y elimina', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const description = uniqueName('OTRO-INGRESO');

  await createOtherIncome(page, { description, amount: 350 });
  await editOtherMovement(page, 'income', description, 420);
  await deleteOtherMovement(page, 'income', description);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/comprobante/i] });
});

test('@crud otros egresos: crea descripción, registra, edita y elimina', async ({ page }, testInfo) => {
  await requireMutations(test, page);
  const diagnostics = installDiagnostics(page);
  const description = uniqueName('OTRO-EGRESO');

  await createOtherExpense(page, { description, amount: 280 });
  await editOtherMovement(page, 'expense', description, 310);
  await deleteOtherMovement(page, 'expense', description);

  await assertNoCriticalErrors(diagnostics, testInfo, { allowConsole: [/comprobante/i] });
});
