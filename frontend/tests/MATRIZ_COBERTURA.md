# Matriz de cobertura E2E

| Área | Cobertura automática incluida |
|---|---|
| Autenticación | Redirección protegida, login real, persistencia de sesión |
| Dashboard | Carga, backend correcto, errores JS/HTTP 5xx |
| Movimientos | Navegación y estabilidad del listado global |
| Stock | Alta, edición, búsqueda, stock exacto, eliminación permanente |
| Compras | Alta, edición de cantidad, detalle, eliminación y reversión de stock |
| NC compras | Aplicación parcial y resta exacta de stock; la compra queda por trazabilidad |
| Ventas | Alta, detalle, eliminación y reversión de stock |
| NC ventas | Aplicación interna parcial y reingreso exacto de stock |
| Presupuestos | Alta, eliminación, conversión a venta y bloqueo visual de reconversión |
| Otros ingresos | Nueva descripción, alta, edición y eliminación |
| Otros egresos | Nueva descripción, clasificación, alta, edición y eliminación |
| Recibos | Generación de cobro completo sobre deuda real |
| Órdenes de pago | Generación de pago completo sobre deuda real |
| Cuenta corriente | Lectura de clientes/proveedores y validación de estado posterior al pago |
| Facturación/Remitos | Carga, filtros y estabilidad; no emite comprobantes ARCA |
| IVA/Contabilidad | Carga y ausencia de errores críticos |
| Flujo de caja | Carga y ausencia de errores críticos |
| Cheques/eCheqs | Carga, búsqueda y estabilidad de las cuatro vistas |
| Análisis financiero | Carga y ausencia de errores críticos |
| Configuración | Vistas, apertura/cancelación de modales sensibles |
| Modales | No cierran con clic exterior y sí con Escape |
| Tienda Nube | Se saltea en CRUD por seguridad mediante parámetro existente del backend |

## No automatizado de forma destructiva

- Emisión fiscal real en ARCA.
- Conexión/desconexión de una tienda de Tienda Nube.
- Depósito o reactivación de cheques reales sin un cheque de prueba preconfigurado.
- Eliminación o modificación de usuarios administrativos reales.
- Casos que requieren dispositivos físicos, archivos firmados o servicios externos inestables.

La suite prioriza flujos críticos y repetibles. No representa una demostración matemática de ausencia total de bugs.
