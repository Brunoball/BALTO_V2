export const LOGIN_STORAGE_KEYS = {
  rememberFlag: "rememberLogin",
  user: "remember_nombre",
  pass: "remember_contrasena",
};

export function normalizeLoginRol(value, idRol = null) {
  const id = Number(idRol);
  const v = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (
    id === 1 ||
    ["1", "admin", "administrator", "administrador", "superadmin"].includes(v)
  ) {
    return "admin";
  }

  return "empleado_basico";
}

export function normalizeLoginPlanNivel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

export function normalizeLoginPlanId(value) {
  const n = Number(value);
  return n === 2 ? 2 : 1;
}

export function persistRememberedLogin(user, pass, flag) {
  if (flag) {
    localStorage.setItem(LOGIN_STORAGE_KEYS.rememberFlag, "1");
    localStorage.setItem(LOGIN_STORAGE_KEYS.user, user ?? "");
    localStorage.setItem(LOGIN_STORAGE_KEYS.pass, pass ?? "");
  } else {
    localStorage.removeItem(LOGIN_STORAGE_KEYS.rememberFlag);
    localStorage.removeItem(LOGIN_STORAGE_KEYS.user);
    localStorage.removeItem(LOGIN_STORAGE_KEYS.pass);
  }
}

export function getRememberedLogin() {
  const saved = localStorage.getItem(LOGIN_STORAGE_KEYS.rememberFlag) === "1";
  if (!saved) return { remember: false, user: "", pass: "" };

  return {
    remember: true,
    user: localStorage.getItem(LOGIN_STORAGE_KEYS.user) || "",
    pass: localStorage.getItem(LOGIN_STORAGE_KEYS.pass) || "",
  };
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 4))}@${domain}`;
}

export function getPasswordStrength(pass) {
  if (!pass) return null;

  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 1) return { label: "Débil", color: "#ef4444", width: "25%" };
  if (score === 2) return { label: "Regular", color: "#f59e0b", width: "50%" };
  if (score === 3) return { label: "Buena", color: "#3b82f6", width: "75%" };
  return { label: "Fuerte", color: "#22c55e", width: "100%" };
}
