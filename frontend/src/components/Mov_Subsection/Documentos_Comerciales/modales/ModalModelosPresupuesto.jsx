import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import BASE_URL from "../../../../config/config";
import ProductStockAutocomplete from "../../_shared/ProductStockAutocomplete.jsx";
import "../../../Global/Global_css/GlobalsModalsV2.css";
import "../../../Global/Global_css/Global_responsive.css";
import "../../../Global/Global_css/roots.css";
import "./ModalModelosPresupuesto.css";

const IVA_OPTIONS = [0, 10.5, 21, 27];

function uid() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function upperInput(v) {
  return String(v ?? "").toLocaleUpperCase("es-AR");
}

function upperStr(v) {
  return upperInput(v).trim();
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyARS(v) {
  try {
    return Number(v || 0).toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `$ ${Number(v || 0).toFixed(2)}`;
  }
}

function getStockProductoId(d) {
  const n = Number(d?.id_stock_producto ?? d?.idStockProducto ?? d?.id_producto ?? d?.id ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getStockVarianteId(d) {
  const n = Number(d?.id_stock_variante ?? d?.idStockVariante ?? d?.id_variante ?? 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getNombre(d) {
  return upperStr(d?.nombre || d?.descripcion || d?.detalle || d?.label || "");
}

function getCodigo(d) {
  return upperStr(d?.sku || d?.codigo || d?.codigo_barra || "");
}

function getPrecio(d) {
  const candidates = [d?.precio_venta, d?.precio, d?.precio_promocional, d?.precio_mayorista];
  for (const raw of candidates) {
    if (raw === null || raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const precios = Array.isArray(d?.precios) ? d.precios : [];
  for (const item of precios) {
    const raw = item?.monto ?? item?.precio;
    if (raw === null || raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function emptyRow() {
  return {
    localId: uid(),
    id_detalle: null,
    id_stock_producto: null,
    id_stock_variante: null,
    descripcion: "",
    codigo: "",
    cantidad: 1,
    precio: 0,
    iva_pct: 0,
  };
}

function rowFromItem(item) {
  return {
    localId: uid(),
    id_detalle: Number(item?.id_detalle || 0) || null,
    id_stock_producto: Number(item?.id_stock_producto || 0) || null,
    id_stock_variante: Number(item?.id_stock_variante || 0) || null,
    descripcion: upperStr(item?.descripcion || item?.detalle || item?.nombre),
    codigo: upperStr(item?.codigo || item?.sku),
    cantidad: safeNumber(item?.cantidad) || 1,
    precio: safeNumber(item?.precio ?? item?.precio_unitario),
    iva_pct: safeNumber(item?.iva_pct),
  };
}

function normalizeLists(lists) {
  const src = lists && typeof lists === "object" ? lists : {};
  const data = src.listas && typeof src.listas === "object" ? src.listas : src;
  return Array.isArray(data.detalles) ? data.detalles : Array.isArray(data.productos) ? data.productos : [];
}

function buildHeaders(json = true) {
  const sessionKey =
    localStorage.getItem("session_key") ||
    localStorage.getItem("sessionKey") ||
    localStorage.getItem("x_session") ||
    localStorage.getItem("X-Session") ||
    "";
  const token = localStorage.getItem("token") || localStorage.getItem("auth_token") || "";
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (sessionKey) headers["X-Session"] = sessionKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Respuesta inválida del servidor. HTTP ${res.status}`);
  }
  if (!res.ok || data?.exito === false) throw new Error(data?.mensaje || data?.error || `HTTP ${res.status}`);
  return data || {};
}

export default function ModalModelosPresupuesto({ open, lists, onClose, onToast, onUseModel }) {
  const API = `${BASE_URL}/api.php`;
  const stockOptions = useMemo(() => normalizeLists(lists), [lists]);
  const [modelos, setModelos] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({
    id_modelo: null,
    nombre: "",
    descripcion: "",
    es_personalizado: true,
    validez_dias: "7",
    plazo_entrega: "",
    forma_pago: "",
    condiciones_comerciales: "",
    garantia: "",
    lugar_entrega: "",
    notas: "",
    rows: [emptyRow()],
  });

  const cargar = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}?action=presupuestos_modelos_listar&limit=200`, {
        method: "GET",
        headers: buildHeaders(false),
      });
      const data = await parseJson(res);
      setModelos(Array.isArray(data?.modelos) ? data.modelos : Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      onToast?.("error", e?.message || "No se pudieron cargar los modelos.", 4500);
    } finally {
      setLoading(false);
    }
  }, [API, onToast, open]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setEditorOpen(false);
    setDeletingId(null);
    cargar();
  }, [open, cargar]);

  const filtered = useMemo(() => {
    const needle = safeStr(q).toLowerCase();
    if (!needle) return modelos;
    return modelos.filter((m) => {
      const items = Array.isArray(m?.items) ? m.items : [];
      return [m?.nombre, m?.descripcion, ...items.map((i) => i?.descripcion || i?.nombre)]
        .map((v) => safeStr(v).toLowerCase())
        .some((v) => v.includes(needle));
    });
  }, [modelos, q]);

  const openCreate = useCallback(() => {
    setForm({
      id_modelo: null,
      nombre: "",
      descripcion: "",
      es_personalizado: true,
      validez_dias: "7",
      plazo_entrega: "",
      forma_pago: "",
      condiciones_comerciales: "",
      garantia: "",
      lugar_entrega: "",
      notas: "",
      rows: [emptyRow()],
    });
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((modelo) => {
    const c = modelo?.condiciones_presupuesto && typeof modelo.condiciones_presupuesto === "object"
      ? modelo.condiciones_presupuesto
      : {};
    setForm({
      id_modelo: Number(modelo?.id_modelo || 0) || null,
      nombre: upperStr(modelo?.nombre),
      descripcion: upperStr(modelo?.descripcion),
      es_personalizado: Number(modelo?.es_personalizado ?? 1) === 1,
      validez_dias: String(modelo?.validez_dias ?? c?.validez_dias ?? c?.validezDias ?? "7"),
      plazo_entrega: upperStr(modelo?.plazo_entrega || c?.plazo_entrega || c?.plazoEntrega),
      forma_pago: upperStr(modelo?.forma_pago || c?.forma_pago || c?.formaPago),
      condiciones_comerciales: upperStr(modelo?.condiciones_comerciales || c?.condiciones_comerciales || c?.condicionesComerciales),
      garantia: upperStr(modelo?.garantia || c?.garantia),
      lugar_entrega: upperStr(modelo?.lugar_entrega || c?.lugar_entrega || c?.lugarEntrega),
      notas: upperStr(modelo?.notas || c?.notas),
      rows: Array.isArray(modelo?.items) && modelo.items.length ? modelo.items.map(rowFromItem) : [emptyRow()],
    });
    setEditorOpen(true);
  }, []);

  const updateRow = useCallback((localId, patch) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    }));
  }, []);

  const selectStock = useCallback((localId, option) => {
    updateRow(localId, {
      id_detalle: null,
      id_stock_producto: getStockProductoId(option),
      id_stock_variante: getStockVarianteId(option),
      descripcion: getNombre(option),
      codigo: getCodigo(option),
      precio: getPrecio(option),
    });
  }, [updateRow]);

  const itemsPayload = useMemo(() => {
    return form.rows
      .filter((r) => safeStr(r.descripcion) && safeNumber(r.cantidad) > 0)
      .map((r) => {
        const cantidad = safeNumber(r.cantidad);
        const precio = safeNumber(r.precio);
        const ivaPct = safeNumber(r.iva_pct);
        const subtotal = cantidad * precio;
        const ivaMonto = subtotal * ivaPct / 100;
        return {
          id_detalle: r.id_detalle || null,
          id_stock_producto: r.id_stock_producto || null,
          id_stock_variante: r.id_stock_variante || null,
          descripcion: upperStr(r.descripcion),
          detalle: upperStr(r.descripcion),
          codigo: upperStr(r.codigo),
          cantidad,
          precio,
          precio_unitario: precio,
          iva_pct: ivaPct,
          subtotal,
          iva_monto: ivaMonto,
          total: subtotal + ivaMonto,
        };
      });
  }, [form.rows]);

  const total = useMemo(() => itemsPayload.reduce((acc, item) => acc + safeNumber(item.total), 0), [itemsPayload]);

  const guardar = useCallback(async () => {
    if (!safeStr(form.nombre)) {
      onToast?.("error", "Ingresá un nombre para el modelo.", 3500);
      return;
    }
    if (!itemsPayload.length) {
      onToast?.("error", "Agregá al menos un elemento al modelo.", 3500);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id_modelo: form.id_modelo,
        nombre: upperStr(form.nombre),
        descripcion: upperStr(form.descripcion),
        es_personalizado: form.es_personalizado ? 1 : 0,
        validez_dias: safeNumber(form.validez_dias) > 0 ? Math.floor(safeNumber(form.validez_dias)) : null,
        plazo_entrega: upperStr(form.plazo_entrega),
        forma_pago: upperStr(form.forma_pago),
        condiciones_comerciales: upperStr(form.condiciones_comerciales),
        garantia: upperStr(form.garantia),
        lugar_entrega: upperStr(form.lugar_entrega),
        notas: upperStr(form.notas),
        moneda: "ARS",
        condiciones_presupuesto: {
          validez_dias: safeNumber(form.validez_dias) > 0 ? Math.floor(safeNumber(form.validez_dias)) : null,
          plazo_entrega: safeStr(form.plazo_entrega),
          forma_pago: safeStr(form.forma_pago),
          condiciones_comerciales: safeStr(form.condiciones_comerciales),
          garantia: safeStr(form.garantia),
          lugar_entrega: safeStr(form.lugar_entrega),
          notas: safeStr(form.notas),
          moneda: "ARS",
        },
        items: itemsPayload,
      };
      const res = await fetch(`${API}?action=presupuestos_modelos_guardar`, {
        method: "POST",
        headers: buildHeaders(true),
        body: JSON.stringify(payload),
      });
      await parseJson(res);
      onToast?.("exito", form.id_modelo ? "Modelo actualizado correctamente." : "Modelo creado correctamente.", 3000);
      setEditorOpen(false);
      await cargar();
    } catch (e) {
      onToast?.("error", e?.message || "No se pudo guardar el modelo.", 4800);
    } finally {
      setSaving(false);
    }
  }, [API, cargar, form, itemsPayload, onToast]);

  const eliminar = useCallback(async (modelo) => {
    const id = Number(modelo?.id_modelo || 0);
    if (!id) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}?action=presupuestos_modelos_eliminar`, {
        method: "POST",
        headers: buildHeaders(true),
        body: JSON.stringify({ id_modelo: id }),
      });
      await parseJson(res);
      setModelos((prev) => prev.filter((m) => Number(m?.id_modelo) !== id));
      onToast?.("exito", "Modelo eliminado correctamente.", 3000);
    } catch (e) {
      onToast?.("error", e?.message || "No se pudo eliminar el modelo.", 4500);
    } finally {
      setDeletingId(null);
    }
  }, [API, onToast]);

  if (!open) return null;

  return createPortal(
    <div className="pm-gallery-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose?.()}>
      <div className="pm-gallery-modal" role="dialog" aria-modal="true" aria-label="Modelos de presupuesto" onMouseDown={(e) => e.stopPropagation()}>
        <header className="pm-gallery-head">
          <div>
            <h2>{editorOpen ? (form.id_modelo ? "Editar modelo" : "Nuevo modelo") : "Modelos de presupuesto"}</h2>
            <p>{editorOpen ? "Definí los elementos base. Después cada presupuesto puede cambiar cantidades, medidas y precios." : "Guardá estructuras repetitivas como techo, portón, puerta o cualquier trabajo personalizado."}</p>
          </div>
          <button type="button" className="pm-gallery-close" onClick={() => editorOpen ? setEditorOpen(false) : onClose?.()} disabled={saving}>✕</button>
        </header>

        {!editorOpen ? (
          <div className="pm-gallery-body">
            <div className="pm-gallery-toolbar">
              <div className="pm-gallery-search">
                <span>⌕</span>
                <input value={q} onChange={(e) => setQ(upperInput(e.target.value))} placeholder="Buscar por nombre o material…" />
              </div>
              <button type="button" className="pm-btn pm-btn--primary" onClick={openCreate}>+ Crear modelo</button>
            </div>

            {loading ? (
              <div className="pm-gallery-empty">Cargando modelos…</div>
            ) : filtered.length === 0 ? (
              <div className="pm-gallery-empty">{q ? "No hay modelos que coincidan con la búsqueda." : "Todavía no hay modelos guardados."}</div>
            ) : (
              <div className="pm-gallery-grid">
                {filtered.map((modelo) => (
                  <article className="pm-model-card" key={modelo.id_modelo}>
                    <div className="pm-model-card__top">
                      <span className="pm-model-card__badge">{Number(modelo.es_personalizado ?? 1) === 1 ? "PERSONALIZADO" : "CON STOCK"}</span>
                      <strong>{upperStr(modelo.nombre) || "MODELO SIN NOMBRE"}</strong>
                      <p>{upperStr(modelo.descripcion) || "SIN DESCRIPCIÓN"}</p>
                    </div>
                    <div className="pm-model-card__items">
                      {(Array.isArray(modelo.items) ? modelo.items : []).slice(0, 5).map((item, idx) => (
                        <div key={`${modelo.id_modelo}-${idx}`}><span>{safeNumber(item.cantidad)}×</span>{upperStr(item.descripcion || item.nombre)}</div>
                      ))}
                      {Number(modelo.cantidad_items || 0) > 5 && <small>+ {Number(modelo.cantidad_items) - 5} elementos más</small>}
                    </div>
                    <div className="pm-model-card__summary">
                      <span>{Number(modelo.cantidad_items || 0)} elementos</span>
                      <b>{moneyARS(modelo.total_modelo || 0)}</b>
                    </div>
                    <div className="pm-model-card__actions">
                      <button type="button" className="pm-btn pm-btn--primary" onClick={() => onUseModel?.(modelo)}>Usar modelo</button>
                      <button type="button" className="pm-btn" onClick={() => openEdit(modelo)}>Editar</button>
                      <button
                        type="button"
                        className={`pm-btn pm-btn--danger ${deletingId === Number(modelo.id_modelo) ? "is-confirm" : ""}`}
                        disabled={deletingId && deletingId !== Number(modelo.id_modelo)}
                        onClick={() => deletingId === Number(modelo.id_modelo) ? eliminar(modelo) : setDeletingId(Number(modelo.id_modelo))}
                      >
                        {deletingId === Number(modelo.id_modelo) ? "Confirmar" : "Eliminar"}
                      </button>
                      {deletingId === Number(modelo.id_modelo) && <button type="button" className="pm-btn" onClick={() => setDeletingId(null)}>Cancelar</button>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="pm-editor-body">
            <div className="pm-editor-meta">
              <label><span>Nombre del modelo *</span><input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: upperInput(e.target.value) }))} placeholder="Ej.: Techo de chapa" /></label>
              <label><span>Descripción</span><input value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: upperInput(e.target.value) }))} placeholder="Uso interno para identificarlo" /></label>
              <label className="pm-switch-line">
                <input type="checkbox" checked={form.es_personalizado} onChange={(e) => setForm((p) => ({ ...p, es_personalizado: e.target.checked }))} />
                <span><b>Trabajo personalizado</b><small>Permite materiales escritos a mano y productos sin stock disponible.</small></span>
              </label>
            </div>

            <div className="pm-editor-table">
              <div className="pm-editor-row pm-editor-row--head"><span>Elemento / material</span><span>Cantidad / medida</span><span>Precio</span><span>IVA</span><span>Total</span><span /></div>
              {form.rows.map((row) => {
                const subtotal = safeNumber(row.cantidad) * safeNumber(row.precio);
                const totalRow = subtotal + subtotal * safeNumber(row.iva_pct) / 100;
                return (
                  <div className="pm-editor-row" key={row.localId}>
                    <ProductStockAutocomplete
                      value={row.descripcion}
                      onChange={(value) => updateRow(row.localId, { descripcion: upperInput(value), id_detalle: null, id_stock_producto: null, id_stock_variante: null, codigo: "" })}
                      onSelect={(option) => selectStock(row.localId, option)}
                      options={stockOptions}
                      allowOutOfStock={form.es_personalizado}
                      showAllOnFocus={true}
                      placeholder="Buscar en stock o escribir manualmente…"
                      emptyMessage="Sin coincidencias. Podés dejar el texto escrito."
                      disabled={saving}
                      inputClassName="pm-editor-input"
                    />
                    <input type="number" min="0.01" step="0.01" value={row.cantidad} onChange={(e) => updateRow(row.localId, { cantidad: e.target.value })} disabled={saving} />
                    <input type="number" min="0" step="0.01" value={row.precio} onChange={(e) => updateRow(row.localId, { precio: e.target.value })} disabled={saving} />
                    <select value={row.iva_pct} onChange={(e) => updateRow(row.localId, { iva_pct: Number(e.target.value) })} disabled={saving}>{IVA_OPTIONS.map((iva) => <option key={iva} value={iva}>{iva} %</option>)}</select>
                    <b>{moneyARS(totalRow)}</b>
                    <button type="button" className="pm-row-delete" onClick={() => setForm((p) => ({ ...p, rows: p.rows.length <= 1 ? p.rows : p.rows.filter((x) => x.localId !== row.localId) }))} disabled={saving || form.rows.length <= 1}>×</button>
                  </div>
                );
              })}
              <div className="pm-editor-table__foot">
                <button type="button" className="pm-btn" onClick={() => setForm((p) => ({ ...p, rows: [...p.rows, emptyRow()] }))} disabled={saving}>+ Agregar elemento</button>
                <div><span>Total base</span><b>{moneyARS(total)}</b></div>
              </div>
            </div>

            <div className="pm-editor-conditions">
              <label><span>Validez (días)</span><input type="number" min="0" max="3650" step="1" value={form.validez_dias} onChange={(e) => setForm((p) => ({ ...p, validez_dias: e.target.value }))} /></label>
              <label><span>Plazo de entrega / ejecución</span><textarea rows={2} value={form.plazo_entrega} onChange={(e) => setForm((p) => ({ ...p, plazo_entrega: upperInput(e.target.value) }))} /></label>
              <label><span>Forma de pago</span><textarea rows={2} value={form.forma_pago} onChange={(e) => setForm((p) => ({ ...p, forma_pago: upperInput(e.target.value) }))} /></label>
              <label><span>Condiciones comerciales</span><textarea rows={2} value={form.condiciones_comerciales} onChange={(e) => setForm((p) => ({ ...p, condiciones_comerciales: upperInput(e.target.value) }))} /></label>
              <label><span>Garantía</span><textarea rows={2} value={form.garantia} onChange={(e) => setForm((p) => ({ ...p, garantia: upperInput(e.target.value) }))} /></label>
              <label><span>Lugar de entrega / instalación</span><textarea rows={2} value={form.lugar_entrega} onChange={(e) => setForm((p) => ({ ...p, lugar_entrega: upperInput(e.target.value) }))} /></label>
              <label><span>Notas</span><textarea rows={2} value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: upperInput(e.target.value) }))} /></label>
            </div>

            <footer className="pm-editor-actions">
              <button type="button" className="pm-btn" onClick={() => setEditorOpen(false)} disabled={saving}>Volver</button>
              <button type="button" className="pm-btn pm-btn--primary" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar modelo"}</button>
            </footer>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
