// Mi perfil: datos de contacto y cambio de contraseña (todos los roles)
const pool = require('../config/db');
const claves = require('../utils/claves');

async function cargarPerfil(dni) {
  const [filas] = await pool.query(
    'SELECT dni, nombres, apellidos, email, telefono, foto, rol, fecha_registro, ultimo_acceso FROM usuarios WHERE dni = ?',
    [dni],
  );
  return filas[0];
}

async function mostrar(req, res) {
  const perfil = await cargarPerfil(req.session.usuario.dni);
  res.render('perfil', { perfil, erroresDatos: [], erroresClave: [] });
}

async function guardarDatos(req, res) {
  const dni = req.session.usuario.dni;
  const email = (req.body.email || '').trim() || null;
  const telefono = (req.body.telefono || '').trim() || null;
  const errores = [];
  if (email && (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errores.push('El correo no es válido.');
  if (telefono && !/^[0-9+\-\s]{7,15}$/.test(telefono)) errores.push('El teléfono solo puede tener números, espacios o guiones (7 a 15 caracteres).');

  if (!errores.length) {
    try {
      await pool.query('UPDATE usuarios SET email = ?, telefono = ? WHERE dni = ?', [email, telefono, dni]);
      req.session.flash = { tipo: 'exito', texto: 'Tus datos se guardaron.' };
      return res.redirect('/perfil');
    } catch (e) {
      if (e.code !== 'ER_DUP_ENTRY') throw e;
      errores.push('Ese correo ya lo usa otra cuenta.');
    }
  }
  const perfil = { ...(await cargarPerfil(dni)), email, telefono };
  res.status(400).render('perfil', { perfil, erroresDatos: errores, erroresClave: [] });
}

async function guardarClave(req, res) {
  const dni = req.session.usuario.dni;
  const { actual, nueva, confirmar } = req.body;
  const [filas] = await pool.query('SELECT password_hash FROM usuarios WHERE dni = ?', [dni]);
  const errores = [];
  if (!(await claves.comparar(actual || '', filas[0].password_hash))) errores.push('La contraseña actual no es correcta.');
  errores.push(...claves.validarNuevaClave(nueva, confirmar));
  if (nueva && nueva === actual) errores.push('La nueva contraseña debe ser distinta de la actual.');
  if (errores.length) {
    const perfil = await cargarPerfil(dni);
    return res.status(400).render('perfil', { perfil, erroresDatos: [], erroresClave: errores });
  }
  await pool.query('UPDATE usuarios SET password_hash = ? WHERE dni = ?', [await claves.hash(nueva), dni]);
  req.session.flash = { tipo: 'exito', texto: 'Tu contraseña se cambió correctamente.' };
  res.redirect('/perfil');
}

module.exports = { mostrar, guardarDatos, guardarClave };
