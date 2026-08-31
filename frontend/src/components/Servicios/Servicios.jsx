import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Servicios.css";
import "../Global/Global_css/Global_Section.css";
import BotonExportar from "../Global/Boton_Exportar/BotonExportar";
import ModalEliminar from "../Global/Modales/ModalEliminar";
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
  obtenerServicioServicios,
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBan, faPenToSquare, faRotateLeft, faTrashCan } from "@fortawesome/free-solid-svg-icons";

const EMPTY_FILTERS = { buscar: "", categoria: "", estado: "todos" };
const includesText = (value, q) => upper(value).includes(q);
const SECTION_META = {
  servicios: {
    title: "Servicios",
    description: "Administrá los servicios y definí los insumos o productos de Stock que necesita cada uno.",
    addLabel: "Agregar servicio",
  },
  insumos: {
    title: "Insumos",
    description: "Administrá los insumos utilizados por los servicios de manera independiente del Stock.",
    addLabel: "Agregar insumo",
  },
  stock: {
    title: "Stock",
    description: "Administrá los productos y existencias de Stock de manera independiente de los Insumos.",
    addLabel: "Agregar producto",
  },
};

const formatIva = (value) => `${Number(value || 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })} %`;

export default function Servicios() {
  const [tab, setTab] = useState("servicios");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const flash = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, cs, ci, cst, s, i, st] = await Promise.all([
        listarUnidadesServicios(),
        listarCategoriasServicios({ activo: "todos" }),
        listarCategoriasInsumosServicios({ activo: "todos" }),
        listarCategoriasStockServicios({ activo: "todos" }),
        listarCatalogoServicios({ activo: "todos", limit: 1000 }),
        listarInsumosServicios({ activo: "todos", limit: 1000 }),
        listarStockServicios({ activo: "todos", limit: 1000 }),
      ]);

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

  const openEditServicio = async (item) => {
    setError("");
    try {
      const result = await obtenerServicioServicios(item.id_servicio);
      setServiceModal({ open: true, item: result?.servicio || item });
    } catch (e) {
      setError(e?.message || "No se pudo cargar el servicio.");
    }
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

  return (
    <section className="servicios-page">
      <div className="servicios-head">
        <div>
          <p className="servicios-kicker">BALTO · SERVICIOS</p>
          <h1>{SECTION_META[tab].title}</h1>
          <p>{SECTION_META[tab].description}</p>
        </div>
        <div className="servicios-head__actions">
          <BotonExportar label="Exportar" title="Exportar vista actual" opciones={exportOptions} disabled={loading} />
          <button type="button" className="servicios-btn" onClick={openNew} disabled={saving}>
            {SECTION_META[tab].addLabel}
          </button>
        </div>
      </div>

      {error && <div className="servicios-alert servicios-alert--error">{error}</div>}
      {notice && <div className="servicios-alert servicios-alert--ok">{notice}</div>}

      <div className="servicios-toolbar">
        <label className="servicios-search">
          <span>Buscar</span>
          <input
            maxLength={100}
            value={currentFilters.buscar}
            onChange={(e) => updateFilter("buscar", upper(e.target.value).slice(0, 100))}
            placeholder={tab === "servicios" ? "BUSCAR SERVICIO, CÓDIGO O CATEGORÍA" : tab === "insumos" ? "BUSCAR INSUMO, CÓDIGO O CATEGORÍA" : "BUSCAR EN STOCK"}
          />
        </label>

        <label className="servicios-filter">
          <span>Categoría</span>
          <select value={currentFilters.categoria} onChange={(e) => updateFilter("categoria", e.target.value)}>
            <option value="">TODAS LAS CATEGORÍAS</option>
            {activeCategoryList.map((category) => (
              <option key={categoryId(category)} value={categoryId(category)}>{category.nombre}{Number(category.activo) === 1 ? "" : " (BAJA)"}</option>
            ))}
          </select>
        </label>

        <label className="servicios-filter">
          <span>Estado</span>
          <select value={currentFilters.estado} onChange={(e) => updateFilter("estado", e.target.value)}>
            <option value="todos">TODOS</option>
            <option value="1">ACTIVOS</option>
            <option value="0">DADOS DE BAJA</option>
          </select>
        </label>

        <button
          type="button"
          className="servicios-btn servicios-btn--ghost servicios-toolbar__categories"
          onClick={() => setCategoryModal({ open: true, kind: tab })}
        >
          Gestionar categorías
        </button>
      </div>

      {loading ? (
        <div className="servicios-loading">Cargando módulo Servicios…</div>
      ) : (
        <>
          {tab === "servicios" && (
            <div className="servicios-card servicios-table-card">
              <div className="servicios-card-title"><div><h2>Servicios</h2><span>{serviciosFiltrados.length} registro(s)</span></div></div>
              <div className="servicios-table-wrap">
                <table>
                  <thead><tr><th>Servicio</th><th>Categoría</th><th>Composición</th><th>Costo estimado</th><th>Precio</th><th>IVA</th><th>Estado</th><th className="servicios-actions-col">Acciones</th></tr></thead>
                  <tbody>
                    {serviciosFiltrados.length === 0 ? <tr><td colSpan="8" className="servicios-empty">NO HAY SERVICIOS PARA LOS FILTROS ACTUALES.</td></tr> : serviciosFiltrados.map((item) => {
                      const activo = Number(item.activo) === 1;
                      return (
                        <tr key={item.id_servicio} className={activo ? "" : "is-row-inactive"}>
                          <td><strong>{item.nombre}</strong><small>{item.codigo || "SIN CÓDIGO"}</small></td>
                          <td>{item.categoria_nombre || "SIN CATEGORÍA"}</td>
                          <td>
                            <span className="servicios-composition-summary">
                              {Number(item.cantidad_insumos || 0)} insumo(s) · {Number(item.cantidad_productos_stock || 0)} de Stock
                            </span>
                          </td>
                          <td>{money(item.costo_estimado)}</td>
                          <td>{money(item.precio_venta)}</td>
                          <td>{formatIva(item.iva_pct)}</td>
                          <td><span className={`servicios-status ${activo ? "is-active" : "is-inactive"}`}>{activo ? "ACTIVO" : "BAJA"}</span></td>
                          <td><div className="servicios-row-actions">
                            <button type="button" className="servicios-action-icon" title="Editar" aria-label="Editar" onClick={() => openEditServicio(item)}>
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button type="button" className="servicios-action-icon" title={activo ? "Dar de baja" : "Reactivar"} aria-label={activo ? "Dar de baja" : "Reactivar"} onClick={() => toggleServicio(item)}>
                              <FontAwesomeIcon icon={activo ? faBan : faRotateLeft} />
                            </button>
                            <button type="button" className="servicios-action-icon is-danger" title="Eliminar" aria-label="Eliminar" onClick={() => setDeleteModal({ open: true, kind: "servicio", item })}>
                              <FontAwesomeIcon icon={faTrashCan} />
                            </button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "insumos" && (
            <div className="servicios-card servicios-table-card">
              <div className="servicios-card-title"><div><h2>Insumos</h2><span>{insumosFiltrados.length} registro(s) · independientes de Stock</span></div></div>
              <div className="servicios-table-wrap">
                <table>
                  <thead><tr><th>Insumo</th><th>Categoría</th><th>Unidad</th><th>Costo</th><th>Precio</th><th>IVA</th><th>Estado</th><th className="servicios-actions-col">Acciones</th></tr></thead>
                  <tbody>
                    {insumosFiltrados.length === 0 ? <tr><td colSpan="8" className="servicios-empty">NO HAY INSUMOS PARA LOS FILTROS ACTUALES.</td></tr> : insumosFiltrados.map((item) => {
                      const activo = Number(item.activo) === 1;
                      return (
                        <tr key={item.id_insumo} className={activo ? "" : "is-row-inactive"}>
                          <td><strong>{item.nombre}</strong><small>{item.codigo || "SIN CÓDIGO"}</small></td>
                          <td>{item.categoria_nombre || "SIN CATEGORÍA"}</td>
                          <td>{item.unidad_simbolo || item.unidad_nombre}</td>
                          <td>{money(item.costo_unitario)}</td>
                          <td>{item.precio_venta == null ? "—" : money(item.precio_venta)}</td>
                          <td>{formatIva(item.iva_pct)}</td>
                          <td><span className={`servicios-status ${activo ? "is-active" : "is-inactive"}`}>{activo ? "ACTIVO" : "BAJA"}</span></td>
                          <td><div className="servicios-row-actions">
                            <button type="button" className="servicios-action-icon" title="Editar" aria-label="Editar" onClick={() => setInsumoModal({ open: true, item })}>
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button type="button" className="servicios-action-icon" title={activo ? "Dar de baja" : "Reactivar"} aria-label={activo ? "Dar de baja" : "Reactivar"} onClick={() => toggleInsumo(item)}>
                              <FontAwesomeIcon icon={activo ? faBan : faRotateLeft} />
                            </button>
                            <button type="button" className="servicios-action-icon is-danger" title="Eliminar" aria-label="Eliminar" onClick={() => setDeleteModal({ open: true, kind: "insumo", item })}>
                              <FontAwesomeIcon icon={faTrashCan} />
                            </button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "stock" && (
            <div className="servicios-card servicios-table-card">
              <div className="servicios-card-title"><div><h2>Stock</h2><span>{stockFiltrado.length} registro(s) · catálogo independiente de Insumos</span></div></div>
              <div className="servicios-table-wrap">
                <table>
                  <thead><tr><th>Stock</th><th>Categoría</th><th>Unidad</th><th>Cantidad</th><th>Costo</th><th>Estado</th><th className="servicios-actions-col">Acciones</th></tr></thead>
                  <tbody>
                    {stockFiltrado.length === 0 ? <tr><td colSpan="7" className="servicios-empty">NO HAY REGISTROS DE STOCK PARA LOS FILTROS ACTUALES.</td></tr> : stockFiltrado.map((item) => {
                      const activo = Number(item.activo) === 1;
                      return (
                        <tr key={item.id_stock} className={activo ? "" : "is-row-inactive"}>
                          <td><strong>{item.nombre}</strong><small>{item.codigo || "SIN CÓDIGO"}</small></td>
                          <td>{item.categoria_nombre || "SIN CATEGORÍA"}</td>
                          <td>{item.unidad_simbolo || item.unidad_nombre}</td>
                          <td><strong className="servicios-stock-value">{integer(item.stock_actual)}</strong></td>
                          <td>{money(item.costo_unitario)}</td>
                          <td><span className={`servicios-status ${activo ? "is-active" : "is-inactive"}`}>{activo ? "ACTIVO" : "BAJA"}</span></td>
                          <td><div className="servicios-row-actions">
                            <button type="button" className="servicios-action-icon" title="Editar" aria-label="Editar" onClick={() => setStockModal({ open: true, item })}>
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button type="button" className="servicios-action-icon" title={activo ? "Dar de baja" : "Reactivar"} aria-label={activo ? "Dar de baja" : "Reactivar"} onClick={() => toggleStock(item)}>
                              <FontAwesomeIcon icon={activo ? faBan : faRotateLeft} />
                            </button>
                            <button type="button" className="servicios-action-icon is-danger" title="Eliminar" aria-label="Eliminar" onClick={() => setDeleteModal({ open: true, kind: "stock", item })}>
                              <FontAwesomeIcon icon={faTrashCan} />
                            </button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <ModalServicio
        open={serviceModal.open}
        item={serviceModal.item}
        categorias={categoriasServicios}
        insumos={insumos}
        stock={stock}
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
