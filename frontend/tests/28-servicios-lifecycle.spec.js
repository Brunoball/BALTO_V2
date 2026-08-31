import { test, expect } from './support/test.js';
import { authenticatedApi, expectApiSuccess } from './support/api.js';
import { ENV, assertSafeMutationConfiguration } from './support/env.js';
import { uniqueName } from './support/data.js';

async function ensureAuthenticatedOrigin(page) {
  // La fixture restaura la sesión mediante storageState, pero una Page nueva
  // comienza en about:blank. authenticatedApi usa page.evaluate(localStorage),
  // así que primero debemos cargar una URL del frontend.
  if (!/^https?:/i.test(page.url())) {
    await page.goto('/panel/servicios', { waitUntil: 'domcontentloaded' });
  }
}

test.describe('@servicios @crud composición Servicios + Insumos + Stock', () => {
  test.skip(!ENV.allowMutations, 'Requiere PW_ALLOW_MUTATIONS=1.');

  test.beforeAll(() => {
    assertSafeMutationConfiguration();
  });

  test('Servicios, Insumos y Stock tienen CRUD independiente', async ({ page }) => {
    await ensureAuthenticatedOrigin(page);
    const suffix = uniqueName('SERVV5', 38);
    const ids = {
      categoriaServicio: 0,
      categoriaInsumo: 0,
      categoriaStock: 0,
      servicio: 0,
      insumo: 0,
      stock: 0,
    };

    const post = async (action, body) => {
      const response = await authenticatedApi(page, action, { method: 'POST', body });
      return expectApiSuccess(response, `Falló ${action}`);
    };

    try {
      const categoriaServicio = await post('servicios_categoria_crear', {
        nombre: `${suffix}-CAT-SERV`,
        descripcion: 'CATEGORIA SERVICIO E2E',
      });
      ids.categoriaServicio = Number(categoriaServicio.id_servicio_categoria || 0);

      // Mismo nombre permitido entre Insumos y Stock porque son catálogos distintos.
      const categoriaCompartida = `${suffix}-CAT-MATERIAL`;
      const categoriaInsumo = await post('servicios_insumo_categoria_crear', {
        nombre: categoriaCompartida,
        descripcion: 'CATEGORIA INSUMO E2E',
      });
      ids.categoriaInsumo = Number(categoriaInsumo.id_categoria || 0);

      const categoriaStock = await post('servicios_stock_categoria_crear', {
        nombre: categoriaCompartida,
        descripcion: 'CATEGORIA STOCK E2E',
      });
      ids.categoriaStock = Number(categoriaStock.id_stock_categoria || 0);

      expect(ids.categoriaServicio).toBeGreaterThan(0);
      expect(ids.categoriaInsumo).toBeGreaterThan(0);
      expect(ids.categoriaStock).toBeGreaterThan(0);

      const unidadesRes = await authenticatedApi(page, 'servicios_unidades_listar');
      const unidades = expectApiSuccess(unidadesRes).unidades || [];
      const unidad = unidades.find((u) => String(u.codigo || '').toUpperCase() === 'UN') || unidades[0];
      expect(Number(unidad?.id_unidad || 0)).toBeGreaterThan(0);

      const servicioCreado = await post('servicios_servicio_crear', {
        codigo: `${suffix}-S`.slice(0, 60),
        nombre: `${suffix} SERVICIO`,
        id_servicio_categoria: ids.categoriaServicio,
        descripcion: 'SERVICIO E2E',
        costo_base: 100,
        precio_venta: 250,
        iva_pct: 21,
      });
      ids.servicio = Number(servicioCreado.id_servicio || 0);

      const insumoCreado = await post('servicios_insumo_crear', {
        codigo: `${suffix}-I`.slice(0, 60),
        nombre: `${suffix} TORNILLO INSUMO`,
        id_categoria: ids.categoriaInsumo,
        id_unidad: Number(unidad.id_unidad),
        descripcion: 'INSUMO INDEPENDIENTE',
        costo_unitario: 50,
        precio_venta: 90,
        iva_pct: 21,
      });
      ids.insumo = Number(insumoCreado.id_insumo || 0);

      const stockCreado = await post('servicios_stock_crear', {
        codigo: `${suffix}-ST`.slice(0, 60),
        nombre: `${suffix} TORNILLO STOCK`,
        id_categoria: ids.categoriaStock,
        id_unidad: Number(unidad.id_unidad),
        descripcion: 'STOCK INDEPENDIENTE',
        stock_actual: 7,
        costo_unitario: 45,
      });
      ids.stock = Number(stockCreado.id_stock || 0);

      expect(ids.servicio).toBeGreaterThan(0);
      expect(ids.insumo).toBeGreaterThan(0);
      expect(ids.stock).toBeGreaterThan(0);

      await post('servicios_composicion_guardar', {
        id_servicio: ids.servicio,
        composicion: {
          insumos: [
            { id_insumo: ids.insumo, cantidad_requerida: 2, merma_pct: 0, obligatorio: 1 },
          ],
          stock: [
            { id_stock: ids.stock, cantidad_requerida: 5 },
          ],
        },
      });

      const servicioConComposicionRes = await authenticatedApi(page, 'servicios_servicio_obtener', {
        query: { id_servicio: ids.servicio },
      });
      const servicioConComposicion = expectApiSuccess(servicioConComposicionRes).servicio;
      expect(servicioConComposicion?.insumos || []).toHaveLength(1);
      expect(servicioConComposicion?.productos_stock || []).toHaveLength(1);
      expect(Number(servicioConComposicion?.productos_stock?.[0]?.cantidad_requerida || 0)).toBe(5);

      // Editar Insumo no modifica Stock.
      await post('servicios_insumo_actualizar', {
        id_insumo: ids.insumo,
        codigo: `${suffix}-I`.slice(0, 60),
        nombre: `${suffix} INSUMO EDITADO`,
        id_categoria: ids.categoriaInsumo,
        id_unidad: Number(unidad.id_unidad),
        descripcion: 'INSUMO EDITADO',
        costo_unitario: 60,
        precio_venta: 95,
        iva_pct: 21,
      });

      let stockRes = await authenticatedApi(page, 'servicios_stock_listar', {
        query: { activo: 'todos', buscar: `${suffix} TORNILLO STOCK`, limit: 20 },
      });
      let stockRows = expectApiSuccess(stockRes).stock || [];
      let stockRow = stockRows.find((item) => Number(item.id_stock) === ids.stock);
      expect(Number(stockRow?.stock_actual || 0)).toBe(7);
      expect(stockRow?.nombre).toContain('TORNILLO STOCK');

      // Editar Stock no modifica Insumo.
      await post('servicios_stock_actualizar', {
        id_stock: ids.stock,
        codigo: `${suffix}-ST`.slice(0, 60),
        nombre: `${suffix} STOCK EDITADO`,
        id_categoria: ids.categoriaStock,
        id_unidad: Number(unidad.id_unidad),
        descripcion: 'STOCK EDITADO',
        stock_actual: 13,
        costo_unitario: 44,
      });

      const insumosRes = await authenticatedApi(page, 'servicios_insumos_listar', {
        query: { activo: 'todos', buscar: `${suffix} INSUMO EDITADO`, limit: 20 },
      });
      const insumos = expectApiSuccess(insumosRes).insumos || [];
      const insumo = insumos.find((item) => Number(item.id_insumo) === ids.insumo);
      expect(insumo?.nombre).toContain('INSUMO EDITADO');
      expect(Number(insumo?.costo_unitario || 0)).toBe(60);

      await post('servicios_insumo_dar_baja', { id_insumo: ids.insumo });
      await post('servicios_insumo_reactivar', { id_insumo: ids.insumo });
      await post('servicios_stock_dar_baja', { id_stock: ids.stock });
      await post('servicios_stock_reactivar', { id_stock: ids.stock });

      // Eliminar Stock no elimina ni modifica Insumo y limpia sólo su relación con el servicio.
      await post('servicios_stock_eliminar', { id_stock: ids.stock });
      ids.stock = 0;

      const insumoDespuesStock = await authenticatedApi(page, 'servicios_insumo_obtener', {
        query: { id_insumo: ids.insumo },
      });
      expect(expectApiSuccess(insumoDespuesStock).insumo?.nombre).toContain('INSUMO EDITADO');

      const servicioDespuesStockRes = await authenticatedApi(page, 'servicios_servicio_obtener', {
        query: { id_servicio: ids.servicio },
      });
      const servicioDespuesStock = expectApiSuccess(servicioDespuesStockRes).servicio;
      expect(servicioDespuesStock?.productos_stock || []).toHaveLength(0);
      expect(servicioDespuesStock?.insumos || []).toHaveLength(1);

      // Eliminar Insumo limpia su composición, pero no el Servicio.
      await post('servicios_insumo_eliminar', { id_insumo: ids.insumo });
      ids.insumo = 0;

      const servicioDespuesInsumo = await authenticatedApi(page, 'servicios_servicio_obtener', {
        query: { id_servicio: ids.servicio },
      });
      const servicio = expectApiSuccess(servicioDespuesInsumo).servicio;
      expect(Number(servicio?.id_servicio || 0)).toBe(ids.servicio);
      expect(Array.isArray(servicio?.receta) ? servicio.receta.length : 0).toBe(0);
      expect(Array.isArray(servicio?.productos_stock) ? servicio.productos_stock.length : 0).toBe(0);

      // Borrar categoría de Insumos no toca categoría de Stock, y viceversa.
      await post('servicios_insumo_categoria_eliminar', { id_categoria: ids.categoriaInsumo });
      ids.categoriaInsumo = 0;

      const stockCats = await authenticatedApi(page, 'servicios_stock_categorias_listar', {
        query: { activo: 'todos' },
      });
      expect((expectApiSuccess(stockCats).categorias || []).some((c) => Number(c.id_stock_categoria) === ids.categoriaStock)).toBe(true);

      await post('servicios_stock_categoria_eliminar', { id_stock_categoria: ids.categoriaStock });
      ids.categoriaStock = 0;

      await post('servicios_servicio_eliminar', { id_servicio: ids.servicio });
      ids.servicio = 0;
      await post('servicios_categoria_eliminar', { id_servicio_categoria: ids.categoriaServicio });
      ids.categoriaServicio = 0;
    } finally {
      if (ids.stock) await post('servicios_stock_eliminar', { id_stock: ids.stock }).catch(() => {});
      if (ids.insumo) await post('servicios_insumo_eliminar', { id_insumo: ids.insumo }).catch(() => {});
      if (ids.servicio) await post('servicios_servicio_eliminar', { id_servicio: ids.servicio }).catch(() => {});
      if (ids.categoriaStock) await post('servicios_stock_categoria_eliminar', { id_stock_categoria: ids.categoriaStock }).catch(() => {});
      if (ids.categoriaInsumo) await post('servicios_insumo_categoria_eliminar', { id_categoria: ids.categoriaInsumo }).catch(() => {});
      if (ids.categoriaServicio) await post('servicios_categoria_eliminar', { id_servicio_categoria: ids.categoriaServicio }).catch(() => {});
    }
  });
});
