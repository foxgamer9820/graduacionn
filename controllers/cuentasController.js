// Gestión de cuentas con contraseña temporal.
// El administrador gestiona docentes; el docente gestiona estudiantes y padres o encargados.
const pool = require('../config/db');
const claves = require('../utils/claves');
const { limpiarFallos } = require('../middleware/seguridad');

const POR_PAGINA = 15;
const PARENTESCOS = ['padre', 'madre', 'tutor', 'otro'];

const CONTEXTOS = {
  admin: { clave: 'admin', base: '/admin/docentes', titulo: 'Docentes', tipos: ['docente'] },
  docente: { clave: 'docente', base: '/docente/estudiantes', titulo: 'Estudiantes', tipos: ['estudiante', 'tutor'] },
};
const NOMBRE_TIPO = { docente: 'docente', estudiante: 'estudiante', tutor: 'padre o encargado' };

// Subconsulta: DNI de los estudiantes de un docente (los que creó o los inscritos en sus temas)
const MIS_ESTUDIANTES = `
  SELECT dni FROM usuarios WHERE rol = 'estudiante' AND creado_por = ?
  UNION
  SELECT i.estudiante_dni FROM inscripciones i JOIN temas t ON t.id = i.tema_id WHERE t.docente_dni = ?`;

function contexto(clave) {
  return (req, res, next) => { req.ctx = CONTEXTOS[clave]; res.locals.ctx = req.ctx; next(); };
}

// ---------- Consultas de apoyo ----------
async function temasDelDocente(docenteDni) {
  const [filas] = await pool.query(
    "SELECT id, nombre FROM temas WHERE docente_dni = ? AND estado = 'activo' ORDER BY nombre", [docenteDni]);
  return filas;
}

async function estudiantesDelDocente(docenteDni) {
  const [filas] = await pool.query(
    `SELECT dni, nombres, apellidos FROM usuarios WHERE dni IN (${MIS_ESTUDIANTES}) ORDER BY apellidos, nombres`,
    [docenteDni, docenteDni]);
  return filas;
}

// Devuelve la cuenta si el usuario en sesión puede gestionarla
async function cuentaGestionable(req, dni) {
  const yo = req.session.usuario.dni;
  if (req.ctx.clave === 'admin') {
    const [f] = await pool.query("SELECT * FROM usuarios WHERE dni = ? AND rol = 'docente'", [dni]);
    return f[0] || null;
  }
  const [f] = await pool.query(
    `SELECT * FROM usuarios WHERE dni = ? AND (
       (rol = 'estudiante' AND dni IN (${MIS_ESTUDIANTES}))
       OR (rol = 'tutor' AND (creado_por = ? OR dni IN (
             SELECT tutor_dni FROM tutores_estudiantes WHERE estudiante_dni IN (${MIS_ESTUDIANTES})))))`,
    [dni, yo, yo, yo, yo, yo]);
  return f[0] || null;
}

