function safeStr(value) {
  return String(value ?? "").trim();
}

function detalleProductosLabel(cantidad) {
  const n = Number(cantidad || 0);
  if (!Number.isFinite(n) || n <= 0) return "SIN PRODUCTOS";
  if (n === 1) return "1 PRODUCTO";
  return `${n} PRODUCTOS`;
}

function isResumenProductosText(value) {
  const text = safeStr(value).toUpperCase();
  return text === "SIN PRODUCTOS" || text === "1 CONCEPTO" || /^\d+\s+PRODUCTO(S)?$/.test(text);
}

function getItemDetalleText(item) {
  const raw = item && typeof item === "object" ? item : {};
  const value =
    safeStr(raw.descripcion) ||
    safeStr(raw.detalle) ||
    safeStr(raw.detalle_nombre) ||
    safeStr(raw.producto_nombre) ||
    safeStr(raw.stock_producto_nombre) ||
    safeStr(raw.nombre) ||
    safeStr(raw.producto) ||
    safeStr(raw.concepto);

  return value && value !== "Producto / Servicio" && !isResumenProductosText(value) ? value : "";
}

function buildDetalleItemsText(items) {
  const values = (Array.isArray(items) ? items : [])
    .map(getItemDetalleText)
    .filter(Boolean);

  return [...new Set(values)].join(", ");
}

function getItemsArray(row) {
  const candidates = [row?.items_detalle, row?.itemsDetalle, row?.items, row?.productos];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function getCantidadProductos(row) {
  const items = getItemsArray(row);
  if (items.length > 0) return items.length;

  const cantidadItems = Number(row?.cantidad_items ?? row?.cantidadItems ?? row?.productos_count ?? row?.productosCount ?? 0);
  if (Number.isFinite(cantidadItems) && cantidadItems > 0) return Math.trunc(cantidadItems);

  const resumenOriginal = safeStr(row?.detalle || row?.descripcion || row?.concepto || row?.nombre);
  const resumen = resumenOriginal.toUpperCase();
  const match = resumen.match(/^(\d+)\s+PRODUCTO(S)?$/);
  if (match) return Number(match[1]);

  const tieneProducto = safeStr(row?.id_stock_producto || row?.idStockProducto || row?.producto_nombre || row?.stock_producto_nombre);
  if (tieneProducto) return 1;

  if (resumenOriginal && !isResumenProductosText(resumenOriginal) && resumenOriginal !== "Producto / Servicio") return 1;

  return 0;
}

export function getResumenProductosMovimiento(row) {
  return detalleProductosLabel(getCantidadProductos(row));
}

export function getDetalleMovimiento(row) {
  const itemsText = buildDetalleItemsText(getItemsArray(row));
  if (itemsText) return itemsText;

  const original = safeStr(
    row?.detalle_original ||
      row?.descripcion_original ||
      row?.concepto_original ||
      row?.producto_nombre ||
      row?.stock_producto_nombre
  );
  if (original && !isResumenProductosText(original) && original !== "Producto / Servicio") return original;

  const detalle = safeStr(row?.detalle || row?.descripcion || row?.concepto || row?.nombre);
  if (detalle && !isResumenProductosText(detalle) && detalle !== "Producto / Servicio") return detalle;

  return getResumenProductosMovimiento(row);
}
