import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import "../../Global/Global_css/Global_Modals.css";
import "./ModalBajaEliminarStock.css";
import { isTopStockModal } from "./modalStackUtils";

function isTemaOscuro() {
  return (
    document.documentElement.getAttribute("data-theme") === "oscuro" ||
    document.body?.classList?.contains("dark")
  );
}

export default function ModalBajaEliminarStock({
  open,
  title,
  message,
  warning,
  details = [],
  extraContent = null,
  loading = false,
  processingAction = "",
  onClose,
  onDarBaja,
  onEliminar,
  darBajaDisabled = false,
  eliminarDisabled = false,
  entidadLabel = "registro",
}) {
  const overlayRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [dark, setDark] = useState(isTemaOscuro);

  useEffect(() => {
    const update = () => setDark(isTemaOscuro());

    const htmlObserver = new MutationObserver(update);
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const bodyObserver = new MutationObserver(update);
    if (document.body) {
      bodyObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => {
      htmlObserver.disconnect();
      bodyObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (!isTopStockModal(overlayRef.current)) return;

      event.preventDefault();
      event.stopPropagation();

      if (!loading) onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, loading, onClose]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => closeBtnRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  const labelProcesando =
    processingAction === "eliminar"
      ? `Eliminando ${entidadLabel}...`
      : `Dando de baja ${entidadLabel}...`;

  return createPortal(
    <div
      ref={overlayRef}
      data-stock-modal-overlay="true"
      className={["mi-modal__overlay", dark ? "mi-modal__overlay--dark" : ""]
        .filter(Boolean)
        .join(" ")}
      role="presentation"
      onMouseDown={loading ? undefined : onClose}
    >
      <div
        className={["mi-modal__container", "mi-modal__container--stock-action", dark ? "mi-modal--dark" : ""]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-baja-eliminar-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mi-modal__header">
          <div className="mi-modal__head-icon mi-modal__head-icon--danger" aria-hidden="true">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>

          <div className="mi-modal__head-left">
            <h2 className="mi-modal__title" id="stock-baja-eliminar-title">
              {title}
            </h2>
            <p className="mi-modal__subtitle">{message}</p>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="mi-modal__close"
            onClick={() => onClose?.()}
            disabled={loading}
            aria-label="Cerrar"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="mi-modal__content stock-bajaEliminarModal__content">
          {details.length > 0 ? (
            <div className="stock-bajaEliminarModal__details">
              {details.map((item, idx) => (
                <div className="stock-bajaEliminarModal__detail" key={`${item.label}-${idx}`}>
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          ) : null}

          {warning ? <div className="stock-bajaEliminarModal__warning">{warning}</div> : null}
          {extraContent ? <div className="stock-bajaEliminarModal__extra">{extraContent}</div> : null}
          {loading ? <div className="stock-bajaEliminarModal__loading">{labelProcesando}</div> : null}
        </div>

        <div className="mit-actions stock-bajaEliminarModal__actions">
          <button
            type="button"
            className="mit-btn mit-btn--ghost"
            onClick={() => onClose?.()}
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="mit-btn stock-bajaEliminarModal__btnBaja"
            onClick={() => onDarBaja?.()}
            disabled={loading || darBajaDisabled}
          >
            {processingAction === "baja" ? labelProcesando : "Dar de baja"}
          </button>

          <button
            type="button"
            className="mit-btn mit-btn--danger"
            onClick={() => onEliminar?.()}
            disabled={loading || eliminarDisabled}
          >
            {processingAction === "eliminar" ? labelProcesando : "Eliminar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
