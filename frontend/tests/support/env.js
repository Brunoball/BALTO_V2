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

function applyValues(values, externalValues) {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }

  // Las variables indicadas expresamente desde PowerShell siempre tienen prioridad.
  for (const [key, value] of Object.entries(externalValues)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function productionHost(host) {
  const normalized = String(host || '').toLowerCase();
  return normalized === 'app.balto.com.ar' || normalized === 'www.app.balto.com.ar';
}

function resolveTarget(apiURL) {
  try {
    return productionHost(new URL(apiURL).hostname) ? 'production' : 'staging';
  } catch {
    return 'staging';
  }
}

const root = process.cwd();
const externalValues = { ...process.env };
const commonFile = path.join(root, '.env.playwright');
const commonValues = parseEnvFile(commonFile);

// Primero se lee la URL común. Esa URL decide automáticamente qué cuenta usar.
applyValues(commonValues, externalValues);

const preliminaryApiURL =
  process.env.PW_API_URL || commonValues.PW_API_URL || 'https://balto.3devsnet.com/api/routes';
const selectedTarget = resolveTarget(preliminaryApiURL);
const profileFile = path.join(root, `.env.playwright.${selectedTarget}.local`);
const profileValues = parseEnvFile(profileFile);

// El perfil aporta usuario, contraseña y tenant. PowerShell sigue teniendo prioridad.
applyValues({ ...commonValues, ...profileValues }, externalValues);

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(value).trim().toLowerCase());
}

function integer(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const ENV = Object.freeze({
  target: selectedTarget,
  profileFile,
  baseURL: process.env.PW_BASE_URL || 'http://127.0.0.1:3000',
  apiURL: process.env.PW_API_URL || 'https://balto.3devsnet.com/api/routes',
  user: process.env.PW_USER || '',
  password: process.env.PW_PASSWORD || '',
  allowMutations: bool(process.env.PW_ALLOW_MUTATIONS, false),
  allowProduction: bool(process.env.PW_ALLOW_PRODUCTION, false),
  expectedTenantId: String(process.env.PW_EXPECTED_TENANT_ID || '').trim(),
  expectedTenantName: String(process.env.PW_EXPECTED_TENANT_NAME || '').trim(),
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
      `Faltan PW_USER y PW_PASSWORD para ${ENV.target}. Completá ${path.basename(ENV.profileFile)} o ejecutá scripts\\configurar-cuentas-playwright.ps1.`
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

  const looksProduction = productionHost(host);
  if (looksProduction && !ENV.allowProduction) {
    throw new Error(
      'Bloqueado: las pruebas mutables apuntan a producción, pero el perfil production no habilitó PW_ALLOW_PRODUCTION=1.'
    );
  }

  if (looksProduction && !ENV.expectedTenantId && !ENV.expectedTenantName) {
    throw new Error(
      'Bloqueado: para mutar producción debés definir PW_EXPECTED_TENANT_ID o PW_EXPECTED_TENANT_NAME en .env.playwright.production.local.'
    );
  }
}

function normalizeTenantName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-AR');
}

export async function assertExpectedTenant(page) {
  if (!page || (!ENV.expectedTenantId && !ENV.expectedTenantName)) return;

  // Al comenzar cada test, Playwright crea una página about:blank. En ese
  // documento el acceso directo a window.localStorage lanza SecurityError.
  // Leemos el storageState del contexto, que contiene el localStorage
  // restaurado por tests/.auth/user.json sin depender de la URL de la página.
  const storageState = await page.context().storageState();

  let preferredOrigin = '';
  try {
    preferredOrigin = new URL(ENV.baseURL).origin;
  } catch {
    preferredOrigin = '';
  }

  const orderedOrigins = [...(storageState.origins || [])].sort((a, b) => {
    if (a.origin === preferredOrigin) return -1;
    if (b.origin === preferredOrigin) return 1;
    return 0;
  });

  let rawUsuario = '';
  let sourceOrigin = '';
  for (const originEntry of orderedOrigins) {
    const item = (originEntry.localStorage || []).find((entry) => entry.name === 'usuario');
    if (item?.value) {
      rawUsuario = item.value;
      sourceOrigin = originEntry.origin;
      break;
    }
  }

  let usuario = null;
  if (rawUsuario) {
    try {
      usuario = JSON.parse(rawUsuario);
    } catch {
      usuario = null;
    }
  }

  if (!usuario || typeof usuario !== 'object') {
    const available = orderedOrigins
      .map((originEntry) => {
        const keys = (originEntry.localStorage || []).map((entry) => entry.name).join(', ');
        return `${originEntry.origin}: ${keys || '(ninguna)'}`;
      })
      .join(' | ');

    throw new Error(
      `No se pudo verificar el tenant: localStorage.usuario no existe o no es JSON válido en el storageState. Orígenes y claves: ${available || '(sin orígenes)'}.`
    );
  }

  const actualId = String(
    usuario.idTenant ?? usuario.id_tenant ?? usuario.tenant_id ?? usuario.tenantId ?? ''
  ).trim();
  const actualName = String(
    usuario.tenant_nombre ?? usuario.nombre_tenant ?? usuario.tenantName ?? ''
  ).trim();

  if (ENV.expectedTenantId && actualId !== ENV.expectedTenantId) {
    throw new Error(
      `Bloqueado: la sesión pertenece al tenant ${actualId || '(sin id)'}, pero PW_EXPECTED_TENANT_ID=${ENV.expectedTenantId}. Origen: ${sourceOrigin || '(desconocido)'}.`
    );
  }

  if (
    ENV.expectedTenantName &&
    normalizeTenantName(actualName) !== normalizeTenantName(ENV.expectedTenantName)
  ) {
    throw new Error(
      `Bloqueado: la sesión pertenece a "${actualName || '(sin nombre)'}", pero PW_EXPECTED_TENANT_NAME="${ENV.expectedTenantName}". Origen: ${sourceOrigin || '(desconocido)'}.`
    );
  }
}
