// Sprint 6: protecciones de seguridad
const crypto = require('crypto');

// Encabezados que le dicen al navegador qué puede cargar la página
function encabezados(req, res, next) {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
}

// Rechaza formularios enviados desde otro sitio web (protección CSRF junto con la cookie SameSite)
function mismoOrigen(req, res, next) {
  if (req.method !== 'POST') return next();
  const origen = req.get('origin') || req.get('referer');
  if (!origen) return next();
  try {
    if (new URL(origen).host === req.get('host')) return next();
  } catch (e) { /* origen inválido */ }
  res.status(403).render('error', { titulo: 'Solicitud rechazada', mensaje: 'El formulario no se envió desde esta aplicación.' });
}

// Bloquea una cuenta 15 minutos después de 5 contraseñas incorrectas seguidas.
// Se cuenta por DNI (no por computadora) para no bloquear a todo un laboratorio que comparte la misma red.
const INTENTOS_MAX = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const fallos = new Map();

function bloqueado(dni) {
  const f = fallos.get(dni);
  if (!f) return 0;
  if (f.hasta && f.hasta > Date.now()) return Math.ceil((f.hasta - Date.now()) / 60000);
  if (f.hasta) fallos.delete(dni);
  return 0;
}

function registrarFallo(dni) {
  const f = fallos.get(dni) || { veces: 0, hasta: 0 };
  f.veces += 1;
  if (f.veces >= INTENTOS_MAX) f.hasta = Date.now() + BLOQUEO_MS;
  fallos.set(dni, f);
  return INTENTOS_MAX - f.veces;
}

function limpiarFallos(dni) {
  fallos.delete(dni);
}

// Limpieza periódica para que la lista no crezca sin límite
setInterval(() => {
  const ahora = Date.now();
  for (const [dni, f] of fallos) if (f.hasta && f.hasta < ahora) fallos.delete(dni);
}, 10 * 60 * 1000).unref();

// Frase secreta de las sesiones: si no se configura, se genera una al iniciar
function secretoSesion() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  console.log('Aviso: no se definió SESSION_SECRET. Se generó una frase aleatoria; las sesiones se cierran al reiniciar el servidor.');
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { encabezados, mismoOrigen, bloqueado, registrarFallo, limpiarFallos, secretoSesion, INTENTOS_MAX };
