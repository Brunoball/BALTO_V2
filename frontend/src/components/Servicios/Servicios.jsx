import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import "../Global/Global_css/roots.css";
import "../Global/Global_css/Global_Section.css";
import "../Global/Global_css/Global_oscuro.css";
import "./Servicios.css";
import BotonExportar from "../Global/Boton_Exportar/BotonExportar";
import ModalEliminar from "../Global/Modales/ModalEliminar";
import useTableScrollGutter from "../Global/useTableScrollGutter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faListCheck,
  faMagnifyingGlass,
  faPenToSquare,
  faPlus,
  faTimes,
  faTrashCan,
  faUndo,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  actualizarCategoriaInsumoServicios,
  actualizarCategoriaServicios,
  actualizarCategoriaStockServicios,
  actualizarInsumoServicios,
  actualizarServicioServicios,
  actualizarStockServicios,
  crearCategoriaInsumoServicios,
  crearCategoriaServicios,
  crearCategoriaStockServicios,
  crearInsumoServicios,
  crearServicioServicios,
  crearStockServicios,
  darBajaCategoriaInsumoServicios,
  darBajaCategoriaServicios,
  darBajaCategoriaStockServicios,
  darBajaInsumoServicios,
  darBajaServicioServicios,
  darBajaStockServicios,
  eliminarCategoriaInsumoServicios,
  eliminarCategoriaServicios,
  eliminarCategoriaStockServicios,
  eliminarInsumoServicios,
  eliminarServicioServicios,
  eliminarStockServicios,
  listarCatalogoServicios,
  listarCategoriasInsumosServicios,
  listarCategoriasServicios,
  listarCategoriasStockServicios,
  listarInsumosServicios,
  listarStockServicios,
  listarUnidadesServicios,
  obtenerResumenServicios,
  reactivarCategoriaInsumoServicios,
  reactivarCategoriaServicios,
  reactivarCategoriaStockServicios,
  reactivarInsumoServicios,
  reactivarServicioServicios,
  reactivarStockServicios,
} from "./api/serviciosApi";
import ModalCategorias from "./modales/ModalCategorias";
import ModalInsumo from "./modales/ModalInsumo";
import ModalServicio from "./modales/ModalServicio";
import ModalStock from "./modales/ModalStock";
import { integer, money, upper } from "./utils/serviciosFormUtils";
import { exportServiciosExcel, exportServiciosPdf } from "./utils/serviciosExport";

const EMPTY_FILTERS = { buscar: "", categoria: "", estado: "todos" };
const includesText = (value, q) => upper(value).includes(q);

