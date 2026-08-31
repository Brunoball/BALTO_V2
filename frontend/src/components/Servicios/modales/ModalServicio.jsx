import React, { useEffect, useMemo, useState } from "react";
import BuscadorSelector from "../components/BuscadorSelector";
import {
  cleanCode,
  clampText,
  decimalText,
  integerText,
  money,
} from "../utils/serviciosFormUtils";

const initialForm = {
  codigo: "",
  nombre: "",
  id_servicio_categoria: "",
  descripcion: "",
  costo_base: "0",
  precio_venta: "0",
  iva_pct: "0",
  duracion_estimada_minutos: "",
};

const idInsumo = (row) => Number(row?.id_insumo ?? row?.id_articulo ?? row?.id ?? 0);
const idStock = (row) => Number(row?.id_stock ?? row?.id ?? 0);

const IVA_OPTIONS = [
  { value: "0", label: "0 %" },
  { value: "10.5", label: "10,5 %" },
  { value: "21", label: "21 %" },
  { value: "27", label: "27 %" },
];

const isStandardIva = (value) => IVA_OPTIONS.some((option) => Number(option.value) === Number(value));

export default function ModalServicio({
  open,
  item,
  categorias = [],
  insumos = [],
  stock = [],
  saving,
  onClose,
  onSave,
  onOpenCategorias,
}) {
  const [form, setForm] = useState(initialForm);
  const [insumoRows, setInsumoRows] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [insumoToAdd, setInsumoToAdd] = useState("");
  const [stockToAdd, setStockToAdd] = useState("");
  const [stockValidationError, setStockValidationError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (item) {
      setForm({
        codigo: item.codigo || "",
        nombre: item.nombre || "",
        id_servicio_categoria: item.id_servicio_categoria ? String(item.id_servicio_categoria) : "",
        descripcion: item.descripcion || "",
        costo_base: String(item.costo_base ?? "0"),
        precio_venta: String(item.precio_venta ?? "0"),
        iva_pct: String(item.iva_pct ?? "0"),
        duracion_estimada_minutos: item.duracion_estimada_minutos
          ? String(item.duracion_estimada_minutos)
          : "",
      });

      const rawInsumos = item.insumos || item.receta || item.composicion?.insumos || [];
      setInsumoRows(
        rawInsumos.map((row) => ({
          id_insumo: idInsumo(row),
          cantidad_requerida: String(row.cantidad_requerida ?? row.cantidad ?? "1"),
          merma_pct: String(row.merma_pct ?? "0"),
          observaciones: row.observaciones || "",
          nombre: row.insumo_nombre || row.nombre || "",
          unidad_simbolo: row.unidad_simbolo || "",
          costo_unitario: Number(row.costo_unitario || 0),
        }))
      );

      const rawStock = item.productos_stock || item.composicion?.stock || [];
      setStockRows(
        rawStock.map((row) => ({
          id_stock: idStock(row),
          cantidad_requerida: String(row.cantidad_requerida ?? row.cantidad ?? "1"),
          observaciones: row.observaciones || "",
          nombre: row.stock_nombre || row.nombre || "",
          unidad_simbolo: row.unidad_simbolo || "",
          stock_actual: Number(row.stock_actual || 0),
          costo_unitario: Number(row.costo_unitario || 0),
        }))
      );
    } else {
      setForm(initialForm);
      setInsumoRows([]);
      setStockRows([]);
    }

    setInsumoToAdd("");
    setStockToAdd("");
    setStockValidationError("");
  }, [open, item]);

  const activeInsumos = useMemo(
    () => insumos.filter((row) => Number(row.activo) === 1),
    [insumos]
  );

  const activeStock = useMemo(
    () => stock.filter((row) => Number(row.activo) === 1),
    [stock]
  );

  const usedInsumos = useMemo(
    () => new Set(insumoRows.map((row) => Number(row.id_insumo))),
    [insumoRows]
  );

  const usedStock = useMemo(
    () => new Set(stockRows.map((row) => Number(row.id_stock))),
    [stockRows]
  );

  const costoInsumos = useMemo(
    () =>
      insumoRows.reduce((total, row) => {
        const catalog = insumos.find((i) => Number(i.id_insumo) === Number(row.id_insumo));
        const costo = Number(catalog?.costo_unitario ?? row.costo_unitario ?? 0);
        const cantidad = Number(row.cantidad_requerida || 0);
        const merma = Number(row.merma_pct || 0);
        return total + costo * cantidad * (1 + merma / 100);
      }, 0),
    [insumoRows, insumos]
  );

  const costoStock = useMemo(
    () =>
      stockRows.reduce((total, row) => {
        const catalog = stock.find((s) => Number(s.id_stock) === Number(row.id_stock));
        return total + Number(catalog?.costo_unitario ?? row.costo_unitario ?? 0) * Number(row.cantidad_requerida || 0);
      }, 0),
    [stockRows, stock]
  );

  const costoEstimado = Number(form.costo_base || 0) + costoInsumos + costoStock;

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const addInsumo = () => {
    const id = Number(insumoToAdd || 0);
    if (!id || usedInsumos.has(id)) return;
    const selected = insumos.find((row) => Number(row.id_insumo) === id);
    if (!selected) return;

    setInsumoRows((prev) => [
      ...prev,
      {
        id_insumo: id,
        cantidad_requerida: "1",
        merma_pct: "0",
        observaciones: "",
        nombre: selected.nombre || "",
        unidad_simbolo: selected.unidad_simbolo || selected.unidad_nombre || "",
        costo_unitario: Number(selected.costo_unitario || 0),
      },
    ]);
    setInsumoToAdd("");
  };

  const addStock = () => {
    const id = Number(stockToAdd || 0);
    if (!id || usedStock.has(id)) return;
    const selected = stock.find((row) => Number(row.id_stock) === id);
    if (!selected) return;

    const disponible = Math.max(0, Number(selected.stock_actual || 0));
    if (disponible < 1) {
      setStockValidationError(`${selected.nombre || "ESTE PRODUCTO"} NO TIENE STOCK DISPONIBLE.`);
      return;
    }

    setStockRows((prev) => [
      ...prev,
      {
        id_stock: id,
        cantidad_requerida: "1",
        observaciones: "",
        nombre: selected.nombre || "",
        unidad_simbolo: selected.unidad_simbolo || selected.unidad_nombre || "",
        stock_actual: disponible,
        costo_unitario: Number(selected.costo_unitario || 0),
      },
    ]);
    setStockValidationError("");
    setStockToAdd("");
  };

  const updateInsumo = (id, key, value) => {
    setInsumoRows((prev) =>
      prev.map((row) => (Number(row.id_insumo) === Number(id) ? { ...row, [key]: value } : row))
    );
  };

  const updateStock = (id, key, value) => {
    setStockRows((prev) =>
      prev.map((row) => (Number(row.id_stock) === Number(id) ? { ...row, [key]: value } : row))
    );
  };

  const updateStockCantidad = (row, rawValue) => {
    const limpio = integerText(rawValue, 10);
    if (limpio === "") {
      updateStock(row.id_stock, "cantidad_requerida", "");
      setStockValidationError("");
      return;
    }

    const catalog = stock.find((s) => Number(s.id_stock) === Number(row.id_stock));
    const disponible = Math.max(0, Number(catalog?.stock_actual ?? row.stock_actual ?? 0));
    const solicitado = Number(limpio);

    if (solicitado > disponible) {
      updateStock(row.id_stock, "cantidad_requerida", String(disponible));
      setStockValidationError(
        `${catalog?.nombre || row.nombre || "EL PRODUCTO"} TIENE ${disponible} ${catalog?.unidad_simbolo || catalog?.unidad_nombre || row.unidad_simbolo || "UNIDADES"} DISPONIBLES. NO PODÉS USAR MÁS DE ESA CANTIDAD.`
      );
      return;
    }

    updateStock(row.id_stock, "cantidad_requerida", limpio);
    setStockValidationError("");
  };

  const submit = async (event) => {
    event.preventDefault();

    const normalizedInsumos = insumoRows.map((row) => ({
      id_insumo: Number(row.id_insumo),
      cantidad_requerida: row.cantidad_requerida,
      merma_pct: row.merma_pct || "0",
      obligatorio: 1,
      observaciones: row.observaciones || null,
    }));

    for (const row of stockRows) {
      const catalog = stock.find((s) => Number(s.id_stock) === Number(row.id_stock));
      const disponible = Math.max(0, Number(catalog?.stock_actual ?? row.stock_actual ?? 0));
      const solicitado = Number(row.cantidad_requerida || 0);
      if (solicitado < 1) {
        setStockValidationError(`INDICÁ UNA CANTIDAD VÁLIDA PARA ${catalog?.nombre || row.nombre || "EL PRODUCTO"}.`);
        return;
      }
      if (solicitado > disponible) {
        setStockValidationError(
          `${catalog?.nombre || row.nombre || "EL PRODUCTO"} TIENE ${disponible} ${catalog?.unidad_simbolo || catalog?.unidad_nombre || row.unidad_simbolo || "UNIDADES"} DISPONIBLES. NO PODÉS USAR ${solicitado}.`
        );
        return;
      }
    }

    const normalizedStock = stockRows.map((row) => ({
      id_stock: Number(row.id_stock),
      cantidad_requerida: row.cantidad_requerida,
      observaciones: row.observaciones || null,
    }));

    setStockValidationError("");
    await onSave({
      ...form,
      id_servicio: item?.id_servicio,
      id_servicio_categoria: form.id_servicio_categoria || null,
      duracion_estimada_minutos: form.duracion_estimada_minutos || null,
      composicion: {
        insumos: normalizedInsumos,
        stock: normalizedStock,
      },
    });
  };

  const handleCategoria = (event) => {
    const value = event.target.value;
    if (value === "__ADD__") {
      onOpenCategorias?.();
      return;
    }
    set("id_servicio_categoria", value);
  };

  return (
    <div className="gm-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <form className="gm-modal-container gm-modal-v2 servicios-modal servicios-modal--service" onSubmit={submit}>
        <div className="gm-modal-header servicios-modal__head">
          <div>
            <span>{item ? "EDITAR" : "AGREGAR"}</span>
            <h2>{item ? "Editar servicio" : "Agregar servicio"}</h2>
          </div>
          <button type="button" className="gm-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="servicios-form-grid">
          <label className="servicios-field servicios-field--wide">
            Nombre
            <input
              className="gm-input"
              required
              autoFocus
              maxLength={150}
              value={form.nombre}
              onChange={(e) => set("nombre", clampText(e.target.value, 150))}
              placeholder="EJ.: INSTALACIÓN DE AIRE ACONDICIONADO"
            />
          </label>

          <label className="servicios-field">
            Código
            <input
              className="gm-input"
              maxLength={60}
              value={form.codigo}
              onChange={(e) => set("codigo", cleanCode(e.target.value))}
              placeholder="SERV-001"
            />
          </label>

          <label className="servicios-field">
            Categoría
            <select className="gm-input gm-select" value={form.id_servicio_categoria} onChange={handleCategoria}>
              <option value="__ADD__">+ AGREGAR CATEGORÍA</option>
              <option value="">SIN CATEGORÍA</option>
              {categorias
                .filter((c) => Number(c.activo) === 1)
                .map((c) => (
                  <option key={c.id_servicio_categoria} value={c.id_servicio_categoria}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          </label>

          <label className="servicios-field servicios-field--wide">
            Descripción
            <textarea
              className="gm-input servicios-textarea"
              rows={3}
              maxLength={1000}
              value={form.descripcion}
              onChange={(e) => set("descripcion", clampText(e.target.value, 1000))}
              placeholder="DETALLE DEL SERVICIO"
            />
            <small>{form.descripcion.length}/1000</small>
          </label>

          <label className="servicios-field">
            Costo base
            <input
              className="gm-input"
              inputMode="decimal"
              value={form.costo_base}
              onChange={(e) => set("costo_base", decimalText(e.target.value, 2))}
              placeholder="0.00"
            />
          </label>

          <label className="servicios-field">
            Precio de venta
            <input
              className="gm-input"
              required
              inputMode="decimal"
              value={form.precio_venta}
              onChange={(e) => set("precio_venta", decimalText(e.target.value, 2))}
              placeholder="0.00"
            />
          </label>

          <label className="servicios-field">
            IVA %
            <select className="gm-input gm-select" value={form.iva_pct} onChange={(e) => set("iva_pct", e.target.value)}>
              {!isStandardIva(form.iva_pct) && form.iva_pct !== "" && (
                <option value={form.iva_pct}>{String(form.iva_pct).replace(".", ",")} % (ACTUAL)</option>
              )}
              {IVA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="servicios-field">
            Duración estimada (min)
            <input
              className="gm-input"
              inputMode="numeric"
              maxLength={6}
              value={form.duracion_estimada_minutos}
              onChange={(e) => set("duracion_estimada_minutos", integerText(e.target.value, 6))}
              placeholder="OPCIONAL"
            />
          </label>
        </div>

        <section className="servicios-composition">
          <div className="servicios-composition__head">
            <div>
              <span>COMPOSICIÓN DEL SERVICIO</span>
              <h3>Qué necesita este servicio</h3>
            </div>
            <div className="servicios-composition__cost">
              <span>Costo estimado</span>
              <strong>{money(costoEstimado)}</strong>
            </div>
          </div>

          <div className="servicios-composition-grid">
            <article className="servicios-component-card">
              <div className="servicios-component-card__title">
                <div>
                  <h4>Insumos</h4>
                  <p>Materiales o costos necesarios para realizar el servicio.</p>
                </div>
                <strong>{insumoRows.length}</strong>
              </div>

              <div className="servicios-component-add">
                <BuscadorSelector
                  options={activeInsumos.filter((row) => !usedInsumos.has(Number(row.id_insumo)))}
                  value={insumoToAdd}
                  onChange={setInsumoToAdd}
                  getValue={(row) => row.id_insumo}
                  getLabel={(row) => `${row.nombre} · ${row.unidad_simbolo || row.unidad_nombre || "UNIDAD"}`}
                  placeholder="SELECCIONAR INSUMO"
                  searchPlaceholder="BUSCAR INSUMO..."
                  emptyText="NO HAY INSUMOS DISPONIBLES"
                />
                <button type="button" className="gm-action-btn gm-action-btn--cancel" onClick={addInsumo} disabled={!insumoToAdd}>
                  Agregar
                </button>
              </div>

              <div className="servicios-component-list">
                {insumoRows.length === 0 ? (
                  <p className="servicios-component-empty">ESTE SERVICIO NO TIENE INSUMOS ASIGNADOS.</p>
                ) : (
                  insumoRows.map((row) => {
                    const catalog = insumos.find((i) => Number(i.id_insumo) === Number(row.id_insumo));
                    const nombre = catalog?.nombre || row.nombre || "INSUMO";
                    const unidad = catalog?.unidad_simbolo || catalog?.unidad_nombre || row.unidad_simbolo || "";
                    return (
                      <div className="servicios-component-row" key={row.id_insumo}>
                        <div className="servicios-component-row__name">
                          <strong>{nombre}</strong>
                          <small>{money(catalog?.costo_unitario ?? row.costo_unitario ?? 0)} por {unidad || "unidad"}</small>
                        </div>
                        <label>
                          Cantidad
                          <input
                            className="gm-cell-input gm-cell-input--right"
                            required
                            inputMode="decimal"
                            value={row.cantidad_requerida}
                            onChange={(e) => updateInsumo(row.id_insumo, "cantidad_requerida", decimalText(e.target.value, 6))}
                            placeholder="1"
                          />
                        </label>
                        <span className="servicios-component-unit">{unidad}</span>
                        <button
                          type="button"
                          className="servicios-component-remove"
                          onClick={() => setInsumoRows((prev) => prev.filter((r) => Number(r.id_insumo) !== Number(row.id_insumo)))}
                          aria-label={`Quitar ${nombre}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <article className="servicios-component-card servicios-component-card--stock">
              <div className="servicios-component-card__title">
                <div>
                  <h4>Productos de Stock</h4>
                  <p>La cantidad indicada se descuenta al registrar una venta del servicio.</p>
                </div>
                <strong>{stockRows.length}</strong>
              </div>

              <div className="servicios-component-add">
                <BuscadorSelector
                  options={activeStock.filter((row) => Number(row.stock_actual || 0) > 0 && !usedStock.has(Number(row.id_stock)))}
                  value={stockToAdd}
                  onChange={setStockToAdd}
                  getValue={(row) => row.id_stock}
                  getLabel={(row) => `${row.nombre} · DISPONIBLE ${Number(row.stock_actual || 0)}`}
                  placeholder="SELECCIONAR PRODUCTO DE STOCK"
                  searchPlaceholder="BUSCAR PRODUCTO DE STOCK..."
                  emptyText="NO HAY PRODUCTOS DE STOCK DISPONIBLES"
                />
                <button type="button" className="gm-action-btn gm-action-btn--cancel" onClick={addStock} disabled={!stockToAdd}>
                  Agregar
                </button>
              </div>

              <div className="servicios-component-list">
                {stockRows.length === 0 ? (
                  <p className="servicios-component-empty">ESTE SERVICIO NO DESCUENTA PRODUCTOS DE STOCK.</p>
                ) : (
                  stockRows.map((row) => {
                    const catalog = stock.find((s) => Number(s.id_stock) === Number(row.id_stock));
                    const nombre = catalog?.nombre || row.nombre || "PRODUCTO";
                    const unidad = catalog?.unidad_simbolo || catalog?.unidad_nombre || row.unidad_simbolo || "";
                    const disponible = Number(catalog?.stock_actual ?? row.stock_actual ?? 0);
                    return (
                      <div className="servicios-component-row" key={row.id_stock}>
                        <div className="servicios-component-row__name">
                          <strong>{nombre}</strong>
                          <small>DISPONIBLE: {disponible} {unidad}</small>
                        </div>
                        <label>
                          Usa por servicio
                          <input
                            className="gm-cell-input gm-cell-input--right"
                            required
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={Math.max(0, disponible)}
                            step="1"
                            value={row.cantidad_requerida}
                            onChange={(e) => updateStockCantidad(row, e.target.value)}
                            placeholder="1"
                          />
                        </label>
                        <span className="servicios-component-unit">{unidad}</span>
                        <button
                          type="button"
                          className="servicios-component-remove"
                          onClick={() => setStockRows((prev) => prev.filter((r) => Number(r.id_stock) !== Number(row.id_stock)))}
                          aria-label={`Quitar ${nombre}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {stockValidationError && (
                <div className="servicios-alert servicios-alert--error" role="alert">
                  {stockValidationError}
                </div>
              )}
            </article>
          </div>

          <div className="servicios-composition__totals">
            <span>Costo base: <strong>{money(form.costo_base || 0)}</strong></span>
            <span>Insumos: <strong>{money(costoInsumos)}</strong></span>
            <span>Stock: <strong>{money(costoStock)}</strong></span>
            <span>Total estimado: <strong>{money(costoEstimado)}</strong></span>
          </div>
        </section>

        <div className="servicios-modal__note">
          Los Insumos y Stock siguen siendo independientes. Agregarlos acá sólo indica qué necesita este servicio. Los productos de Stock se descuentan cuando el servicio se registra en una venta.
        </div>

        <div className="servicios-modal__actions">
          <button type="button" className="gm-action-btn gm-action-btn--cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="gm-action-btn gm-action-btn--save" disabled={saving}>
            {saving ? "Guardando..." : item ? "Guardar cambios" : "Agregar servicio"}
          </button>
        </div>
      </form>
    </div>
  );
}
