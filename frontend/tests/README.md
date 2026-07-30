# Testing automático de Balto con Playwright

## Qué cubre

La suite combina pruebas de interfaz, llamadas reales del frontend local al backend de Hostinger y verificaciones del resultado visible.

- Login y protección de rutas.
- Navegación de todos los módulos.
- Stock: alta, edición y eliminación de un producto sin movimientos.
- Compras: alta, edición de cantidad, detalle, eliminación con reversión y nota de crédito de proveedor.
- Ventas: alta, detalle, eliminación con reversión y nota de crédito interna con reingreso de stock.
- Presupuestos: alta, eliminación, conversión a venta y prueba concurrente real desde dos pestañas para impedir doble venta/stock.
- Otros ingresos y egresos: alta de descripción, creación, edición y eliminación.
- Cuenta corriente: creación de deuda, recibo y orden de pago.
- Flujo de caja, cuentas corrientes, IVA, análisis, cheques y configuración: carga y estabilidad.
- Detección de errores JavaScript, respuestas HTTP 5xx y peticiones fallidas.
- Verificación de que un clic fuera no cierre los modales.

## Seguridad

Las operaciones mutables se ejecutan una sola vez en Chromium, con `workers: 1` y sin reintentos automáticos. Esto evita duplicar movimientos.

La configuración bloquea por defecto las pruebas mutables cuando `PW_API_URL` apunta a `app.balto.com.ar`. No habilites `PW_ALLOW_PRODUCTION=1` salvo que estés completamente seguro.

Los tests no facturan en ARCA ni presionan `Facturar`. Además, `PW_SKIP_TIENDA_NUBE=1` agrega el parámetro de exclusión que ya reconoce el backend, por lo que los CRUD modifican stock real de Balto sin crear/editar productos ni jobs remotos de Tienda Nube.

## Instalación

Extraé el ZIP en la raíz del frontend. Deben quedar `playwright.config.js`, `tests/` y `scripts/` junto a `package.json`.

Después de extraer, prepará el `.gitignore` y validá que Playwright vea la suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\preparar-suite.ps1
```

Playwright ya está instalado. Si cambiás de computadora:

```powershell
npm install
npx playwright install chromium firefox webkit
```

## Comandos

Prueba rápida sin recorrer todos los CRUD:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-smoke.ps1
```

Prueba completa con acciones reales:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-completo.ps1
```

Prueba completa viendo el navegador:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-completo-visible.ps1
```

Barrido de navegación en Chromium, Firefox y WebKit, sin repetir los CRUD:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-cross-browser.ps1
```

Interfaz visual de Playwright:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-ui.ps1
```

Reporte de la última ejecución:

```powershell
npx playwright show-report
```

## Datos generados

Cada ejecución crea nombres con prefijo `PW-` y un identificador único. Esto permite encontrarlos y distinguirlos de la información cargada manualmente.

Las operaciones relacionadas con movimientos se conservan por trazabilidad. El producto usado exclusivamente para probar el CRUD de Stock sí se elimina al finalizar su prueba.

## Requisitos del tenant de testing

Debe existir al menos:

- un cliente activo;
- un proveedor activo;
- un tipo de venta de cuenta corriente;
- un medio de pago no asociado a cheque;
- clasificaciones para otros egresos.

Si alguno falta, la prueba correspondiente falla indicando el requisito ausente. Esto también sirve para detectar una configuración incompleta del tenant.

## Mantenimiento

Cuando cambie un texto, título o estructura de modal, ajustá primero los helpers de `tests/support/`. Los archivos de cada módulo deberían contener solamente el recorrido específico del negocio.

Ninguna suite E2E garantiza por sí sola ausencia total de bugs. Esta cobertura debe mantenerse junto con pruebas del backend y pruebas manuales controladas de ARCA y Tienda Nube.

## Nota sobre el frontend ya levantado

Si `npm start` ya estaba ejecutándose antes del test, Playwright reutiliza ese servidor. Para asegurar que tome otro `PW_API_URL`, cerrá el servidor anterior y dejá que Playwright lo inicie automáticamente.
