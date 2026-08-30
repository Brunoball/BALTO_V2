import BASE_URL from "../../../config/config";

const API = `${BASE_URL}/api.php`;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);

  return {
    controller,
    clear: () => clearTimeout(id),
  };
}

async function postJsonAction(action, payload, { timeoutMs = 0, acceptJson = false } = {}) {
  const timeout = timeoutMs > 0 ? withTimeout(timeoutMs) : null;

  try {
    const headers = { "Content-Type": "application/json" };
    if (acceptJson) headers.Accept = "application/json";

    const res = await fetch(`${API}?action=${encodeURIComponent(action)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      ...(timeout ? { signal: timeout.controller.signal } : {}),
    });

    const rawText = await res.text();
    const data = safeJsonParse(rawText);

    return {
      ok: res.ok,
      status: res.status,
      data,
      rawText,
    };
  } finally {
    timeout?.clear();
  }
}

export function iniciarSesion({ nombre, contrasena }) {
  return postJsonAction(
    "inicio",
    { nombre, contrasena },
    { timeoutMs: 12000, acceptJson: true }
  );
}

export async function registrarUsuario({ nombre, contrasena, rol }) {
  const result = await postJsonAction("registro", { nombre, contrasena, rol });

  if (!result.data) {
    throw new Error(`Respuesta inválida: ${result.rawText.slice(0, 200)}`);
  }

  return result;
}

export function solicitarRecuperacionContrasena({ nombre }) {
  return postJsonAction("recuperar_contrasena", { nombre });
}

export function validarTokenReset({ token }) {
  return postJsonAction("validar_token_reset", { token });
}

export function restablecerContrasena({ token, nuevaContrasena }) {
  return postJsonAction("reset_contrasena", {
    token,
    nueva_contrasena: nuevaContrasena,
  });
}