// ---------- Lista ----------
async function lista(req, res) {
  const yo = req.session.usuario.dni;
  const ctx = req.ctx;
  const tipo = ctx.tipos.includes(req.query.tipo) ? req.query.tipo : ctx.tipos[0];
  const q = (req.query.q || '').trim();
  const estado = ['activa', 'pendiente', 'inactiva'].includes(req.query.estado) ? req.query.estado : '';
  const temaId = Number(req.query.tema) || 0;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);

  const where = ['u.rol = ?'];
  const params = [tipo];
  if (ctx.clave === 'docente') {
    if (tipo === 'estudiante') {
      where.push(`u.dni IN (${MIS_ESTUDIANTES})`); params.push(yo, yo);
    } else {
      where.push(`(u.creado_por = ? OR u.dni IN (SELECT tutor_dni FROM tutores_estudiantes WHERE estudiante_dni IN (${MIS_ESTUDIANTES})))`);
      params.push(yo, yo, yo);
    }
  }
  if (q) {
    where.push("(u.dni LIKE ? OR CONCAT(u.nombres, ' ', u.apellidos) LIKE ?)");
    params.push(`%${claves.limpiarDni(q)}%`, `%${q}%`);
  }
  if (estado === 'activa') where.push("u.estado = 'activo' AND u.debe_cambiar_clave = 0");
  if (estado === 'pendiente') where.push("u.estado = 'activo' AND u.debe_cambiar_clave = 1");
  if (estado === 'inactiva') where.push("u.estado = 'inactivo'");
  if (temaId && tipo === 'estudiante') {
    where.push('u.dni IN (SELECT estudiante_dni FROM inscripciones WHERE tema_id = ?)'); params.push(temaId);
  }

  let extra = "'' AS detalle";
  const extraParams = [];
  if (tipo === 'docente') extra = '(SELECT COUNT(*) FROM temas t WHERE t.docente_dni = u.dni) AS detalle';
  if (tipo === 'estudiante') {
    extra = `(SELECT GROUP_CONCAT(t.nombre ORDER BY t.nombre SEPARATOR ', ') FROM inscripciones i
              JOIN temas t ON t.id = i.tema_id WHERE i.estudiante_dni = u.dni AND t.docente_dni = ?) AS detalle`;
    extraParams.push(yo);
  }
  if (tipo === 'tutor') {
    extra = `(SELECT GROUP_CONCAT(CONCAT(e.nombres, ' ', e.apellidos) ORDER BY e.nombres SEPARATOR ', ')
              FROM tutores_estudiantes te JOIN usuarios e ON e.dni = te.estudiante_dni WHERE te.tutor_dni = u.dni) AS detalle`;
  }

  const condicion = where.join(' AND ');
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM usuarios u WHERE ${condicion}`, params);
  const [cuentas] = await pool.query(
    `SELECT u.dni, u.nombres, u.apellidos, u.email, u.estado, u.debe_cambiar_clave, u.ultimo_acceso, ${extra}
     FROM usuarios u WHERE ${condicion} ORDER BY u.apellidos, u.nombres LIMIT ? OFFSET ?`,
    [...extraParams, ...params, POR_PAGINA, (pagina - 1) * POR_PAGINA]);
  const [[{ pendientes }]] = await pool.query(
    `SELECT COUNT(*) AS pendientes FROM usuarios u WHERE ${condicion} AND u.estado = 'activo' AND u.debe_cambiar_clave = 1`, params);

  res.render('cuentas/lista', {
    titulo: ctx.titulo, tipo, cuentas, total, pendientes, q, estado, temaId, pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    temas: ctx.clave === 'docente' ? await temasDelDocente(yo) : [],
    NOMBRE_TIPO,
    ...(ctx.clave === 'admin' ? await require('./temasController').datosAsignacion() : {}),
  });
}

// ---------- Formulario ----------
async function datosFormulario(req) {
  const yo = req.session.usuario.dni;
  if (req.ctx.clave !== 'docente') return { temas: [], estudiantes: [] };
  return { temas: await temasDelDocente(yo), estudiantes: await estudiantesDelDocente(yo) };
}

async function formNuevo(req, res) {
  const tipo = req.ctx.tipos.includes(req.query.tipo) ? req.query.tipo : req.ctx.tipos[0];
  res.render('cuentas/form', {
    titulo: req.ctx.titulo, modo: 'nuevo', errores: [], ...(await datosFormulario(req)), NOMBRE_TIPO, PARENTESCOS,
    datos: { tipo, dni: '', nombres: '', apellidos: '', email: '', telefono: '', parentesco: 'madre', temas: [], estudiantes: [] },
  });
}

// Lee y valida lo que llega del formulario
function leerFormulario(req, opciones) {
  const lista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const d = {
    tipo: req.ctx.tipos.includes(req.body.tipo) ? req.body.tipo : req.ctx.tipos[0],
    dni: claves.limpiarDni(req.body.dni),
    nombres: (req.body.nombres || '').trim(),
    apellidos: (req.body.apellidos || '').trim(),
    email: (req.body.email || '').trim(),
    telefono: (req.body.telefono || '').trim(),
    parentesco: req.body.parentesco,
    temas: lista(req.body.temas).map(Number).filter(Boolean),
    estudiantes: lista(req.body.estudiantes).map(claves.limpiarDni),
  };
  const e = [];
  if (!claves.dniValido(d.dni)) e.push('El DNI debe tener 13 números, sin guiones.');
  if (!d.nombres || d.nombres.length > 60) e.push('Escribe los nombres (máximo 60 caracteres).');
  if (!d.apellidos || d.apellidos.length > 60) e.push('Escribe los apellidos (máximo 60 caracteres).');
  if (d.email && (d.email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))) e.push('El correo no es válido.');
  if (d.telefono && !/^[0-9+\-\s]{7,15}$/.test(d.telefono)) e.push('El teléfono no es válido.');
  if (d.tipo === 'tutor') {
    if (!PARENTESCOS.includes(d.parentesco)) e.push('Elige el parentesco.');
    if (!d.estudiantes.length) e.push('Vincula al menos un estudiante.');
  }
  const temasValidos = new Set(opciones.temas.map((t) => t.id));
  const estudiantesValidos = new Set(opciones.estudiantes.map((s) => s.dni));
  d.temas = d.temas.filter((id) => temasValidos.has(id));
  d.estudiantes = d.estudiantes.filter((dni) => estudiantesValidos.has(dni));
  return { d, errores: e };
}

// Guarda inscripciones o vínculos según el tipo de cuenta
async function guardarRelaciones(con, req, d, dni) {
  const yo = req.session.usuario.dni;
  if (d.tipo === 'estudiante') {
    await con.query(
      'DELETE i FROM inscripciones i JOIN temas t ON t.id = i.tema_id WHERE i.estudiante_dni = ? AND t.docente_dni = ?', [dni, yo]);
    for (const id of d.temas) {
      await con.query('INSERT INTO inscripciones (estudiante_dni, tema_id, inscrito_por) VALUES (?, ?, ?)', [dni, id, yo]);
    }
  }
  if (d.tipo === 'tutor') {
    await con.query(`DELETE FROM tutores_estudiantes WHERE tutor_dni = ? AND estudiante_dni IN (${MIS_ESTUDIANTES})`, [dni, yo, yo]);
    for (const est of d.estudiantes) {
      await con.query(
        'INSERT INTO tutores_estudiantes (tutor_dni, estudiante_dni, parentesco, creado_por) VALUES (?, ?, ?, ?)',
        [dni, est, d.parentesco, yo]);
    }
  }
}

function mensajeDuplicado(e) {
  if (e.code !== 'ER_DUP_ENTRY') return null;
  return /email/.test(e.message) ? 'Ese correo ya lo usa otra cuenta.' : 'Ya existe una cuenta con ese DNI.';
}

async function crear(req, res) {
  const opciones = await datosFormulario(req);
  const { d, errores } = leerFormulario(req, opciones);
  const volver = (errs) => res.status(400).render('cuentas/form', {
    titulo: req.ctx.titulo, modo: 'nuevo', errores: errs, datos: d, ...opciones, NOMBRE_TIPO, PARENTESCOS });
  if (errores.length) return volver(errores);

  const temporal = claves.generarClaveTemporal();
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    await con.query(
      `INSERT INTO usuarios (dni, nombres, apellidos, email, telefono, password_hash, rol, debe_cambiar_clave, clave_temporal_expira, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [d.dni, d.nombres, d.apellidos, d.email || null, d.telefono || null, await claves.hash(temporal), d.tipo,
        claves.vencimientoTemporal(), req.session.usuario.dni]);
    await guardarRelaciones(con, req, d, d.dni);
    await con.commit();
  } catch (e) {
    await con.rollback();
    const msg = mensajeDuplicado(e);
    if (msg) return volver([msg]);
    throw e;
  } finally {
    con.release();
  }

  req.session.cuentaCreada = {
    motivo: 'creada', nombre: `${d.nombres} ${d.apellidos}`, dni: d.dni, clave: temporal,
    tipo: NOMBRE_TIPO[d.tipo], volver: `${req.ctx.base}?tipo=${d.tipo}`,
  };
  res.redirect('/cuenta-creada');
}

