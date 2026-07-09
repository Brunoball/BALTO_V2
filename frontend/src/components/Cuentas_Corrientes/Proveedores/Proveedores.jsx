import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import BASE_URL from "../../../config/config";
import "../cuentas_corrientes.css";
import "../../Global/Global_css/Global_oscuro.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faFileExcel,
  faTimes,
  faEye,
  faInfoCircle,
  faBoxOpen,
  faChevronDown,
  faArrowRightLong,
  faMagnifyingGlass,
  faTrashCan,
  faArrowLeft,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";

import Toast from "../../Global/Toast.jsx";
import Calendario from "../../Global/Calendario/Calendario.jsx";
import ModalVerComprobante from "../../Global/Ver_Comprobantes/ModalVerComprobante.jsx";
import ModalEliminarMovimientos from "../../Global/Modales/ModalEliminar.jsx";
import ModalDetalleMovimiento from "../../Global/Modales/ModalDetalleMovimiento.jsx";
import { useDateRange } from "../../../context/DateRangeContext.jsx";
import BotonExportar from "../../Global/Boton_Exportar/BotonExportar.jsx";
import ModalProveedores from "./modales/ModalProveedores.jsx";

/* =========================
   Helpers
========================= */
function moneyARS(v) {
  const n = Number(v || 0);
  try {
    return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function saldoProveedorToneClass(value) {
  const n = Number(value || 0);
  if (n > 0) return "cc-money cc-money--negative";
  if (n < 0) return "cc-money cc-money--positive";
  return "cc-money cc-money--neutral";
}

function saldoTotalProveedorToneClass(totales) {
  const debito = Number(totales?.debito || 0);
  const credito = Number(totales?.credito || 0);

  if (debito > credito) return "cc-money cc-money--negative";
  if (credito > debito) return "cc-money cc-money--positive";
  return saldoProveedorToneClass(totales?.saldo);
}

function saldoMovimientoToneClass(row) {
  const debito = Number(row?.debito || 0);
  const credito = Number(row?.credito || 0);

  if (debito > 0 && credito <= 0) return "cc-money cc-money--negative";
  if (credito > 0 && debito <= 0) return "cc-money cc-money--positive";

  return saldoProveedorToneClass(row?.saldo);
}

function formatDateISO(d) {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(d) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

function safeText(v) {
  return String(v ?? "").trim();
}

function normLower(s) {
  return safeText(s).toLowerCase();
}

function formatDisplayDate(value) {
  const v = safeText(value);
  if (!v) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  }
  return v;
}

function getBaseOrigin() {
  try {
    return new URL(BASE_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

function resolveFileUrl(rawUrl) {
  const url = safeText(rawUrl);
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  const origin = getBaseOrigin();
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url.replace(/^\.?\//, "")}`;
}

function getAuthInfo() {
  const sessionKey = (
    localStorage.getItem("session_key") ||
    localStorage.getItem("sessionKey") ||
    localStorage.getItem("X-Session") ||
    ""
  ).trim();

  const token = (localStorage.getItem("token") || "").trim();

  let idUsuario = 0;
  try {
    const u = JSON.parse(localStorage.getItem("usuario") || "null");
    const cand =
      u?.idUsuarioMaster ??
      u?.idUsuario ??
      u?.id_usuario ??
      u?.id ??
      u?.user_id ??
      0;

    if (Number.isFinite(Number(cand))) {
      idUsuario = Number(cand);
    }
  } catch {}

  return { sessionKey, token, idUsuario };
}

function withSessionKey(url) {
  const base = safeText(url);
  if (!base) return "";
  try {
    const { sessionKey, token } = getAuthInfo();
    const u = new URL(base, window.location.origin);

    // No tocar URLs firmadas de R2/S3: agregar session_key/token rompe la firma.
    const isSignedObjectUrl =
      u.searchParams.has("X-Amz-Signature") ||
      u.searchParams.has("x-amz-signature") ||
      /r2\.cloudflarestorage\.com$/i.test(u.hostname);

    if (isSignedObjectUrl) {
      return u.toString();
    }

    if (sessionKey && !u.searchParams.has("session_key")) {
      u.searchParams.set("session_key", sessionKey);
    }

    if (token && !u.searchParams.has("token")) {
      u.searchParams.set("token", token);
    }

    return u.toString();
  } catch {
    return base;
  }
}

function ensureResourceHint(url, rel = "prefetch", as = "") {
  const href = safeText(url);
  if (!href) return;

  const finalAs = rel === "preload" ? safeText(as) : "";
  const key = `hint:${rel}:${finalAs}:${href}`;
  const selectorKey =
    typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(key)
      : key.replace(/"/g, '\\"');

  if (document.head.querySelector(`link[data-key="${selectorKey}"]`)) return;

  const link = document.createElement("link");
  link.rel = rel;

  if (rel === "preload" && finalAs) {
    link.as = finalAs;
  }

  link.href = href;
  link.setAttribute("data-key", key);
  document.head.appendChild(link);
}

function prewarmComprobanteUrl(url, mime = "") {
  const finalUrl = withSessionKey(url);
  if (!finalUrl) return;

  const mm = safeText(mime).toLowerCase();
  const ll = finalUrl.toLowerCase();

  const isPdf =
    mm.includes("pdf") ||
    ll.includes(".pdf") ||
    ll.includes("cc_comprobante_descargar");

  if (isPdf) {
    ensureResourceHint(finalUrl, "prefetch");
  } else {
    ensureResourceHint(finalUrl, "preload", "image");
    ensureResourceHint(finalUrl, "prefetch");
  }
}

function comprobanteLabelFromTipo(tipo = "", fallback = "Comprobante") {
  const t = safeText(tipo).toUpperCase();
  if (t === "VENTA_NO_FACTURADA") return "Venta no facturada";
  if (t === "FACTURA_INTERNA") return "Factura interna";
  if (["FACTURA", "FACTURA_FISCAL", "COMPROBANTE_FISCAL"].includes(t)) return "Factura";
  if (t === "REMITO") return "Remito";
  if (t === "RECIBO") return "Recibo";
  if (t === "ORDEN_PAGO") return "Orden de pago";
  if (t === "NOTA_CREDITO") return "Nota de crédito";
  if (t === "NOTA_DEBITO") return "Nota de débito";
  return safeText(fallback) || "Comprobante";
}

function comprobanteRank(doc) {
  const t = safeText(doc?.tipo || doc?.tipo_relacion || "").toUpperCase();
  const k = safeText(doc?.key || "").toLowerCase();
  if (["VENTA_NO_FACTURADA", "FACTURA_INTERNA", "FACTURA", "FACTURA_FISCAL", "COMPROBANTE_FISCAL"].includes(t) || k.includes("factura") || k.includes("venta_no_facturada")) return 10;
  if (["NOTA_CREDITO", "NOTA_DEBITO"].includes(t)) return 15;
  if (t === "REMITO" || k.includes("remito")) return 20;
  return 30;
}

function normalizeCCComprobanteDocs(row) {
  const rawDocsBase = Array.isArray(row?.comprobantes_detalle) ? row.comprobantes_detalle : [];
  const pagosDocs = Array.isArray(row?.medios_pago_detalle)
    ? row.medios_pago_detalle
        .map((medio) => {
          const id = Number(medio?.id_comprobante ?? medio?.id_archivo ?? 0);
          const rawUrl = safeText(medio?.url || medio?.archivo_url || medio?.comprobante_url || "");
          if (!id && !rawUrl) return null;

          const tipo = safeText(
            medio?.tipo ||
              medio?.tipo_archivo ||
              medio?.archivo_tipo ||
              (row?.id_proveedor ? "ORDEN_PAGO" : "RECIBO")
          ).toUpperCase();
          const label = safeText(medio?.label || medio?.title || comprobanteLabelFromTipo(tipo, "Comprobante de pago"));

          return {
            ...medio,
            id_comprobante: Number.isFinite(id) && id > 0 ? id : null,
            id_archivo: Number.isFinite(id) && id > 0 ? id : null,
            tipo,
            tipo_relacion: safeText(medio?.tipo_relacion || tipo).toUpperCase(),
            key: safeText(medio?.key || `${tipo || "comprobante_pago"}_${id || rawUrl}`).toLowerCase(),
            label,
            title: label,
            mime: safeText(medio?.mime || medio?.archivo_mime || "application/pdf") || "application/pdf",
            fileName: safeText(medio?.fileName || medio?.filename || `${label.toLowerCase().replace(/\s+/g, "_")}.pdf`),
            rawUrl,
            cacheSalt: safeText(medio?.archivo_path || medio?.archivo_created_at || medio?.created_at || tipo || id || rawUrl),
          };
        })
        .filter(Boolean)
    : [];

  const rawDocs = [...rawDocsBase, ...pagosDocs];
  const seenDocs = new Set();
  const docs = rawDocs
    .map((doc, index) => {
      const id = Number(doc?.id_comprobante ?? doc?.id_archivo ?? doc?.id ?? 0);
      const rawUrl = safeText(doc?.url || doc?.archivo_url || doc?.comprobante_url || "");
      if (!id && !rawUrl) return null;

      const tipo = safeText(doc?.tipo || doc?.tipo_relacion || doc?.archivo_tipo || "").toUpperCase();
      const label = safeText(doc?.label || doc?.title || comprobanteLabelFromTipo(tipo, `Comprobante ${index + 1}`));

      return {
        ...doc,
        id_comprobante: Number.isFinite(id) && id > 0 ? id : null,
        id_archivo: Number.isFinite(id) && id > 0 ? id : null,
        tipo,
        key: safeText(doc?.key || `${tipo || "comprobante"}_${id || index + 1}`).toLowerCase(),
        label,
        title: safeText(doc?.title || label),
        mime: safeText(doc?.mime || doc?.archivo_mime || row?.comprobante_mime || "application/pdf") || "application/pdf",
        fileName: safeText(doc?.fileName || doc?.filename || `${label.toLowerCase().replace(/\s+/g, "_")}.pdf`),
        rawUrl,
        cacheSalt: safeText(doc?.archivo_path || doc?.created_at || tipo || id || rawUrl),
      };
    })
    .filter((doc) => {
      if (!doc) return false;
      const key = doc.id_comprobante ? `id:${doc.id_comprobante}` : `url:${safeText(doc.rawUrl)}`;
      if (seenDocs.has(key)) return false;
      seenDocs.add(key);
      return true;
    });

  if (!docs.length) {
    const id = Number(row?.id_comprobante || 0);
    const rawUrl = safeText(row?.comprobante_url || "");
    if (id > 0 || rawUrl) {
      const tipo = safeText(row?.tipo_relacion || row?.comprobante_tipo || "COMPROBANTE").toUpperCase();
      const label = safeText(row?.comprobante || comprobanteLabelFromTipo(tipo, "Comprobante"));
      docs.push({
        id_comprobante: id > 0 ? id : null,
        id_archivo: id > 0 ? id : null,
        tipo,
        key: `${tipo.toLowerCase()}_${id || 1}`,
        label,
        title: label,
        mime: safeText(row?.comprobante_mime || "application/pdf") || "application/pdf",
        fileName: `${label.toLowerCase().replace(/\s+/g, "_")}.pdf`,
        rawUrl,
        cacheSalt: safeText(row?.archivo_path || tipo || id || rawUrl),
      });
    }
  }

  return docs.sort((a, b) => {
    const ra = comprobanteRank(a);
    const rb = comprobanteRank(b);
    if (ra !== rb) return ra - rb;
    return Number(a?.id_comprobante || 0) - Number(b?.id_comprobante || 0);
  });
}

function canPreviewComprobante(row) {
  return normalizeCCComprobanteDocs(row).length > 0;
}

function canDeleteCobro(row) {
  return Number(row?.id_cobro || 0) > 0;
}

/* =========================
   Export helpers
========================= */
function escapeCSV(value) {
  const s = String(value ?? "");
  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function buildExportRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    FECHA: formatDisplayDate(r.fecha || r.fecha_raw || ""),
    COMPROBANTE: safeText(r.comprobante || ""),
    DETALLE: safeText(r.detalle || ""),
    "DÉBITO (DEBE)": Number(r.debito || 0),
    "CRÉDITO (HABER)": Number(r.credito || 0),
    SALDO: Number(r.saldo || 0),
  }));
}

function buildHistorialExportRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    FECHA: formatDisplayDate(r.fecha || r.fecha_raw || ""),
    MOVIMIENTO: safeText(r.comprobante || ""),
    DETALLE: safeText(r.detalle || ""),
    TIPO: safeText(r.tipo_venta_nombre || r.tipo_venta || ""),
    ESTADO: safeText(r.estado_pago || ""),
    TOTAL: Number(r.monto_total ?? r.debito ?? 0),
    PAGADO: Number(r.total_pagado ?? r.credito ?? 0),
    SALDO: Number(r.saldo_movimiento ?? r.saldo ?? 0),
  }));
}

function buildProveedoresExportRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    PROVEEDOR: safeText(r.nombre || "-"),
    "SALDO ACTUAL": Number(r.saldo || 0),
  }));
}

/* =========================
   Auth
========================= */
function buildHeadersGET() {
  const { sessionKey, token } = getAuthInfo();
  const h = {};
  if (sessionKey) h["X-Session"] = sessionKey;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function buildHeadersJSON() {
  const { sessionKey, token } = getAuthInfo();
  const h = { "Content-Type": "application/json" };
  if (sessionKey) h["X-Session"] = sessionKey;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseJsonOrThrow(res) {
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `${res.status} (Unauthorized): Sesión vencida o no autorizada. Volvé a iniciar sesión.`
    );
  }
  const text = await res.text();
  if (!text) throw new Error("Respuesta vacía del servidor.");
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.length > 600 ? text.slice(0, 600) + "..." : text;
    throw new Error(`Respuesta inválida (no es JSON). HTTP ${res.status}\n${preview}`);
  }
}

async function apiGet(url) {
  const res = await fetch(url, { method: "GET", headers: buildHeadersGET() });
  return await parseJsonOrThrow(res);
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeadersJSON(),
    body: JSON.stringify(body ?? {}),
  });
  return await parseJsonOrThrow(res);
}

