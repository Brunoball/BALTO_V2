import { ENV } from './env.js';

const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
const runPrefix = `PW-${ENV.runLabel ? `${ENV.runLabel}-` : ''}${seed}`.replace(/[^A-Z0-9-]/g, '').slice(0, 34);

export function uniqueName(kind, maxLength = 70) {
  const normalized = String(kind || 'DATO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return `${runPrefix}-${normalized}`.slice(0, maxLength);
}

export function uniqueSku(kind = 'SKU') {
  return uniqueName(kind, 32).replace(/-/g, '').slice(-24);
}

export function uniqueChequeNumber() {
  const millis = String(Date.now());
  const random = String(Math.floor(Math.random() * 100_000)).padStart(5, '0');
  return `${millis}${random}`;
}

export const RUN_PREFIX = runPrefix;

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
