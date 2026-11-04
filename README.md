# Software educativo de ejercitación tutorial

Proyecto de Graduación IEREQ01 · Profesorado en Informática Educativa · UPNFM CURNAC
Autor: Angel Luis Quiñonez Rivera

Esta versión cubre el **Sprint 1** (configuración inicial, inicio de sesión, roles y cuentas con
contraseña temporal), el **Sprint 2** (temas de estudio y su asignación a docentes), el **Sprint 3**
(gestión de exámenes de selección única), el **Sprint 4** (realizar tests con calificación automática
y retroalimentación inmediata), el **Sprint 5** (seguimiento del rendimiento) y la parte técnica del
**Sprint 6** (accesibilidad, seguridad, optimización y pruebas finales) del guion metodológico.

## Qué ya funciona

- Inicio de sesión con DNI y contraseña (con los logos de la UPNFM, la carrera y la Dirección).
- Cambio de contraseña obligatorio en el primer ingreso. Mientras no la cambie, no puede entrar a ninguna otra pantalla.
- La contraseña temporal vence a las 72 horas.
- Mi perfil para todos los roles: teléfono, correo y cambio de contraseña.
- Administrador: crear, editar, desactivar, eliminar docentes y restablecer su contraseña.
- Docente: lo mismo con sus estudiantes y con los padres o encargados (parentesco y estudiantes vinculados).
  Al crear un estudiante se puede inscribir en los temas del docente.
- Una cuenta con notas o con temas no se borra: se desactiva para no perder el historial.
- Si el docente desactiva una cuenta, esa persona pierde la sesión de inmediato.
- Inicio del docente, del estudiante y del padre con datos reales de la base.
- Diseño adaptado a celular (menú desplegable y tablas en forma de tarjetas).

### Sprint 2: temas de estudio

- El docente crea, edita, desactiva y elimina sus temas, con nombre, descripción y color.
- No puede tener dos temas con el mismo nombre.
- Un tema con tests no se puede eliminar; se desactiva, y sus estudiantes dejan de verlo.
- Inscribir estudiantes en cada tema: lista con casillas, filtro por nombre o DNI y seleccionar o quitar todos.
- Inscribir por DNI a un estudiante que ya tiene cuenta (por ejemplo, creada por otro docente).
- El administrador asigna un tema a otro docente desde la pantalla Docentes. Las inscripciones y los tests se conservan.
- Un docente no puede ver ni modificar los temas de otro docente.

### Sprint 3: exámenes

- El docente crea tests en uno de sus temas: nombre, instrucciones, duración, intentos, nota mínima,
  fechas de apertura y cierre, y si se muestran las respuestas correctas al terminar.
- Cada test nace como borrador. Se publica cuando tiene al menos una pregunta; también se puede archivar o volver a borrador.
- Preguntas con enunciado, 4 opciones, una sola correcta, puntos, retroalimentación e imagen opcional
  (PNG, JPG, WEBP o GIF de hasta 2 MB, con descripción obligatoria para lectores de pantalla).
- Botón "Guardar y agregar otra" para escribir varias preguntas seguidas.
- Lista de exámenes con pestañas por estado y filtro por tema.
- Cuando un test ya tiene intentos de estudiantes, sus preguntas quedan bloqueadas para no alterar las notas.
  Se puede duplicar para hacer una versión nueva. Eliminarlo lo archiva.
- Las imágenes se guardan en `public/uploads/preguntas/`.

### Sprint 4: realizar tests

- Pantalla previa con instrucciones, número de preguntas, tiempo, nota mínima e intentos usados.
- Al comenzar, las preguntas se barajan y ese orden se guarda en `respuestas_estudiante.posicion`.
  Cada estudiante y cada intento tienen un orden distinto.
- Cada respuesta se guarda en cuanto se elige la opción. Si se cae el internet o se cierra el navegador,
  al volver se continúa con las mismas preguntas en el mismo orden.
- Reloj con el tiempo restante. Al llegar a cero, el test se entrega solo con lo respondido.
  Si el estudiante no regresa, el intento se cierra la próxima vez que entra.
