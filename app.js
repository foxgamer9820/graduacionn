// Software educativo de ejercitación tutorial - archivo principal
const path = require('path');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const compression = require('compression');
const fs = require('fs');
const vistas = require('./utils/vistas');
const { requiereSesion, exigirCambioClave } = require('./middleware/auth');
const seguridad = require('./middleware/seguridad');
const MySQLSessionStore = require('./config/sesionStore');
const { servirImagen } = require('./utils/subidas');

const app = express();
const PUERTO = process.env.PORT || 3000;
const EN_INTERNET = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');

// Render (y otros servicios) pasan las visitas por un intermediario con https.
// Esto permite saber la dirección real del visitante y usar cookies seguras.
app.set('trust proxy', 1);

// Seguridad y compresión (Sprint 6): las páginas pesan menos en conexiones lentas
app.use(seguridad.encabezados);
app.use(compression());

// Motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Archivos públicos: CSS, JavaScript del navegador e imágenes.
// El navegador los guarda 7 días; ?v= cambia cuando cambian el CSS o el JavaScript.
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
// Imágenes de preguntas guardadas en la base de datos (cuando corre en internet)
app.get('/uploads/preguntas/:nombre', servirImagen);
const VERSION = ['css/estilos.css', 'js/app.js', 'js/test.js']
  .map((f) => fs.statSync(path.join(__dirname, 'public', f)).mtimeMs).join('-')
  .split('').reduce((h, c) => ((h * 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);

// Lee los datos de los formularios
app.use(bodyParser.urlencoded({ extended: false, limit: '200kb' }));

// Sesiones de usuario, guardadas en la tabla "sesiones" de MySQL
app.use(session({
  name: 'sesion_tests',
  store: new MySQLSessionStore(),
  secret: seguridad.secretoSesion(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: EN_INTERNET, // en internet la cookie solo viaja por https
    maxAge: 1000 * 60 * 60 * 2, // 2 horas
  },
}));

// Datos disponibles en todas las vistas
app.use((req, res, next) => {
  Object.assign(res.locals, vistas);
  res.locals.usuario = req.session.usuario || null;
  res.locals.rutaActual = req.path;
  res.locals.v = VERSION;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Rechaza formularios enviados desde otros sitios
app.use(seguridad.mismoOrigen);

// Rutas públicas (inicio de sesión)
app.use('/', require('./routes/auth'));

// A partir de aquí todo exige sesión y contraseña definitiva
app.use(requiereSesion, exigirCambioClave);
app.use('/', require('./routes/cuenta'));
app.use('/admin', require('./routes/admin'));
app.use('/docente', require('./routes/docente'));
app.use('/estudiante', require('./routes/estudiante'));
app.use('/tutor', require('./routes/tutor'));

// Página no encontrada
app.use((req, res) => {
  res.status(404).render('error', { titulo: 'Página no encontrada', mensaje: 'La dirección que buscas no existe.' });
});

// Errores inesperados
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { titulo: 'Ocurrió un error', mensaje: 'Algo salió mal. Revisa la consola del servidor.' });
});

app.listen(PUERTO, () => {
  console.log(`Servidor listo en http://localhost:${PUERTO}`);
});
