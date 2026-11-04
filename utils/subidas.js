// Subida de imágenes de las preguntas (multer)
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const CARPETA = path.join(__dirname, '..', 'public', 'uploads', 'preguntas');
const RUTA_PUBLICA = '/uploads/preguntas/';
const TIPOS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const MAX_MB = 2;

fs.mkdirSync(CARPETA, { recursive: true });

const subir = multer({
  storage: multer.diskStorage({
    destination: CARPETA,
    filename: (req, archivo, cb) => cb(null, crypto.randomUUID() + TIPOS[archivo.mimetype]),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, archivo, cb) => {
    if (!TIPOS[archivo.mimetype]) req.archivoRechazado = true;
    cb(null, Boolean(TIPOS[archivo.mimetype]));
  },
}).single('imagen');

// Middleware: si la imagen falla, no detiene la petición; deja el error en req.errorSubida
function imagenPregunta(req, res, next) {
  subir(req, res, (err) => {
    if (err) {
      req.errorSubida = err.code === 'LIMIT_FILE_SIZE'
        ? `La imagen pesa más de ${MAX_MB} MB.`
        : 'No se pudo subir la imagen.';
    } else if (req.archivoRechazado) {
      req.errorSubida = 'La imagen debe ser PNG, JPG, WEBP o GIF.';
    }
    next();
  });
}

function borrarImagen(rutaPublica) {
  if (!rutaPublica || !rutaPublica.startsWith(RUTA_PUBLICA)) return;
  const archivo = path.join(CARPETA, path.basename(rutaPublica));
  fs.rm(archivo, { force: true }, () => {});
}

module.exports = { imagenPregunta, borrarImagen, RUTA_PUBLICA, MAX_MB };
