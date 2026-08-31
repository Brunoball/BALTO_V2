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
  id_categoria: "",
  id_unidad: "",
  descripcion: "",
  stock_actual: "0",
  costo_unitario: "0",
};

export default function ModalStock({
  open,
  item,
  categorias,
  unidades,
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
        id_categoria: item.id_categoria ? String(item.id_categoria) : "",
        id_unidad: item.id_unidad ? String(item.id_unidad) : "",
        descripcion: item.descripcion || "",
        stock_actual: String(Math.max(0, Math.trunc(Number(item.stock_actual || 0)))),
        costo_unitario: String(item.costo_unitario ?? "0"),
      });
      return;
    }

    const defaultUnit = unidades.find((u) => String(u.codigo || "").toUpperCase() === "UN") || unidades[0];
    setForm({ ...initialForm, id_unidad: defaultUnit ? String(defaultUnit.id_unidad) : "" });
  }, [open, item, unidades]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    await onSave({
      ...form,
      id_stock: item?.id_stock,
      id_categoria: form.id_categoria || null,
    });
  };

  const handleCategoria = (event) => {
    const value = event.target.value;
    if (value === "__ADD__") {
      onOpenCategorias?.();
      return;
    }
    set("id_categoria", value);
  };

  return (
    <div className="servicios-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <form className="servicios-modal" onSubmit={submit}>
        <div className="servicios-modal__head">
          <div>
            <span>{item ? "EDITAR" : "AGREGAR"}</span>
            <h2>{item ? "Editar producto" : "Agregar producto"}</h2>
          </div>
          <button type="button" className="servicios-icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="servicios-form-grid">
          <label className="servicios-field">
            Código
            <input
              maxLength={60}
              value={form.codigo}
              onChange={(e) => set("codigo", cleanCode(e.target.value))}
              placeholder="STK-001"
            />
          </label>

          <label className="servicios-field servicios-field--wide">
            Nombre
            <input
              required
              autoFocus
              maxLength={150}
              value={form.nombre}
              onChange={(e) => set("nombre", clampText(e.target.value, 150))}
              placeholder="EJ.: TORNILLO 8 MM"
            />
          </label>

          <label className="servicios-field">
            Categoría
            <select value={form.id_categoria} onChange={handleCategoria}>
              <option value="__ADD__">+ AGREGAR CATEGORÍA</option>
              <option value="">SIN CATEGORÍA</option>
              {categorias.filter((c) => Number(c.activo) === 1).map((c) => (
                <option key={c.id_stock_categoria} value={c.id_stock_categoria}>{c.nombre}</option>
              ))}
            </select>
          </label>

          <label className="servicios-field">
            Unidad
            <select required value={form.id_unidad} onChange={(e) => set("id_unidad", e.target.value)}>
              <option value="">SELECCIONAR</option>
              {unidades
                .filter((u) => Number(u.activo) === 1 && String(u.codigo || "").toUpperCase() !== "SERVICIO")
                .map((u) => (
                  <option key={u.id_unidad} value={u.id_unidad}>
                    {String(u.nombre || "").toUpperCase()} ({u.simbolo})
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
              placeholder="DETALLE DEL REGISTRO DE STOCK"
            />
            <small>{form.descripcion.length}/1000</small>
          </label>

          <label className="servicios-field">
            Stock actual
            <input
              required
              inputMode="numeric"
              maxLength={10}
              value={form.stock_actual}
              onChange={(e) => set("stock_actual", integerText(e.target.value, 10))}
              placeholder="0"
            />
            <small>SE GUARDA COMO NÚMERO ENTERO.</small>
          </label>

          <label className="servicios-field">
            Costo unitario
            <input
              inputMode="decimal"
              value={form.costo_unitario}
              onChange={(e) => set("costo_unitario", decimalText(e.target.value, 2))}
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="servicios-modal__note">
          Este registro pertenece únicamente a Stock. No se crea, modifica ni elimina ningún insumo al guardar cambios acá.
        </div>

        <div className="servicios-modal__actions">
          <button type="button" className="servicios-btn servicios-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="servicios-btn" disabled={saving || form.stock_actual === ""}>
            {saving ? "Guardando..." : item ? "Guardar cambios" : "Agregar producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
