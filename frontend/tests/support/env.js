import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const out = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx < 1) continue;

    const key = line.slice(0, idx).trim().replace(/^\uFEFF/, '');
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const root = process.cwd();
const fileValues = parseEnvFile(path.join(root, '.env.playwright'));
for (const [key, value] of Object.entries(fileValues)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).trim().toLowerCase());
}

function integer(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const ENV = Object.freeze({
  baseURL: process.env.PW_BASE_URL || 'http://127.0.0.1:3000',
  apiURL: process.env.PW_API_URL || 'https://balto.3devsnet.com/api/routes',
  user: process.env.PW_USER || '',
  password: process.env.PW_PASSWORD || '',
  allowMutations: bool(process.env.PW_ALLOW_MUTATIONS, false),
  allowProduction: bool(process.env.PW_ALLOW_PRODUCTION, false),
  skipWebServer: bool(process.env.PW_SKIP_WEBSERVER, false),
  startCommand: process.env.PW_START_COMMAND || 'npm start',
  cleanup: bool(process.env.PW_CLEANUP, false),
  skipTiendaNube: bool(process.env.PW_SKIP_TIENDA_NUBE, true),
  timeoutMs: integer(process.env.PW_TIMEOUT_MS, 60_000),
  expectTimeoutMs: integer(process.env.PW_EXPECT_TIMEOUT_MS, 12_000),
  slowMoMs: integer(process.env.PW_SLOW_MO_MS, 0),
  runLabel: process.env.PW_RUN_LABEL || '',
});

export const AUTH_FILE = path.join(root, 'tests', '.auth', 'user.json');

export function assertCredentialsConfigured() {
  if (!ENV.user || !ENV.password) {
    throw new Error(
      'Faltan PW_USER y PW_PASSWORD. Ejecutá scripts\\configurar-playwright.ps1 o completá .env.playwright.'
    );
  }
}

export function assertSafeMutationConfiguration() {
  if (!ENV.allowMutations) {
    throw new Error('Las pruebas mutables requieren PW_ALLOW_MUTATIONS=1.');
  }

  let host = '';
  try {
    host = new URL(ENV.apiURL).hostname.toLowerCase();
  } catch {
    throw new Error(`PW_API_URL no es una URL válida: ${ENV.apiURL}`);
  }

  const looksProduction = host === 'app.balto.com.ar' || host.startsWith('www.app.balto.com.ar');
  if (looksProduction && !ENV.allowProduction) {
    throw new Error(
      'Bloqueado: las pruebas mutables apuntan a producción. Usá el backend de pruebas o definí PW_ALLOW_PRODUCTION=1 bajo tu responsabilidad.'
    );
  }
}
