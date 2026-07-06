import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ModalCargaMasiva from "./modales/ModalCargaMasiva";
import ModalEditarProducto from "./modales/ModalEditarStock";
import ModalAjustePrecios from "./modales/ModalAjustePrecios";
import ModalHistorialPreciosProducto from "./modales/ModalHistorialPreciosProducto";
import ModalEliminar from "../Global/Modales/ModalEliminar";
import Toast from "../Global/Toast";
import BASE_URL from "../../config/config";
import BaltoCargaGif from "../../imagenes/Balto_Carga.gif";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faMagnifyingGlass,
  faTimes,
  faPenToSquare,
  faTrashCan,
  faBoxOpen,
  faChevronUp,
  faChevronDown,
  faSort,
  faLayerGroup,
  faMoneyBillTrendUp,
  faClockRotateLeft,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import "./Stock.css";
import "../Global/Global_css/Global_Section.css";

const API_URL = `${String(BASE_URL || "").replace(/\/+$/, "")}/api.php`;
const TOAST_LOADING_DURATION = 90000;
const PRECIOS_MASIVOS_LOADING_THRESHOLD = 10;


function buildHeadersGET() {
  const sessionKey = (localStorage.getItem("session_key") || "").trim();
  const token = (localStorage.getItem("token") || "").trim();
  const h = {};
  if (sessionKey) h["X-Session"] = sessionKey;
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function buildHeadersJSON() {
  const sessionKey = (localStorage.getItem("session_key") || "").trim();
  const token = (localStorage.getItem("token") || "").trim();
  const h = { "Content-Type": "application/json" };
  if (sessionKey) h["X-Session"] = sessionKey;
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function withSessionKey(url) {
  const base = String(url || "").trim();
  if (!base) return "";

  try {
    const sessionKey = (localStorage.getItem("session_key") || "").trim();
    const token = (localStorage.getItem("token") || "").trim();
    const u = new URL(base, window.location.origin);

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

function notifyListsUpdated() {
  try {
    window.dispatchEvent(new CustomEvent("balto:listas-updated"));
  } catch {}
}

async function parseJsonOrThrow(res) {
  if (res.status === 401 || res.status === 403) {
    throw new Error(`${res.status}: Sesión vencida o no autorizada. Volvé a iniciar sesión.`);
  }

  const text = await res.text();
  if (!text) throw new Error("Respuesta vacía del servidor.");

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.length > 400 ? `${text.slice(0, 400)}...` : text;
    throw new Error(
      text.startsWith("<!DOCTYPE") || text.startsWith("<")
        ? "La API devolvió HTML en vez de JSON. Revisá la ruta del backend."
        : `Respuesta inválida del servidor. HTTP ${res.status}\n${preview}`
    );
  }
}

async function apiGet(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: buildHeadersGET(),
    cache: "no-store",
  });
  return await parseJsonOrThrow(res);
}

async function apiPost(url, body) {
  const { action, ...rest } = body ?? {};
  const finalUrl = action ? `${url}?action=${encodeURIComponent(action)}` : url;

  const res = await fetch(finalUrl, {
    method: "POST",
    headers: buildHeadersJSON(),
    body: JSON.stringify(rest),
  });

  return await parseJsonOrThrow(res);
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";

  const raw = typeof value === "string" ? value.replace(",", ".") : value;
  const n = Number(raw);

  if (!Number.isFinite(n)) return "—";

  return `$${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toNonNegativeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function esToastCarga(tipo) {
  const t = String(tipo || "").toLowerCase().trim();
  return t === "loading" || t === "cargando" || t === "carga" || t === "loader";
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function compareValues(a, b, campo) {
  const va = a?.[campo];
  const vb = b?.[campo];

  if (campo === "stock" || campo === "precio_costo" || campo === "precio" || campo === "precio_promo") {
    const na = Number(String(va ?? 0).replace(",", "."));
    const nb = Number(String(vb ?? 0).replace(",", "."));
    return na - nb;
  }

  return String(va ?? "").localeCompare(String(vb ?? ""), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function getProductoId(prod) {
  return Number(prod?.id ?? prod?.id_stock_producto ?? 0);
}

function getProductoCategoriaId(prod) {
  return Number(
    prod?.id_stock_categoria ??
      prod?.stock_categoria_id ??
      prod?.id_categoria_stock ??
      prod?.id_categoria ??
      0
  );
}

function productoTieneCategoria(prod, categoriaId) {
  const id = Number(categoriaId || 0);
  if (!id) return true;
  if (getProductoCategoriaId(prod) === id) return true;
  const cats = Array.isArray(prod?.categorias) ? prod.categorias : [];
  return cats.some((cat) => Number(cat?.id_stock_categoria ?? cat?.id ?? 0) === id);
}

function productoTieneCategoriaEnSet(prod, categoriaIds) {
  if (!(categoriaIds instanceof Set) || categoriaIds.size === 0) return true;

  const principal = getProductoCategoriaId(prod);
  if (principal > 0 && categoriaIds.has(principal)) return true;

  const cats = Array.isArray(prod?.categorias) ? prod.categorias : [];
  return cats.some((cat) => {
    const id = Number(cat?.id_stock_categoria ?? cat?.id ?? cat?.id_categoria_stock ?? 0);
    return id > 0 && categoriaIds.has(id);
  });
}

function normalizeCategoria(cat = {}) {
  const id = Number(cat?.id ?? cat?.id_stock_categoria ?? 0);
  return {
    ...cat,
    id,
    id_stock_categoria: id,
    id_categoria_padre: Number(cat?.id_categoria_padre || 0) || null,
    nivel: Number(cat?.nivel || 0),
    nombre: String(cat?.nombre ?? cat?.label ?? ""),
    nombre_mostrar: String(cat?.nombre_mostrar ?? `${"— ".repeat(Number(cat?.nivel || 0))}${cat?.nombre ?? cat?.label ?? ""}`),
  };
}

function normalizeProductoListItem(prod = {}) {
  const id = getProductoId(prod);
  if (!id) return null;

  const categoriaId = Number(
    prod?.id_stock_categoria ??
      prod?.stock_categoria_id ??
      prod?.id_categoria_stock ??
      prod?.id_categoria ??
      0
  );

  return {
    ...prod,
    id,
    id_stock_producto: Number(prod?.id_stock_producto ?? id),
    nombre: String(prod?.nombre ?? ""),
    sku: String(prod?.sku ?? ""),
    stock: prod?.stock ?? 0,
    precio_costo: prod?.precio_costo ?? null,
    precio: prod?.precio ?? null,
    precio_promo: prod?.precio_promo ?? null,
    descripcion: prod?.descripcion ?? "",
    imagen_archivo_id:
      Number(prod?.imagen_archivo_id ?? prod?.id_archivo_imagen ?? prod?.archivo_id ?? 0) || 0,
    id_stock_categoria: categoriaId || null,
    id_categoria_stock: categoriaId || null,
    activo: Number(prod?.activo ?? 1),
    tiene_variantes: Number(prod?.tiene_variantes || 0) === 1,
    cantidad_variantes: Number(prod?.cantidad_variantes || 0),
    cantidad_variantes_total: Number(prod?.cantidad_variantes_total ?? prod?.cantidad_variantes ?? 0),
    cantidad_variantes_activas: Number(prod?.cantidad_variantes_activas ?? prod?.cantidad_variantes ?? 0),
    cantidad_variantes_inactivas: Number(prod?.cantidad_variantes_inactivas ?? 0),
    categorias: Array.isArray(prod?.categorias) ? prod.categorias : [],
    updated_at:
      prod?.updated_at ??
      prod?.updatedAt ??
      prod?.fecha_actualizacion ??
      prod?.fecha_modificacion ??
      prod?.modificado_en ??
      prod?.imagen_actualizada_en ??
      prod?.ultima_actualizacion ??
      "",
  };
}


function getVarianteId(variante) {
  return Number(variante?.id ?? variante?.id_stock_variante ?? 0);
}

function getPrecioVariante(variante = {}, idTipo) {
  const precios = Array.isArray(variante?.precios) ? variante.precios : [];
  const item = precios.find((p) => Number(p?.id_tipo_precio_stock ?? p?.id_tipo ?? 0) === Number(idTipo));
  const value = item?.monto ?? item?.precio ?? item?.importe ?? null;
  return value === null || value === undefined || value === "" ? null : value;
}

function normalizeVarianteListItem(variante = {}) {
  const id = getVarianteId(variante);
  if (!id) return null;

  return {
    ...variante,
    id,
    id_stock_variante: Number(variante?.id_stock_variante ?? id),
    nombre_variante: String(variante?.nombre_variante ?? variante?.nombre ?? ""),
    sku: String(variante?.sku ?? ""),
    stock: variante?.stock ?? 0,
    activo: Number(variante?.activo ?? 1),
    precio_costo: variante?.precio_costo ?? getPrecioVariante(variante, 1),
    precio: variante?.precio ?? getPrecioVariante(variante, 2),
    precio_promo: variante?.precio_promo ?? getPrecioVariante(variante, 3),
    precios_extra: (Array.isArray(variante?.precios) ? variante.precios : [])
      .filter((p) => {
        const idTipo = Number(p?.id_tipo_precio_stock ?? p?.id_tipo ?? 0);
        return idTipo > 3;
      })
      .map((p) => ({
        id_tipo_precio_stock: Number(p?.id_tipo_precio_stock ?? p?.id_tipo ?? 0),
        tipo_nombre: String(p?.tipo_nombre ?? p?.nombre ?? ""),
        precio: p?.monto ?? p?.precio ?? p?.importe ?? null,
      })),
    atributos: Array.isArray(variante?.atributos) ? variante.atributos : [],
    categorias: Array.isArray(variante?.categorias) ? variante.categorias : [],
    categorias_heredadas: !!variante?.categorias_heredadas,
  };
}

function normalizeVariantesCollection(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeVarianteListItem(item))
    .filter(Boolean);
}

function variantAttributesLabel(variante = {}) {
  const attrs = Array.isArray(variante?.atributos) ? variante.atributos : [];
  const label = attrs
    .map((attr) => {
      const nombre = String(attr?.atributo ?? attr?.nombre_atributo ?? attr?.nombre ?? "").trim();
      const valor = String(attr?.valor ?? attr?.nombre_valor ?? "").trim();
      if (nombre && valor) return `${nombre}: ${valor}`;
      return nombre || valor;
    })
    .filter(Boolean)
    .join(" · ");

  return label || "Sin atributos";
}

function variantCategoriasLabel(variante = {}) {
  const cats = Array.isArray(variante?.categorias) ? variante.categorias : [];
  const label = cats
    .map((cat) => String(cat?.nombre_mostrar ?? cat?.nombre ?? cat?.label ?? "").replace(/^—\s*/, "").trim())
    .filter(Boolean)
    .join(" · ");

  return label || "Hereda categorías del producto";
}

function renderStockChip(value) {
  const stockNum = Number(value || 0);
  let stockClass = "mov-chip mov-chip--danger";
  let stockLabel = "Sin stock";

  if (stockNum > 10) {
    stockClass = "mov-chip mov-chip--ok";
    stockLabel = stockNum;
  } else if (stockNum > 0 && stockNum <= 10) {
    stockClass = "mov-chip mov-chip--warn";
    stockLabel = stockNum;
  }

  return <span className={stockClass}>{stockLabel}</span>;
}

function mergeProductoEnLista(lista = [], producto = null) {
  const normalizado = normalizeProductoListItem(producto);
  if (!normalizado) return Array.isArray(lista) ? lista : [];

  const base = Array.isArray(lista) ? [...lista] : [];
  const idx = base.findIndex((item) => getProductoId(item) === getProductoId(normalizado));

  if (idx === -1) {
    return [normalizado, ...base];
  }

  base[idx] = {
    ...base[idx],
    ...normalizado,
  };

  return base;
}

function normalizeProductosCollection(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeProductoListItem(item))
    .filter(Boolean);
}

function getProductoImageRefreshToken(prod, refreshKey = 0, intento = 0) {
  const archivoId = Number(prod?.imagen_archivo_id || 0);
  const updateToken =
    prod?.updated_at ??
    prod?.updatedAt ??
    prod?.fecha_actualizacion ??
    prod?.fecha_modificacion ??
    prod?.modificado_en ??
    prod?.imagen_actualizada_en ??
    prod?.ultima_actualizacion ??
    "";

  return `${archivoId}-${String(updateToken || "")}-${String(refreshKey)}-${String(intento)}`;
}

function getProductoImageUrl(prod, apiUrl, refreshKey = 0, intento = 0) {
  const archivoId = Number(prod?.imagen_archivo_id || 0);
  if (!archivoId) return "";

  const params = new URLSearchParams({
    action: "stock_producto_imagen_ver",
    id_archivo: String(archivoId),
    _imgv: getProductoImageRefreshToken(prod, refreshKey, intento),
  });

  return withSessionKey(`${apiUrl}?${params.toString()}`);
}

function extractProductoFromApiResponse(data) {
  const candidates = [
    data?.producto,
    data?.data?.producto,
    data?.data,
    data?.resultado?.producto,
    data?.resultado,
  ];

  return candidates.find((item) => item && typeof item === "object" && getProductoId(item) > 0) || null;
}

function getUsuarioAuditData() {
  let idUsuarioMaster = 0;
  let idTenant = null;

  try {
    const u = JSON.parse(localStorage.getItem("usuario") || "null");
    const cand =
      u?.idUsuarioMaster ??
      u?.id_usuario_master ??
      u?.idUsuario ??
      u?.id_usuario ??
      u?.id ??
      0;

    if (Number.isFinite(Number(cand))) {
      idUsuarioMaster = Number(cand);
    }

    const tenantCand =
      u?.idTenant ??
      u?.id_tenant ??
      u?.tenant_id ??
      u?.tenant?.idTenant ??
      null;

    if (
      tenantCand !== null &&
      tenantCand !== undefined &&
      tenantCand !== "" &&
      Number(tenantCand) > 0
    ) {
      idTenant = Number(tenantCand);
    }
  } catch {}

  return { idUsuarioMaster, idTenant };
}

const COLUMNS = [
  { key: "nombre", label: "PRODUCTO", fr: 2.2, align: "left", sortable: true },
  { key: "sku", label: "SKU", fr: 0.95, align: "center", sortable: true },
  { key: "stock", label: "STOCK", fr: 0.8, align: "center", sortable: true },
  { key: "precio_costo", label: "PRECIO COSTO", fr: 1.0, align: "right", sortable: true },
  { key: "precio", label: "PRECIO VENTA", fr: 1.0, align: "right", sortable: true },
  { key: "precio_promo", label: "PRECIO PROMO", fr: 1.0, align: "right", sortable: true },
  { key: "acciones", label: "ACCIONES", fr: 0.75, align: "center", sortable: false },
];

const GRID_COLS = COLUMNS.map((c) => `${c.fr}fr`).join(" ");
const SKELETON_ROWS = 10;

const SKEL_WIDTHS = {
  nombre: ["68%", "52%", "60%", "48%"],
  sku: ["44%", "36%", "40%", "32%"],
  stock: ["38%", "30%", "34%", "28%"],
  precio_costo: ["48%", "40%", "44%", "36%"],
  precio: ["50%", "42%", "46%", "38%"],
  precio_promo: ["46%", "38%", "42%", "34%"],
};

const Stock = () => {
  const [productosRaw, setProductosRaw] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [mostrarDadosDeBaja, setMostrarDadosDeBaja] = useState(false);
  const [categoriaDropdownAbierto, setCategoriaDropdownAbierto] = useState(false);
  const [categoriasFiltroExpandidas, setCategoriasFiltroExpandidas] = useState({});
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalProductosServidor, setTotalProductosServidor] = useState(0);
  const [totalPaginasServidor, setTotalPaginasServidor] = useState(1);
  const [orden, setOrden] = useState({ campo: "nombre", dir: "ASC" });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [productoEditarId, setProductoEditarId] = useState(null);
  const [modalAjustePreciosAbierto, setModalAjustePreciosAbierto] = useState(false);
  const [productoHistorialPrecios, setProductoHistorialPrecios] = useState(null);

  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [productoEliminar, setProductoEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [modalBajaVarianteAbierto, setModalBajaVarianteAbierto] = useState(false);
  const [varianteBaja, setVarianteBaja] = useState(null);
  const [procesandoVarianteId, setProcesandoVarianteId] = useState(null);
  const [reactivandoId, setReactivandoId] = useState(null);
  const [impactoEliminar, setImpactoEliminar] = useState(null);
  const [cargandoImpactoEliminar, setCargandoImpactoEliminar] = useState(false);
  const [errorImpactoEliminar, setErrorImpactoEliminar] = useState("");

  const [toast, setToast] = useState(null);
  const [cargaPreciosMasivos, setCargaPreciosMasivos] = useState(null);
  const [versionImagenPorProducto, setVersionImagenPorProducto] = useState({});
  const [erroresImagenes, setErroresImagenes] = useState({});
  const [reintentosImagenes, setReintentosImagenes] = useState({});
  const [imagenesTemporalesPorProducto, setImagenesTemporalesPorProducto] = useState({});
  const [variantesAbiertas, setVariantesAbiertas] = useState({});
  const [variantesPorProducto, setVariantesPorProducto] = useState({});
  const [loadingVariantesPorProducto, setLoadingVariantesPorProducto] = useState({});
  const [errorVariantesPorProducto, setErrorVariantesPorProducto] = useState({});

  const refreshTimersRef = useRef([]);
  const imagenesTemporalesRef = useRef({});
  const impactoEliminarRequestRef = useRef(0);
  const categoriaFiltroDropdownRef = useRef(null);
  const productosPorPagina = 20;

  const mostrarToast = useCallback((tipo, mensaje, duracion = 2500) => {
    setToast({ tipo, mensaje, duracion, id: Date.now() + Math.random() });
  }, []);

  const mostrarToastCarga = useCallback((mensaje) => {
    mostrarToast("loading", mensaje, TOAST_LOADING_DURATION);
  }, [mostrarToast]);

  const cerrarToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast || !esToastCarga(toast.tipo) || !Number(toast.duracion || 0)) return undefined;
    const timer = window.setTimeout(() => setToast(null), Number(toast.duracion));
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCargaPreciosMasivos = useCallback((estado) => {
    if (!estado?.open) {
      setCargaPreciosMasivos(null);
      return;
    }

    setCargaPreciosMasivos({
      total: Number(estado?.total || 0),
      startedAt: Date.now(),
    });
  }, []);

  const limpiarRefreshTimers = useCallback(() => {
    refreshTimersRef.current.forEach((id) => clearTimeout(id));
    refreshTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      limpiarRefreshTimers();
      Object.values(imagenesTemporalesRef.current || {}).forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
      imagenesTemporalesRef.current = {};
    };
  }, [limpiarRefreshTimers]);

  const limpiarImagenTemporalProducto = useCallback((productoId) => {
    const id = Number(productoId || 0);
    if (!id) return;

    const actual = imagenesTemporalesRef.current?.[id];
    if (actual?.url) URL.revokeObjectURL(actual.url);

    const nextRef = { ...(imagenesTemporalesRef.current || {}) };
    delete nextRef[id];
    imagenesTemporalesRef.current = nextRef;

    setImagenesTemporalesPorProducto((prev) => {
      if (!prev?.[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const aplicarImagenTemporalProducto = useCallback((productoId, file) => {
    const id = Number(productoId || 0);
    if (!id || !file) return;

    const actual = imagenesTemporalesRef.current?.[id];
    if (actual?.url) URL.revokeObjectURL(actual.url);

    const temp = {
      url: URL.createObjectURL(file),
      createdAt: Date.now(),
    };

    imagenesTemporalesRef.current = {
      ...(imagenesTemporalesRef.current || {}),
      [id]: temp,
    };

    setImagenesTemporalesPorProducto((prev) => ({
      ...prev,
      [id]: temp,
    }));
  }, []);

  const invalidarMiniaturaProducto = useCallback((productoId, seed = Date.now()) => {
    const id = Number(productoId || 0);
    if (!id) return;

    setVersionImagenPorProducto((prev) => ({
      ...prev,
      [id]: seed,
    }));

    setErroresImagenes((prev) => {
      if (!prev?.[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setReintentosImagenes((prev) => {
      if (!prev?.[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const programarReintentoImagen = useCallback((productoId) => {
    const timerId = setTimeout(() => {
      setReintentosImagenes((prev) => ({
        ...prev,
        [productoId]: Number(prev?.[productoId] || 0) + 1,
      }));

      setErroresImagenes((prev) => {
        if (!prev?.[productoId]) return prev;
        const next = { ...prev };
        delete next[productoId];
        return next;
      });
    }, 900);

    refreshTimersRef.current.push(timerId);
  }, []);

  const recargarTodo = useCallback(async (opciones = {}) => {
    const mostrarLoader = opciones?.mostrarLoader !== false;
    const seed = opciones?.seed || Date.now();

    if (mostrarLoader) setLoading(true);
    setError(null);

    try {
      const [productosRes, categoriasRes] = await Promise.allSettled([
        (async () => {
          const params = new URLSearchParams({
            action: "stock_productos_listar",
            activo: mostrarDadosDeBaja ? "0" : "1",
            pagina: String(paginaActual),
            por_pagina: String(productosPorPagina),
            orden_campo: orden.campo,
            orden_dir: orden.dir,
            _r: String(seed),
          });
          if (categoriaFiltro) params.set("id_categoria", String(categoriaFiltro));
          if (busqueda.trim()) params.set("buscar", busqueda.trim());

          const data = await apiGet(`${API_URL}?${params.toString()}`);
          if (data?.exito === false) {
            throw new Error(data?.mensaje || "Error al obtener productos");
          }

          return {
            productos: normalizeProductosCollection(data?.productos),
            total: Number(data?.total ?? 0),
            pagina: Number(data?.pagina ?? paginaActual),
            totalPaginas: Math.max(1, Number(data?.total_paginas ?? 1)),
          };
        })(),
        (async () => {
          const params = new URLSearchParams({
            action: "stock_categorias_listar",
            _r: String(seed),
          });
          const data = await apiGet(`${API_URL}?${params.toString()}`);
          const lista = (Array.isArray(data?.categorias) ? data.categorias : [])
            .map((cat) => normalizeCategoria(cat))
            .filter((cat) => Number(cat.id_stock_categoria) > 0);

          return [...lista].sort((a, b) =>
            String(a?.nombre_mostrar || a?.nombre || "").localeCompare(String(b?.nombre_mostrar || b?.nombre || ""), "es", {
              sensitivity: "base",
            })
          );
        })(),
      ]);

      if (productosRes.status === "fulfilled") {
        setProductosRaw(productosRes.value.productos);
        setTotalProductosServidor(productosRes.value.total);
        setTotalPaginasServidor(productosRes.value.totalPaginas);
        if (productosRes.value.pagina && productosRes.value.pagina !== paginaActual) {
          setPaginaActual(productosRes.value.pagina);
        }
      } else {
        setProductosRaw([]);
        setTotalProductosServidor(0);
        setTotalPaginasServidor(1);
        throw productosRes.reason;
      }

      if (categoriasRes.status === "fulfilled") {
        setCategorias(categoriasRes.value);
      } else {
        setCategorias([]);
      }
    } catch (err) {
      if (mostrarLoader) setError(err?.message || "Error inesperado");
      throw err;
    } finally {
      if (mostrarLoader) setLoading(false);
    }
  }, [busqueda, categoriaFiltro, mostrarDadosDeBaja, orden, paginaActual, productosPorPagina]);

  const refrescarProductoPorId = useCallback(async (productoId, opciones = {}) => {
    const id = Number(productoId || 0);
    if (!id) return null;

    const params = new URLSearchParams({
      action: "stock_producto_obtener",
      id: String(id),
      _r: String(opciones?.seed || Date.now()),
    });

    const data = await apiGet(`${API_URL}?${params.toString()}`);
    if (data?.exito === false) {
      throw new Error(data?.mensaje || "No se pudo refrescar el producto editado.");
    }

    const productoActualizado = extractProductoFromApiResponse(data);
    if (!productoActualizado) return null;

    setProductosRaw((prev) => mergeProductoEnLista(prev, productoActualizado));

    const productoNormalizado = normalizeProductoListItem(productoActualizado);
    const idNormalizado = getProductoId(productoNormalizado) || id;

    if (Array.isArray(productoActualizado?.variantes)) {
      setVariantesPorProducto((prev) => ({
        ...prev,
        [idNormalizado]: normalizeVariantesCollection(productoActualizado.variantes),
      }));
      setErrorVariantesPorProducto((prev) => {
        const next = { ...prev };
        delete next[idNormalizado];
        return next;
      });
    }

    return productoNormalizado || productoActualizado;
  }, []);

  const refrescarListaYProducto = useCallback(async (productoId = 0, opciones = {}) => {
    const id = Number(productoId || 0);
    const seed = opciones?.seed || Date.now();

    try {
      await recargarTodo({ mostrarLoader: opciones?.mostrarLoader === true, seed });
    } catch {}

    if (id > 0) {
      if (opciones?.recargarProducto !== false) {
        try {
          await refrescarProductoPorId(id, { seed });
        } catch {}
      }

      if (opciones?.invalidarImagen !== false) {
        invalidarMiniaturaProducto(id, seed);
      }
    }
  }, [invalidarMiniaturaProducto, recargarTodo, refrescarProductoPorId]);

  const programarRefrescoPostImagen = useCallback((productoId) => {
    const id = Number(productoId || 0);
    if (!id) return;

    limpiarRefreshTimers();

    const timerId = window.setTimeout(() => {
      refrescarListaYProducto(id, {
        seed: Date.now(),
        mostrarLoader: false,
        invalidarImagen: true,
        recargarProducto: true,
      });
    }, 1600);

    refreshTimersRef.current.push(timerId);
  }, [limpiarRefreshTimers, refrescarListaYProducto]);

  const refrescarDespuesDeGuardar = useCallback(
    async (productoGuardado = null, opciones = {}) => {
      const productoId = getProductoId(productoGuardado) || Number(opciones?.productoId || 0);
      const imagenActualizada = !!opciones?.imagen_actualizada;
      const imagenEliminada = !!opciones?.imagen_eliminada;
      const refrescarImagen =
        imagenActualizada ||
        imagenEliminada ||
        !!productoGuardado?.imagen_actualizada_en;

      if (productoId > 0 && imagenActualizada && opciones?.imagen_file) {
        aplicarImagenTemporalProducto(productoId, opciones.imagen_file);
      }

      if (productoId > 0 && imagenEliminada) {
        limpiarImagenTemporalProducto(productoId);
      }

      if (productoGuardado) {
        setProductosRaw((prev) => mergeProductoEnLista(prev, productoGuardado));

        if (productoId > 0 && Array.isArray(productoGuardado?.variantes)) {
          setVariantesPorProducto((prev) => ({
            ...prev,
            [productoId]: normalizeVariantesCollection(productoGuardado.variantes),
          }));
          setErrorVariantesPorProducto((prev) => {
            const next = { ...prev };
            delete next[productoId];
            return next;
          });
        }
      }

      if (productoId > 0 && refrescarImagen) {
        invalidarMiniaturaProducto(productoId, Date.now());
        programarRefrescoPostImagen(productoId);
        return;
      }

      await refrescarListaYProducto(productoId, {
        seed: Date.now(),
        mostrarLoader: opciones?.mostrarLoader === true,
        invalidarImagen: false,
      });
    },
    [
      aplicarImagenTemporalProducto,
      invalidarMiniaturaProducto,
      limpiarImagenTemporalProducto,
      programarRefrescoPostImagen,
      refrescarListaYProducto,
    ]
  );

  const fetchCategorias = useCallback(async () => {
    setLoadingCategorias(true);

    try {
      const params = new URLSearchParams({ action: "stock_categorias_listar" });
      const data = await apiGet(`${API_URL}?${params.toString()}`);
      const lista = (Array.isArray(data?.categorias) ? data.categorias : [])
        .map((cat) => normalizeCategoria(cat))
        .filter((cat) => Number(cat.id_stock_categoria) > 0);

      setCategorias(
        [...lista].sort((a, b) =>
          String(a?.nombre_mostrar || a?.nombre || "").localeCompare(String(b?.nombre_mostrar || b?.nombre || ""), "es", {
            sensitivity: "base",
          })
        )
      );
    } catch (err) {
      setCategorias([]);
      mostrarToast("error", err?.message || "No se pudieron cargar las categorías.");
    } finally {
      setLoadingCategorias(false);
    }
  }, [mostrarToast]);

  const fetchProductos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        action: "stock_productos_listar",
        activo: mostrarDadosDeBaja ? "0" : "1",
        pagina: String(paginaActual),
        por_pagina: String(productosPorPagina),
        orden_campo: orden.campo,
        orden_dir: orden.dir,
        _r: String(Date.now()),
      });
      if (categoriaFiltro) params.set("id_categoria", String(categoriaFiltro));
      if (busqueda.trim()) params.set("buscar", busqueda.trim());

      const data = await apiGet(`${API_URL}?${params.toString()}`);
      if (data.exito === false) {
        throw new Error(data.mensaje || "Error al obtener productos");
      }

      setProductosRaw(normalizeProductosCollection(data.productos));
      setTotalProductosServidor(Number(data?.total ?? 0));
      setTotalPaginasServidor(Math.max(1, Number(data?.total_paginas ?? 1)));
      const paginaServidor = Number(data?.pagina ?? paginaActual);
      if (paginaServidor > 0 && paginaServidor !== paginaActual) {
        setPaginaActual(paginaServidor);
      }
    } catch (err) {
      setProductosRaw([]);
      setTotalProductosServidor(0);
      setTotalPaginasServidor(1);
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [busqueda, categoriaFiltro, mostrarDadosDeBaja, orden, paginaActual, productosPorPagina]);

  const cargarVariantesProducto = useCallback(async (productoId) => {
    const id = Number(productoId || 0);
    if (!id) return;

    setLoadingVariantesPorProducto((prev) => ({ ...prev, [id]: true }));
    setErrorVariantesPorProducto((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const params = new URLSearchParams({
        action: "stock_variantes_listar",
        id_stock_producto: String(id),
        activo: "todos",
      });
      if (categoriaFiltro) params.set("id_categoria", String(categoriaFiltro));

      const data = await apiGet(`${API_URL}?${params.toString()}`);
      if (data?.exito === false) {
        throw new Error(data?.mensaje || "No se pudieron cargar las variantes.");
      }

      const variantes = normalizeVariantesCollection(data?.variantes || data?.data?.variantes || []);
      setVariantesPorProducto((prev) => ({ ...prev, [id]: variantes }));
    } catch (err) {
      setVariantesPorProducto((prev) => ({ ...prev, [id]: [] }));
      setErrorVariantesPorProducto((prev) => ({
        ...prev,
        [id]: err?.message || "No se pudieron cargar las variantes.",
      }));
    } finally {
      setLoadingVariantesPorProducto((prev) => ({ ...prev, [id]: false }));
    }
  }, [categoriaFiltro]);

  const toggleVariantesProducto = useCallback((producto) => {
    const id = getProductoId(producto);
    if (!id) return;

    const abierto = !!variantesAbiertas[id];
    setVariantesAbiertas((prev) => ({ ...prev, [id]: !abierto }));

    if (!abierto && !variantesPorProducto[id]) {
      cargarVariantesProducto(id);
    }
  }, [cargarVariantesProducto, variantesAbiertas, variantesPorProducto]);

  useEffect(() => {
    setVariantesPorProducto({});
    setErrorVariantesPorProducto({});
    setLoadingVariantesPorProducto({});
    setVariantesAbiertas({});
  }, [categoriaFiltro, mostrarDadosDeBaja]);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  // Escucha actualizaciones de productos (stock-updated)
  useEffect(() => {
    const handleExternalListsUpdate = async () => {
      try {
        await refrescarDespuesDeGuardar();
      } catch {}
    };

    window.addEventListener("balto:stock-updated", handleExternalListsUpdate);
    return () => window.removeEventListener("balto:stock-updated", handleExternalListsUpdate);
  }, [refrescarDespuesDeGuardar]);

  // ✅ NUEVO: Escucha actualizaciones de listas/categorías (listas-updated)
  useEffect(() => {
    const handleExternalCategoriasUpdate = async () => {
      try {
        await fetchCategorias();
      } catch {}
    };

    window.addEventListener("balto:listas-updated", handleExternalCategoriasUpdate);

    return () => {
      window.removeEventListener("balto:listas-updated", handleExternalCategoriasUpdate);
    };
  }, [fetchCategorias]);

  const categoriasPorId = useMemo(() => {
    const map = {};
    categorias.forEach((cat) => {
      const id = Number(cat?.id_stock_categoria ?? cat?.id ?? 0);
      if (id > 0) map[id] = cat;
    });
    return map;
  }, [categorias]);

  const categoriasPorPadre = useMemo(() => {
    const map = {};
    categorias.forEach((cat) => {
      const padre = Number(cat?.id_categoria_padre || 0);
      if (!map[padre]) map[padre] = [];
      map[padre].push(cat);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) =>
        String(a?.nombre ?? "").localeCompare(String(b?.nombre ?? ""), "es", {
          numeric: true,
          sensitivity: "base",
        })
      );
    });

    return map;
  }, [categorias]);

  const categoriaFiltroIds = useMemo(() => {
    const id = Number(categoriaFiltro || 0);
    const ids = new Set();
    if (!id) return ids;

    const agregarConHijas = (categoriaId) => {
      const n = Number(categoriaId || 0);
      if (!n || ids.has(n)) return;
      ids.add(n);
      (categoriasPorPadre[n] || []).forEach((hija) =>
        agregarConHijas(hija?.id_stock_categoria ?? hija?.id)
      );
    };

    agregarConHijas(id);
    return ids;
  }, [categoriaFiltro, categoriasPorPadre]);

  const categoriaFiltroLabel = useMemo(() => {
    const id = Number(categoriaFiltro || 0);
    if (!id) return "Todas";

    const partes = [];
    let cursor = id;
    let guard = 0;
    while (cursor > 0 && categoriasPorId[cursor] && guard++ < 12) {
      const cat = categoriasPorId[cursor];
      partes.unshift(String(cat?.nombre ?? cat?.nombre_mostrar ?? "").replace(/^—\s*/g, "").trim());
      cursor = Number(cat?.id_categoria_padre || 0);
    }

    return partes.filter(Boolean).join(" / ") || "Todas";
  }, [categoriaFiltro, categoriasPorId]);

  useEffect(() => {
    if (!categoriaDropdownAbierto) return;

    const handleClickOutside = (event) => {
      if (categoriaFiltroDropdownRef.current && !categoriaFiltroDropdownRef.current.contains(event.target)) {
        setCategoriaDropdownAbierto(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoriaDropdownAbierto]);

  useEffect(() => {
    const id = Number(categoriaFiltro || 0);
    if (!id) return;

    const expandidas = {};
    let cursor = Number(categoriasPorId[id]?.id_categoria_padre || 0);
    let guard = 0;
    while (cursor > 0 && categoriasPorId[cursor] && guard++ < 12) {
      expandidas[cursor] = true;
      cursor = Number(categoriasPorId[cursor]?.id_categoria_padre || 0);
    }

    if (Object.keys(expandidas).length > 0) {
      setCategoriasFiltroExpandidas((prev) => ({ ...prev, ...expandidas }));
    }
  }, [categoriaFiltro, categoriasPorId]);

  const seleccionarCategoriaFiltro = useCallback((id) => {
    setCategoriaFiltro(id ? String(id) : "");
    setCategoriaDropdownAbierto(false);
    setPaginaActual(1);
  }, []);

  const toggleCategoriaFiltroExpandida = useCallback((id) => {
    const n = Number(id || 0);
    if (!n) return;
    setCategoriasFiltroExpandidas((prev) => ({ ...prev, [n]: !prev[n] }));
  }, []);

  const renderCategoriaFiltroItem = useCallback((cat, nivel = 0) => {
    const id = Number(cat?.id_stock_categoria ?? cat?.id ?? 0);
    if (!id) return null;

    const hijas = categoriasPorPadre[id] || [];
    const tieneHijas = hijas.length > 0;
    const expandida = !!categoriasFiltroExpandidas[id];
    const seleccionada = Number(categoriaFiltro || 0) === id;

    return (
      <div className="stock-catFilterNode" key={id}>
        <div
          className={[
            "stock-catFilterOption",
            seleccionada ? "is-selected" : "",
            tieneHijas ? "has-children" : "",
          ].join(" ")}
          style={{ paddingLeft: 10 + nivel * 18 }}
        >
          {tieneHijas ? (
            <button
              type="button"
              className="stock-catFilterExpand"
              title={expandida ? "Ocultar subcategorías" : "Ver subcategorías"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleCategoriaFiltroExpandida(id);
              }}
            >
              <FontAwesomeIcon icon={expandida ? faChevronUp : faChevronDown} />
            </button>
          ) : (
            <span className="stock-catFilterExpand stock-catFilterExpand--empty" />
          )}

          <button
            type="button"
            className="stock-catFilterLabel"
            onClick={() => seleccionarCategoriaFiltro(id)}
          >
            {String(cat?.nombre ?? cat?.nombre_mostrar ?? "").replace(/^—\s*/g, "").trim()}
          </button>
        </div>

        {tieneHijas && expandida ? (
          <div className="stock-catFilterChildren">
            {hijas.map((hija) => renderCategoriaFiltroItem(hija, nivel + 1))}
          </div>
        ) : null}
      </div>
    );
  }, [
    categoriaFiltro,
    categoriasFiltroExpandidas,
    categoriasPorPadre,
    seleccionarCategoriaFiltro,
    toggleCategoriaFiltroExpandida,
  ]);

  const productosFiltradosYOrdenados = useMemo(() => {
    return Array.isArray(productosRaw) ? productosRaw : [];
  }, [productosRaw]);

  const totalProductos = totalProductosServidor;
  const totalPaginas = Math.max(1, totalPaginasServidor);

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  const productos = productosFiltradosYOrdenados;

  const inicioProductosVisibles = totalProductos > 0
    ? (paginaActual - 1) * productosPorPagina + 1
    : 0;
  const finProductosVisibles = totalProductos > 0
    ? Math.min(inicioProductosVisibles + productos.length - 1, totalProductos)
    : 0;

  const handleBusqueda = (e) => {
    setBusqueda(e.target.value);
    setPaginaActual(1);
  };

  const handleCategoriaFiltro = (e) => {
    seleccionarCategoriaFiltro(e.target.value);
  };

  const handleOrden = (campo) => {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === "ASC" ? "DESC" : "ASC" }
        : { campo, dir: "ASC" }
    );
    setPaginaActual(1);
  };

  const handleAbrirEditar = (id) => {
    if (!id || Number(id) <= 0) {
      mostrarToast("error", "ID de producto inválido.");
      return;
    }

    setProductoEditarId(Number(id));
    setModalEditarAbierto(true);
  };

  const handleCerrarEditar = () => {
    setModalEditarAbierto(false);
    setProductoEditarId(null);
  };

  const consultarImpactoEliminacion = useCallback(async (productoId) => {
    const id = Number(productoId || 0);
    if (!id) return;

    const requestId = impactoEliminarRequestRef.current + 1;
    impactoEliminarRequestRef.current = requestId;
    setCargandoImpactoEliminar(true);
    setErrorImpactoEliminar("");
    setImpactoEliminar(null);

    try {
      const params = new URLSearchParams({
        action: "stock_producto_impacto_eliminacion",
        id: String(id),
      });

      const data = await apiGet(`${API_URL}?${params.toString()}`);
      if (data?.exito === false) {
        throw new Error(data?.mensaje || "No se pudo consultar el impacto de la baja.");
      }

      if (impactoEliminarRequestRef.current !== requestId) return;
      setImpactoEliminar(data?.impacto || null);
    } catch (err) {
      if (impactoEliminarRequestRef.current !== requestId) return;
      setErrorImpactoEliminar(
        err?.message || "No se pudo consultar cuántos movimientos se afectarían."
      );
    } finally {
      if (impactoEliminarRequestRef.current === requestId) {
        setCargandoImpactoEliminar(false);
      }
    }
  }, []);

  const handleAbrirEliminar = (producto) => {
    const productoId = getProductoId(producto);

    if (!productoId || productoId <= 0) {
      mostrarToast("error", "ID de producto inválido.");
      return;
    }

    setProductoEliminar({
      ...producto,
      id: productoId,
    });
    setImpactoEliminar(null);
    setErrorImpactoEliminar("");
    setCargandoImpactoEliminar(true);
    setModalEliminarAbierto(true);
    consultarImpactoEliminacion(productoId);
  };

  const handleCerrarEliminar = () => {
    if (eliminando) return;
    impactoEliminarRequestRef.current += 1;
    setModalEliminarAbierto(false);
    setProductoEliminar(null);
    setImpactoEliminar(null);
    setErrorImpactoEliminar("");
    setCargandoImpactoEliminar(false);
  };

  const handleConfirmarEliminar = async () => {
    const productoId = getProductoId(productoEliminar);

    if (!productoId || productoId <= 0) {
      throw new Error("ID de producto inválido.");
    }

    setEliminando(true);

    try {
      const { idUsuarioMaster, idTenant } = getUsuarioAuditData();

      const payload = {
        action: "stock_productos_eliminar",
        id: productoId,
        idUsuarioMaster,
      };

      if (idTenant) {
        payload.tenant_id = idTenant;
      }

      const data = await apiPost(API_URL, payload);

      if (data.exito === false) {
        throw new Error(data.mensaje || "Error al dar de baja el producto");
      }

      setProductosRaw((prev) =>
        prev.filter((p) => getProductoId(p) !== productoId)
      );
      
      setErroresImagenes((prev) => {
        const next = { ...prev };
        delete next[productoId];
        return next;
      });
      setReintentosImagenes((prev) => {
        const next = { ...prev };
        delete next[productoId];
        return next;
      });

      setModalEliminarAbierto(false);
      setProductoEliminar(null);
      await refrescarDespuesDeGuardar();
      notifyListsUpdated();
      mostrarToast("exito", "Producto dado de baja correctamente.");
    } catch (error) {
      mostrarToast("error", error.message || "No se pudo dar de baja el producto.");
    } finally {
      setEliminando(false);
    }
  };

  const handleReactivarProducto = async (producto) => {
    const productoId = getProductoId(producto);
    if (!productoId || productoId <= 0 || reactivandoId) return;

    setReactivandoId(productoId);
    mostrarToastCarga("Dando de alta producto...");

    try {
      const { idUsuarioMaster, idTenant } = getUsuarioAuditData();
      const payload = {
        action: "stock_producto_reactivar",
        id: productoId,
        idUsuarioMaster,
      };
      if (idTenant) payload.tenant_id = idTenant;

      const data = await apiPost(API_URL, payload);
      if (data?.exito === false) {
        throw new Error(data?.mensaje || "No se pudo reactivar el producto.");
      }

      setProductosRaw((prev) => prev.filter((p) => getProductoId(p) !== productoId));
      await refrescarDespuesDeGuardar();
      notifyListsUpdated();
      mostrarToast("exito", "Producto dado de alta correctamente.");
    } catch (error) {
      mostrarToast("error", error?.message || "No se pudo dar de alta el producto.");
    } finally {
      setReactivandoId(null);
    }
  };

  const handleAbrirBajaVariante = (producto, variante) => {
    const productoId = getProductoId(producto);
    const varianteId = getVarianteId(variante);

    if (!productoId || !varianteId) {
      mostrarToast("error", "ID de variante inválido.");
      return;
    }

    setVarianteBaja({
      productoId,
      productoNombre: producto?.nombre || "Producto",
      ...variante,
      id: varianteId,
    });
    setModalBajaVarianteAbierto(true);
  };

  const handleCerrarBajaVariante = () => {
    if (procesandoVarianteId) return;
    setModalBajaVarianteAbierto(false);
    setVarianteBaja(null);
  };

  const handleConfirmarBajaVariante = async () => {
    const varianteId = getVarianteId(varianteBaja);
    const productoId = Number(varianteBaja?.productoId || varianteBaja?.id_stock_producto || 0);

    if (!varianteId || varianteId <= 0 || !productoId || productoId <= 0) {
      throw new Error("ID de variante inválido.");
    }

    setProcesandoVarianteId(varianteId);
    mostrarToastCarga("Dando de baja variante...");

    try {
      const { idUsuarioMaster, idTenant } = getUsuarioAuditData();
      const payload = {
        action: "stock_variante_dar_baja",
        id: varianteId,
        id_stock_variante: varianteId,
        idUsuarioMaster,
      };
      if (idTenant) payload.tenant_id = idTenant;

      const data = await apiPost(API_URL, payload);
      if (data?.exito === false) {
        throw new Error(data?.mensaje || "No se pudo dar de baja la variante.");
      }

      await cargarVariantesProducto(productoId);
      await refrescarDespuesDeGuardar();
      notifyListsUpdated();
      setModalBajaVarianteAbierto(false);
      setVarianteBaja(null);
      mostrarToast("exito", "Variante dada de baja correctamente.");
    } catch (error) {
      mostrarToast("error", error?.message || "No se pudo dar de baja la variante.");
    } finally {
      setProcesandoVarianteId(null);
    }
  };

  const handleReactivarVariante = async (producto, variante) => {
    const productoId = getProductoId(producto);
    const varianteId = getVarianteId(variante);
    if (!productoId || !varianteId || procesandoVarianteId) return;

    setProcesandoVarianteId(varianteId);
    mostrarToastCarga("Dando de alta variante...");

    try {
      const { idUsuarioMaster, idTenant } = getUsuarioAuditData();
      const payload = {
        action: "stock_variante_reactivar",
        id: varianteId,
        id_stock_variante: varianteId,
        idUsuarioMaster,
      };
      if (idTenant) payload.tenant_id = idTenant;

      const data = await apiPost(API_URL, payload);
      if (data?.exito === false) {
        throw new Error(data?.mensaje || "No se pudo reactivar la variante.");
      }

      await cargarVariantesProducto(productoId);
      await refrescarDespuesDeGuardar();
      notifyListsUpdated();
      mostrarToast("exito", "Variante dada de alta correctamente.");
    } catch (error) {
      mostrarToast("error", error?.message || "No se pudo dar de alta la variante.");
    } finally {
      setProcesandoVarianteId(null);
    }
  };

  const paginasVisibles = Array.from({ length: totalPaginas }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 2)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  const impactoEliminacionProducto = useMemo(() => {
    if (!productoEliminar) return null;

    const baseStyle = {
      marginTop: "12px",
      padding: "12px 14px",
      borderRadius: "14px",
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
      fontSize: "13px",
      lineHeight: 1.45,
      textAlign: "left",
    };

    if (cargandoImpactoEliminar) {
      return (
        <div style={baseStyle}>
          <strong>Consultando movimientos...</strong>
          <div>Se está verificando en la base de datos cuántos registros usan este producto.</div>
        </div>
      );
    }

    if (errorImpactoEliminar) {
      return (
        <div
          style={{
            ...baseStyle,
            borderColor: "#fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          <strong>No se pudo consultar el impacto.</strong>
          <div>{errorImpactoEliminar}</div>
        </div>
      );
    }

    if (!impactoEliminar) return null;

    const itemsAfectados = toNonNegativeInt(impactoEliminar.total_items_afectados);
    const movimientosAfectados = toNonNegativeInt(impactoEliminar.total_movimientos_afectados);
    const movimientosSinProductos = toNonNegativeInt(
      impactoEliminar.movimientos_quedarian_sin_productos
    );
    const movimientosConOtrosProductos = toNonNegativeInt(
      impactoEliminar.movimientos_con_otros_productos
    );

    if (movimientosAfectados <= 0) {
      return (
        <div
          style={{
            ...baseStyle,
            borderColor: "#bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>Impacto en movimientos</strong>
          <div>Este producto no está usado en ningún movimiento.</div>
        </div>
      );
    }

    return (
      <div style={baseStyle}>
        <strong>Impacto en movimientos</strong>
        <div>
          Este producto está usado en {pluralize(itemsAfectados, "ítem", "ítems")} de {" "}
          {pluralize(movimientosAfectados, "movimiento")}.
        </div>
        {movimientosSinProductos > 0 ? (
          <div style={{ marginTop: "6px", fontWeight: 700 }}>
            Atención: {pluralize(movimientosSinProductos, "movimiento")} {" "}
            {movimientosSinProductos === 1 ? "quedaría" : "quedarían"} sin productos asociados.
          </div>
        ) : (
          <div style={{ marginTop: "6px" }}>
            Ningún movimiento quedaría vacío, porque {" "}
            {pluralize(movimientosConOtrosProductos, "movimiento")} {" "}
            {movimientosConOtrosProductos === 1 ? "tiene" : "tienen"} otros productos cargados.
          </div>
        )}
      </div>
    );
  }, [
    productoEliminar,
    cargandoImpactoEliminar,
    errorImpactoEliminar,
    impactoEliminar,
  ]);

  const OrdenIcon = ({ campo }) => {
    if (orden.campo !== campo) {
      return <FontAwesomeIcon icon={faSort} className="prod-sortIcon prod-sortIcon--inactive" />;
    }

    return (
      <FontAwesomeIcon
        icon={orden.dir === "ASC" ? faChevronUp : faChevronDown}
        className="prod-sortIcon prod-sortIcon--active"
      />
    );
  };

  const renderSkeletonRow = (idx) => (
    <div
      key={`skel-${idx}`}
      className="mov-gridTable mov-gridTable--row mov-row--skeleton"
      style={{ gridTemplateColumns: GRID_COLS }}
      role="row"
      aria-hidden="true"
    >
      {COLUMNS.map((c) => {
        if (c.key === "acciones") {
          return (
            <div key={c.key} className="mov-gridCell mov-gridCell--actions is-center" role="cell">
              <div className="mov-skelActions">
                <span className="mov-skelIcon" />
                <span className="mov-skelIcon" />
              </div>
            </div>
          );
        }

        const list = SKEL_WIDTHS[c.key] || ["60%"];
        const w = list[idx % list.length];

        return (
          <div
            key={c.key}
            className={[
              "mov-gridCell",
              c.align === "right" ? "is-right" : "",
              c.align === "center" ? "is-center" : "",
            ].join(" ")}
            role="cell"
          >
            <span className="mov-skeletonBar" style={{ width: w }} />
          </div>
        );
      })}
    </div>
  );


  const renderVariantesProducto = (prod) => {
    const productoId = getProductoId(prod);
    const variantes = variantesPorProducto[productoId] || [];
    const loadingVars = !!loadingVariantesPorProducto[productoId];
    const errorVars = errorVariantesPorProducto[productoId];

    return (
      <div className="prod-variantsDetailRow" role="row">
        <div className="prod-variantsPanel">
          <div className="prod-variantsPanel__head">
            <div>
              <strong>Variantes de {prod.nombre}</strong>
              <span>{loadingVars ? "Cargando variantes..." : `${variantes.length} registradas`}</span>
            </div>
          </div>

          {errorVars ? (
            <div className="prod-variantsPanel__empty">{errorVars}</div>
          ) : loadingVars ? (
            <div className="prod-variantsPanel__empty">Cargando información de variantes...</div>
          ) : variantes.length === 0 ? (
            <div className="prod-variantsPanel__empty">Este producto todavía no tiene variantes cargadas.</div>
          ) : (
            <div className="prod-variantsMiniTable">
              <div className="prod-variantsMiniTable__head">
                <span>Variante</span>
                <span>SKU</span>
                <span>Stock</span>
                <span>Precio de costo</span>
                <span>Precio de venta</span>
                <span>Precio promocional</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              {variantes.map((variant) => {
                const varianteId = getVarianteId(variant);
                const varianteInactiva = Number(variant?.activo ?? 1) === 0;
                const procesandoEstaVariante = procesandoVarianteId === varianteId;

                return (
                  <div
                    className={["prod-variantsMiniTable__row", varianteInactiva ? "is-inactive" : ""].join(" ")}
                    key={variant.id_stock_variante}
                  >
                    <span>
                      <b>{variant.nombre_variante || `Variante #${variant.id_stock_variante}`}</b>
                      <small>{variantAttributesLabel(variant)}</small>
                      <small>{variantCategoriasLabel(variant)}</small>
                      {(variant.precios_extra || []).length > 0 ? (
                        <small className="prod-variantExtraPrices">
                          {(variant.precios_extra || [])
                            .map((item) => `${item.tipo_nombre || `Precio ${item.id_tipo_precio_stock}`}: ${formatMoney(item.precio)}`)
                            .join(" · ")}
                        </small>
                      ) : null}
                    </span>
                    <span className="prod-sku">{variant.sku || "—"}</span>
                    <span>{renderStockChip(variant.stock)}</span>
                    <span>{formatMoney(variant.precio_costo)}</span>
                    <span>{formatMoney(variant.precio)}</span>
                    <span className="prod-promo">{formatMoney(variant.precio_promo)}</span>
                    <span>
                      {varianteInactiva ? (
                        <span className="prod-statusChip prod-statusChip--inactive">Dada de baja</span>
                      ) : (
                        <span className="prod-statusChip prod-statusChip--active">Activa</span>
                      )}
                    </span>
                    <span className="prod-variantActions">
                      {varianteInactiva ? (
                        <button
                          type="button"
                          className="mov-iconBtn"
                          title="Dar de alta variante"
                          disabled={procesandoEstaVariante}
                          onClick={() => handleReactivarVariante(prod, variant)}
                        >
                          <FontAwesomeIcon icon={faRotateLeft} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mov-iconBtn mov-iconBtn--danger"
                          title="Dar de baja variante"
                          disabled={procesandoEstaVariante}
                          onClick={() => handleAbrirBajaVariante(prod, variant)}
                        >
                          <FontAwesomeIcon icon={faTrashCan} />
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStockToolbarActions = (extraClassName = "", options = {}) => {
    const { showToggleBajas = true, showAjustePrecios = true, showAgregarProducto = true } = options;

    return (
      <div className={["stock-tableActions", extraClassName].filter(Boolean).join(" ")}>
        {showToggleBajas ? (
          <button
            type="button"
            className={[
              "mov-btn",
              mostrarDadosDeBaja ? "mov-btn--primary" : "mov-btn--ghost",
              "stock-actionBtn",
              "stock-actionBtn--bajas",
            ].join(" ")}
            onClick={() => {
              setMostrarDadosDeBaja((prev) => !prev);
              setPaginaActual(1);
            }}
          >
            <FontAwesomeIcon icon={faRotateLeft} /> {mostrarDadosDeBaja ? "Ver activos" : "Ver dados de baja"}
          </button>
        ) : null}

        {showAjustePrecios ? (
          <button
            type="button"
            className="mov-btn mov-btn--ghost stock-actionBtn stock-actionBtn--ajuste"
            onClick={() => setModalAjustePreciosAbierto(true)}
            disabled={mostrarDadosDeBaja}
          >
            <FontAwesomeIcon icon={faMoneyBillTrendUp} /> Ajustar precios
          </button>
        ) : null}

        {showAgregarProducto ? (
          <button
            type="button"
            className="mov-btn mov-btn--primary"
            onClick={() => setModalAbierto(true)}
            disabled={mostrarDadosDeBaja}
          >
            <FontAwesomeIcon icon={faPlus} /> Agregar producto
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="mov-page">
        {error && (
          <div className="mov-alert" role="alert">
            {error}
          </div>
        )}

        <section className="mov-card mov-card--table">
          <div className="mov-card__head">
            <div className="mov-card__headLeft">
              <div className="title-mov">
                <div className="mov-card__title">Stock · Productos</div>
                <div className="mov-card__hint">
                  {totalProductos > 0 ? (
                    <>
                      Mostrando <b>{inicioProductosVisibles}</b>–<b>{finProductosVisibles}</b> de{" "}
                      <b>{totalProductos}</b> {mostrarDadosDeBaja ? "productos dados de baja" : "productos"}
                    </>
                  ) : (
                    <>Sin productos para mostrar</>
                  )}
                </div>
              </div>

              <div className="mov-headFilters">
                <div className="cc-filter cc-filter--search">
                  <div className="cc-floatingField cc-floatingField--search is-active">
                    <div className="cc-searchInput">
                      <div className="cc-searchInput__fieldWrap">
                        <input
                          className="cc-input cc-input--floating"
                          value={busqueda}
                          onChange={handleBusqueda}
                          placeholder="Buscar por nombre, SKU o variante..."
                          disabled={loading}
                        />
                        <span className="cc-floatingLabel">
                          <FontAwesomeIcon icon={faMagnifyingGlass} /> Búsqueda
                        </span>

                        {busqueda.trim() !== "" && (
                          <button
                            type="button"
                            className="cc-clearSearch cc-clearSearch--inside"
                            title="Limpiar búsqueda"
                            onClick={() => {
                              setBusqueda("");
                              setPaginaActual(1);
                            }}
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cc-filter">
                  <div
                    className={[
                      "cc-floatingField",
                      "is-active",
                      "stock-catFilter",
                      categoriaDropdownAbierto ? "is-open" : "",
                    ].join(" ")}
                    ref={categoriaFiltroDropdownRef}
                  >
                    <button
                      type="button"
                      className="cc-input cc-input--floating stock-catFilterTrigger"
                      disabled={loading || loadingCategorias}
                      onClick={() => setCategoriaDropdownAbierto((prev) => !prev)}
                    >
                      <span className="stock-catFilterTrigger__text">{categoriaFiltroLabel}</span>
                      <FontAwesomeIcon icon={faChevronDown} className="stock-catFilterTrigger__icon" />
                    </button>

                    <span className="cc-floatingLabel">
                      <FontAwesomeIcon icon={faLayerGroup} /> Categoría
                    </span>

                    {categoriaDropdownAbierto ? (
                      <div className="stock-catFilterPanel">
                        <button
                          type="button"
                          className={[
                            "stock-catFilterOption",
                            "stock-catFilterOption--all",
                            !categoriaFiltro ? "is-selected" : "",
                          ].join(" ")}
                          onClick={() => seleccionarCategoriaFiltro("")}
                        >
                          <span className="stock-catFilterExpand stock-catFilterExpand--empty" />
                          <span className="stock-catFilterLabel">Todas</span>
                        </button>

                        {categorias.length === 0 ? (
                          <div className="stock-catFilterEmpty">
                            {loadingCategorias ? "Cargando categorías..." : "No hay categorías cargadas."}
                          </div>
                        ) : (
                          (categoriasPorPadre[0] || []).map((cat) => renderCategoriaFiltroItem(cat, 0))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mov-card__actions stock-tableActionsDesktop">
              {renderStockToolbarActions()}
            </div>

            <div className="mov-card__actions stock-tableActionsAddMobile">
              {renderStockToolbarActions("", { showToggleBajas: false, showAjustePrecios: false })}
            </div>
          </div>

          <div
            className="mov-gridTable mov-gridTable--head"
            style={{ gridTemplateColumns: GRID_COLS }}
            role="row"
          >
            {COLUMNS.map((c) => (
              <div
                key={c.key}
                className={[
                  "mov-gridCell",
                  "mov-gridCell--head",
                  c.align === "right" ? "is-right" : "",
                  c.align === "center" ? "is-center" : "",
                  c.sortable ? "prod-th--sortable" : "",
                ].join(" ")}
                role="columnheader"
                onClick={c.sortable ? () => handleOrden(c.key) : undefined}
              >
                {c.label}
                {c.sortable && <OrdenIcon campo={c.key} />}
              </div>
            ))}
          </div>

          <div className="mov-tableWrap stock-tableWrap" role="rowgroup">
            <div
              className={[
                "mov-gridBody",
                "mov-gridBody--relative",
                loading ? "mov-softLoading" : "",
              ].join(" ")}
            >
              {loading ? (
                <div className="mov-skeletonWrap" aria-busy="true">
                  {Array.from({ length: SKELETON_ROWS }).map((_, i) => renderSkeletonRow(i))}
                </div>
              ) : (
                <>
                  {productos.length === 0 ? (
                    <div className="cc-emptyState">
                      <FontAwesomeIcon icon={faBoxOpen} className="cc-emptyIcon" />
                      <div className="cc-emptyText">
                        {busqueda.trim() || categoriaFiltro
                          ? "No se encontraron productos con los filtros seleccionados."
                          : mostrarDadosDeBaja
                            ? "No hay productos dados de baja."
                            : "No hay productos para mostrar."}
                      </div>
                    </div>
                  ) : (
                    productos.map((prod) => {
                      const productoId = getProductoId(prod);
                      const archivoId = Number(prod?.imagen_archivo_id || 0);
                      const imagenTemporal = imagenesTemporalesPorProducto?.[productoId]?.url || "";
                      const usandoImagenTemporal = !!imagenTemporal;
                      const intentoImagen = Number(reintentosImagenes?.[productoId] || 0);
                      const imagenRota = !usandoImagenTemporal && !!erroresImagenes[productoId];
                      const productoInactivo = Number(prod?.activo ?? 1) === 0;
                      const totalVariantesProducto = Number(prod?.cantidad_variantes_total ?? prod?.cantidad_variantes ?? 0);
                      const variantesActivasProducto = Number(prod?.cantidad_variantes_activas ?? prod?.cantidad_variantes ?? 0);
                      const variantesInactivasProducto = Number(prod?.cantidad_variantes_inactivas ?? 0);
                      const tieneVariantesParaMostrar = !!prod.tiene_variantes || variantesActivasProducto > 0;
                      const imageUrl =
                        imagenTemporal ||
                        (archivoId > 0
                          ? getProductoImageUrl(
                              prod,
                              API_URL,
                              versionImagenPorProducto[productoId] || 0,
                              intentoImagen
                            )
                          : "");

                      return (
                        <React.Fragment key={productoId}>
                        <div
                          className={`mov-gridTable mov-gridTable--row ${tieneVariantesParaMostrar ? "prod-row--expandable" : ""} ${variantesAbiertas[productoId] ? "is-variants-open" : ""}`}
                          style={{ gridTemplateColumns: GRID_COLS }}
                          role="row"
                          tabIndex={tieneVariantesParaMostrar ? 0 : undefined}
                          aria-expanded={tieneVariantesParaMostrar ? !!variantesAbiertas[productoId] : undefined}
                          title={tieneVariantesParaMostrar ? (variantesAbiertas[productoId] ? "Ocultar variantes" : "Ver variantes") : undefined}
                          onClick={() => {
                            if (tieneVariantesParaMostrar) toggleVariantesProducto(prod);
                          }}
                          onKeyDown={(e) => {
                            if (!tieneVariantesParaMostrar) return;
                            if (e.target !== e.currentTarget) return;
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            toggleVariantesProducto(prod);
                          }}
                        >
                          <div className="mov-gridCell is-strong" role="cell" data-label="PRODUCTO">
                            <div className="prod-productCell">
                              <div className="prod-thumb">
                                {imageUrl && !imagenRota ? (
                                  <img
                                    src={imageUrl}
                                    alt={prod.nombre}
                                    className="prod-thumb__img"
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => {
                                      setErroresImagenes((prev) => {
                                        if (!prev?.[productoId]) return prev;
                                        const next = { ...prev };
                                        delete next[productoId];
                                        return next;
                                      });
                                    }}
                                    onError={() => {
                                      if (usandoImagenTemporal) {
                                        limpiarImagenTemporalProducto(productoId);
                                        return;
                                      }

                                      if (intentoImagen < 6) {
                                        programarReintentoImagen(productoId);
                                        return;
                                      }

                                      setErroresImagenes((prev) => ({
                                        ...prev,
                                        [productoId]: true,
                                      }));
                                    }}
                                  />
                                ) : (
                                  <span className="prod-thumb__placeholder">
                                    <FontAwesomeIcon icon={faBoxOpen} />
                                  </span>
                                )}
                              </div>

                              <span className="mov-ellipsissss">{prod.nombre}</span>
                              {tieneVariantesParaMostrar ? (
                                <span className="prod-variantBadge prod-variantBadge--count">
                                  {totalVariantesProducto || variantesActivasProducto || 0} variantes
                                  {variantesInactivasProducto > 0 ? ` · ${variantesInactivasProducto} baja${variantesInactivasProducto === 1 ? "" : "s"}` : ""}
                                </span>
                              ) : null}
                              {productoInactivo ? <span className="prod-variantBadge prod-variantBadge--inactive">Dado de baja</span> : null}
                            </div>
                          </div>

                          <div className="mov-gridCell is-center" role="cell" data-label="SKU">
                            <span className="mov-ellipsissss prod-sku">{prod.sku || "—"}</span>
                          </div>

                          <div className="mov-gridCell is-center" role="cell" data-label="STOCK">
                            {renderStockChip(prod.stock)}
                          </div>

                          <div
                            className="mov-gridCell is-right"
                            role="cell"
                            data-label="PRECIO COSTO"
                          >
                            <span className="mov-ellipsissss">{formatMoney(prod.precio_costo)}</span>
                          </div>

                          <div
                            className="mov-gridCell is-right"
                            role="cell"
                            data-label="PRECIO VENTA"
                          >
                            <span className="mov-ellipsissss">{formatMoney(prod.precio)}</span>
                          </div>

                          <div
                            className="mov-gridCell is-right"
                            role="cell"
                            data-label="PRECIO PROMO"
                          >
                            <span className="mov-ellipsissss prod-promo">
                              {formatMoney(prod.precio_promo)}
                            </span>
                          </div>

                          <div
                            className="mov-gridCell mov-gridCell--actions is-center"
                            role="cell"
                            data-label="ACCIONES"
                          >
                            <div className="mov-actionsInline">
                              <button
                                type="button"
                                title="Historial de precios"
                                className="mov-iconBtn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductoHistorialPrecios(prod);
                                }}
                              >
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                              </button>

                              {productoInactivo ? (
                                <button
                                  type="button"
                                  title="Dar de alta producto"
                                  className="mov-iconBtn"
                                  disabled={reactivandoId === productoId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReactivarProducto(prod);
                                  }}
                                >
                                  <FontAwesomeIcon icon={faRotateLeft} />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    title="Editar"
                                    className="mov-iconBtn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAbrirEditar(productoId);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faPenToSquare} />
                                  </button>

                                  <button
                                    type="button"
                                    title="Dar de baja"
                                    className="mov-iconBtn mov-iconBtn--danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAbrirEliminar(prod);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faTrashCan} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {variantesAbiertas[productoId] ? renderVariantesProducto(prod) : null}
                        </React.Fragment>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>

          {renderStockToolbarActions("stock-tableActionsMobile", { showAgregarProducto: false })}
        </section>

        {totalPaginas > 1 && (
          <div className="prod-pagination">
            <button
              type="button"
              className="mov-btn mov-btn--ghost"
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
            >
              ← Anterior
            </button>

            {paginasVisibles.map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="prod-page-dots">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`mov-btn ${p === paginaActual ? "mov-btn--primary" : "mov-btn--ghost"}`}
                  onClick={() => setPaginaActual(p)}
                  style={{ minWidth: 40, padding: "0 10px" }}
                >
                  {p}
                </button>
              )
            )}

            <span className="prod-pagination__summary">
              Página {paginaActual} de {totalPaginas}
            </span>

            <button
              type="button"
              className="mov-btn mov-btn--ghost"
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>


      {modalAjustePreciosAbierto && (
        <ModalAjustePrecios
          open={modalAjustePreciosAbierto}
          onClose={() => setModalAjustePreciosAbierto(false)}
          onToast={mostrarToast}
          onGuardado={async () => {
            await refrescarDespuesDeGuardar();
            try {
              window.dispatchEvent(new CustomEvent("balto:stock-updated"));
            } catch {}
          }}
          onProcesoMasivo={handleCargaPreciosMasivos}
          umbralProcesoMasivo={PRECIOS_MASIVOS_LOADING_THRESHOLD}
        />
      )}

      {productoHistorialPrecios && (
        <ModalHistorialPreciosProducto
          open={!!productoHistorialPrecios}
          producto={productoHistorialPrecios}
          onClose={() => setProductoHistorialPrecios(null)}
          onToast={mostrarToast}
        />
      )}

      {modalAbierto && (
        <ModalCargaMasiva
          open={modalAbierto}
          onClose={() => setModalAbierto(false)}
          onToast={mostrarToast}
          onGuardado={async (productoGuardado) => {
            setModalAbierto(false);
            await refrescarDespuesDeGuardar(productoGuardado);
            notifyListsUpdated();
            mostrarToast("exito", "Producto agregado correctamente.");
          }}
          onImportado={async (mensaje) => {
            setModalAbierto(false);
            await refrescarDespuesDeGuardar();
            notifyListsUpdated();
            mostrarToast("exito", mensaje || "Importación finalizada correctamente.");
          }}
          categorias={categorias}
          loadingCategorias={loadingCategorias}
        />
      )}

      {modalEditarAbierto && productoEditarId && (
        <ModalEditarProducto
          productoId={productoEditarId}
          onClose={handleCerrarEditar}
          onToast={mostrarToast}
          onGuardado={async (productoGuardado, opciones = {}) => {
            const productoIdEditado = getProductoId(productoGuardado) || Number(opciones?.productoId || productoEditarId || 0);
            handleCerrarEditar();
            await refrescarDespuesDeGuardar(productoGuardado, {
              ...opciones,
              productoId: productoIdEditado,
            });
            notifyListsUpdated();
            mostrarToast("exito", "Producto editado correctamente.");
          }}
        />
      )}

      <ModalEliminar
        open={modalEliminarAbierto}
        row={
          productoEliminar
            ? {
                id: getProductoId(productoEliminar),
                nombre: productoEliminar.nombre,
                sku: productoEliminar.sku,
                stock: productoEliminar.stock,
                precio_costo: productoEliminar.precio_costo,
                precio: productoEliminar.precio,
              }
            : null
        }
        loading={eliminando}
        onClose={handleCerrarEliminar}
        onConfirm={handleConfirmarEliminar}
        onToast={mostrarToast}
        title="Dar de baja producto"
        message="¿Seguro que querés dar de baja este producto?"
        warning="No se borra historial, precios, variantes ni movimientos. Vas a poder reactivarlo desde la vista de dados de baja."
        loadingMessage="Dando de baja producto..."
        successMessage="Producto dado de baja correctamente."
        errorMessage="No se pudo dar de baja el producto."
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        confirmDisabled={cargandoImpactoEliminar}
        confirmVariant="danger"
        extraContent={impactoEliminacionProducto}
        details={
          productoEliminar
            ? [
                { label: "ID Producto", value: `#${getProductoId(productoEliminar)}` },
                { label: "Nombre", value: productoEliminar.nombre || "—" },
                { label: "SKU", value: productoEliminar.sku || "—" },
                {
                  label: "Stock",
                  value:
                    productoEliminar.stock === null ||
                    productoEliminar.stock === undefined ||
                    productoEliminar.stock === ""
                      ? "—"
                      : String(productoEliminar.stock),
                },
                { label: "Precio costo", value: formatMoney(productoEliminar.precio_costo) },
                { label: "Precio venta", value: formatMoney(productoEliminar.precio) },
              ]
            : []
        }
      />


      <ModalEliminar
        open={modalBajaVarianteAbierto}
        row={
          varianteBaja
            ? {
                id: getVarianteId(varianteBaja),
                nombre: varianteBaja.nombre_variante || `Variante #${getVarianteId(varianteBaja)}`,
                sku: varianteBaja.sku,
                stock: varianteBaja.stock,
                precio_costo: varianteBaja.precio_costo,
                precio: varianteBaja.precio,
              }
            : null
        }
        loading={!!procesandoVarianteId}
        onClose={handleCerrarBajaVariante}
        onConfirm={handleConfirmarBajaVariante}
        onToast={mostrarToast}
        title="Dar de baja variante"
        message="¿Seguro que querés dar de baja esta variante?"
        warning="No se borra historial, precios, categorías, atributos ni movimientos. Vas a poder reactivarla desde el detalle de variantes del producto."
        loadingMessage="Dando de baja variante..."
        successMessage="Variante dada de baja correctamente."
        errorMessage="No se pudo dar de baja la variante."
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        confirmVariant="danger"
        details={
          varianteBaja
            ? [
                { label: "ID Variante", value: `#${getVarianteId(varianteBaja)}` },
                { label: "Producto", value: varianteBaja.productoNombre || "—" },
                { label: "Variante", value: varianteBaja.nombre_variante || "—" },
                { label: "SKU", value: varianteBaja.sku || "—" },
                {
                  label: "Stock",
                  value:
                    varianteBaja.stock === null ||
                    varianteBaja.stock === undefined ||
                    varianteBaja.stock === ""
                      ? "—"
                      : String(varianteBaja.stock),
                },
                { label: "Precio costo", value: formatMoney(varianteBaja.precio_costo) },
                { label: "Precio venta", value: formatMoney(varianteBaja.precio) },
              ]
            : []
        }
      />


      {cargaPreciosMasivos && (
        <div className="stock-priceLoadingOverlay" role="status" aria-live="polite">
          <div className="stock-priceLoadingModal">
            <div className="stock-priceLoadingModal__icon">
              <img src={BaltoCargaGif} alt="Balto cargando" className="stock-priceLoadingModal__gif" />
            </div>
            <div className="stock-priceLoadingModal__content">
              <h3>Actualizando precios en Balto y Tienda Nube</h3>
              <p>Esta acción puede tardar unos segundos.</p>
              <small>
                {cargaPreciosMasivos.total > 0
                  ? `${cargaPreciosMasivos.total} precios en proceso. Si la conexión con Tienda Nube está activa, también se sincronizan allá.`
                  : "Si la conexión con Tienda Nube está activa, también se sincronizan allá."}
              </small>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <Toast
          key={toast.id}
          tipo={esToastCarga(toast.tipo) ? "cargando" : toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={cerrarToast}
        />
      ) : null}
    </>
  );
};

export default Stock;