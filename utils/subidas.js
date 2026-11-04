// Subida de imágenes de las preguntas (multer)
//
// En tu computadora las imágenes se guardan en public/uploads/preguntas/, como siempre.
// En internet (NODE_ENV=production o IMAGENES_EN_BD=1) se guardan en la tabla "imagenes"
// de la base de datos, porque servidores como Render borran sus archivos al reiniciar.
// En los dos casos la dirección es la misma: /uploads/preguntas/<nombre>
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../config/db');

const CARPETA = path.join(__dirname, '..', 'public', 'uploads', 'preguntas');
const RUTA_PUBLICA = '/uploads/preguntas/';
const TIPOS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_MB = 2;
const EN_BD = process.env.IMAGENES_EN_BD === '1' || process.env.NODE_ENV === 'production';

if (!EN_BD) fs.mkdirSync(CARPETA, { recursive: true });

const nombreNuevo = (mimetype) => crypto.randomUUID() + TIPOS[mimetype];

const almacenamiento = EN_BD
  ? multer.memoryStorage()
  : multer.diskStorage({
    destination: CARPETA,
    filename: (req, archivo, cb) => cb(null, nombreNuevo(archivo.mimetype)),
  });

const subir = multer({
  storage: almacenamiento,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, archivo, cb) => {
    if (!TIPOS[archivo.mimetype]) req.archivoRechazado = true;
    cb(null, Boolean(TIPOS[archivo.mimetype]));
  },
}).single('imagen');

// ---- Tabla de imágenes (solo se usa en internet) ----
let tablaLista = null;
function asegurarTabla() {
  if (!tablaLista) {
    tablaLista = pool.query(`
      CREATE TABLE IF NOT EXISTS imagenes (
        nombre VARCHAR(64)  NOT NULL,
        tipo   VARCHAR(30)  NOT NULL,
        datos  MEDIUMBLOB   NOT NULL,
        fecha  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (nombre)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
      .catch((e) => { tablaLista = null; throw e; });
  }
  return tablaLista;
}

// Middleware: si la imagen falla, no detiene la petición; deja el error en req.errorSubida
function imagenPregunta(req, res, next) {
  subir(req, res, async (err) => {
    if (err) {
      req.errorSubida = err.code === 'LIMIT_FILE_SIZE'
        ? `La imagen pesa más de ${MAX_MB} MB.`
        : 'No se pudo subir la imagen.';
      delete req.file;
    } else if (req.archivoRechazado) {
      req.errorSubida = 'La imagen debe ser PNG, JPG, WEBP o GIF.';
    } else if (EN_BD && req.file) {
      try {
        const nombre = nombreNuevo(req.file.mimetype);
        await asegurarTabla();
        await pool.query('INSERT INTO imagenes (nombre, tipo, datos) VALUES (?, ?, ?)',
          [nombre, req.file.mimetype, req.file.buffer]);
        req.file.filename = nombre; // los controladores usan RUTA_PUBLICA + req.file.filename
        delete req.file.buffer;
      } catch (e) {
        console.error('No se pudo guardar la imagen en la base:', e.message);
        req.errorSubida = 'No se pudo subir la imagen.';
        delete req.file;
      }
    }
    next();
  });
}

function borrarImagen(rutaPublica) {
  if (!rutaPublica || !rutaPublica.startsWith(RUTA_PUBLICA)) return;
  const nombre = path.basename(rutaPublica);
  if (EN_BD) {
    asegurarTabla()
      .then(() => pool.query('DELETE FROM imagenes WHERE nombre = ?', [nombre]))
      .catch(() => {});
  } else {
    fs.rm(path.join(CARPETA, nombre), { force: true }, () => {});
  }
}

// Ruta GET /uploads/preguntas/:nombre para las imágenes guardadas en la base.
// (Las que están en la carpeta las entrega express.static antes de llegar aquí.)
async function servirImagen(req, res, next) {
  if (!EN_BD) return next();
  const nombre = path.basename(req.params.nombre || '');
  try {
    await asegurarTabla();
    const [filas] = await pool.query('SELECT tipo, datos FROM imagenes WHERE nombre = ? LIMIT 1', [nombre]);
    if (!filas[0]) return next();
    res.set({ 'Content-Type': filas[0].tipo, 'Cache-Control': 'public, max-age=604800, immutable' });
    res.send(filas[0].datos);
  } catch (e) {
    next(e);
  }
}

module.exports = { imagenPregunta, borrarImagen, servirImagen, RUTA_PUBLICA, MAX_MB };
