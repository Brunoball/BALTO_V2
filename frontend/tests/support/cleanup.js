/**
 * Helper de limpieza tolerante a errores HTTP 500/404 para entorno E2E.
 */
export async function runCleanupWithPage(page, request) {
  try {
    const response = await request.post('/api/testing/cleanup', {
      timeout: 5000,
      failOnStatusCode: false
    });

    if (response.status() === 200) {
      console.log('Limpieza automática de testing completada con éxito.');
    } else {
      console.warn(`Limpieza con aviso: Servidor devolvió status ${response.status()}`);
    }
  } catch (err) {
    console.warn('No se pudo conectar al endpoint de limpieza de prueba:', err.message);
  }
}
