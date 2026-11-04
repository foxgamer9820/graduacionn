// Middleware de sesión, cambio de clave obligatorio y roles
const pool = require('../config/db');

// Exige sesión iniciada y vuelve a revisar en la base que la cuenta siga activa
async function requiereSesion(req, res, next) {
  const u = req.session.usuario;
  if (!u) return res.redirect('/login');
  const [filas] = await pool.query(
    'SELECT dni, nombres, apellidos, rol, estado, debe_cambiar_clave FROM usuarios WHERE dni = ?',
    [u.dni],
  );
  const actual = filas[0];
  if (!actual || actual.estado !== 'activo') {
    return req.session.destroy(() => res.redirect('/login?motivo=inactiva'));
  }
  req.session.usuario = {
    dni: actual.dni, nombres: actual.nombres, apellidos: actual.apellidos,
    rol: actual.rol, debe_cambiar_clave: !!actual.debe_cambiar_clave,
  };
  res.locals.usuario = req.session.usuario;
  next();
}

// Mientras tenga contraseña temporal, solo puede cambiarla o cerrar sesión
function exigirCambioClave(req, res, next) {
  const u = req.session.usuario;
  const permitidas = ['/cambiar-clave', '/logout'];
  if (u && u.debe_cambiar_clave && !permitidas.includes(req.path)) {
    return res.redirect('/cambiar-clave');
  }
  next();
}

function requiereRol(...roles) {
  return (req, res, next) => {
    if (req.session.usuario && roles.includes(req.session.usuario.rol)) return next();
    res.status(403).render('error', { titulo: 'Acceso denegado', mensaje: 'No tienes permiso para ver esta página.' });
  };
}

module.exports = { requiereSesion, exigirCambioClave, requiereRol };
