import React, { useEffect, useState } from "react";
import {
  cleanCode,
  clampText,
  decimalText,
  integerText,
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

export default function ModalServicio({
  open,
  item,
  categorias,
  saving,
  onClose,
  onSave,
  onOpenCategorias,
}) {
  const [form, setForm] = useState(initialForm);

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
    } else {
      setForm(initialForm);
    }
  }, [open, item]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    await onSave({
      ...form,
      id_servicio: item?.id_servicio,
      id_servicio_categoria: form.id_servicio_categoria || null,
      duracion_estimada_minutos: form.duracion_estimada_minutos || null,
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
    <div className="servicios-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <form className="servicios-modal" onSubmit={submit}>
        <div className="servicios-modal__head">
          <div>
            <span>{item ? "EDITAR" : "NUEVO"}</span>
            <h2>{item ? "Editar servicio" : "Nuevo servicio"}</h2>
          </div>
          <button type="button" className="servicios-icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="servicios-form-grid">
          <label className="servicios-field servicios-field--wide">
            Nombre
            <input
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
              maxLength={60}
              value={form.codigo}
              onChange={(e) => set("codigo", cleanCode(e.target.value))}
              placeholder="SERV-001"
            />
          </label>

          <label className="servicios-field">
            Categoría
            <select value={form.id_servicio_categoria} onChange={handleCategoria}>
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
              inputMode="decimal"
              value={form.costo_base}
              onChange={(e) => set("costo_base", decimalText(e.target.value, 2))}
              placeholder="0.00"
            />
          </label>

          <label className="servicios-field">
            Precio de venta
            <input
              required
              inputMode="decimal"
              value={form.precio_venta}
              onChange={(e) => set("precio_venta", decimalText(e.target.value, 2))}
              placeholder="0.00"
            />
          </label>

          <label className="servicios-field">
            IVA %
            <input
              inputMode="decimal"
              value={form.iva_pct}
              onChange={(e) => {
                const next = decimalText(e.target.value, 2, 3);
                if (next === "" || Number(next) <= 100) set("iva_pct", next);
              }}
              placeholder="0"
            />
          </label>

          <label className="servicios-field">
            Duración estimada (min)
            <input
              inputMode="numeric"
              maxLength={6}
              value={form.duracion_estimada_minutos}
              onChange={(e) => set("duracion_estimada_minutos", integerText(e.target.value, 6))}
              placeholder="OPCIONAL"
            />
          </label>
        </div>

        <div className="servicios-modal__note">
          Un servicio se guarda como una unidad de servicio. No se configura por litros, kilos ni otras unidades.
        </div>

        <div className="servicios-modal__actions">
          <button type="button" className="servicios-btn servicios-btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="servicios-btn" disabled={saving}>
            {saving ? "Guardando..." : item ? "Guardar cambios" : "Crear servicio"}
          </button>
        </div>
      </form>
    </div>
  );
}
