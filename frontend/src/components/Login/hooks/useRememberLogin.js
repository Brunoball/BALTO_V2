import { useCallback, useEffect, useState } from "react";
import {
  getRememberedLogin,
  persistRememberedLogin,
} from "../utils/loginUtils";

export default function useRememberLogin({ nombre, contrasena, setNombre, setContrasena }) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const saved = getRememberedLogin();
    if (!saved.remember) return;

    setRemember(true);
    setNombre(saved.user);
    setContrasena(saved.pass);
  }, [setContrasena, setNombre]);

  const persistRemember = useCallback((user, pass, flag) => {
    persistRememberedLogin(user, pass, flag);
  }, []);

  useEffect(() => {
    if (remember) {
      persistRemember(nombre, contrasena, true);
    }
  }, [nombre, contrasena, remember, persistRemember]);

  return {
    remember,
    setRemember,
    persistRemember,
  };
}
