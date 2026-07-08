import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faXmark } from "@fortawesome/free-solid-svg-icons";
import "../../Global/Global_css/Global_Modals.css";
import "./ModalDarBajaStock.css";
import { isTopStockModal } from "./modalStackUtils";

export default function ModalDarBajaStock({
  open,
  title = "Dar de baja",
  message = "El registro se ocultará de la lista principal.",
  details = [],
  loading = false,
  confirmLabel = "Dar de baja",
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

  return createPortal(
    <div
      ref={overlayRef}
      data-stock-modal-overlay="true"
      className="mi-modal__overlay"
      role="presentation"
      onMouseDown={loading ? undefined : onClose}
    >
      <div
        className="mi-modal__container stock-bajaModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-baja-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mi-modal__header">
          <div className="mi-modal__head-icon stock-bajaModal__icon" aria-hidden="true">
            <FontAwesomeIcon icon={faBoxOpen} />
          </div>
          <div className="mi-modal__head-left">
            <h2 className="mi-modal__title" id="stock-baja-title">{title}</h2>
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

        <div className="mi-modal__content stock-bajaModal__content">
          {details.length > 0 ? (
            <div className="stock-bajaModal__details">
              {details.map((item, idx) => (
                <div className="stock-bajaModal__detail" key={`${item.label || "detalle"}-${idx}`}>
                  <span>{item.label || "Dato"}</span>
                  <b>{item.value || "—"}</b>
                </div>
              ))}
            </div>
          ) : null}

          <div className="stock-bajaModal__notice">
            Esta acción no elimina información: solo oculta el {entidadLabel} y permite volver a activarlo más adelante.
          </div>

        </div>

        <div className="mit-actions">
          <button type="button" className="mit-btn mit-btn--ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className="mit-btn mit-btn--solid" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
