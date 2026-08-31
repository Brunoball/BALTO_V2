const fs = require('fs');
const path = require('path');

const VALID_ENVIRONMENTS = new Set(['STOCK', 'SERVICIOS', 'PRODUCCION']);

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

const REQUIRED_PROFILE_KEYS = ['BASE_URL', 'API_URL', 'USER', 'PASSWORD'];

function stripOptionalQuotes(value) {
  const text = String(value ?? '').trim();
  if (text.length < 2) return text;

  const first = text[0];
  const last = text[text.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    const inner = text.slice(1, -1);
    if (first === '"') {
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return inner;
  }

  return text;
}

function parseEnvText(text) {
  const result = {};

  String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;

      const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
      const eq = normalized.indexOf('=');
      if (eq <= 0) return;

      const key = normalized.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;

      result[key] = stripOptionalQuotes(normalized.slice(eq + 1));
    });

  return result;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return parseEnvText(fs.readFileSync(filePath, 'utf8'));
}

function loadCommonValues(baseValues) {
  // Las variables comunes del archivo se cargan si no fueron definidas
  // expresamente desde fuera. Las variables del PERFIL elegido se pisan luego.
  for (const [key, value] of Object.entries(baseValues)) {
    if (process.env[key] === undefined && value !== '') {
      process.env[key] = String(value);
    }
  }
}

function activeEnvironmentFromSelector(selectorFile) {
  if (!fs.existsSync(selectorFile)) {
    throw new Error(
      '[Playwright] Falta .env.playwright.entorno. Dejá una sola línea activa: PW_ENTORNO=STOCK, SERVICIOS o PRODUCCION.',
    );
  }

  const active = fs
    .readFileSync(selectorFile, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.match(/^PW_ENTORNO\s*=\s*(.+)$/i))
    .filter(Boolean)
    .map((match) => stripOptionalQuotes(match[1]).trim().toUpperCase());

  if (active.length !== 1) {
    throw new Error(
      `[Playwright] .env.playwright.entorno debe tener UNA sola línea PW_ENTORNO activa. Encontradas: ${active.length}.`,
    );
  }

  const selected = active[0];
  if (!VALID_ENVIRONMENTS.has(selected)) {
    throw new Error(
      `[Playwright] PW_ENTORNO inválido: "${selected}". Usá STOCK, SERVICIOS o PRODUCCION.`,
    );
  }

  return selected;
}

function isPlaceholder(value) {
  const text = String(value || '').trim().toUpperCase();
  return (
    !text ||
    text.includes('PEGAR_AQUI') ||
    text.includes('TU_PASSWORD') ||
    text.includes('PASSWORD_ACTUAL') ||
    text.includes('COMPLETAR')
  );
}

function applySelectedProfile(selected, baseValues) {
  for (const suffix of PROFILE_KEYS) {
    const sourceKey = `PW_${selected}_${suffix}`;
    const targetKey = `PW_${suffix}`;
    const profileValue = baseValues[sourceKey] ?? process.env[sourceKey];

    if (profileValue !== undefined && String(profileValue) !== '') {
      // El selector MANDA: el perfil elegido siempre reemplaza cualquier PW_* genérico
      // viejo que haya quedado en la terminal o de una corrida anterior.
      process.env[targetKey] = String(profileValue);
    } else if (REQUIRED_PROFILE_KEYS.includes(suffix)) {
      delete process.env[targetKey];
    }
  }

  // Compatibilidad con tests/support/env.js: los perfiles locales contra
  // balto.3devsnet.com son staging; PRODUCCION es production.
  process.env.PW_ENV = selected === 'PRODUCCION' ? 'production' : 'staging';
  process.env.PW_ENTORNO = selected;

  // Si React se levanta local, debe consumir la misma API que eligió Playwright.
  process.env.REACT_APP_API_URL = process.env.PW_API_URL || '';
}

function validateSelectedProfile(selected) {
  const missing = REQUIRED_PROFILE_KEYS
    .map((suffix) => `PW_${suffix}`)
    .filter((key) => isPlaceholder(process.env[key]));

  if (missing.length) {
    throw new Error(
      `[Playwright] El perfil ${selected} no está completo. Revisá ${missing.join(', ')} en .env.playwright.`,
    );
  }
}

function loadTestEnv(rootDir = process.cwd()) {
  const baseFile = path.resolve(rootDir, '.env.playwright');
  const selectorFile = path.resolve(rootDir, '.env.playwright.entorno');

  if (!fs.existsSync(baseFile)) {
    throw new Error('[Playwright] Falta .env.playwright en la raíz del frontend.');
  }

  const baseValues = readEnvFile(baseFile);
  loadCommonValues(baseValues);

  // IMPORTANTE: el archivo selector es la fuente de verdad. No se usa un
  // PW_ENTORNO viejo de PowerShell para decidir el perfil.
  const selected = activeEnvironmentFromSelector(selectorFile);
  applySelectedProfile(selected, baseValues);
  validateSelectedProfile(selected);

  return {
    environment: selected,
    baseURL: process.env.PW_BASE_URL,
    apiURL: process.env.PW_API_URL,
    user: process.env.PW_USER,
  };
}

function envBoolean(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;

  const value = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'si', 'sí'].includes(value)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(value)) return false;
  return fallback;
}

module.exports = {
  envBoolean,
  loadTestEnv,
  parseEnvText,
};
