import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBuildingColumns,
  faFloppyDisk,
  faMoneyCheckDollar,
  faPlus,
  faRotateLeft,
  faTrash,
  faUsers,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";

import BASE_URL from "../../../config/config";
import Toast from "../../Global/Toast";
import "./ConfiguracionSaldosIniciales.css";

const API_RELATIVE = "api.php";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildApiUrl(paramsObj = {}) {
  const baseRaw = String(BASE_URL || "").trim();
  const base = baseRaw.replace(/\/+$/, "") + "/";
  const url = new URL(API_RELATIVE, base);
  const qs = new URLSearchParams();
  Object.entries(paramsObj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    qs.set(k, String(v));
  });
  url.search = qs.toString();
  return url.toString();
}

function getSessionKey() {
  return String(localStorage.getItem("session_key") || "").trim();
}

async function apiFetch(action, options = {}) {
  const headers = new Headers(options.headers || {});
  const session = getSessionKey();
  if (session) headers.set("X-Session", session);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(buildApiUrl({ action }), { ...options, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok || !data?.exito) {
    throw new Error(data?.mensaje || `Error HTTP ${res.status}`);
  }
  return data;
}

function parseMoney(value) {
  let s = String(value ?? "").trim().replace(/\$/g, "").replace(/\s+/g, "");
  if (!s) return 0;

  if (!/^[+-]?[0-9.,]+$/.test(s)) return null;

  const sign = s.startsWith("-") ? -1 : 1;
  s = s.replace(/^[+-]/, "");
  if (!s || !/[0-9]/.test(s)) return null;

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;
  let normalized = s;

  if (commaCount > 0 && dotCount > 0) {
    const decimalSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    if (s.split(decimalSep).length - 1 !== 1) return null;
    const [integerPart, decimalPart = ""] = s.split(decimalSep);
    if (decimalPart.length > 2 || !/^\d{0,2}$/.test(decimalPart)) return null;
    const integerGroups = integerPart.split(thousandSep);
    if (integerGroups.length > 1) {
      if (!/^\d{1,3}$/.test(integerGroups[0]) || integerGroups.slice(1).some((g) => !/^\d{3}$/.test(g))) return null;
    }
    normalized = integerGroups.join("") + (decimalPart !== "" ? `.${decimalPart}` : "");
  } else if (commaCount > 0) {
    if (commaCount !== 1) return null;
    const [integerPart, decimalPart = ""] = s.split(",");
    if (!/^\d+$/.test(integerPart) || decimalPart.length > 2 || !/^\d{0,2}$/.test(decimalPart)) return null;
    normalized = integerPart + (decimalPart !== "" ? `.${decimalPart}` : "");
  } else if (dotCount > 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      normalized = s.replace(/\./g, "");
    } else {
      if (dotCount !== 1) return null;
      const [integerPart, decimalPart = ""] = s.split(".");
      if (!/^\d+$/.test(integerPart) || decimalPart.length > 2 || !/^\d{0,2}$/.test(decimalPart)) return null;
      normalized = integerPart + (decimalPart !== "" ? `.${decimalPart}` : "");
    }
  } else if (!/^\d+$/.test(s)) {
    return null;
  }

  const n = Number(normalized) * sign;
  return Number.isFinite(n) ? n : null;
}

