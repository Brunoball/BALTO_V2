import React, { useEffect, useState } from "react";
import { clampText } from "../utils/serviciosFormUtils";

const emptyForm = { nombre: "", descripcion: "" };

export default function ModalCategorias({
  open,
  titulo,
  categorias,
  getId,
  getCount,
  saving,
  onClose,
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
  nota,
}) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setForm(emptyForm);
  }, [open]);

  if (!open) return null;

  const edit = (categoria) => {
    setEditingId(getId(categoria));
    setForm({
      nombre: categoria.nombre || "",
      descripcion: categoria.descripcion || "",
    });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    reset();
  };

  return (
    <div className="servicios-modal-backdrop servicios-modal-backdrop--above" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="servicios-modal servicios-modal--categories">
        <div className="servicios-modal__head">
          <div>
            <span>CATEGORÍAS</span>
            <h2>{titulo}</h2>
          </div>
          <button type="button" className="servicios-icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <form className="servicios-category-form" onSubmit={submit}>
          <label className="servicios-field">
            Nombre
            <input
              required
              autoFocus
              maxLength={100}
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: clampText(e.target.value, 100) }))}
              placeholder="NOMBRE DE LA CATEGORÍA"
            />
          </label>
          <label className="servicios-field">
            Descripción
            <input
              maxLength={255}
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: clampText(e.target.value, 255) }))}
              placeholder="OPCIONAL"
            />
          </label>
          <div className="servicios-category-form__actions">
            {editingId && (
              <button type="button" className="servicios-btn servicios-btn--ghost" onClick={reset} disabled={saving}>
                Cancelar edición
              </button>
            )}
            <button type="submit" className="servicios-btn" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar categoría" : "Agregar categoría"}
            </button>
          </div>
        </form>

        <div className="servicios-table-wrap servicios-category-table">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Registros</th>
                <th>Estado</th>
                <th className="servicios-actions-col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.length === 0 ? (
                <tr>
                  <td colSpan="4" className="servicios-empty">NO HAY CATEGORÍAS.</td>
                </tr>
              ) : (
                categorias.map((categoria) => {
                  const id = getId(categoria);
                  const activo = Number(categoria.activo) === 1;
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{categoria.nombre}</strong>
                        <small>{categoria.descripcion || "SIN DESCRIPCIÓN"}</small>
                      </td>
                      <td>{getCount(categoria)}</td>
                      <td>
                        <span className={`servicios-status ${activo ? "is-active" : "is-inactive"}`}>
                          {activo ? "ACTIVA" : "BAJA"}
                        </span>
                      </td>
                      <td>
                        <div className="servicios-row-actions">
                          <button type="button" onClick={() => edit(categoria)}>Editar</button>
                          <button type="button" onClick={() => onToggle(categoria)}>
                            {activo ? "Dar de baja" : "Reactivar"}
                          </button>
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => onDelete(categoria)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="servicios-modal__note">
          {nota || "Al eliminar una categoría, los registros asociados quedan sin categoría. Antes de borrar se mostrará una advertencia con el impacto de la acción."}
        </div>
      </div>
    </div>
  );
}
