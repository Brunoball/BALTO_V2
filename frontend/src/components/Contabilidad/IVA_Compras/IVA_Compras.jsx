import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen } from "@fortawesome/free-solid-svg-icons";
import "../../Global/Global_css/Global_Section.css";
import "../../Global/Global_css/Global_responsive.css";
import "../contabilidad.css";

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

const columnas = [
  { key: "fecha", label: "Fecha" },
  { key: "tipo", label: "Tipo" },
  { key: "comprobante", label: "Comprobante" },
  { key: "proveedor", label: "Proveedor" },
  { key: "condicion", label: "Condición" },
  { key: "subtotal", label: "Subtotal", align: "right" },
  { key: "iva", label: "IVA", align: "right" },
  { key: "total", label: "Total", align: "right" },
];

const gridCols = "0.85fr 0.95fr 1.15fr minmax(160px, 1.45fr) 1fr 1fr 0.9fr 1fr";
const registrosIniciales = [];

export default function IVACompras() {
  const totales = useMemo(
    () =>
      registrosIniciales.reduce(
        (acc, item) => ({
          subtotal: acc.subtotal + Number(item.subtotal || 0),
          iva: acc.iva + Number(item.iva || 0),
          total: acc.total + Number(item.total || 0),
        }),
        { subtotal: 0, iva: 0, total: 0 }
      ),
    []
  );

  return (
    <div className="mov-page contabilidad-page">
      <section className="mov-card mov-card--table contabilidad-cardTable">
        <div className="mov-card__head">
          <div className="mov-card__headLeft">
            <div className="title-mov">
              <div className="mov-card__title">IVA Compras</div>
              <div className="mov-card__hint">
                Mostrando <b>{registrosIniciales.length}</b> registros de IVA compras
              </div>
            </div>
          </div>
        </div>

        <div
          className="mov-gridTable mov-gridTable--head contabilidad-gridHead"
          style={{ gridTemplateColumns: gridCols }}
          role="row"
        >
          {columnas.map((col) => (
            <div
              key={col.key}
              className={[
                "mov-gridCell",
                "mov-gridCell--head",
                col.align === "right" ? "is-right" : "",
              ].join(" ")}
              role="columnheader"
            >
              {col.label}
            </div>
          ))}
        </div>

        <div className="mov-tableWrap contabilidad-tableWrap" role="rowgroup">
          <div className="mov-gridBody mov-gridBody--relative">
            {registrosIniciales.length === 0 ? (
              <div className="cc-emptyState contabilidad-emptyState">
                <FontAwesomeIcon icon={faBoxOpen} className="cc-emptyIcon" />
                <div className="cc-emptyText">No hay registros de IVA compras cargados todavía.</div>
              </div>
            ) : (
              registrosIniciales.map((item) => (
                <div
                  key={item.id}
                  className="mov-gridTable mov-gridTable--row"
                  style={{ gridTemplateColumns: gridCols }}
                  role="row"
                >
                  <div className="mov-gridCell" role="cell">{item.fecha}</div>
                  <div className="mov-gridCell" role="cell">{item.tipo}</div>
                  <div className="mov-gridCell" role="cell">{item.comprobante}</div>
                  <div className="mov-gridCell" role="cell">{item.proveedor}</div>
                  <div className="mov-gridCell" role="cell">{item.condicion}</div>
                  <div className="mov-gridCell is-right" role="cell">{formatCurrency(item.subtotal)}</div>
                  <div className="mov-gridCell is-right" role="cell">{formatCurrency(item.iva)}</div>
                  <div className="mov-gridCell is-right is-strong" role="cell">{formatCurrency(item.total)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {registrosIniciales.length > 0 && (
          <div
            className="mov-gridTable contabilidad-totalRow"
            style={{ gridTemplateColumns: gridCols }}
            role="row"
          >
            <div className="mov-gridCell is-strong" role="cell">Totales</div>
            <div className="mov-gridCell" role="cell" />
            <div className="mov-gridCell" role="cell" />
            <div className="mov-gridCell" role="cell" />
            <div className="mov-gridCell" role="cell" />
            <div className="mov-gridCell is-right is-strong" role="cell">{formatCurrency(totales.subtotal)}</div>
            <div className="mov-gridCell is-right is-strong" role="cell">{formatCurrency(totales.iva)}</div>
            <div className="mov-gridCell is-right is-strong" role="cell">{formatCurrency(totales.total)}</div>
          </div>
        )}
      </section>
    </div>
  );
}
