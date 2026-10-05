# Matriz de paridad

Origen: `main`, commit `b597590` y su archivo `index.html`. La rama `developer` ya aportaba cuentas por pagar y fue integrada en ese commit. La migración incluye ese módulo.

| Función original                                | Implementación moderna                  | Verificación                                     |
| ----------------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| Balance de ingresos menos egresos               | Dominio `resumen`, `bankBalance`        | Casos de saldos positivos y negativos            |
| Filtros y orden descendente por fecha           | `filtrarMovimientos`                    | Tipo, banco, mes, persona                        |
| Categorías/personas y nombres personalizados    | Esquemas y comandos de catálogo         | Duplicados, importación                          |
| Bancos y borrado de movimientos del banco       | `FinanzasService`                       | Borrado en cascada y conflicto                   |
| Préstamos sin interés/simple/fijo               | `calcLoanSchedule` copiado del original | 216 comparaciones exactas                        |
| Redondeo y capital residual final               | Misma función original                  | Importes pequeños y no divisibles                |
| Fechas por frecuencia en días                   | Misma función original                  | Fin de mes y año bisiesto                        |
| Mantener cuotas pagadas al editar               | Caso de uso `save loans`                | Recalcular conservando `paid`                    |
| Cuotas cobradas independientes del banco        | `toggleCuota`                           | No agrega movimientos                            |
| Pago marcado asigna estimado si falta real      | `togglePago`                            | Primera marca y reversión                        |
| Pago marcado no crea egreso                     | `togglePago`                            | Cantidad de movimientos intacta                  |
| Totales de pagos con real/estimado              | `resumen`                               | Reglas y recorrido UI                            |
| Préstamos activos/completados y detalle         | `Prestamos.tsx`                         | Cronograma en recorrido UI                       |
| JSON de respaldo                                | `EstadoSchema`, configuración React     | Formato heredado y rechazo de inválidos          |
| Contraseña + TOTP y bloqueo                     | Servicio de autenticación NestJS        | Vector RFC y API HTTP real                       |
| Bloquear sesión                                 | Logout y guard                          | Cookie invalidada                                |
| Ocultar montos/menú                             | Estado local React                      | Interfaz escritorio/móvil                        |
| Gráficos por mes/categoría/persona              | Dashboard React/Recharts                | Capturas y ausencia de errores JS                |
| Google Sheets, mismas hojas/columnas originales | `SheetsAdapter`                         | Contratos simulados, autorización real pendiente |

## Cambios técnicos deliberados

- Los datos pasan de localStorage a SQLite mediante NestJS. La importación del JSON anterior conserva los datos y nombres. localStorage anterior solo se lee con una acción de importación.
- La cuenta se configura nuevamente en el servidor. El hash y secreto anteriores del navegador no se copian a la API.
- La nueva base comienza vacía para que no se mezclen movimientos de demostración con datos reales.
- Se validan IDs, fechas, números finitos, bancos de referencia, cronogramas y límites de cuotas. Un respaldo inconsistente se rechaza completo, sin escritura parcial.
- Google recibe textos mediante `RAW`; los tokens OAuth permanecen en memoria. Se incorporan pagos y catálogos a la sincronización, que antes no los incluía.
- El backend requiere ejecutarse; el despliegue estático de un único HTML se conserva únicamente como versión anterior.

## Pruebas reproducibles

`npm test` valida el dominio y levanta un servidor NestJS temporal con una base independiente. Comprueba 2FA, cookie HttpOnly, acceso protegido, CRUD, revisiones antiguas, importaciones inválidas, origen/cabecera, logout, bloqueo y persistencia. No usa tus datos financieros ni credenciales reales.

`npm run test:e2e` levanta frontend/backend compilados con otra base temporal y usa Chromium. Recorre configuración TOTP, banco, movimiento, edición, pago, cuotas, catálogo, exportación, cierre y reapertura de sesión. Las capturas quedan en `test-results` y el workflow las adjunta como artefactos.

Google OAuth y sus APIs se verifican con respuestas simuladas. Una prueba real necesita que autorices tu cliente de Google; no se afirma que una hoja real haya sido sincronizada.
