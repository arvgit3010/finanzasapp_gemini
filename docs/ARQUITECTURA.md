# Arquitectura y mantenimiento

## Antes y después

El original combina HTML/CSS, acceso directo al DOM, datos globales, cálculos, credenciales, localStorage y Sheets dentro de `index.html`. La nueva versión distribuye esas responsabilidades entre React, un paquete de dominio y NestJS. El original se conserva para comparación en `docs/original.html`.

React representa el estado que devuelve la API. Los componentes no escriben SQLite ni contienen consultas SQL. NestJS recibe un comando validado, ejecuta el caso de uso y guarda mediante el contrato `RepositorioFinanzas`. El dominio financiero es compartido entre frontend y backend para que la vista previa y el cálculo definitivo de los préstamos coincidan.

Los controladores delegan la lógica a proveedores registrados en el módulo NestJS, siguiendo [la documentación de NestJS](https://docs.nestjs.com/providers). La interfaz usa componentes React y una raíz creada con [createRoot](https://react.dev/reference/react-dom/client/createRoot).

## Secuencia: registrar un movimiento

1. `Editor.tsx` captura tipo, descripción, monto, fecha, banco, categoría y persona.
2. `App.tsx` solicita un comando `save`, entidad `movs`, con los datos.
3. `useFinanzas.ts` adjunta la revisión leída y controla operaciones en curso.
4. `api.ts` envía el comando con cookie de sesión y cabecera de la aplicación.
5. El middleware verifica origen/cabecera. `SessionGuard` verifica la sesión.
6. `FinanzasController` delega en `FinanzasService`.
7. El servicio valida el comando, comprueba que exista el banco y valida el estado resultante.
8. `SqliteRepository` actualiza el documento financiero y la revisión en una sola sentencia SQL condicional.
9. React recibe el estado actualizado y representa tablas, saldos y gráficos.
10. Si Google está conectado, el adaptador programa el envío a Sheets.

El comando no alcanza el repositorio si la validación falla. Una revisión antigua recibe HTTP 409; React recarga el estado y el formulario mantiene los datos editados para revisarlos antes de reintentar.

## API

| Método y ruta                 | Autenticación         | Uso                                           |
| ----------------------------- | --------------------- | --------------------------------------------- |
| GET `/api/health`             | Pública               | Estado del servicio                           |
| GET `/api/auth/status`        | Pública               | Saber si existe la cuenta                     |
| POST `/api/auth/prepare`      | Configuración inicial | Validar contraseña y generar desafío/QR       |
| POST `/api/auth/setup`        | Desafío y TOTP        | Confirmar el autenticador y crear la cuenta   |
| POST `/api/auth/login`        | Contraseña y TOTP     | Crear cookie de sesión                        |
| POST `/api/auth/logout`       | Cookie                | Invalidar la sesión                           |
| GET `/api/finanzas`           | Sesión                | Estado financiero y revisión                  |
| POST `/api/finanzas/comandos` | Sesión                | Ejecutar un comando y devolver nueva revisión |

Ejemplo de cuerpo del comando:

```json
{
  "revision": 4,
  "command": {
    "action": "save",
    "entity": "movs",
    "data": {
      "type": "ingreso",
      "desc": "Salario",
      "amount": 4500,
      "bankId": 1,
      "date": "2026-10-01",
      "cat": "Sueldo",
      "person": "Yo"
    }
  }
}
```

Las acciones disponibles son `save`, `delete`, `togglePago`, `toggleCuota`, `catalogo` e `import`. `save` sin ID crea; con ID actualiza. Los nombres físicos del respaldo anterior (`banks`, `movs`, `loans`, `pagos`, `categories`, `personas`) se conservan para compatibilidad.

## Persistencia

SQLite usa dos tablas: `estado` para el documento JSON completo y su revisión; `seguridad` para la configuración personal. La sentencia condicional sobre la revisión evita sobrescrituras. Se habilitan WAL y tiempo de espera para bloqueo. Este diseño resulta adecuado para el uso personal del original y mantiene el formato de importación. Una versión multiusuario requeriría separar datos por propietario y adaptar el contrato del repositorio.

La ruta se configura mediante `DATABASE_PATH`. Copiar `.env.example` a `.env` en la raíz hace que los scripts API carguen las variables automáticamente. Los archivos `.env`, SQLite y `data/` quedan fuera de Git.

Para una copia de seguridad de la base completa, detén el proceso y copia `finanzapp.sqlite`; si copias con el proceso activo debes usar una copia consistente de SQLite, considerando WAL. El respaldo JSON contiene datos financieros, no contraseña ni secreto TOTP. No existe restablecimiento de contraseña por correo: conserva la clave del autenticador y un respaldo protegido del archivo SQLite.

## Autenticación

La contraseña se guarda como derivación scrypt con sal aleatoria. El código TOTP usa HMAC-SHA1 y una ventana de ±30 segundos, compatible con el original. Cinco fallos bloquean nuevos intentos durante cinco minutos. El contador queda en SQLite y no se reinicia al recargar la página. La sesión usa un identificador aleatorio en cookie HttpOnly/SameSite=Strict y caduca a las ocho horas.

Los desafíos iniciales duran diez minutos y permiten cinco intentos. La creación de la cuenta usa una inserción condicional para evitar configuraciones concurrentes. La aplicación abre una sola cuenta personal; la primera configuración debe realizarse antes de abrir el servicio a otros equipos.

## Agregar una funcionalidad

Ejemplo: incorporar una referencia de pago.

1. Agrega el campo opcional con valor por defecto en `PagoSchema`, para aceptar respaldos antiguos.
2. Agrega el campo al formulario `Editor` y muéstralo en la tabla de pagos de `App`.
3. Si introduce una regla, aplícala en `FinanzasService` o una función de dominio.
4. Actualiza `SheetsAdapter` para exportar/importar el campo sin alterar columnas heredadas.
5. Agrega una prueba que compruebe la regla y la compatibilidad de respaldos.
6. Ejecuta `npm run check` y revisa el PR.

No se modifica `SqliteRepository` para agregar un atributo financiero: el repositorio guarda un estado validado. Para cambiar a PostgreSQL se implementa otro adaptador de `RepositorioFinanzas` y se cambia su registro en el módulo.

## Operación

`npm run dev` inicia ambos procesos; reinicia la API después de modificar su código fuente (el comando compila al arrancar). `npm run build` genera los artefactos; `npm start` sirve la API y el frontend compilado. La sincronización con Sheets es un adaptador del navegador y requiere conexión a Internet; la API personal puede funcionar en el equipo sin usar Sheets.