- Pantalla de revisión antes de entregar, que avisa si quedan preguntas sin responder.
- Calificación automática: puntos obtenidos sobre puntos totales, llevado a 100. Se compara con la nota mínima
  y se guarda si aprobó (`resultados_tests.aprobado`).
- Resultado con la nota, las correctas, el tiempo y, si el docente lo permite, cada respuesta con la correcta
  y la retroalimentación.
- Control de intentos: no deja pasar del máximo, ni comenzar un test cerrado, en borrador o de un tema donde no está inscrito.
- La respuesta correcta nunca se envía al navegador mientras se resuelve el test.

### Sprint 5: seguimiento del rendimiento

- **Docente, menú Rendimiento.** Resumen de cada test (cuántos lo presentaron, promedio y cuántos aprobaron)
  y lista de estudiantes ordenada de menor a mayor promedio, para ver primero a quien necesita apoyo.
- Al elegir un test: promedio del grupo, aprobados, tiempo promedio, porcentaje de aciertos de cada pregunta,
  aviso de las preguntas que menos de la mitad acertó y la respuesta incorrecta más elegida.
- Resultados por estudiante con su mejor nota, y botón para ver sus respuestas.
- Exportar los resultados de un test a un archivo CSV que se abre en Excel.
- Progreso de cada estudiante: gráfica de calificaciones en el tiempo, promedio por tema e historial de intentos.
- **Estudiante, menú Mi progreso.** Su promedio, tests completados y aprobados, mejor nota, gráfica,
  avance por tema e historial con enlace a cada resultado.
- **Padre o encargado.** Elige entre sus estudiantes vinculados y ve lo mismo que el estudiante en Mi progreso,
  más los tests pendientes. Solo consulta, y ve las respuestas únicamente si el docente lo permitió.
- Los promedios usan la mejor nota de cada test.

### Sprint 6: ajustes finales y optimización

- **Accesibilidad:** las 37 pantallas se revisaron con axe-core (normas WCAG 2.1, nivel AA) en computadora
  y en celular. Se corrigieron los contrastes de color (el verde pasó a `#23744A`) y se nombró la barra de avance del test.
  Resultado final: 0 problemas.
- **Seguridad:** encabezados de seguridad (Content-Security-Policy y otros), rechazo de formularios enviados
  desde otros sitios, bloqueo de 15 minutos tras 5 contraseñas incorrectas seguidas (por DNI, para no bloquear
  a todo un laboratorio) y frase secreta de sesión aleatoria si no se define `SESSION_SECRET`.
  Cuando el docente restablece la contraseña, la cuenta se desbloquea.
- **Optimización:** las páginas, el CSS y el JavaScript se envían comprimidos (el CSS pasa de 34 KB a 7 KB),
  los logos se redujeron de 612 KB a 36 KB y el navegador guarda los archivos 7 días.
- **Prueba de carga:** 35 estudiantes (una sección completa) iniciaron sesión, resolvieron un test de
  10 preguntas y lo entregaron al mismo tiempo, sin pausas entre respuestas: 1 540 peticiones, 0 errores,
  4.6 segundos en total, respuesta mediana de 68 ms. Con 100 estudiantes simultáneos: 4 400 peticiones,
  0 errores. Las 135 calificaciones se calcularon bien. (Medido en una computadora de 2 núcleos; en otra los
  tiempos pueden variar.)
- **Pruebas finales:** 192 verificaciones automáticas en el navegador, de los sprints 1 a 6, todas correctas.

La tarea 6.1 (mejoras basadas en pruebas de usabilidad) se hace con usuarios reales: usa la guía de prueba
de usabilidad que acompaña al proyecto.

## Lo que necesitas instalar

1. **XAMPP** (ya lo tienes), con MySQL encendido.
2. **Node.js** versión LTS, desde https://nodejs.org (versión 20 o más nueva).
3. **Visual Studio Code** (recomendado).

## Pasos para ponerlo a funcionar

1. **Base de datos.** En phpMyAdmin crea la base `proyectoedu` con el cotejamiento `utf8mb4_unicode_ci`
   (si ya la tienes, úsala). Haz clic en ella, abre **Importar** y sube `database/proyecto_final.sql`.