function moneyARS(value) {
  const n = Number(value || 0);
  try {
    return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function moneyDraft(value) {
  const n = Number(value || 0);
  return n === 0 ? "" : String(n).replace(".", ",");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function fmtDate(value) {
  const [y, m, d] = String(value || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

export default function ConfiguracionSaldosIniciales() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("tesoreria");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [data, setData] = useState({ medios_pago: [], tesoreria: [], clientes: [], proveedores: [], cheques: [] });
  const [tesoreriaRows, setTesoreriaRows] = useState([]);
  const [ccTipo, setCcTipo] = useState("CLIENTE");
  const [ccSearch, setCcSearch] = useState("");
  const [ccEditor, setCcEditor] = useState(null);
  const [chequeForm, setChequeForm] = useState({
    tipo: "CHEQUE",
    fecha_saldo: todayISO(),
    fecha_emision: todayISO(),
    fecha_pago: todayISO(),
    emisor: "",
    numero_cheque: "",
    importe: "",
    observaciones: "",
  });

  const notify = useCallback((tipo, mensaje, duracion = 3300) => {
    setToast({ tipo, mensaje, duracion, key: Date.now() });
  }, []);

  const hydrate = useCallback((payload) => {
    const next = {
      medios_pago: Array.isArray(payload?.medios_pago) ? payload.medios_pago : [],
      tesoreria: Array.isArray(payload?.tesoreria) ? payload.tesoreria : [],
      clientes: Array.isArray(payload?.clientes) ? payload.clientes : [],
      proveedores: Array.isArray(payload?.proveedores) ? payload.proveedores : [],
      cheques: Array.isArray(payload?.cheques) ? payload.cheques : [],
    };
    setData(next);
    const byId = new Map(next.tesoreria.map((r) => [Number(r.id_medio_pago), r]));
    setTesoreriaRows(next.medios_pago.map((medio) => {
      const current = byId.get(Number(medio.id_medio_pago));
      return {
        id_medio_pago: Number(medio.id_medio_pago),
        nombre: String(medio.nombre || "MEDIO DE PAGO"),
        fecha_saldo: current?.fecha_saldo || todayISO(),
        saldo: current ? moneyDraft(current.saldo) : "",
        observaciones: current?.observaciones || "",
        configured: Boolean(current),
      };
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch("config_saldos_iniciales_get");
      hydrate(payload);
    } catch (e) {
      notify("error", e?.message || "No se pudieron cargar los saldos iniciales.", 4500);
    } finally {
      setLoading(false);
    }
  }, [hydrate, notify]);

  useEffect(() => { load(); }, [load]);

  const saveTreasury = useCallback(async () => {
    const rowsToSave = tesoreriaRows.filter(
      (r) => r.configured || normalizeText(r.saldo) !== "" || normalizeText(r.observaciones) !== ""
    );
    if (!rowsToSave.length) {
      notify("advertencia", "Ingresá al menos un saldo inicial para guardar.");
      return;
    }
    const invalidRow = rowsToSave.find((r) => parseMoney(r.saldo) === null);
    if (invalidRow) {
      notify("advertencia", `Revisá el saldo inicial de ${invalidRow.nombre}: el importe no es válido.`);
      return;
    }
    setSaving(true);
    try {
      const payload = await apiFetch("config_saldos_iniciales_tesoreria_guardar", {
        method: "POST",
        body: JSON.stringify({
          saldos: rowsToSave.map((r) => ({
            id_medio_pago: r.id_medio_pago,
            fecha_saldo: r.fecha_saldo,
            saldo: parseMoney(r.saldo),
            observaciones: normalizeText(r.observaciones),
          })),
        }),
      });
      hydrate(payload);
      notify("exito", payload.mensaje || "Saldos iniciales guardados correctamente.");
    } catch (e) {
      notify("error", e?.message || "No se pudieron guardar los saldos.", 4500);
    } finally {
      setSaving(false);
    }
  }, [tesoreriaRows, hydrate, notify]);

  const ccRows = ccTipo === "CLIENTE" ? data.clientes : data.proveedores;
  const filteredCcRows = useMemo(() => {
    const q = normalizeText(ccSearch).toLocaleUpperCase("es-AR");
    if (!q) return ccRows;
    return ccRows.filter((r) => String(r.nombre || "").toLocaleUpperCase("es-AR").includes(q));
  }, [ccRows, ccSearch]);

  const openCcEditor = useCallback((row) => {
    const stored = row?.saldo;
    const hasStored = row?.id_saldo_inicial != null;
    setCcEditor({
      tipo_entidad: ccTipo,
      id_entidad: Number(ccTipo === "CLIENTE" ? row.id_cliente : row.id_proveedor),
      nombre: String(row.nombre || ""),
      fecha_saldo: row.fecha_saldo || todayISO(),
      sentido: hasStored && Number(stored) < 0 ? "FAVOR" : "DEUDA",
      importe: hasStored ? moneyDraft(Math.abs(Number(stored || 0))) : "",
      observaciones: row.observaciones || "",
      exists: hasStored,
    });
  }, [ccTipo]);

  const saveCc = useCallback(async () => {
    if (!ccEditor) return;
    const parsedImporte = parseMoney(ccEditor.importe);
    if (parsedImporte === null) {
      notify("advertencia", "Ingresá un importe válido para el saldo inicial.");
      return;
    }
    if (!(Math.abs(parsedImporte) > 0)) {
      notify("advertencia", "Ingresá un importe mayor a cero. Si querés dejar la cuenta sin saldo inicial, eliminá el saldo existente.");
      return;
    }
    setSaving(true);
    try {
      const payload = await apiFetch("config_saldos_iniciales_cc_guardar", {
        method: "POST",
        body: JSON.stringify({
          tipo_entidad: ccEditor.tipo_entidad,
          id_entidad: ccEditor.id_entidad,
          fecha_saldo: ccEditor.fecha_saldo,
          sentido: ccEditor.sentido,
          importe: Math.abs(parsedImporte),
          observaciones: normalizeText(ccEditor.observaciones),
        }),
      });
      hydrate(payload);
      setCcEditor(null);
      notify("exito", payload.mensaje || "Saldo inicial guardado correctamente.");
    } catch (e) {
      notify("error", e?.message || "No se pudo guardar el saldo inicial.", 4500);
    } finally {
      setSaving(false);
    }
  }, [ccEditor, hydrate, notify]);

  const deleteCc = useCallback(async () => {
    if (!ccEditor?.exists) return;
    setSaving(true);
    try {
      const payload = await apiFetch("config_saldos_iniciales_cc_eliminar", {
        method: "POST",
        body: JSON.stringify({ tipo_entidad: ccEditor.tipo_entidad, id_entidad: ccEditor.id_entidad }),
      });
      hydrate(payload);
      setCcEditor(null);
      notify("exito", payload.mensaje || "Saldo inicial eliminado.");
    } catch (e) {
      notify("error", e?.message || "No se pudo eliminar el saldo inicial.", 4500);
    } finally {
      setSaving(false);
    }
  }, [ccEditor, hydrate, notify]);

  const saveCheque = useCallback(async () => {
    if (!normalizeText(chequeForm.emisor)) return notify("advertencia", "Ingresá el emisor del cheque/eCheq.");
    if (!normalizeText(chequeForm.numero_cheque)) return notify("advertencia", "Ingresá el número del cheque/eCheq.");
    const parsedImporte = parseMoney(chequeForm.importe);
    if (parsedImporte === null) return notify("advertencia", "Ingresá un importe válido.");
    if (!(Math.abs(parsedImporte) > 0)) return notify("advertencia", "Ingresá un importe mayor a cero.");
    if (chequeForm.fecha_emision && chequeForm.fecha_saldo && chequeForm.fecha_emision > chequeForm.fecha_saldo) {
      return notify("advertencia", "La fecha de emisión no puede ser posterior a la fecha de apertura.");
    }
    if (chequeForm.fecha_emision && chequeForm.fecha_pago && chequeForm.fecha_pago < chequeForm.fecha_emision) {
      return notify("advertencia", "La fecha de pago/vencimiento no puede ser anterior a la fecha de emisión.");
    }
    setSaving(true);
    try {
      const payload = await apiFetch("config_saldos_iniciales_cheque_crear", {
        method: "POST",
        body: JSON.stringify({
          ...chequeForm,
          importe: Math.abs(parsedImporte),
          emisor: normalizeText(chequeForm.emisor),
          numero_cheque: normalizeText(chequeForm.numero_cheque),
          observaciones: normalizeText(chequeForm.observaciones),
        }),
      });
      hydrate(payload);
      setChequeForm({
        tipo: chequeForm.tipo,
        fecha_saldo: chequeForm.fecha_saldo || todayISO(),
        fecha_emision: todayISO(),
        fecha_pago: todayISO(),
        emisor: "",
        numero_cheque: "",
        importe: "",
        observaciones: "",
      });
      notify("exito", payload.mensaje || "Cheque/eCheq inicial cargado.");
    } catch (e) {
      notify("error", e?.message || "No se pudo cargar el cheque/eCheq.", 4500);
    } finally {
      setSaving(false);
    }
  }, [chequeForm, hydrate, notify]);

  const deleteCheque = useCallback(async (row) => {
    if (!row?.id_cheque) return;
    setSaving(true);
    try {
      const payload = await apiFetch("config_saldos_iniciales_cheque_eliminar", {
        method: "POST",
        body: JSON.stringify({ id_cheque: row.id_cheque }),
      });
      hydrate(payload);
      notify("exito", payload.mensaje || "Cheque/eCheq inicial eliminado.");
    } catch (e) {
      notify("error", e?.message || "No se pudo eliminar el cheque/eCheq.", 4500);
    } finally {
      setSaving(false);
    }
  }, [hydrate, notify]);

  const configuredCount = useMemo(() => ({
    tesoreria: data.tesoreria.length,
    cc: [...data.clientes, ...data.proveedores].filter((r) => r.id_saldo_inicial != null).length,
    cheques: data.cheques.length,
  }), [data]);

  return (
    <>
      {toast && <Toast key={toast.key} tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={() => setToast(null)} />}
      <section className="cfg-si-page">
        <header className="cfg-si-hero">
          <button className="cfg-si-iconBtn" type="button" onClick={() => navigate("/panel/configuracion")} title="Volver a Configuración">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="cfg-si-heroText">
            <span className="cfg-si-eyebrow">Puesta en marcha</span>
            <h1>Saldos iniciales</h1>
            <p>Registrá la situación existente antes de comenzar a operar en Balto. Estos valores no generan ventas, compras, ingresos ni egresos ficticios.</p>
          </div>
          <button className="cfg-si-secondaryBtn" type="button" onClick={load} disabled={loading || saving}>
            <FontAwesomeIcon icon={faRotateLeft} /> Actualizar
          </button>
        </header>

        <div className="cfg-si-tabs" role="tablist">
          <button className={tab === "tesoreria" ? "is-active" : ""} onClick={() => setTab("tesoreria")} type="button">
            <FontAwesomeIcon icon={faWallet} /> Caja y cuentas <span>{configuredCount.tesoreria}</span>
          </button>
          <button className={tab === "cheques" ? "is-active" : ""} onClick={() => setTab("cheques")} type="button">
            <FontAwesomeIcon icon={faMoneyCheckDollar} /> Cheques <span>{configuredCount.cheques}</span>
          </button>
          <button className={tab === "cc" ? "is-active" : ""} onClick={() => setTab("cc")} type="button">
            <FontAwesomeIcon icon={faUsers} /> Cuentas corrientes <span>{configuredCount.cc}</span>
          </button>
        </div>

        <div className="cfg-si-scroll">
          {loading ? (
            <div className="cfg-si-empty">Cargando configuración de saldos iniciales…</div>
          ) : tab === "tesoreria" ? (
            <div className="cfg-si-panel">
              <div className="cfg-si-panelHead">
                <div><h2>Caja, banco y billeteras</h2><p>El importe representa el saldo disponible al inicio de la fecha indicada.</p></div>
                <button type="button" className="cfg-si-primaryBtn" onClick={saveTreasury} disabled={saving || !tesoreriaRows.length}>
                  <FontAwesomeIcon icon={faFloppyDisk} /> Guardar saldos
                </button>
              </div>
              <div className="cfg-si-warning">No incluyas cheques dentro de Banco o Efectivo. Los cheques se cargan individualmente en su pestaña. Si modificás un saldo ya configurado, Balto recalculará todos los saldos posteriores.</div>
              <div className="cfg-si-accountGrid">
                {tesoreriaRows.map((row, index) => (
                  <article className="cfg-si-accountCard" key={row.id_medio_pago}>
                    <div className="cfg-si-accountTop">
                      <span className="cfg-si-accountIcon"><FontAwesomeIcon icon={row.nombre.toUpperCase().includes("BANCO") ? faBuildingColumns : faWallet} /></span>
                      <div><strong>{row.nombre}</strong><small>{row.configured ? "Saldo configurado" : "Sin saldo inicial"}</small></div>
                    </div>
                    <label>Fecha de apertura<input type="date" max={todayISO()} value={row.fecha_saldo} onChange={(e) => setTesoreriaRows((prev) => prev.map((x, i) => i === index ? { ...x, fecha_saldo: e.target.value } : x))} /></label>
                    <label>Saldo inicial<div className="cfg-si-moneyInput"><span>$</span><input inputMode="decimal" placeholder="0,00" value={row.saldo} onChange={(e) => setTesoreriaRows((prev) => prev.map((x, i) => i === index ? { ...x, saldo: e.target.value } : x))} /></div></label>
                    <label>Observación<input type="text" maxLength={500} placeholder="Opcional" value={row.observaciones} onChange={(e) => setTesoreriaRows((prev) => prev.map((x, i) => i === index ? { ...x, observaciones: e.target.value } : x))} /></label>
                  </article>
                ))}
              </div>
            </div>
          ) : tab === "cheques" ? (
            <div className="cfg-si-panel">
              <div className="cfg-si-panelHead"><div><h2>Cheques y eCheq en cartera</h2><p>Cargá cada documento real que el negocio ya poseía al comenzar a usar Balto.</p></div></div>
              <div className="cfg-si-chequeForm">
                <label>Tipo<select value={chequeForm.tipo} onChange={(e) => setChequeForm((p) => ({ ...p, tipo: e.target.value }))}><option value="CHEQUE">Cheque</option><option value="ECHEQ">eCheq</option></select></label>
                <label>Fecha de apertura<input type="date" max={todayISO()} value={chequeForm.fecha_saldo} onChange={(e) => setChequeForm((p) => ({ ...p, fecha_saldo: e.target.value }))} /></label>
                <label>Fecha emisión<input type="date" max={todayISO()} value={chequeForm.fecha_emision} onChange={(e) => setChequeForm((p) => ({ ...p, fecha_emision: e.target.value }))} /></label>
                <label>Fecha de pago / vencimiento<input type="date" value={chequeForm.fecha_pago} onChange={(e) => setChequeForm((p) => ({ ...p, fecha_pago: e.target.value }))} /></label>
                <label className="cfg-si-span2">Emisor<input type="text" maxLength={150} value={chequeForm.emisor} onChange={(e) => setChequeForm((p) => ({ ...p, emisor: e.target.value.toLocaleUpperCase("es-AR") }))} /></label>
                <label>Número<input type="text" inputMode="numeric" maxLength={80} value={chequeForm.numero_cheque} onChange={(e) => setChequeForm((p) => ({ ...p, numero_cheque: e.target.value.replace(/[^0-9]/g, "") }))} /></label>
                <label>Importe<div className="cfg-si-moneyInput"><span>$</span><input inputMode="decimal" value={chequeForm.importe} onChange={(e) => setChequeForm((p) => ({ ...p, importe: e.target.value }))} /></div></label>
                <label className="cfg-si-span2">Observación<input type="text" maxLength={500} placeholder="Opcional" value={chequeForm.observaciones} onChange={(e) => setChequeForm((p) => ({ ...p, observaciones: e.target.value }))} /></label>
                <div className="cfg-si-chequeAction"><button className="cfg-si-primaryBtn" type="button" onClick={saveCheque} disabled={saving}><FontAwesomeIcon icon={faPlus} /> Cargar en cartera</button></div>
              </div>

              <div className="cfg-si-tableWrap">
                <table className="cfg-si-table"><thead><tr><th>Tipo</th><th>Número</th><th>Emisor</th><th>Apertura</th><th>Vencimiento</th><th className="is-right">Importe</th><th>Estado</th><th></th></tr></thead>
                  <tbody>{data.cheques.length ? data.cheques.map((r) => (
                    <tr key={r.id_cheque}><td>{r.tipo}</td><td>{r.numero_cheque}</td><td>{r.emisor}</td><td>{fmtDate(r.fecha_saldo)}</td><td>{fmtDate(r.fecha_pago)}</td><td className="is-right is-strong">{moneyARS(r.importe)}</td><td><span className={`cfg-si-state ${r.estado === "EN_CARTERA" ? "is-ok" : ""}`}>{String(r.estado || "").replaceAll("_", " ")}</span></td><td><button type="button" className="cfg-si-dangerIcon" title="Eliminar carga inicial" onClick={() => deleteCheque(r)} disabled={saving}><FontAwesomeIcon icon={faTrash} /></button></td></tr>
                  )) : <tr><td colSpan="8" className="cfg-si-tableEmpty">No hay cheques iniciales cargados.</td></tr>}</tbody></table>
              </div>
            </div>
          ) : (
            <div className="cfg-si-panel">
              <div className="cfg-si-panelHead"><div><h2>Cuentas corrientes</h2><p>Definí cuánto debía cada cliente o cuánto se debía a cada proveedor antes de Balto.</p></div></div>
              <div className="cfg-si-ccToolbar">
                <div className="cfg-si-segmented"><button type="button" className={ccTipo === "CLIENTE" ? "is-active" : ""} onClick={() => { setCcTipo("CLIENTE"); setCcEditor(null); }}>Clientes</button><button type="button" className={ccTipo === "PROVEEDOR" ? "is-active" : ""} onClick={() => { setCcTipo("PROVEEDOR"); setCcEditor(null); }}>Proveedores</button></div>
                <input className="cfg-si-search" type="search" placeholder={`Buscar ${ccTipo === "CLIENTE" ? "cliente" : "proveedor"}…`} value={ccSearch} onChange={(e) => setCcSearch(e.target.value)} />
              </div>
              <div className="cfg-si-ccList">
                {filteredCcRows.map((r) => {
                  const exists = r.id_saldo_inicial != null;
                  const saldo = Number(r.saldo || 0);
                  return <button type="button" className="cfg-si-ccRow" key={ccTipo === "CLIENTE" ? r.id_cliente : r.id_proveedor} onClick={() => openCcEditor(r)}>
                    <div><strong>{r.nombre}</strong><small>{exists ? `Desde ${fmtDate(r.fecha_saldo)}` : "Sin saldo inicial"}</small></div>
                    <div className={exists ? (saldo < 0 ? "cfg-si-saldo is-favor" : "cfg-si-saldo") : "cfg-si-saldo is-empty"}>{exists ? moneyARS(saldo) : "Cargar"}</div>
                  </button>;
                })}
                {!filteredCcRows.length && <div className="cfg-si-empty">No se encontraron resultados.</div>}
              </div>
            </div>
          )}
        </div>

        {ccEditor && (
          <div className="cfg-si-modalBack" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setCcEditor(null); }}>
            <div className="cfg-si-modal" role="dialog" aria-modal="true">
              <div className="cfg-si-modalHead"><div><small>{ccEditor.tipo_entidad === "CLIENTE" ? "Cliente" : "Proveedor"}</small><h3>{ccEditor.nombre}</h3></div><button type="button" onClick={() => setCcEditor(null)} disabled={saving}>×</button></div>
              <div className="cfg-si-modalBody">
                {ccEditor.exists && <div className="cfg-si-warning">Al modificar este saldo inicial también cambiarán los saldos posteriores de esta cuenta corriente.</div>}
                <label>Fecha de apertura<input type="date" max={todayISO()} value={ccEditor.fecha_saldo} onChange={(e) => setCcEditor((p) => ({ ...p, fecha_saldo: e.target.value }))} /></label>
                <label>Situación<select value={ccEditor.sentido} onChange={(e) => setCcEditor((p) => ({ ...p, sentido: e.target.value }))}>{ccEditor.tipo_entidad === "CLIENTE" ? <><option value="DEUDA">El cliente nos debe</option><option value="FAVOR">El cliente tiene saldo a favor</option></> : <><option value="DEUDA">Le debemos al proveedor</option><option value="FAVOR">Tenemos saldo a favor</option></>}</select></label>
                <label>Importe<div className="cfg-si-moneyInput"><span>$</span><input autoFocus inputMode="decimal" placeholder="0,00" value={ccEditor.importe} onChange={(e) => setCcEditor((p) => ({ ...p, importe: e.target.value }))} /></div></label>
                <label>Observación<textarea rows="3" maxLength={500} placeholder="Ej.: saldo anterior a la implementación de Balto" value={ccEditor.observaciones} onChange={(e) => setCcEditor((p) => ({ ...p, observaciones: e.target.value }))} /></label>
              </div>
              <div className="cfg-si-modalFoot">{ccEditor.exists && <button className="cfg-si-deleteBtn" type="button" onClick={deleteCc} disabled={saving}><FontAwesomeIcon icon={faTrash} /> Eliminar saldo</button>}<div className="cfg-si-modalFootRight"><button className="cfg-si-secondaryBtn" type="button" onClick={() => setCcEditor(null)} disabled={saving}>Cancelar</button><button className="cfg-si-primaryBtn" type="button" onClick={saveCc} disabled={saving}><FontAwesomeIcon icon={faFloppyDisk} /> Guardar</button></div></div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