async function formEditar(req, res) {
  const cuenta = await cuentaGestionable(req, req.params.dni);
  if (!cuenta) return res.status(404).render('error', { titulo: 'Cuenta no encontrada', mensaje: 'No existe o no puedes gestionarla.' });
  const yo = req.session.usuario.dni;
  const datos = { ...cuenta, tipo: cuenta.rol, email: cuenta.email || '', telefono: cuenta.telefono || '', temas: [], estudiantes: [], parentesco: 'madre' };
  if (cuenta.rol === 'estudiante') {
    const [t] = await pool.query(
      'SELECT i.tema_id FROM inscripciones i JOIN temas t ON t.id = i.tema_id WHERE i.estudiante_dni = ? AND t.docente_dni = ?', [cuenta.dni, yo]);
    datos.temas = t.map((x) => x.tema_id);
  }
  if (cuenta.rol === 'tutor') {
    const [v] = await pool.query('SELECT estudiante_dni, parentesco FROM tutores_estudiantes WHERE tutor_dni = ?', [cuenta.dni]);
    datos.estudiantes = v.map((x) => x.estudiante_dni);
    if (v[0]) datos.parentesco = v[0].parentesco;
  }
  res.render('cuentas/form', { titulo: req.ctx.titulo, modo: 'editar', dniOriginal: cuenta.dni, errores: [], datos, ...(await datosFormulario(req)), NOMBRE_TIPO, PARENTESCOS });
}