2. **Abre la carpeta del proyecto** en Visual Studio Code (Archivo > Abrir carpeta).
3. **Abre la terminal** (Terminal > Nueva terminal) y escribe:
   ```
   npm install
   ```
   Si Windows muestra "la ejecución de scripts está deshabilitada", escribe `npm.cmd install` en su lugar
   (y después `npm.cmd start`). Esto descarga Express, EJS, bcrypt y los demás paquetes. Solo se hace una vez.
4. **Si tu base tiene otro nombre** o tu usuario `root` de MySQL tiene contraseña, cámbialo en `config/db.js`.
5. **Inicia el servidor:**
   ```
   npm start
   ```
   Debe aparecer `Servidor listo en http://localhost:3000`. Para detenerlo, presiona `Ctrl + C`.
6. **Abre el navegador** en http://localhost:3000

### Primer ingreso

| Usuario | DNI | Contraseña temporal |
|---|---|---|
| Administrador | `0000000000000` | `Admin2026` |

El sistema te pedirá cambiarla. Después:

1. Como administrador, crea un docente. El sistema muestra su contraseña temporal **una sola vez**: anótala.
2. Cierra sesión y entra con el DNI del docente y esa contraseña. Cámbiala.
3. Como docente, crea estudiantes y padres o encargados.

### Actualizar desde una versión anterior

Copia el contenido de la carpeta nueva sobre tu carpeta del proyecto y acepta reemplazar los archivos.
No borres `node_modules`. Si la versión nueva agrega paquetes (el Sprint 3 agrega `multer` y el Sprint 6 `compression`),
vuelve a ejecutar `npm install` (o `npm.cmd install`).
Detén el servidor con `Ctrl + C` y vuelve a iniciarlo con `npm start` (o `npm.cmd start`).

### Probar en un celular

El celular debe estar en la misma red wifi que la computadora. En la computadora abre una terminal,
escribe `ipconfig` y busca la "Dirección IPv4" (por ejemplo `192.168.1.15`). En el celular abre
`http://192.168.1.15:3000`. Si no carga, permite Node.js en el Firewall de Windows.

## Estructura del proyecto (patrón MVC del guion)

| Carpeta o archivo | Qué contiene | Parte del MVC |
|---|---|---|
| `app.js` | Archivo principal: configura Express, EJS, sesiones y rutas | — |
| `config/db.js` | Conexión a MySQL | Modelo |
| `controllers/` | Lógica de cada pantalla y consultas a la base | Controlador y modelo |
| `routes/` | Direcciones de cada rol (`/admin`, `/docente`, `/estudiante`, `/tutor`) | Controlador |
| `middleware/auth.js` | Revisa la sesión, el rol y el cambio de clave obligatorio | Middleware |
| `views/` | Pantallas EJS. `partials/` tiene el menú, el encabezado y los logos | Vista |
| `public/` | CSS, JavaScript del navegador (jQuery) e imágenes | Vista |
| `utils/` | Contraseñas temporales, fechas, menús e íconos | Apoyo |
| `database/proyecto_final.sql` | Script de la base de datos | Modelo |

## Diferencias con la lista de herramientas del guion

- Se usa `mysql2` en lugar de `mysql`: funciona igual, pero es compatible con MySQL 8 y maneja bien acentos y ñ.
- Se usa Express 5, que captura automáticamente los errores de las consultas a la base.
- `body-parser`, `path`, `express-session`, `bcrypt`, `ejs` y jQuery se usan como pide el guion.
- Se agrega `multer` para subir las imágenes de las preguntas y `compression` para que las páginas pesen menos.

## Antes de publicarlo en un servidor real

- Define la variable de entorno `SESSION_SECRET` con una frase larga. Si no la defines, el sistema genera una
  al arrancar y todas las sesiones se cierran cada vez que reinicias el servidor.
- Crea un usuario de MySQL con contraseña para la aplicación en lugar de `root` sin contraseña.

## Créditos de terceros

- Íconos: Material Design Icons de Google (licencia Apache 2.0).
- jQuery 3.7.1 (licencia MIT).