/* =========================
   Comprobante
========================= */
function makeComprobanteAccessUrl(row, API) {
  const idComprobante = Number(row?.id_comprobante || 0);
  if (idComprobante > 0) {
    return `${API}?action=cc_comprobante_descargar&id_comprobante=${idComprobante}`;
  }
  return resolveFileUrl(row?.comprobante_url);
}

export default function ProveedoresCC() {
  const API = `${String(BASE_URL || "").replace(/\/+$/, "")}/api.php`;
  const { dateRange, setDateRange } = useDateRange();

  const [calOpen, setCalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [summaryRows, setSummaryRows] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState(null);

  const [rows, setRows] = useState([]);
  const [totales, setTotales] = useState({ debito: 0, credito: 0, saldo: 0 });
  const [historialRows, setHistorialRows] = useState([]);
  const [historialTotales, setHistorialTotales] = useState({ debito: 0, credito: 0, saldo: 0 });
  const [activeDetailTab, setActiveDetailTab] = useState("cuenta");

  const [hasSearched, setHasSearched] = useState(false);
  const [queryUsed, setQueryUsed] = useState("");

  const comprobanteUrlCacheRef = useRef(new Map());

  const [previewComprobante, setPreviewComprobante] = useState({
    open: false,
    url: "",
    mime: "",
    title: "Comprobante",
    documents: [],
  });

  const [deleteState, setDeleteState] = useState({
    open: false,
    loading: false,
    row: null,
  });

  const [detalleMovimientoState, setDetalleMovimientoState] = useState({
    open: false,
    row: null,
  });

  const [toast, setToast] = useState(null);
  const [modalProveedoresOpen, setModalProveedoresOpen] = useState(false);

  const showToast = useCallback(
    (tipo, mensaje, duracion = 2800) => setToast({ tipo, mensaje, duracion }),
    []
  );

  const closeToast = useCallback(() => setToast(null), []);

  const rangeLabel = useMemo(() => {
    const from = dateRange?.from || null;
    const to = dateRange?.to || null;
    if (!from) return "Seleccionar período";
    if (!to || formatDateISO(from) === formatDateISO(to)) return formatDateLabel(from);
    return (
      <>
        <span>{formatDateLabel(from)}</span>
        <span className="cc-rangeArrow">
          <FontAwesomeIcon icon={faArrowRightLong} />
        </span>
        <span>{formatDateLabel(to)}</span>
      </>
    );
  }, [dateRange]);

  const exportBaseName = useMemo(() => {
    if (!selectedProveedor) {
      const safeSearch = String(q || "").trim().replace(/[^\w.-]+/g, "_");
      return safeSearch ? `cc_proveedores_${safeSearch}` : "cc_proveedores";
    }

    const safeName = String(queryUsed || selectedProveedor?.nombre || "proveedor").replace(/[^\w.-]+/g, "_");
    const from = formatDateISO(dateRange?.from);
    const to = formatDateISO(dateRange?.to || dateRange?.from);
    const detailSuffix = activeDetailTab === "historial" ? "historial" : "cuenta_corriente";
    return `cc_proveedor_${safeName}_${detailSuffix}_${from}_${to}`;
  }, [selectedProveedor, q, queryUsed, dateRange, activeDetailTab]);

  const filteredSummaryRows = useMemo(() => {
    const needle = normLower(q);
    const base = Array.isArray(summaryRows) ? summaryRows : [];
    if (!needle) return base;
    return base.filter((r) => normLower(r.nombre).includes(needle));
  }, [summaryRows, q]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`${API}?action=cc_saldos_proveedores`);
      if (!data || data.exito !== true) {
        throw new Error(data?.mensaje || "No se pudo cargar el listado de proveedores.");
      }
      const rowsApi = Array.isArray(data.rows) ? data.rows : [];
      const rowsOrdenadas = [...rowsApi].sort((a, b) =>
        safeText(a?.nombre).localeCompare(safeText(b?.nombre), "es", {
          sensitivity: "base",
          numeric: true,
        })
      );
      setSummaryRows(rowsOrdenadas);
    } catch (e) {
      setSummaryRows([]);
      showToast("error", e?.message || "Error cargando proveedores.", 3500);
    } finally {
      setLoading(false);
    }
  }, [API, showToast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const loadHistorial = useCallback(
    async (proveedor, options = {}) => {
      if (!proveedor?.id_proveedor) return;

      const keepSelection = options.keepSelection === true;

      setLoading(true);
      setHasSearched(true);

      if (!keepSelection) {
        setSelectedProveedor(proveedor);
        setQueryUsed(proveedor.nombre || "");
        setActiveDetailTab("cuenta");
        setHistorialRows([]);
        setHistorialTotales({ debito: 0, credito: 0, saldo: 0 });
      }

      try {
        const sp = new URLSearchParams();
        sp.set("action", "cc_historial_proveedor");
        sp.set("id_proveedor", String(proveedor.id_proveedor));

        if (dateRange?.from) {
          sp.set("fecha_desde", formatDateISO(dateRange.from));
          sp.set("fecha_hasta", formatDateISO(dateRange.to || dateRange.from));
        }

        const data = await apiGet(`${API}?${sp.toString()}`);
        if (!data || data.exito !== true) {
          throw new Error(data?.mensaje || "Error al cargar historial del proveedor.");
        }

        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotales(data.totales || { debito: 0, credito: 0, saldo: 0 });
      } catch (e) {
        setRows([]);
        setTotales({ debito: 0, credito: 0, saldo: 0 });
        showToast("error", e?.message || "Error inesperado", 4200);
      } finally {
        setLoading(false);
      }
    },
    [API, dateRange, showToast]
  );

  const loadMovimientosHistorial = useCallback(
    async (proveedor) => {
      if (!proveedor?.id_proveedor) return;

      setLoading(true);
      setHasSearched(true);

      try {
        const sp = new URLSearchParams();
        sp.set("action", "cc_movimientos_historial_proveedor");
        sp.set("id_proveedor", String(proveedor.id_proveedor));

        if (dateRange?.from) {
          sp.set("fecha_desde", formatDateISO(dateRange.from));
          sp.set("fecha_hasta", formatDateISO(dateRange.to || dateRange.from));
        }

        const data = await apiGet(`${API}?${sp.toString()}`);
        if (!data || data.exito !== true) {
          throw new Error(data?.mensaje || "Error al cargar historial completo del proveedor.");
        }

        setHistorialRows(Array.isArray(data.rows) ? data.rows : []);
        setHistorialTotales(data.totales || { debito: 0, credito: 0, saldo: 0 });
      } catch (e) {
        setHistorialRows([]);
        setHistorialTotales({ debito: 0, credito: 0, saldo: 0 });
        showToast("error", e?.message || "Error inesperado", 4200);
      } finally {
        setLoading(false);
      }
    },
    [API, dateRange, showToast]
  );

  useEffect(() => {
    if (!selectedProveedor?.id_proveedor) return;

    loadHistorial(selectedProveedor, { keepSelection: true });
    if (activeDetailTab === "historial") {
      loadMovimientosHistorial(selectedProveedor);
    }
  }, [dateRange?.from, dateRange?.to, selectedProveedor?.id_proveedor, activeDetailTab, loadHistorial, loadMovimientosHistorial]);

  const volverAlListado = useCallback(() => {
    setSelectedProveedor(null);
    setRows([]);
    setTotales({ debito: 0, credito: 0, saldo: 0 });
    setHistorialRows([]);
    setHistorialTotales({ debito: 0, credito: 0, saldo: 0 });
    setActiveDetailTab("cuenta");
    setHasSearched(false);
    setQueryUsed("");

    // Al volver desde el detalle, el saldo del listado debe recalcularse
    // porque una acción interna (por ejemplo eliminar un cobro) puede cambiarlo.
    loadSummary();
  }, [loadSummary]);

  const handleDetailTabChange = useCallback((tab) => {
    setActiveDetailTab(tab === "historial" ? "historial" : "cuenta");
  }, []);

  const getExportData = useCallback(() => {
    const data = selectedProveedor
      ? activeDetailTab === "historial"
        ? buildHistorialExportRows(historialRows)
        : buildExportRows(rows)
      : buildProveedoresExportRows(filteredSummaryRows);
    if (!data.length) throw new Error("No hay datos para exportar.");
    return data;
  }, [selectedProveedor, activeDetailTab, rows, historialRows, filteredSummaryRows]);

  const exportToExcel = useCallback(() => {
    const dataToExport = getExportData();
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws["!cols"] = selectedProveedor
      ? [
          { wch: 14 },
          { wch: 28 },
          { wch: 28 },
          { wch: 16 },
          { wch: 16 },
          { wch: 16 },
        ]
      : [
          { wch: 42 },
          { wch: 18 },
        ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      selectedProveedor ? (activeDetailTab === "historial" ? "Historial Proveedor" : "Cuenta Corriente Proveedor") : "Proveedores"
    );
    XLSX.writeFile(wb, `${exportBaseName}.xlsx`);
  }, [getExportData, exportBaseName, selectedProveedor, activeDetailTab]);

  const exportToCSV = useCallback(() => {
    const dataToExport = getExportData();
    const headers = Object.keys(dataToExport[0] || {});
    const lines = [
      headers.join(";"),
      ...dataToExport.map((row) => headers.map((h) => escapeCSV(row[h])).join(";")),
    ];
    const csvContent = "\uFEFF" + lines.join("\n");
    downloadBlob(csvContent, `${exportBaseName}.csv`, "text/csv;charset=utf-8;");
  }, [getExportData, exportBaseName]);

  const exportToTXT = useCallback(() => {
    const dataToExport = getExportData();
    const lines = dataToExport.map((row, index) => {
      const rowLines = Object.entries(row).map(([key, value]) => `${key}: ${value ?? ""}`);
      return [`REGISTRO ${index + 1}`, ...rowLines, "----------------------------------------"].join("\n");
    });
    downloadBlob(lines.join("\n"), `${exportBaseName}.txt`, "text/plain;charset=utf-8;");
  }, [getExportData, exportBaseName]);

  const handleExport = useCallback(
    async (type) => {
      try {
        if (type === "excel") {
          exportToExcel();
          showToast("exito", "Excel exportado.", 2200);
          return;
        }
        if (type === "csv") {
          exportToCSV();
          showToast("exito", "CSV exportado.", 2200);
          return;
        }
        if (type === "txt") {
          exportToTXT();
          showToast("exito", "TXT exportado.", 2200);
        }
      } catch (e) {
        showToast("error", e?.message || "Error exportando archivo.", 3500);
      }
    },
    [exportToExcel, exportToCSV, exportToTXT, showToast]
  );

  const exportOptions = useMemo(() => {
    const excelOption = {
      key: "excel",
      label: selectedProveedor ? "Exportar Excel (.xlsx)" : "Exportar listado Excel (.xlsx)",
      icon: faFileExcel,
      onClick: () => handleExport("excel"),
    };

    if (!selectedProveedor) return [excelOption];

    return [
      excelOption,
      {
        key: "csv",
        label: "Exportar CSV (.csv)",
        onClick: () => handleExport("csv"),
      },
      {
        key: "txt",
        label: "Exportar TXT (.txt)",
        onClick: () => handleExport("txt"),
      },
    ];
  }, [handleExport, selectedProveedor]);

  const getComprobanteResolvedUrl = useCallback(
    async (doc) => {
      const idComp = Number(doc?.id_comprobante || doc?.id_archivo || 0);
      const rawUrl = safeText(doc?.rawUrl || doc?.url || doc?.archivo_url || doc?.comprobante_url || "");

      if (idComp <= 0) {
        return resolveFileUrl(rawUrl);
      }

      const cacheKey = `id:${idComp}:${safeText(doc?.cacheSalt || doc?.tipo || doc?.key || "")}`;
      if (comprobanteUrlCacheRef.current.has(cacheKey)) {
        return comprobanteUrlCacheRef.current.get(cacheKey) || "";
      }

      const data = await apiGet(`${API}?action=cc_comprobante_info&id_comprobante=${idComp}&_=${Date.now()}`);
      if (!data || data.exito !== true) {
        throw new Error(data?.mensaje || "No se pudo obtener el comprobante.");
      }

      const payload = data?.data || {};
      const finalUrl = safeText(
        data?.url ||
          data?.download_url ||
          data?.archivo_url ||
          payload?.url ||
          payload?.download_url ||
          payload?.archivo_url ||
          payload?.cc_download_url ||
          rawUrl
      );

      if (!finalUrl) {
        throw new Error("El backend no devolvió la URL del comprobante.");
      }

      comprobanteUrlCacheRef.current.set(cacheKey, finalUrl);
      return finalUrl;
    },
    [API]
  );

  const buildComprobantePreviewDocs = useCallback(
    async (row) => {
      const candidates = normalizeCCComprobanteDocs(row);
      const docs = (
        await Promise.all(
          candidates.map(async (doc) => ({
            ...doc,
            url: await getComprobanteResolvedUrl(doc),
          }))
        )
      ).filter((doc) => safeText(doc?.url) !== "");

      return docs;
    },
    [getComprobanteResolvedUrl]
  );

  const handlePrewarmComprobante = useCallback(
    (row) => {
      normalizeCCComprobanteDocs(row).forEach((doc) => {
        getComprobanteResolvedUrl(doc)
          .then((url) => prewarmComprobanteUrl(url, safeText(doc?.mime || doc?.archivo_mime)))
          .catch(() => {});
      });
    },
    [getComprobanteResolvedUrl]
  );

  const openComprobante = useCallback(
    async (row) => {
      const candidates = normalizeCCComprobanteDocs(row);
      if (!candidates.length) {
        showToast("advertencia", "Este registro no tiene comprobante asociado.", 2600);
        return;
      }

      try {
        const docs = await buildComprobantePreviewDocs(row);
        if (!docs.length) {
          showToast("advertencia", "Este registro no tiene comprobante asociado.", 2600);
          return;
        }

        docs.forEach((doc) => prewarmComprobanteUrl(doc.url, safeText(doc?.mime || doc?.archivo_mime)));

        const isHistorialMovimiento = row?.tipo_registro === "historial_movimiento";
        const isCobro = !isHistorialMovimiento && Number(row?.credito || 0) > 0;
        const isMovimiento = isHistorialMovimiento || Number(row?.debito || 0) > 0;

        setPreviewComprobante({
          open: true,
          url: docs[0]?.url || "",
          mime: docs[0]?.mime || docs[0]?.archivo_mime || safeText(row?.comprobante_mime) || "application/pdf",
          title: isCobro
          ? row?.comprobante
            ? `Orden de pago · ${row.comprobante}`
            : "Orden de pago"
          : isMovimiento
          ? row?.tipo_registro === "historial_movimiento"
            ? "Comprobantes del movimiento"
            : "Comprobantes de Compra"
          : "Comprobante",
          documents: docs,
        });
      } catch (e) {
        showToast("error", e?.message || "No se pudieron abrir los comprobantes.", 3200);
      }
    },
    [buildComprobantePreviewDocs, showToast]
  );

  const askDeleteCobro = useCallback((row) => {
    if (!canDeleteCobro(row)) return;
    setDeleteState({ open: true, loading: false, row });
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteState({ open: false, loading: false, row: null });
  }, []);

  const closePreviewComprobante = useCallback(() => {
    setPreviewComprobante({ open: false, url: "", mime: "", title: "Comprobante", documents: [] });
  }, []);

  const openDetalleMovimiento = useCallback((row) => {
    if (!row) return;

    const proveedorNombre = safeText(
      row?.proveedor ||
        row?.nombre_proveedor ||
        row?.razon_social_proveedor ||
        row?.proveedor_nombre ||
        selectedProveedor?.nombre
    );

    setDetalleMovimientoState({
      open: true,
      row: {
        ...row,
        id_proveedor: row?.id_proveedor ?? selectedProveedor?.id_proveedor ?? null,
        proveedor: row?.proveedor || proveedorNombre,
        nombre_proveedor: row?.nombre_proveedor || proveedorNombre,
        razon_social_proveedor: row?.razon_social_proveedor || proveedorNombre,
        proveedor_nombre: row?.proveedor_nombre || proveedorNombre,
      },
    });
  }, [selectedProveedor]);

  const closeDetalleMovimiento = useCallback(() => {
    setDetalleMovimientoState({
      open: false,
      row: null,
    });
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;

      if (modalProveedoresOpen) return;

      const stopEscape = () => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
      };

      if (deleteState.open) {
        stopEscape();
        if (!deleteState.loading) closeDeleteModal();
        return;
      }

      if (previewComprobante.open) {
        stopEscape();
        closePreviewComprobante();
        return;
      }

      if (detalleMovimientoState.open) {
        stopEscape();
        closeDetalleMovimiento();
      }
    };

    document.addEventListener("keydown", h, true);
    return () => document.removeEventListener("keydown", h, true);
  }, [
    modalProveedoresOpen,
    deleteState.open,
    deleteState.loading,
    previewComprobante.open,
    detalleMovimientoState.open,
    closeDeleteModal,
    closePreviewComprobante,
    closeDetalleMovimiento,
  ]);

  const refreshCurrent = useCallback(async () => {
    if (selectedProveedor?.id_proveedor) {
      await loadHistorial(selectedProveedor, { keepSelection: true });
      if (activeDetailTab === "historial") {
        await loadMovimientosHistorial(selectedProveedor);
      }
      await loadSummary();
      return;
    }

    await loadSummary();
  }, [selectedProveedor, activeDetailTab, loadHistorial, loadMovimientosHistorial, loadSummary]);

  const refreshAfterProveedoresUpdate = useCallback(async () => {
    await loadSummary();

    if (selectedProveedor?.id_proveedor) {
      try {
        await loadHistorial(selectedProveedor, { keepSelection: true });
        if (activeDetailTab === "historial") {
          await loadMovimientosHistorial(selectedProveedor);
        }
      } catch {
        volverAlListado();
      }
    }
  }, [loadSummary, selectedProveedor, activeDetailTab, loadHistorial, loadMovimientosHistorial, volverAlListado]);

  const confirmDeleteCobro = useCallback(async () => {
    const row = deleteState.row;
    const idCobro = Number(row?.id_cobro || 0);
    if (idCobro <= 0) {
      throw new Error("No se encontró un id_cobro válido.");
    }

    const { idUsuario } = getAuthInfo();

    setDeleteState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await apiPost(`${API}?action=cc_eliminar_cobro`, {
        id_cobro: idCobro,
        idUsuario,
      });

      if (!data || data.exito !== true) {
        throw new Error(data?.mensaje || "No se pudo eliminar el cobro.");
      }

      closeDeleteModal();
      await refreshCurrent();
    } catch (e) {
      setDeleteState((prev) => ({ ...prev, loading: false }));
      throw e;
    }
  }, [deleteState.row, API, closeDeleteModal, refreshCurrent]);

  const isDetailMode = !!selectedProveedor;
  const isHistorialTab = activeDetailTab === "historial";
  const detailRows = isHistorialTab ? historialRows : rows;
  const detailTotales = isHistorialTab ? historialTotales : totales;
  const detailCount = detailRows.length;

  return (
    <div className="contenedor-cards mov-page">
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={closeToast}
        />
      )}

      <ModalVerComprobante
        open={previewComprobante.open}
        url={previewComprobante.url}
        mime={previewComprobante.mime}
        documents={previewComprobante.documents}
        title={previewComprobante.title}
        onClose={closePreviewComprobante}
      />

      <ModalDetalleMovimiento
        open={detalleMovimientoState.open}
        row={detalleMovimientoState.row}
        onClose={closeDetalleMovimiento}
        title="Detalle del movimiento"
      />

      <ModalEliminarMovimientos
        open={deleteState.open}
        row={{
          ...deleteState.row,
          id_movimiento: deleteState.row?.id_cobro ?? null,
          tipo_movimiento: "Cobro CC Proveedor",
          detalle: deleteState.row
            ? `Comprobante: ${safeText(deleteState.row.comprobante) || "-"} · Fecha: ${
                formatDisplayDate(deleteState.row.fecha || deleteState.row.fecha_raw) || "-"
              }`
            : "",
          monto_total: Number(deleteState.row?.credito || 0),
        }}
        loading={deleteState.loading}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteCobro}
        onToast={showToast}
        title="Eliminar registro de cobro"
        message="¿Seguro que querés eliminar solo este cobro de la cuenta corriente?"
        warning="No se eliminará la deuda ni el movimiento original. Solo el cobro seleccionado."
        loadingMessage="Eliminando cobro…"
        successMessage="Cobro eliminado correctamente."
        errorMessage="No se pudo eliminar el cobro."
        confirmLabel="Eliminar cobro"
        cancelLabel="Cancelar"
      />

      <ModalProveedores
        open={modalProveedoresOpen}
        onClose={() => setModalProveedoresOpen(false)}
        onActualizado={refreshAfterProveedoresUpdate}
        onToast={showToast}
      />

      <div className="mov-card__head">
        <div className="mov-card__headLeft">
          <div className="title-mov">
            <div className="mov-card__title">
              {isDetailMode ? `${selectedProveedor.nombre}` : "Cuentas Corrientes"}
            </div>

            <div className="mov-card__hint">
              {isDetailMode ? (
                <>
                  Mostrando <b>{detailCount}</b> registro{detailCount === 1 ? "" : "s"}
                </>
              ) : (
                <>
                  Mostrando <b>{filteredSummaryRows.length}</b> proveedor
                  {filteredSummaryRows.length === 1 ? "" : "es"}
                </>
              )}
            </div>
          </div>

          <div className="mov-headFilters">
            {isDetailMode && (
              <div className="cc-filter cc-filter--cal">
                <div
                  className={`cc-floatingField cc-floatingField--calendar is-active ${
                    calOpen ? "is-open" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`cc-calTrigger ${calOpen ? "is-open" : ""}`}
                    onClick={() => setCalOpen((v) => !v)}
                    disabled={loading}
                  >
                    {rangeLabel}
                    <span className="cc-calTrigger__iconRight">
                      <FontAwesomeIcon icon={faChevronDown} />
                    </span>
                  </button>

                  <span className="cc-floatingLabel cc-floatingLabel--active">
                    <FontAwesomeIcon icon={faCalendarDays} /> Período
                  </span>

                  {calOpen && (
                    <div className="cc-calDropdown">
                      <Calendario
                        value={dateRange}
                        onChange={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to) setCalOpen(false);
                        }}
                        onClose={() => setCalOpen(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="cc-filter cc-filter--search" id="vents-comppr-wits">
              <div className="cc-floatingField cc-floatingField--search is-active">
                <div className="cc-searchInput">
                  <div className="cc-searchInput__fieldWrap">
                    <input
                      className="cc-input cc-input--floating"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar por proveedor..."
                      disabled={loading}
                    />

                    <span className="cc-floatingLabel">
                      <FontAwesomeIcon icon={faMagnifyingGlass} /> Búsqueda
                    </span>

                    {safeText(q) !== "" && !loading && (
                      <button
                        type="button"
                        className="cc-clearSearch cc-clearSearch--inside"
                        onClick={() => setQ("")}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="cc-row-actions">
              <button
                type="button"
                className="mov-btn mov-btn--ghost mov-btn--icon cc-row-actions__btn"
                onClick={() => setModalProveedoresOpen(true)}
                disabled={loading}
                title={!isDetailMode ? "Proveedores" : "Nuevo proveedor"}
              >
                <FontAwesomeIcon icon={faUserPlus} />
                {!isDetailMode && <span style={{ marginLeft: 8 }}>Proveedores</span>}
              </button>

              <div className="cc-row-actions__export">
                <BotonExportar
                  disabled={loading || (isDetailMode ? detailRows.length === 0 : filteredSummaryRows.length === 0)}
                  loading={false}
                  label="Exportar"
                  opciones={exportOptions}
                  align="right"
                />
              </div>

              {isDetailMode && (
                <button
                  type="button"
                  className="mov-btn mov-btn--ghost mov-btn--icon cc-row-actions__btn"
                  onClick={volverAlListado}
                  title="Volver"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isDetailMode && (
        <div className="cc-detailTabs" role="tablist" aria-label="Detalle de cuenta corriente">
          <button
            type="button"
            role="tab"
            aria-selected={activeDetailTab === "cuenta"}
            className={`cc-detailTab ${activeDetailTab === "cuenta" ? "is-active" : ""}`}
            onClick={() => handleDetailTabChange("cuenta")}
            disabled={loading}
          >
            Cuenta corriente
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeDetailTab === "historial"}
            className={`cc-detailTab ${activeDetailTab === "historial" ? "is-active" : ""}`}
            onClick={() => handleDetailTabChange("historial")}
            disabled={loading}
          >
            Historial
          </button>
        </div>
      )}

      {!isDetailMode ? (
        <div className="cc-cliente-table">
          <div
            className="mov-gridTable mov-gridTable--head cc-cliente-table__desktopHead"
            style={{ gridTemplateColumns: "2fr 1fr" }}
          >
            <div className="mov-gridCell mov-gridCell--head">Proveedor</div>
            <div className="mov-gridCell mov-gridCell--head is-right">Saldo actual</div>
          </div>

          <div className="cc-cliente-table__body">
            {loading ? (
              <div className="mov-emptyRow">Cargando proveedores…</div>
            ) : filteredSummaryRows.length > 0 ? (
              filteredSummaryRows.map((r) => (
                <button
                  key={r.id_proveedor}
                  type="button"
                  className="mov-gridTable mov-gridTable--row cc-cliente-table__movRow"
                  style={{ gridTemplateColumns: "2fr 1fr", width: "100%" }}
                  onClick={() => loadHistorial(r)}
                >
                  <div className="mov-gridCell is-strong">
                    <span className="mov-ellipsissss mov-ellipsialingf">{r.nombre || "-"}</span>
                  </div>
                  <div className="mov-gridCell is-right is-strong">
                    <span className={`mov-ellipsissss ${saldoProveedorToneClass(r.saldo)}`}>{moneyARS(r.saldo || 0)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="mov-emptyRow cc-emptyState">
                <FontAwesomeIcon icon={faBoxOpen} className="cc-emptyIcon" />
                <div className="cc-emptyText">No se encontraron proveedores.</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="cc-cliente-table">
          <div
            className="mov-gridTable mov-gridTable--head cc-cliente-table__desktopHead"
            style={{ gridTemplateColumns: ".8fr 2.2fr 1fr 1fr 1fr .9fr" }}
          >
            <div className="mov-gridCell mov-gridCell--head">Fecha</div>
            <div className="mov-gridCell mov-gridCell--head">{isHistorialTab ? "Movimiento" : "Comprobante"}</div>
            <div className="mov-gridCell mov-gridCell--head is-right">{isHistorialTab ? "Total" : "Débito"}</div>
            <div className="mov-gridCell mov-gridCell--head is-right">{isHistorialTab ? "Pagado" : "Crédito"}</div>
            <div className="mov-gridCell mov-gridCell--head is-right">Saldo</div>
            <div className="mov-gridCell mov-gridCell--head is-center">Acciones</div>
          </div>

          <div className="cc-cliente-table__body">
            {loading ? (
              <div className="mov-emptyRow">{isHistorialTab ? "Cargando historial completo…" : "Cargando cuenta corriente del proveedor…"}</div>
            ) : detailRows.length > 0 ? (
              detailRows.map((r, i) => {
                const verHabilitado = canPreviewComprobante(r);
                const puedeEliminar = !isHistorialTab && canDeleteCobro(r);
                const isCobro = !isHistorialTab && Number(r.credito || 0) > 0;

                return (
                  <div
                    key={r.id || `${i}`}
                    className="mov-gridTable mov-gridTable--row"
                    style={{ gridTemplateColumns: ".8fr 2.2fr 1fr 1fr 1fr .9fr" }}
                  >
                    <div className="mov-gridCell">
                      <span className="mov-ellipsissss">
                        {formatDisplayDate(r.fecha || r.fecha_raw)}
                      </span>
                    </div>

                    <div className="mov-gridCell is-strong">
                      <span className="mov-ellipsissss">{r.comprobante || "-"}</span>
                    </div>

                    <div className="mov-gridCell is-right">
                      <span className="mov-ellipsissss cc-money cc-money--negative">
                        {Number(r.debito || 0) > 0 ? moneyARS(r.debito) : "—"}
                      </span>
                    </div>

                    <div className="mov-gridCell is-right">
                      <span className="mov-ellipsissss cc-money cc-money--positive">
                        {Number(r.credito || 0) > 0 ? moneyARS(r.credito) : "—"}
                      </span>
                    </div>

                    <div className="mov-gridCell is-right is-strong">
                      <span className={`mov-ellipsissss ${saldoMovimientoToneClass(r)}`}>{moneyARS(r.saldo || 0)}</span>
                    </div>

                    <div className="mov-gridCell mov-gridCell--actions">
                      <div className="mov-actionsInline">
                        <button
                          type="button"
                          onMouseEnter={() => verHabilitado && handlePrewarmComprobante(r)}
                          onPointerEnter={() => verHabilitado && handlePrewarmComprobante(r)}
                          onFocus={() => verHabilitado && handlePrewarmComprobante(r)}
                          onClick={() => verHabilitado && openComprobante(r)}
                          disabled={!verHabilitado}
                          title={
                            verHabilitado
                              ? isCobro
                                ? "Ver recibo / comprobante del cobro"
                                : "Ver factura / comprobante de la deuda"
                              : "Este registro no tiene comprobante asociado"
                          }
                          className="mov-iconBtn"
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>

                        {isHistorialTab ? (
                          <button
                            type="button"
                            onClick={() => openDetalleMovimiento(r)}
                            title="Ver detalle completo del movimiento"
                            className="mov-iconBtn"
                          >
                            <FontAwesomeIcon icon={faInfoCircle} />
                          </button>
                        ) : null}

                        {puedeEliminar ? (
                          <button
                            type="button"
                            onClick={() => askDeleteCobro(r)}
                            title="Eliminar solo este registro de cobro"
                            className="mov-iconBtn mov-iconBtn--danger"
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="mov-emptyRow cc-emptyState">
                <FontAwesomeIcon icon={faBoxOpen} className="cc-emptyIcon" />
                <div className="cc-emptyText">
                  {hasSearched
                    ? isHistorialTab
                      ? `No se encontraron movimientos en el historial de "${queryUsed}".`
                      : `No se encontraron registros de cuenta corriente para "${queryUsed}".`
                    : "Sin movimientos para mostrar."}
                </div>
              </div>
            )}
          </div>

          <div className="cc-cliente-table__footWrap">
            <div
              className="mov-gridTable mov-gridTable_rsp"
              style={{ gridTemplateColumns: ".8fr 2.2fr 1fr 1fr 1fr .9fr" }}
            >
              <div className="mov-gridCell is-strong">Totales</div>
              <div className="mov-gridCell mov-gridCellf vacio"></div>
              <div className="mov-gridCell mov-gridCellf is-right is-strong cc-money cc-money--negative">
                {moneyARS(detailTotales?.debito || 0)}
              </div>
              <div className="mov-gridCell mov-gridCellf is-right is-strong cc-money cc-money--positive">
                {moneyARS(detailTotales?.credito || 0)}
              </div>
              <div className={`mov-gridCell mov-gridCellf is-right is-strong ${saldoTotalProveedorToneClass(detailTotales)}`}>
                {moneyARS(detailTotales?.saldo || 0)}
              </div>
              <div className="mov-gridCell vacio mov-gridCellf"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}