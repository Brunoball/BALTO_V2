import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// BALTO Playwright: selector único de entorno.
// Este módulo se carga ANTES de tests/support/env.js y convierte el perfil
// elegido en .env.playwright.entorno a las variables PW_* genéricas que la
// suite histórica ya consume. Así no se cambia la lógica existente de Stock.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '../..');

const PROFILE_NAMES = new Set(['STOCK', 'SERVICIOS', 'PRODUCCION']);
const PROFILE_KEYS = [
  'BASE_URL',
  'API_URL',
  'USER',
  'PASSWORD',
  'START_FRONTEND',
  'START_BACKEND',
  'SKIP_WEBSERVER',
  'BACKEND_HEALTH_URL',
  'PHP_COMMAND',
  'BACKEND_DIR',
  'FRONTEND_COMMAND',
  'START_COMMAND',
];

function unquote(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2) {
    const first = text[0];
    const last = text[text.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return text.slice(1, -1);
    }
  }
  return text;
}

function parseEnv(text) {
  const values = {};
  String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;

      const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
      const equalsAt = normalized.indexOf('=');
      if (equalsAt <= 0) return;

      const key = normalized.slice(0, equalsAt).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
      values[key] = unquote(normalized.slice(equalsAt + 1));
    });
  return values;
}

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return parseEnv(fs.readFileSync(file, 'utf8'));
}

function placeholder(value) {
  const text = String(value ?? '').trim().toUpperCase();
  return (
    !text ||
    text.includes('PEGAR_AQUI') ||
    text.includes('TU_PASSWORD') ||
    text.includes('PASSWORD_ACTUAL') ||
    text.includes('COMPLETAR')
  );
}

function selectedProfile(selectorFile) {
  if (!fs.existsSync(selectorFile)) {
    throw new Error(
      '[Playwright] Falta .env.playwright.entorno. Dejá una sola línea activa: PW_ENTORNO=STOCK, SERVICIOS o PRODUCCION.',
    );
  }

  const selected = fs
    .readFileSync(selectorFile, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.match(/^PW_ENTORNO\s*=\s*(.+)$/i))
    .filter(Boolean)
    .map((match) => unquote(match[1]).trim().toUpperCase());

  if (selected.length !== 1) {
    throw new Error(
      `[Playwright] .env.playwright.entorno debe tener UNA sola línea PW_ENTORNO activa. Encontradas: ${selected.length}.`,
    );
  }

  if (!PROFILE_NAMES.has(selected[0])) {
    throw new Error(
      `[Playwright] PW_ENTORNO inválido: "${selected[0]}". Usá STOCK, SERVICIOS o PRODUCCION.`,
    );
  }

  return selected[0];
}

const envFile = path.join(frontendRoot, '.env.playwright');
const selectorFile = path.join(frontendRoot, '.env.playwright.entorno');

if (!fs.existsSync(envFile)) {
  throw new Error('[Playwright] Falta .env.playwright en la raíz de frontend.');
}

const values = readEnvFile(envFile);

// Carga primero configuración común. No pisa variables de terminal todavía;
// el perfil elegido sí manda sobre sus equivalentes genéricos.
for (const [key, value] of Object.entries(values)) {
  if (process.env[key] === undefined && String(value).trim() !== '') {
    process.env[key] = String(value).trim();
  }
}

const profile = selectedProfile(selectorFile);

for (const suffix of PROFILE_KEYS) {
  const profileKey = `PW_${profile}_${suffix}`;
  const genericKey = `PW_${suffix}`;
  const value = values[profileKey] ?? process.env[profileKey];

  if (value === undefined || String(value).trim() === '') continue;

  // Para credenciales con placeholder, preservamos cualquier PW_* genérico
  // válido que ya use la suite histórica (especialmente Stock).
  if ((suffix === 'USER' || suffix === 'PASSWORD') && placeholder(value)) continue;

  process.env[genericKey] = String(value).trim();
}

// Compatibilidad con tests/support/env.js actual.
process.env.PW_ENTORNO = profile;
process.env.PW_ENV = profile === 'PRODUCCION' ? 'production' : 'staging';

if (process.env.PW_API_URL) {
  // El frontend local debe apuntar exactamente a la API elegida.
  process.env.REACT_APP_API_URL = process.env.PW_API_URL;
}

// Validación temprana: evita volver al mensaje viejo de staging cuando el
// perfil elegido tiene sus datos completos pero no fueron mapeados.
const missing = ['PW_BASE_URL', 'PW_API_URL', 'PW_USER', 'PW_PASSWORD'].filter((key) =>
  placeholder(process.env[key]),
);

if (missing.length) {
  throw new Error(
    `[Playwright] Perfil ${profile} incompleto. Revisá ${missing.join(', ')} en .env.playwright.`,
  );
}