export default function Servicios() {
  const location = useLocation();
  const section = useMemo(
    () => new URLSearchParams(location.search).get("seccion") === "inventario" ? "inventario" : "servicios",
    [location.search]
  );
  const [inventoryTab, setInventoryTab] = useState("insumos");
  const tab = section === "servicios" ? "servicios" : inventoryTab;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [resumen, setResumen] = useState({});
  const [unidades, setUnidades] = useState([]);
  const [categoriasServicios, setCategoriasServicios] = useState([]);
  const [categoriasInsumos, setCategoriasInsumos] = useState([]);
  const [categoriasStock, setCategoriasStock] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [stock, setStock] = useState([]);

  const [filters, setFilters] = useState({
    servicios: { ...EMPTY_FILTERS },
    insumos: { ...EMPTY_FILTERS },
    stock: { ...EMPTY_FILTERS },
  });

  const [serviceModal, setServiceModal] = useState({ open: false, item: null });
  const [insumoModal, setInsumoModal] = useState({ open: false, item: null });
  const [stockModal, setStockModal] = useState({ open: false, item: null });
  const [categoryModal, setCategoryModal] = useState({ open: false, kind: "servicios" });
  const [deleteModal, setDeleteModal] = useState({ open: false, kind: null, item: null });
  const [tableWrapRef, hasTableScroll] = useTableScrollGutter();

  const flash = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, u, cs, ci, cst, s, i, st] = await Promise.all([
        obtenerResumenServicios(),
        listarUnidadesServicios(),
        listarCategoriasServicios({ activo: "todos" }),
        listarCategoriasInsumosServicios({ activo: "todos" }),
        listarCategoriasStockServicios({ activo: "todos" }),
        listarCatalogoServicios({ activo: "todos", limit: 1000 }),
        listarInsumosServicios({ activo: "todos", limit: 1000 }),
        listarStockServicios({ activo: "todos", limit: 1000 }),
      ]);

      setResumen(r?.resumen || {});
      setUnidades(u?.unidades || []);
      setCategoriasServicios(cs?.categorias || []);
      setCategoriasInsumos(ci?.categorias || []);
      setCategoriasStock(cst?.categorias || []);
      setServicios(s?.servicios || []);
      setInsumos(i?.insumos || []);
      setStock(st?.stock || []);
    } catch (e) {
      setError(e?.message || "No se pudo cargar el módulo Servicios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const currentFilters = filters[tab] || EMPTY_FILTERS;
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: value } }));
  };

  const serviciosFiltrados = useMemo(() => {
    const f = filters.servicios;
    const q = upper(f.buscar).trim();
    return servicios.filter((item) => {
      if (f.estado !== "todos" && Number(item.activo) !== Number(f.estado)) return false;
      if (f.categoria && String(item.id_servicio_categoria || "") !== String(f.categoria)) return false;
      if (q && !includesText(item.nombre, q) && !includesText(item.codigo, q) && !includesText(item.descripcion, q) && !includesText(item.categoria_nombre, q)) return false;
      return true;
    });
  }, [servicios, filters.servicios]);

  const insumosFiltrados = useMemo(() => {
    const f = filters.insumos;
    const q = upper(f.buscar).trim();
    return insumos.filter((item) => {
      if (f.estado !== "todos" && Number(item.activo) !== Number(f.estado)) return false;
      if (f.categoria && String(item.id_categoria || "") !== String(f.categoria)) return false;
      if (q && !includesText(item.nombre, q) && !includesText(item.codigo, q) && !includesText(item.descripcion, q) && !includesText(item.categoria_nombre, q)) return false;
      return true;
    });
  }, [insumos, filters.insumos]);

  const stockFiltrado = useMemo(() => {
    const f = filters.stock;
    const q = upper(f.buscar).trim();
    return stock.filter((item) => {
      if (f.estado !== "todos" && Number(item.activo) !== Number(f.estado)) return false;
      if (f.categoria && String(item.id_categoria || "") !== String(f.categoria)) return false;
      if (q && !includesText(item.nombre, q) && !includesText(item.codigo, q) && !includesText(item.descripcion, q) && !includesText(item.categoria_nombre, q)) return false;
      return true;
    });
  }, [stock, filters.stock]);

  const execute = async (fn, successMessage) => {
    setSaving(true);
    setError("");
    try {
      const result = await fn();
      if (successMessage) flash(successMessage);
      await cargar();
      return result;
    } catch (e) {
      setError(e?.message || "No se pudo completar la operación.");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const saveServicio = async (payload) => {
    try {
      await execute(
        () => payload.id_servicio ? actualizarServicioServicios(payload) : crearServicioServicios(payload),
        payload.id_servicio ? "Servicio actualizado correctamente." : "Servicio creado correctamente."
      );
      setServiceModal({ open: false, item: null });
    } catch {}
  };

  const saveInsumo = async (payload) => {
    try {
      await execute(
        () => payload.id_insumo ? actualizarInsumoServicios(payload) : crearInsumoServicios(payload),
        payload.id_insumo ? "Insumo actualizado correctamente." : "Insumo creado correctamente."
      );
      setInsumoModal({ open: false, item: null });
    } catch {}
  };

  const saveStock = async (payload) => {
    try {
      await execute(
        () => payload.id_stock ? actualizarStockServicios(payload) : crearStockServicios(payload),
        payload.id_stock ? "Stock actualizado correctamente." : "Registro agregado a Stock."
      );
      setStockModal({ open: false, item: null });
    } catch {}
  };

  const toggleServicio = (item) => execute(
    () => Number(item.activo) === 1 ? darBajaServicioServicios(item.id_servicio) : reactivarServicioServicios(item.id_servicio),
    Number(item.activo) === 1 ? "Servicio dado de baja." : "Servicio reactivado."
  ).catch(() => {});

  const toggleInsumo = (item) => execute(
    () => Number(item.activo) === 1 ? darBajaInsumoServicios(item.id_insumo) : reactivarInsumoServicios(item.id_insumo),
    Number(item.activo) === 1 ? "Insumo dado de baja." : "Insumo reactivado."
  ).catch(() => {});

  const toggleStock = (item) => execute(
    () => Number(item.activo) === 1 ? darBajaStockServicios(item.id_stock) : reactivarStockServicios(item.id_stock),
    Number(item.activo) === 1 ? "Registro de stock dado de baja." : "Registro de stock reactivado."
  ).catch(() => {});

  const categoryConfig = useMemo(() => {
    if (categoryModal.kind === "servicios") {
      return {
        titulo: "Categorías de servicios",
        categorias: categoriasServicios,
        getId: (c) => c.id_servicio_categoria,
        getCount: (c) => c.cantidad_servicios || 0,
        create: crearCategoriaServicios,
        update: (id, body) => actualizarCategoriaServicios({ id_servicio_categoria: id, ...body }),
        toggle: (c) => Number(c.activo) === 1 ? darBajaCategoriaServicios(c.id_servicio_categoria) : reactivarCategoriaServicios(c.id_servicio_categoria),
        deleteKind: "categoria-servicios",
        nota: "Al eliminar una categoría, los servicios asociados quedan sin categoría. Los servicios no se eliminan.",
      };
    }
    if (categoryModal.kind === "stock") {
      return {
        titulo: "Categorías de stock",
        categorias: categoriasStock,
        getId: (c) => c.id_stock_categoria,
        getCount: (c) => c.cantidad_stock || 0,
        create: crearCategoriaStockServicios,
        update: (id, body) => actualizarCategoriaStockServicios({ id_stock_categoria: id, ...body }),
        toggle: (c) => Number(c.activo) === 1 ? darBajaCategoriaStockServicios(c.id_stock_categoria) : reactivarCategoriaStockServicios(c.id_stock_categoria),
        deleteKind: "categoria-stock",
        nota: "Al eliminar una categoría, los registros de Stock asociados quedan sin categoría. Los registros de Stock no se eliminan.",
      };
    }
    return {
      titulo: "Categorías de insumos",
      categorias: categoriasInsumos,
      getId: (c) => c.id_categoria,
      getCount: (c) => c.cantidad_insumos || 0,
      create: crearCategoriaInsumoServicios,
      update: (id, body) => actualizarCategoriaInsumoServicios({ id_categoria: id, ...body }),
      toggle: (c) => Number(c.activo) === 1 ? darBajaCategoriaInsumoServicios(c.id_categoria) : reactivarCategoriaInsumoServicios(c.id_categoria),
      deleteKind: "categoria-insumos",
      nota: "Al eliminar una categoría, los insumos asociados quedan sin categoría. Los insumos no se eliminan y Stock no se modifica.",
    };
  }, [categoryModal.kind, categoriasServicios, categoriasInsumos, categoriasStock]);

  const createCategory = (body) => execute(() => categoryConfig.create(body), "Categoría agregada correctamente.");
  const updateCategory = (id, body) => execute(() => categoryConfig.update(id, body), "Categoría actualizada correctamente.");
  const toggleCategory = (category) => execute(
    () => categoryConfig.toggle(category),
    Number(category.activo) === 1 ? "Categoría dada de baja." : "Categoría reactivada."
  ).catch(() => {});
  const deleteCategory = (item) => setDeleteModal({ open: true, kind: categoryConfig.deleteKind, item });

  const closeDeleteModal = () => {
    if (!saving) setDeleteModal({ open: false, kind: null, item: null });
  };

  const confirmDelete = async () => {
    const { kind, item } = deleteModal;
    if (!kind || !item) return;

    if (kind === "servicio") await execute(() => eliminarServicioServicios(item.id_servicio), "Servicio eliminado definitivamente.");
    if (kind === "insumo") await execute(() => eliminarInsumoServicios(item.id_insumo), "Insumo eliminado definitivamente.");
    if (kind === "stock") await execute(() => eliminarStockServicios(item.id_stock), "Registro de stock eliminado definitivamente.");
    if (kind === "categoria-servicios") await execute(() => eliminarCategoriaServicios(item.id_servicio_categoria), "Categoría eliminada correctamente.");
    if (kind === "categoria-insumos") await execute(() => eliminarCategoriaInsumoServicios(item.id_categoria), "Categoría eliminada correctamente.");
    if (kind === "categoria-stock") await execute(() => eliminarCategoriaStockServicios(item.id_stock_categoria), "Categoría eliminada correctamente.");

    setDeleteModal({ open: false, kind: null, item: null });
  };

  const deleteModalCopy = useMemo(() => {
    const item = deleteModal.item || {};
    const nombre = item.nombre || "ESTE REGISTRO";

    if (deleteModal.kind === "insumo") {
      return {
        title: "Eliminar insumo",
        message: `¿Seguro que querés eliminar definitivamente "${nombre}"?`,
        warning: "Se eliminará el insumo, su historial de precios y su participación en servicios. Si ya fue usado en una venta, compra u otro movimiento, ese movimiento se conservará para no perder información. Stock no se modifica porque se administra de forma independiente. Esta acción no se puede deshacer.",
        details: [
          { label: "Nombre", value: nombre },
          { label: "Categoría", value: item.categoria_nombre || "SIN CATEGORÍA" },
          { label: "Costo", value: money(item.costo_unitario || 0) },
        ],
      };
    }

    if (deleteModal.kind === "stock") {
      return {
        title: "Eliminar de stock",
        message: `¿Seguro que querés eliminar definitivamente "${nombre}" de Stock?`,
        warning: "Se eliminará únicamente este registro de Stock. Los insumos y servicios no se modificarán. Esta acción no se puede deshacer.",
        details: [
          { label: "Nombre", value: nombre },
          { label: "Stock actual", value: integer(item.stock_actual || 0) },
          { label: "Categoría", value: item.categoria_nombre || "SIN CATEGORÍA" },
        ],
      };
    }

    if (deleteModal.kind === "servicio") {
      return {
        title: "Eliminar servicio",
        message: `¿Seguro que querés eliminar definitivamente "${nombre}"?`,
        warning: "Se eliminará el servicio, su historial de precios y su composición. Si ya fue usado en una venta u otro movimiento, ese movimiento se conservará para no perder información. Los insumos y Stock no se eliminan. Esta acción no se puede deshacer.",
        details: [
          { label: "Nombre", value: nombre },
          { label: "Categoría", value: item.categoria_nombre || "SIN CATEGORÍA" },
          { label: "Precio", value: money(item.precio_venta || 0) },
        ],
      };
    }

    const count = deleteModal.kind === "categoria-servicios"
      ? item.cantidad_servicios || 0
      : deleteModal.kind === "categoria-stock"
      ? item.cantidad_stock || 0
      : item.cantidad_insumos || 0;

    return {
      title: "Eliminar categoría",
      message: `¿Seguro que querés eliminar definitivamente "${nombre}"?`,
      warning: "Los registros que usan esta categoría no se eliminan: simplemente quedan sin categoría. Esta acción no se puede deshacer.",
      details: [
        { label: "Categoría", value: nombre },
        { label: "Registros asociados", value: count },
      ],
    };
  }, [deleteModal]);

  const exportDefinition = useMemo(() => {
    if (tab === "servicios") {
      return {
        title: "BALTO_SERVICIOS",
        rows: serviciosFiltrados,
        columns: [
          { label: "CÓDIGO", value: (r) => r.codigo || "", width: 15 },
          { label: "SERVICIO", value: (r) => r.nombre, width: 35, weight: 2 },
          { label: "CATEGORÍA", value: (r) => r.categoria_nombre || "SIN CATEGORÍA", width: 24 },
          { label: "COSTO", value: (r) => Number(r.costo_estimado || 0).toFixed(2), width: 15 },
          { label: "PRECIO", value: (r) => Number(r.precio_venta || 0).toFixed(2), width: 15 },
          { label: "ESTADO", value: (r) => Number(r.activo) === 1 ? "ACTIVO" : "BAJA", width: 12 },
        ],
      };
    }

    if (tab === "insumos") {
      return {
        title: "BALTO_INSUMOS",
        rows: insumosFiltrados,
        columns: [
          { label: "CÓDIGO", value: (r) => r.codigo || "", width: 15 },
          { label: "INSUMO", value: (r) => r.nombre, width: 35, weight: 2 },
          { label: "CATEGORÍA", value: (r) => r.categoria_nombre || "SIN CATEGORÍA", width: 24 },
          { label: "UNIDAD", value: (r) => r.unidad_simbolo || r.unidad_nombre || "", width: 12 },
          { label: "COSTO", value: (r) => Number(r.costo_unitario || 0).toFixed(2), width: 15 },
          { label: "PRECIO", value: (r) => r.precio_venta == null ? "" : Number(r.precio_venta).toFixed(2), width: 15 },
          { label: "ESTADO", value: (r) => Number(r.activo) === 1 ? "ACTIVO" : "BAJA", width: 12 },
        ],
      };
    }

    return {
      title: "BALTO_STOCK_SERVICIOS",
      rows: stockFiltrado,
      columns: [
        { label: "CÓDIGO", value: (r) => r.codigo || "", width: 15 },
        { label: "STOCK", value: (r) => r.nombre, width: 35, weight: 2 },
        { label: "CATEGORÍA", value: (r) => r.categoria_nombre || "SIN CATEGORÍA", width: 24 },
        { label: "UNIDAD", value: (r) => r.unidad_simbolo || r.unidad_nombre || "", width: 12 },
        { label: "CANTIDAD", value: (r) => integer(r.stock_actual), width: 12 },
        { label: "COSTO", value: (r) => Number(r.costo_unitario || 0).toFixed(2), width: 15 },
        { label: "ESTADO", value: (r) => Number(r.activo) === 1 ? "ACTIVO" : "BAJA", width: 12 },
      ],
    };
  }, [tab, serviciosFiltrados, insumosFiltrados, stockFiltrado]);

  const exportOptions = [
    { key: "excel", label: "Exportar Excel (.xlsx)", tipo: "excel", onClick: () => exportServiciosExcel(exportDefinition) },
    { key: "pdf", label: "Exportar PDF (.pdf)", tipo: "pdf", onClick: () => exportServiciosPdf(exportDefinition) },
  ];

  const activeCategoryList = tab === "servicios" ? categoriasServicios : tab === "insumos" ? categoriasInsumos : categoriasStock;
  const categoryId = (category) => tab === "servicios" ? category.id_servicio_categoria : tab === "stock" ? category.id_stock_categoria : category.id_categoria;
  const openNew = () => {
    if (tab === "servicios") setServiceModal({ open: true, item: null });
    if (tab === "insumos") setInsumoModal({ open: true, item: null });
    if (tab === "stock") setStockModal({ open: true, item: null });
  };

  const tableDefinition = useMemo(() => {
    if (tab === "servicios") {
      return {
        entity: "servicios",
        rows: serviciosFiltrados,
        columns: [
          { key: "nombre", label: "Servicio", width: "minmax(190px, 1.65fr)" },
          { key: "categoria", label: "Categoría", width: "minmax(145px, 1.1fr)" },
          { key: "costo_estimado", label: "Costo estimado", width: "minmax(115px, .8fr)", align: "right" },
          { key: "precio_venta", label: "Precio", width: "minmax(110px, .8fr)", align: "right" },
          { key: "iva", label: "IVA", width: "78px", align: "center" },
          { key: "estado", label: "Estado", width: "92px", align: "center" },
          { key: "acciones", label: "Acciones", width: "128px", align: "center" },
        ],
      };
    }
    if (tab === "insumos") {
      return {
        entity: "insumos",
        rows: insumosFiltrados,
        columns: [
          { key: "nombre", label: "Insumo", width: "minmax(180px, 1.55fr)" },
          { key: "categoria", label: "Categoría", width: "minmax(135px, 1fr)" },
          { key: "unidad", label: "Unidad", width: "90px", align: "center" },
          { key: "costo_unitario", label: "Costo", width: "minmax(105px, .75fr)", align: "right" },
          { key: "precio_venta", label: "Precio", width: "minmax(105px, .75fr)", align: "right" },
          { key: "iva", label: "IVA", width: "72px", align: "center" },
          { key: "estado", label: "Estado", width: "88px", align: "center" },
          { key: "acciones", label: "Acciones", width: "128px", align: "center" },
        ],
      };
    }
    return {
      entity: "registros de stock",
      rows: stockFiltrado,
      columns: [
        { key: "nombre", label: "Artículo", width: "minmax(190px, 1.65fr)" },
        { key: "categoria", label: "Categoría", width: "minmax(145px, 1.1fr)" },
        { key: "unidad", label: "Unidad", width: "90px", align: "center" },
        { key: "stock_actual", label: "Cantidad", width: "100px", align: "right" },
        { key: "costo_unitario", label: "Costo", width: "minmax(110px, .8fr)", align: "right" },
        { key: "estado", label: "Estado", width: "92px", align: "center" },
        { key: "acciones", label: "Acciones", width: "128px", align: "center" },
      ],
    };
  }, [tab, serviciosFiltrados, insumosFiltrados, stockFiltrado]);

  const gridColumns = tableDefinition.columns.map((column) => column.width).join(" ");
  const newLabel = tab === "servicios" ? "Nuevo servicio" : tab === "insumos" ? "Nuevo insumo" : "Agregar a stock";
  const searchLabel = tab === "servicios" ? "Buscar servicio" : tab === "insumos" ? "Buscar insumo" : "Buscar en stock";

  const editItem = (item) => {
    if (tab === "servicios") setServiceModal({ open: true, item });
    if (tab === "insumos") setInsumoModal({ open: true, item });
    if (tab === "stock") setStockModal({ open: true, item });
  };

  const toggleItem = (item) => {
    if (tab === "servicios") toggleServicio(item);
    if (tab === "insumos") toggleInsumo(item);
    if (tab === "stock") toggleStock(item);
  };

  const requestDeleteItem = (item) => {
    const kind = tab === "servicios" ? "servicio" : tab === "insumos" ? "insumo" : "stock";
    setDeleteModal({ open: true, kind, item });
  };

  const renderCell = (item, key) => {
    if (key === "nombre") return <div className="servicios-nameCell"><strong>{item.nombre}</strong><small>{item.codigo || "SIN CÓDIGO"}</small></div>;
    if (key === "categoria") return item.categoria_nombre || "SIN CATEGORÍA";
    if (key === "unidad") return item.unidad_simbolo || item.unidad_nombre || "—";
    if (key === "costo_estimado") return money(item.costo_estimado);
    if (key === "costo_unitario") return money(item.costo_unitario);
    if (key === "precio_venta") return item.precio_venta == null ? "—" : money(item.precio_venta);
    if (key === "stock_actual") return <strong className="servicios-stock-value">{integer(item.stock_actual)}</strong>;
    if (key === "iva") return `${Number(item.iva_pct || 0).toFixed(2)}%`;
    if (key === "estado") {
      const active = Number(item.activo) === 1;
      return <span className={`mov-chip ${active ? "mov-chip--ok" : "mov-chip--neutral"}`}>{active ? "ACTIVO" : "BAJA"}</span>;
    }
    return "—";
  };

  const renderSkeletonRow = (index) => (
    <div key={`servicios-skeleton-${index}`} className="mov-gridTable mov-gridTable--row mov-row--skeleton" style={{ gridTemplateColumns: gridColumns }} role="row" aria-hidden="true">
      {tableDefinition.columns.map((column) => (
        <div key={column.key} className={`mov-gridCell ${column.align === "right" ? "is-right" : ""} ${column.align === "center" ? "is-center" : ""}`} role="cell">
          {column.key === "acciones"
            ? <div className="mov-skelActions"><span className="mov-skelIcon" /><span className="mov-skelIcon" /><span className="mov-skelIcon" /></div>
            : <span className="mov-skeletonBar" style={{ width: `${48 + ((index + column.key.length) % 4) * 10}%` }} />}
        </div>
      ))}
    </div>
  );

  const renderSecondaryActions = (className = "", compact = false) => (
    <div className={`mov-card__actions servicios-secondaryActions ${className}`.trim()}>
      <BotonExportar label={compact ? "Exportar datos" : "Exportar"} title="Exportar vista actual" opciones={exportOptions} disabled={loading || tableDefinition.rows.length === 0} align="right" />
      <button type="button" className="mov-btn mov-btn--ghost" onClick={() => setCategoryModal({ open: true, kind: tab })} disabled={saving}><FontAwesomeIcon icon={faListCheck} /> {compact ? "Administrar categorías" : "Categorías"}</button>
    </div>
  );

  return (
    <section className="mov-page servicios-page">
      {error && <div className="mov-alert" role="alert">{error}</div>}
      {notice && <div className="servicios-alert servicios-alert--ok" role="status">{notice}</div>}

      <div className="servicios-summary">
        <article><span>Servicios activos</span><strong>{resumen.servicios_activos ?? 0}</strong></article>
        <article><span>Insumos activos</span><strong>{resumen.insumos_activos ?? 0}</strong></article>
        <article><span>Registros de stock activos</span><strong>{resumen.stock_activos ?? 0}</strong></article>
        <article><span>Unidades en stock</span><strong>{integer(resumen.stock_total_unidades ?? 0)}</strong></article>
      </div>

      <section className="mov-card mov-card--table servicios-table-card">
        <div className="mov-card__head servicios-table-head">
          <div className="mov-card__headLeft">
            <div className="title-mov">
              {section === "inventario" ? (
                <div className="servicios-tabsRow">
                  <div className="servicios-googleTabs" role="tablist" aria-label="Inventario e insumos">
                    <button type="button" role="tab" aria-selected={inventoryTab === "insumos"} className={`servicios-googleTab ${inventoryTab === "insumos" ? "is-active" : ""}`} onClick={() => setInventoryTab("insumos")}>Insumos</button>
                    <button type="button" role="tab" aria-selected={inventoryTab === "stock"} className={`servicios-googleTab ${inventoryTab === "stock" ? "is-active" : ""}`} onClick={() => setInventoryTab("stock")}>Stock</button>
                  </div>
                </div>
              ) : (
                <div className="mov-card__title">Servicios</div>
              )}
              <div className="mov-card__hint">Mostrando <b>{tableDefinition.rows.length}</b> {tableDefinition.entity}</div>
            </div>

            <div className="mov-headFilters servicios-headFilters">
              <div className="cc-filter cc-filter--search servicios-searchGlobal">
                <div className="cc-floatingField cc-floatingField--search is-active">
                  <div className="cc-searchInput">
                    <div className="cc-searchInput__fieldWrap">
                      <input className="cc-input cc-input--floating" maxLength={100} value={currentFilters.buscar} onChange={(event) => updateFilter("buscar", upper(event.target.value).slice(0, 100))} placeholder=" " aria-label={searchLabel} />
                      <span className="cc-floatingLabel"><FontAwesomeIcon icon={faMagnifyingGlass} /> {searchLabel}</span>
                      {currentFilters.buscar && <button type="button" className="cc-clearSearch cc-clearSearch--inside" onClick={() => updateFilter("buscar", "")} title="Limpiar búsqueda"><FontAwesomeIcon icon={faXmark} /></button>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="cc-filter servicios-selectFilter">
                <div className="cc-floatingField is-active">
                  <select id="servicios-categoria" className="cc-input cc-input--floating" value={currentFilters.categoria} onChange={(event) => updateFilter("categoria", event.target.value)} aria-label="Categoría">
                    <option value="">TODAS</option>
                    {activeCategoryList.map((category) => <option key={categoryId(category)} value={categoryId(category)}>{category.nombre}{Number(category.activo) === 1 ? "" : " (BAJA)"}</option>)}
                  </select>
                  <span className="cc-floatingLabel">Categoría</span>
                </div>
              </div>

              <div className="cc-filter servicios-selectFilter servicios-selectFilter--state">
                <div className="cc-floatingField is-active">
                  <select id="servicios-estado" className="cc-input cc-input--floating" value={currentFilters.estado} onChange={(event) => updateFilter("estado", event.target.value)} aria-label="Estado">
                    <option value="todos">TODOS</option><option value="1">ACTIVOS</option><option value="0">BAJAS</option>
                  </select>
                  <span className="cc-floatingLabel">Estado</span>
                </div>
              </div>
            </div>
          </div>

          {renderSecondaryActions("servicios-secondaryActions--desktop")}

          <div className="mov-card__actions servicios-headActions servicios-headActions--primary">
            <button type="button" className="mov-btn mov-btn--primary" onClick={openNew} disabled={saving}><FontAwesomeIcon icon={faPlus} /> {newLabel}</button>
          </div>
        </div>

        <div className={`mov-gridTable mov-gridTable--head ${hasTableScroll ? "has-y-scroll" : ""}`} style={{ gridTemplateColumns: gridColumns }} role="row">
          {tableDefinition.columns.map((column) => <div key={column.key} className={`mov-gridCell mov-gridCell--head ${column.align === "right" ? "is-right" : ""} ${column.align === "center" ? "is-center" : ""}`} role="columnheader">{column.label}</div>)}
        </div>

        <div className="mov-tableWrap servicios-globalTableWrap" role="rowgroup" ref={tableWrapRef}>
          <div className={`mov-gridBody mov-gridBody--relative ${loading ? "mov-softLoading" : ""}`}>
            {loading ? (
              <div className="mov-skeletonWrap" aria-busy="true" aria-label="Cargando registros">{Array.from({ length: 10 }).map((_, index) => renderSkeletonRow(index))}</div>
            ) : (
              <>
                {tableDefinition.rows.map((item) => {
                  const active = Number(item.activo) === 1;
                  const rowKey = item.id_servicio ?? item.id_insumo ?? item.id_stock;
                  return (
                    <div key={rowKey} className={`mov-gridTable mov-gridTable--row ${active ? "" : "is-row-inactive"}`} style={{ gridTemplateColumns: gridColumns }} role="row">
                      {tableDefinition.columns.map((column) => column.key === "acciones" ? (
                        <div key={column.key} className="mov-gridCell mov-gridCell--actions is-center" role="cell" data-label={column.label}>
                          <div className="mov-actionsInline">
                            <button type="button" className="mov-iconBtn" onClick={() => editItem(item)} disabled={saving} title="Editar"><FontAwesomeIcon icon={faPenToSquare} /></button>
                            <button type="button" className="mov-iconBtn" onClick={() => toggleItem(item)} disabled={saving} title={active ? "Dar de baja" : "Reactivar"}><FontAwesomeIcon icon={active ? faTimes : faUndo} /></button>
                            <button type="button" className="mov-iconBtn mov-iconBtn--danger" onClick={() => requestDeleteItem(item)} disabled={saving} title="Eliminar"><FontAwesomeIcon icon={faTrashCan} /></button>
                          </div>
                        </div>
                      ) : (
                        <div key={column.key} className={`mov-gridCell ${column.align === "right" ? "is-right" : ""} ${column.align === "center" ? "is-center" : ""}`} role="cell" data-label={column.label}>{renderCell(item, column.key)}</div>
                      ))}
                    </div>
                  );
                })}

                {tableDefinition.rows.length === 0 && <div className="servicios-emptyState"><FontAwesomeIcon icon={faBoxOpen} /><span>No hay {tableDefinition.entity} para los filtros actuales.</span></div>}
              </>
            )}
          </div>
        </div>

        <div className="servicios-tableFooter">
          {renderSecondaryActions("servicios-secondaryActions--mobile", true)}
        </div>
      </section>

      <ModalServicio
        open={serviceModal.open}
        item={serviceModal.item}
        categorias={categoriasServicios}
        saving={saving}
        onClose={() => setServiceModal({ open: false, item: null })}
        onSave={saveServicio}
        onOpenCategorias={() => setCategoryModal({ open: true, kind: "servicios" })}
      />

      <ModalInsumo
        open={insumoModal.open}
        item={insumoModal.item}
        categorias={categoriasInsumos}
        unidades={unidades}
        saving={saving}
        onClose={() => setInsumoModal({ open: false, item: null })}
        onSave={saveInsumo}
        onOpenCategorias={() => setCategoryModal({ open: true, kind: "insumos" })}
      />

      <ModalStock
        open={stockModal.open}
        item={stockModal.item}
        categorias={categoriasStock}
        unidades={unidades}
        saving={saving}
        onClose={() => setStockModal({ open: false, item: null })}
        onSave={saveStock}
        onOpenCategorias={() => setCategoryModal({ open: true, kind: "stock" })}
      />

      <ModalCategorias
        open={categoryModal.open}
        titulo={categoryConfig.titulo}
        categorias={categoryConfig.categorias}
        getId={categoryConfig.getId}
        getCount={categoryConfig.getCount}
        saving={saving}
        onClose={() => setCategoryModal((prev) => ({ ...prev, open: false }))}
        onCreate={createCategory}
        onUpdate={updateCategory}
        onToggle={toggleCategory}
        onDelete={deleteCategory}
        nota={categoryConfig.nota}
      />

      <ModalEliminar
        open={deleteModal.open}
        row={deleteModal.item}
        loading={saving}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title={deleteModalCopy.title}
        message={deleteModalCopy.message}
        warning={deleteModalCopy.warning}
        loadingMessage="Eliminando registro…"
        successMessage="Registro eliminado correctamente."
        errorMessage="No se pudo eliminar el registro."
        confirmLabel="Eliminar definitivamente"
        details={deleteModalCopy.details}
      />

    </section>
  );
}
