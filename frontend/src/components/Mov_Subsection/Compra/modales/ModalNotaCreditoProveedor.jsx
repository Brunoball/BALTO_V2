import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BASE_URL from "../../../../config/config.jsx";
import "../../../Global/Global_css/roots.css";
import "../../../Global/Global_css/GlobalsModalsV2.css";
import "../../Ventas/modales/ModalNuevaVenta.css";
import { DEMO_BLOCK_MESSAGE, isBaltoDemoMode } from "../../../../utils/demoMode";

const MOTIVOS = [
  ["DEVOLUCION_MERCADERIA", "Devolución de mercadería al proveedor"],
  ["ANULACION_TOTAL", "Anulación total de la compra"],
  ["DESCUENTO", "Descuento del proveedor"],
  ["BONIFICACION", "Bonificación del proveedor"],
  ["DIFERENCIA_PRECIO", "Diferencia de precio"],
  ["OTRO", "Otro ajuste"],
];

const MOTIVOS_AJUSTE_SIN_STOCK = new Set([
  "DESCUENTO",
  "BONIFICACION",
  "DIFERENCIA_PRECIO",
  "OTRO",
]);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function num(value) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedNumberValue(value, maximum) {
  const raw = String(value ?? "");
  if (raw === "") return "";

  const parsed = Number(raw.replace(",", "."));
  const max = Math.max(0, Number(maximum) || 0);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max + 0.000001) return null;
  return raw;
}

function preventInvalidNumberKeys(event) {
  if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
}

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function quantity(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function makeKey(id) {
  const uuid = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `nc-compra-${id || 0}-${uuid}`.slice(0, 100);
}

function auth() {
  const token = (localStorage.getItem("token") || "").trim();
  const sessionKey = (
    localStorage.getItem("session_key") ||
    localStorage.getItem("sessionKey") ||
    localStorage.getItem("X-Session") ||
    ""
  ).trim();
  let idUsuario = 0;
  try {
    const user = JSON.parse(localStorage.getItem("usuario") || "null");
    idUsuario = Number(
      user?.idUsuarioMaster ?? user?.idUsuario ?? user?.id_usuario ?? user?.id ?? 0
    ) || 0;
  } catch {
    // El backend admite id_usuario nulo.
  }
  return { token, sessionKey, idUsuario };
}

function headers(json = false) {
  const session = auth();
  const result = json ? { "Content-Type": "application/json" } : {};
  if (session.sessionKey) result["X-Session"] = session.sessionKey;
  if (session.token) result.Authorization = `Bearer ${session.token}`;
  return result;
}

async function parse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || "Respuesta inválida.");
  }
  if (!response.ok || !data?.exito) {
    throw new Error(data?.mensaje || data?.message || "Error en la operación.");
  }
  return data;
}

function allowedFile(file) {
  if (!file) return false;
  return file.type === "application/pdf" || String(file.type || "").startsWith("image/");
}

