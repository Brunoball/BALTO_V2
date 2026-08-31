import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faPenToSquare, faRotateLeft, faTrashCan } from "@fortawesome/free-solid-svg-icons";
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
    <div className="gm-modal-overlay servicios-modal-backdrop--above" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="gm-modal-container gm-modal-v2 servicios-modal servicios-modal--categories">
        <div className="gm-modal-header servicios-modal__head">
          <div>
            <span>CATEGORÍAS</span>
            <h2>{titulo}</h2>
          </div>
          <button type="button" className="gm-modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <form className="servicios-category-form" onSubmit={submit}>
          <label className="servicios-field">
            Nombre
            <input
              className="gm-input"
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
              className="gm-input"
              maxLength={255}
              value={form.descripcion}
              onChange={(e) => setForm((prev) => ({ ...prev, descripcion: clampText(e.target.value, 255) }))}
              placeholder="OPCIONAL"
            />
          </label>
          <div className="servicios-category-form__actions">
            {editingId && (
              <button type="button" className="gm-action-btn gm-action-btn--cancel" onClick={reset} disabled={saving}>
                Cancelar edición
              </button>
            )}
            <button type="submit" className="gm-action-btn gm-action-btn--save" disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Guardar categoría" : "Agregar categoría"}
            </button>
          </div>
        </form>

        <div className="gm-table servicios-category-table">
          <div className="gm-table-head" style={{ gridTemplateColumns: "minmax(0,1.8fr) 90px 90px 112px" }}>
            <div className="gm-table-th">Categoría</div>
            <div className="gm-table-th">Registros</div>
            <div className="gm-table-th">Estado</div>
            <div className="gm-table-th">Acciones</div>
          </div>
          <div className="gm-table-body">
            {categorias.length === 0 ? (
              <div className="gm-table-empty">NO HAY CATEGORÍAS.</div>
            ) : (
              categorias.map((categoria) => {
                const id = getId(categoria);
                const activo = Number(categoria.activo) === 1;
                return (
                  <div className="gm-table-row" style={{ gridTemplateColumns: "minmax(0,1.8fr) 90px 90px 112px" }} key={id}>
                    <div className="gm-table-cell gm-table-cell--detail">
                      <strong>{categoria.nombre}</strong>
                      <small>{categoria.descripcion || "SIN DESCRIPCIÓN"}</small>
                    </div>
                    <div className="gm-table-cell gm-table-cell--center">{getCount(categoria)}</div>
                    <div className="gm-table-cell gm-table-cell--center">
                      <span className={`mov-chip ${activo ? "mov-chip--ok" : "mov-chip--neutral"}`}>
                        {activo ? "ACTIVA" : "BAJA"}
                      </span>
                    </div>
                    <div className="gm-table-cell gm-table-cell--center">
                      <div className="mov-actionsInline">
                        <button type="button" className="mov-iconBtn" title="Editar" aria-label="Editar" onClick={() => edit(categoria)}>
                          <FontAwesomeIcon icon={faPenToSquare} />
                        </button>
                        <button type="button" className="mov-iconBtn" title={activo ? "Dar de baja" : "Reactivar"} aria-label={activo ? "Dar de baja" : "Reactivar"} onClick={() => onToggle(categoria)}>
                          <FontAwesomeIcon icon={activo ? faBan : faRotateLeft} />
                        </button>
                        <button type="button" className="mov-iconBtn mov-iconBtn--danger" title="Eliminar" aria-label="Eliminar" onClick={() => onDelete(categoria)}>
                          <FontAwesomeIcon icon={faTrashCan} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="servicios-modal__note">
          {nota || "Al eliminar una categoría, los registros asociados quedan sin categoría. Antes de borrar se mostrará una advertencia con el impacto de la acción."}
        </div>
      </div>
    </div>
  );
}