async function actualizar(req, res) {
  const cuenta = await cuentaGestionable(req, req.params.dni);
  if (!cuenta) return res.status(404).render('error', { titulo: 'Cuenta no encontrada', mensaje: 'No existe o no puedes gestionarla.' });
  const opciones = await datosFormulario(req);
  req.body.tipo = cuenta.rol; // el tipo de cuenta no se cambia al editar
  const { d, errores } = leerFormulario(req, opciones);
  const volver = (errs) => res.status(400).render('cuentas/form', {
    titulo: req.ctx.titulo, modo: 'editar', dniOriginal: cuenta.dni, errores: errs, datos: d, ...opciones, NOMBRE_TIPO, PARENTESCOS });
  if (errores.length) return volver(errores);

  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    // Si cambia el DNI, MySQL lo actualiza en las demás tablas (ON UPDATE CASCADE)
    await con.query('UPDATE usuarios SET dni = ?, nombres = ?, apellidos = ?, email = ?, telefono = ? WHERE dni = ?',
      [d.dni, d.nombres, d.apellidos, d.email || null, d.telefono || null, cuenta.dni]);
    await guardarRelaciones(con, req, d, d.dni);
    await con.commit();
  } catch (e) {
    await con.rollback();
    const msg = mensajeDuplicado(e);
    if (msg) return volver([msg]);
    throw e;
  } finally {
    con.release();
  }
  req.session.flash = { tipo: 'exito', texto: `Se guardaron los cambios de ${d.nombres} ${d.apellidos}.` };
  res.redirect(`${req.ctx.base}?tipo=${cuenta.rol}`);
}