export default function ModalNotaCreditoProveedor({ open, row, onClose, onToast, onDone }) {
  const API = `${BASE_URL}/api.php`;
  const [ctx, setCtx] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState("DEVOLUCION_MERCADERIA");
  const [observaciones, setObservaciones] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [ajuste, setAjuste] = useState("");
  const [ivaAjuste, setIvaAjuste] = useState("0");
  const [descripcionAjuste, setDescripcionAjuste] = useState("DESCUENTO / BONIFICACIÓN");
  const [archivo, setArchivo] = useState(null);
  const fileRef = useRef(null);
  const keyRef = useRef("");

  const toast = useCallback(
    (type, message, duration = 3200) => onToast?.(type, message, duration),
    [onToast]
  );

  const idOrigen = Number(row?.id_movimiento ?? row?.id_compra ?? row?.id ?? 0);
  const esAjusteSinStock = MOTIVOS_AJUSTE_SIN_STOCK.has(motivo);
  const esAnulacionTotal = motivo === "ANULACION_TOTAL";

  const load = useCallback(async () => {
    if (!idOrigen) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API}?action=compras_nota_credito_contexto&id_movimiento=${idOrigen}`,
        { headers: headers() }
      );
      const data = await parse(response);
      const context = data.contexto || data.data?.contexto;
      setCtx(context);
      setItems((context?.items || []).map((item) => ({
        id_item_origen: Number(item.id_item),
        descripcion: item.descripcion_resuelta || item.descripcion || "Ítem",
        disponible: Number(item.cantidad_disponible || 0),
        cantidadOriginal: Number(item.cantidad_original || item.cantidad || 0),
        subtotalOriginal: Number(item.subtotal || 0),
        ivaOriginal: Number(item.iva_monto || 0),
        totalOriginal: Number(item.total || 0),
        iva_pct: Number(item.iva_pct || 0),
        cantidad: "",
      })));
    } catch (loadError) {
      setError(loadError.message || "No se pudo cargar la compra.");
    } finally {
      setLoading(false);
    }
  }, [API, idOrigen]);

  useEffect(() => {
    if (!open) return;
    keyRef.current = makeKey(idOrigen);
    setCtx(null);
    setItems([]);
    setError("");
    setMotivo("DEVOLUCION_MERCADERIA");
    setObservaciones("");
    setFecha(todayISO());
    setAjuste("");
    setIvaAjuste("0");
    setDescripcionAjuste("DESCUENTO / BONIFICACIÓN");
    setArchivo(null);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }, [open, idOrigen, load]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, loading, onClose]);

  useEffect(() => {
    if (esAnulacionTotal) {
      setItems((previous) => previous.map((item) => ({
        ...item,
        cantidad: item.disponible > 0 ? String(item.disponible) : "",
      })));
      setAjuste("");
      return;
    }

    if (esAjusteSinStock) {
      setItems((previous) => previous.map((item) => ({ ...item, cantidad: "" })));
      const descriptions = {
        DESCUENTO: "DESCUENTO DEL PROVEEDOR",
        BONIFICACION: "BONIFICACIÓN DEL PROVEEDOR",
        DIFERENCIA_PRECIO: "DIFERENCIA DE PRECIO",
        OTRO: "OTRO AJUSTE",
      };
      setDescripcionAjuste(descriptions[motivo] || "DESCUENTO / BONIFICACIÓN");
      return;
    }

    setAjuste("");
  }, [esAjusteSinStock, esAnulacionTotal, motivo]);

  const selected = useMemo(
    () => items
      .filter((item) => num(item.cantidad) > 0)
      .map((item) => {
        const selectedQuantity = num(item.cantidad);
        const baseQuantity = Math.max(0.000001, item.cantidadOriginal);
        return {
          ...item,
          cantidad: selectedQuantity,
          subtotal: Number(((item.subtotalOriginal / baseQuantity) * selectedQuantity).toFixed(2)),
          iva_monto: Number(((item.ivaOriginal / baseQuantity) * selectedQuantity).toFixed(2)),
          total: Number(((item.totalOriginal / baseQuantity) * selectedQuantity).toFixed(2)),
        };
      }),
    [items]
  );

  const ajusteN = esAjusteSinStock ? Math.max(0, num(ajuste)) : 0;
  const disponible = Number(ctx?.total_disponible || 0);
  const totalCalculado = useMemo(
    () => Number((selected.reduce((sum, item) => sum + item.total, 0) + ajusteN).toFixed(2)),
    [selected, ajusteN]
  );
  const total = esAnulacionTotal ? disponible : totalCalculado;
  const totalCompraLuego = Math.max(0, Number((disponible - total).toFixed(2)));
  const excede = !esAnulacionTotal && total - disponible > 0.05;
  const cantidadesValidas = selected.every(
    (item) => item.cantidad <= item.disponible + 0.0001
  );
  const contenidoValido = esAnulacionTotal
    ? disponible > 0
    : (esAjusteSinStock ? ajusteN > 0 : selected.length > 0);
  const valid = Boolean(fecha)
    && total > 0
    && !excede
    && cantidadesValidas
    && contenidoValido;

  const submit = async () => {
    if (isBaltoDemoMode()) {
      toast("advertencia", DEMO_BLOCK_MESSAGE, 5200);
      return;
    }

    if (!valid) {
      setError(
        esAjusteSinStock
          ? "Ingresá un importe válido para la nota de crédito."
          : "Seleccioná las cantidades que devuelve la compra."
      );
      return;
    }

    setLoading(true);
    setError("");
    try {
      const body = {
        id_movimiento_origen: idOrigen,
        modalidad: "PROVEEDOR",
        motivo,
        fecha,
        observaciones,
        id_usuario: auth().idUsuario || null,
        idempotency_key: keyRef.current,
        items: selected.map((item) => ({
          id_item_origen: item.id_item_origen,
          cantidad: item.cantidad,
          // En una devolución de compra, el producto sale del stock siempre.
          afecta_stock: true,
        })),
        importe_ajuste: ajusteN,
        iva_pct_ajuste: Math.max(0, num(ivaAjuste)),
        descripcion_ajuste: descripcionAjuste || "DESCUENTO / BONIFICACIÓN",
      };

      const response = await fetch(`${API}?action=compras_nota_credito_crear`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify(body),
      });
      const data = await parse(response);
      const idNc = Number(
        data.id_movimiento_nota_credito || data.data?.id_movimiento_nota_credito || 0
      );
      let archivoNoAdjuntado = false;

      if (idNc && archivo) {
        try {
          const formData = new FormData();
          formData.append("archivo", archivo);
          formData.append("tipo", "NOTA_CREDITO_PROVEEDOR");
          formData.append("force", "0");
          formData.append("ids_movimiento", JSON.stringify([idNc]));
          const uploadResponse = await fetch(
            `${API}?action=compras_comprobantes_vincular_movimientos_lote_upload`,
            { method: "POST", headers: headers(), body: formData }
          );
          await parse(uploadResponse);
        } catch (uploadError) {
          archivoNoAdjuntado = true;
          toast(
            "advertencia",
            `La nota quedó aplicada, pero no se pudo adjuntar el archivo: ${uploadError.message || "error de carga"}.`,
            6200
          );
        }
      }

      onDone?.({ ...data, archivo_no_adjuntado: archivoNoAdjuntado });
      onClose?.();
    } catch (submitError) {
      const message = submitError.message || "No se pudo aplicar la nota de crédito.";
      setError(message);
      toast("error", message, 4600);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="gm-modal-overlay">
      <div
        className="gm-modal-container gm-modal-v2 modal-nc-container"
        role="dialog"
        aria-modal="true"
      >
        <div className="gm-modal-header">
          <div className="gm-modal-head-left">
            <h2 className="gm-modal-title">Aplicar nota de crédito del proveedor</h2>
            <p className="gm-modal-subtitle">
              Compra #{idOrigen || "—"} · La compra quedará actualizada con el importe y las cantidades netas.
            </p>
          </div>
          <button className="gm-modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="gm-modal-content modal-nc-body">
          {loading && !ctx && <div className="modal-nc-loading">Cargando compra…</div>}
          {error && <div className="modal-nc-error">{error}</div>}

          {ctx && (
            <>
              <div className="modal-nc-grid modal-nc-grid--totals">
                <div className="modal-nc-card">
                  <span>Total original</span>
                  <strong>{money(ctx.total_original)}</strong>
                </div>
                <div className="modal-nc-card">
                  <span>Ya acreditado</span>
                  <strong>{money(ctx.total_acreditado)}</strong>
                </div>
                <div className="modal-nc-card">
                  <span>Esta nota</span>
                  <strong>{money(total)}</strong>
                </div>
                <div className="modal-nc-card modal-nc-card--accent">
                  <span>Compra quedará en</span>
                  <strong>{money(totalCompraLuego)}</strong>
                </div>
              </div>

              <div className="modal-nc-history">
                La nota la emite el proveedor. En Balto sólo la aplicás sobre esta compra y, si la tenés,
                adjuntás su imagen o PDF. No se solicita CAE, punto de venta ni número de comprobante.
              </div>

              <div className="modal-nc-form-grid">
                <label className="modal-nc-field">
                  <span>Fecha de la nota</span>
                  <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
                </label>

                <label className="modal-nc-field">
                  <span>Imagen o PDF de la nota (opcional)</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && !allowedFile(file)) {
                        setError("Solo se permiten imágenes o archivos PDF.");
                        event.target.value = "";
                        setArchivo(null);
                        return;
                      }
                      setError("");
                      setArchivo(file);
                    }}
                  />
                  {archivo && <small>{archivo.name}</small>}
                </label>

                <label className="modal-nc-field">
                  <span>Motivo</span>
                  <select value={motivo} onChange={(event) => setMotivo(event.target.value)}>
                    {MOTIVOS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="modal-nc-field">
                  <span>Observaciones</span>
                  <input
                    value={observaciones}
                    onChange={(event) => setObservaciones(event.target.value.toUpperCase())}
                    placeholder="DETALLE OPCIONAL"
                  />
                </label>
              </div>

              {!esAjusteSinStock && (
                <>
                  <div className="modal-nc-section-title">
                    {esAnulacionTotal
                      ? "Productos que se devuelven por la anulación total"
                      : "Productos devueltos al proveedor"}
                  </div>

                  <div className="modal-nc-table-wrap">
                    <table className="modal-nc-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Comprado</th>
                          <th>Ya devuelto</th>
                          <th>Disponible</th>
                          <th>Devolver ahora</th>
                          <th>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan="6">La compra no tiene productos disponibles para acreditar.</td>
                          </tr>
                        ) : items.map((item, index) => {
                          const selectedItem = selected.find(
                            (current) => current.id_item_origen === item.id_item_origen
                          );
                          const alreadyReturned = Math.max(
                            0,
                            item.cantidadOriginal - item.disponible
                          );
                          return (
                            <tr key={item.id_item_origen}>
                              <td>{item.descripcion}</td>
                              <td>{quantity(item.cantidadOriginal)}</td>
                              <td>{quantity(alreadyReturned)}</td>
                              <td>{quantity(item.disponible)}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.disponible}
                                  step="0.001"
                                  value={item.cantidad}
                                  disabled={esAnulacionTotal || item.disponible <= 0}
                                  onKeyDown={preventInvalidNumberKeys}
                                  onChange={(event) => {
                                    const value = boundedNumberValue(
                                      event.target.value,
                                      item.disponible
                                    );
                                    if (value === null) return;
                                    setItems((previous) => previous.map((current, currentIndex) => (
                                      currentIndex === index ? { ...current, cantidad: value } : current
                                    )));
                                  }}
                                />
                              </td>
                              <td>{money(selectedItem?.total || 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {esAjusteSinStock && (
                <>
                  <div className="modal-nc-section-title">Importe acreditado sin devolución de stock</div>
                  <div className="modal-nc-form-grid modal-nc-form-grid--three">
                    <label className="modal-nc-field">
                      <span>Descripción</span>
                      <input
                        value={descripcionAjuste}
                        onChange={(event) => setDescripcionAjuste(event.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="modal-nc-field">
                      <span>Importe final</span>
                      <input
                        type="number"
                        min="0"
                        max={disponible}
                        step="0.01"
                        value={ajuste}
                        onKeyDown={preventInvalidNumberKeys}
                        onChange={(event) => {
                          const value = boundedNumberValue(event.target.value, disponible);
                          if (value !== null) setAjuste(value);
                        }}
                      />
                    </label>
                    <label className="modal-nc-field">
                      <span>IVA % incluido</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ivaAjuste}
                        onChange={(event) => setIvaAjuste(event.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}

              {excede && (
                <div className="modal-nc-error">
                  La nota supera el importe que todavía queda disponible en la compra.
                </div>
              )}
            </>
          )}
        </div>

        <div className="mit-actions">
          <button className="mit-btn mit-btn--ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="mit-btn mit-btn--solid"
            onClick={submit}
            disabled={loading || !ctx || !valid}
          >
            {loading ? "Aplicando…" : "Aplicar nota de crédito"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
