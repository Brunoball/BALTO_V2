import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import "../../Global/Global_css/Global_Modals.css";
import "./ModalEliminarStock.css";
import { isTopStockModal } from "./modalStackUtils";

export default function ModalEliminarStock({
  open,
  title = "Eliminar definitivamente",
  message = "Esta acción no se puede deshacer.",
  warning = "Esta acción borra el registro para siempre.",
  details = [],
  extraContent = null,
  loading = false,
  confirmDisabled = false,
  confirmLabel = "Eliminar definitivamente",
  cancelLabel = "Cancelar",
  entidadLabel = "registro",
  onClose,
  onConfirm,
}) {
  const closeBtnRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      if (!isTopStockModal(overlayRef.current)) return;

      e.preventDefault();
      e.stopPropagation();
      if (!loading) onClose?.();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [open, loading, onClose]);

  if (!open) return null;

  const loadingText = `Eliminando ${entidadLabel}...`;

  return createPortal(
    <div
      ref={overlayRef}
      data-stock-modal-overlay="true"
      className="mi-modal__overlay"
      role="presentation"
      onMouseDown={loading ? undefined : onClose}
    >
      <div
        className="mi-modal__container stock-eliminarModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-eliminar-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mi-modal__header">
          <div className="mi-modal__head-icon stock-eliminarModal__icon" aria-hidden="true">
            <FontAwesomeIcon icon={faTrashCan} />
          </div>
          <div className="mi-modal__head-left">
            <h2 className="mi-modal__title" id="stock-eliminar-title">{title}</h2>
            <p className="mi-modal__subtitle">{message}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="mi-modal__close"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="mi-modal__content stock-eliminarModal__content">
          {details.length > 0 ? (
            <div className="stock-eliminarModal__details">
              {details.map((item, idx) => (
                <div className="stock-eliminarModal__detail" key={`${item.label || "detalle"}-${idx}`}>
                  <span>{item.label || "Dato"}</span>
                  <b>{item.value || "—"}</b>
                </div>
              ))}
            </div>
          ) : null}

          {warning ? (
            <div className="stock-eliminarModal__warning">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <span>{warning}</span>
            </div>
          ) : null}

          {extraContent}

          {loading ? <div className="stock-eliminarModal__loading">{loadingText}</div> : null}
        </div>

        <div className="mit-actions">
          <button type="button" className="mit-btn mit-btn--ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="mit-btn stock-eliminarModal__confirm"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
          >
            {loading ? loadingText : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