async function restablecerClave(req, res) {
  const cuenta = await cuentaGestionable(req, req.params.dni);
  if (!cuenta) return res.status(404).render('error', { titulo: 'Cuenta no encontrada', mensaje: 'No existe o no puedes gestionarla.' });
  const temporal = claves.generarClaveTemporal();
  await pool.query(
    'UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = 1, clave_temporal_expira = ? WHERE dni = ?',
    [await claves.hash(temporal), claves.vencimientoTemporal(), cuenta.dni]);
  limpiarFallos(cuenta.dni);
  req.session.cuentaCreada = {
    motivo: 'restablecida', nombre: `${cuenta.nombres} ${cuenta.apellidos}`, dni: cuenta.dni, clave: temporal,
    tipo: NOMBRE_TIPO[cuenta.rol], volver: `${req.ctx.base}?tipo=${cuenta.rol}`,
  };
  res.redirect('/cuenta-creada');
}

async function cambiarEstado(req, res) {
  const cuenta = await cuentaGestionable(req, req.params.dni);
  if (!cuenta) return res.status(404).render('error', { titulo: 'Cuenta no encontrada', mensaje: 'No existe o no puedes gestionarla.' });
  const nuevo = cuenta.estado === 'activo' ? 'inactivo' : 'activo';
  await pool.query('UPDATE usuarios SET estado = ? WHERE dni = ?', [nuevo, cuenta.dni]);
  req.session.flash = { tipo: 'exito', texto: `La cuenta de ${cuenta.nombres} ${cuenta.apellidos} quedó ${nuevo === 'activo' ? 'activa' : 'desactivada'}.` };
  res.redirect(`${req.ctx.base}?tipo=${cuenta.rol}`);
}

// Borra la cuenta solo si no tiene historial; si lo tiene, la desactiva
async function eliminar(req, res) {
  const cuenta = await cuentaGestionable(req, req.params.dni);
  if (!cuenta) return res.status(404).render('error', { titulo: 'Cuenta no encontrada', mensaje: 'No existe o no puedes gestionarla.' });
  const nombre = `${cuenta.nombres} ${cuenta.apellidos}`;
  const volverA = `${req.ctx.base}?tipo=${cuenta.rol}`;

  const [[{ resultados }]] = await pool.query('SELECT COUNT(*) AS resultados FROM resultados_tests WHERE estudiante_dni = ?', [cuenta.dni]);
  const [[{ temas }]] = await pool.query('SELECT COUNT(*) AS temas FROM temas WHERE docente_dni = ?', [cuenta.dni]);
  if (resultados || temas) {
    await pool.query("UPDATE usuarios SET estado = 'inactivo' WHERE dni = ?", [cuenta.dni]);
    req.session.flash = {
      tipo: 'aviso',
      texto: `${nombre} tiene ${resultados ? 'notas registradas' : 'temas asignados'}, así que no se borró: la cuenta quedó desactivada para conservar el historial.`,
    };
    return res.redirect(volverA);
  }
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    await con.query('DELETE FROM tutores_estudiantes WHERE tutor_dni = ? OR estudiante_dni = ?', [cuenta.dni, cuenta.dni]);
    await con.query('DELETE FROM inscripciones WHERE estudiante_dni = ?', [cuenta.dni]);
    await con.query('DELETE FROM usuarios WHERE dni = ?', [cuenta.dni]);
    await con.commit();
  } catch (e) {
    await con.rollback();
    throw e;
  } finally {
    con.release();
  }
  req.session.flash = { tipo: 'exito', texto: `Se eliminó la cuenta de ${nombre}.` };
  res.redirect(volverA);
}

// Muestra la contraseña temporal una sola vez
function cuentaCreada(req, res) {
  const datos = req.session.cuentaCreada;
  if (!datos) return res.redirect('/');
  delete req.session.cuentaCreada;
  res.render('cuentaCreada', { datos, horas: claves.HORAS_VIGENCIA_TEMPORAL });
}

module.exports = { contexto, lista, formNuevo, crear, formEditar, actualizar, restablecerClave, cambiarEstado, eliminar, cuentaCreada };
