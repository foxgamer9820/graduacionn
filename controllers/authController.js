// Inicio de sesión, cierre de sesión y cambio de contraseña obligatorio
const pool = require('../config/db');
const claves = require('../utils/claves');
const { RUTA_INICIO } = require('../utils/vistas');
const seguridad = require('../middleware/seguridad');

const MENSAJE_ERROR = 'El DNI o la contraseña no son correctos.';

function mostrarLogin(req, res) {
  if (req.session.usuario) return res.redirect('/');
  const avisos = {
    inactiva: 'Tu cuenta está desactivada. Habla con tu docente.',
    salida: 'Cerraste sesión correctamente.',
  };
  res.render('login', { error: null, aviso: avisos[req.query.motivo] || null, dni: '' });
}

async function iniciarSesion(req, res) {
  const dni = claves.limpiarDni(req.body.dni);
  const clave = req.body.clave || '';
  const volver = (error) => res.status(401).render('login', { error, aviso: null, dni });

  if (!claves.dniValido(dni) || !clave) return volver(MENSAJE_ERROR);
  const minutos = seguridad.bloqueado(dni);
  if (minutos) {
    return volver(`Demasiados intentos fallidos. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} o pide a tu docente que restablezca tu contraseña.`);
  }

  const [filas] = await pool.query('SELECT * FROM usuarios WHERE dni = ?', [dni]);
  const u = filas[0];
  if (!u || !(await claves.comparar(clave, u.password_hash))) {
    const quedan = seguridad.registrarFallo(dni);
    if (quedan <= 0) return volver('Demasiados intentos fallidos. Espera 15 minutos o pide a tu docente que restablezca tu contraseña.');
    return volver(quedan <= 2 ? `${MENSAJE_ERROR} Te ${quedan === 1 ? 'queda 1 intento' : 'quedan 2 intentos'} antes de un bloqueo de 15 minutos.` : MENSAJE_ERROR);
  }
  seguridad.limpiarFallos(dni);
  if (u.estado !== 'activo') return volver('Tu cuenta está desactivada. Habla con tu docente.');
  if (u.debe_cambiar_clave && u.clave_temporal_expira && new Date(u.clave_temporal_expira) < new Date()) {
    return volver('Tu contraseña temporal venció. Pide a tu docente que te dé una nueva.');
  }

  await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE dni = ?', [dni]);

  // Nueva sesión para evitar que se reutilice una anterior
  await new Promise((ok, falla) => req.session.regenerate((err) => (err ? falla(err) : ok())));
  req.session.usuario = {
    dni: u.dni, nombres: u.nombres, apellidos: u.apellidos, rol: u.rol, debe_cambiar_clave: !!u.debe_cambiar_clave,
  };
  res.redirect(u.debe_cambiar_clave ? '/cambiar-clave' : RUTA_INICIO[u.rol]);
}

function cerrarSesion(req, res) {
  req.session.destroy(() => {
    res.clearCookie('sesion_tests');
    res.redirect('/login?motivo=salida');
  });
}

function irAlInicio(req, res) {
  const u = req.session.usuario;
  if (!u) return res.redirect('/login');
  res.redirect(u.debe_cambiar_clave ? '/cambiar-clave' : RUTA_INICIO[u.rol]);
}

function mostrarCambioClave(req, res) {
  res.render('cambiarClave', { errores: [], obligatorio: req.session.usuario.debe_cambiar_clave });
}

async function guardarCambioClave(req, res) {
  const { actual, nueva, confirmar } = req.body;
  const dni = req.session.usuario.dni;
  const obligatorio = req.session.usuario.debe_cambiar_clave;
  const [filas] = await pool.query('SELECT password_hash FROM usuarios WHERE dni = ?', [dni]);

  const errores = [];
  if (!(await claves.comparar(actual || '', filas[0].password_hash))) {
    errores.push(obligatorio ? 'La contraseña temporal no es correcta.' : 'La contraseña actual no es correcta.');
  }
  errores.push(...claves.validarNuevaClave(nueva, confirmar));
  if (nueva && nueva === actual) errores.push('La nueva contraseña debe ser distinta de la actual.');
  if (errores.length) return res.status(400).render('cambiarClave', { errores, obligatorio });

  await pool.query(
    'UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 0, clave_temporal_expira = NULL WHERE dni = ?',
    [await claves.hash(nueva), dni],
  );
  req.session.usuario.debe_cambiar_clave = false;
  req.session.flash = { tipo: 'exito', texto: 'Tu contraseña se guardó correctamente.' };
  res.redirect(RUTA_INICIO[req.session.usuario.rol]);
}

module.exports = { mostrarLogin, iniciarSesion, cerrarSesion, irAlInicio, mostrarCambioClave, guardarCambioClave };
