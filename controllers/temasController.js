// Sprint 2: temas de estudio del docente, inscripción de estudiantes
// y asignación de temas a docentes desde el administrador
const pool = require('../config/db');
const claves = require('../utils/claves');

// Colores con buen contraste para el ícono blanco
const COLORES = [
  { valor: '#1D4E9E', nombre: 'Azul' },
  { valor: '#2E8B57', nombre: 'Verde' },
  { valor: '#9A5300', nombre: 'Naranja' },
  { valor: '#7B4BB7', nombre: 'Morado' },
  { valor: '#C0262D', nombre: 'Rojo' },
  { valor: '#0E7C86', nombre: 'Turquesa' },
  { valor: '#0B3B7E', nombre: 'Azul oscuro' },
  { valor: '#5B6B80', nombre: 'Gris' },
];

// Estudiantes que el docente puede inscribir: los que creó o ya inscribió en alguno de sus temas
const MIS_ESTUDIANTES = `
  SELECT dni FROM usuarios WHERE rol = 'estudiante' AND creado_por = ?
  UNION
  SELECT i.estudiante_dni FROM inscripciones i JOIN temas t ON t.id = i.tema_id WHERE t.docente_dni = ?`;

const noEncontrado = (res) => res.status(404).render('error', { titulo: 'Tema no encontrado', mensaje: 'No existe o no pertenece a tus temas.' });

async function temaDelDocente(id, docenteDni) {
  const [f] = await pool.query('SELECT * FROM temas WHERE id = ? AND docente_dni = ?', [Number(id) || 0, docenteDni]);
  return f[0] || null;
}

// ---------- Docente: lista de temas ----------
async function lista(req, res) {
  const yo = req.session.usuario.dni;
  const [temas] = await pool.query(
    `SELECT t.*,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.tema_id = t.id) AS estudiantes,
       (SELECT COUNT(*) FROM tests ts WHERE ts.tema_id = t.id) AS tests
     FROM temas t WHERE t.docente_dni = ? ORDER BY t.estado = 'inactivo', t.nombre`, [yo]);
  const activos = temas.filter((t) => t.estado === 'activo').length;
  res.render('temas/lista', { titulo: 'Temas', temas, activos });
}

// ---------- Docente: crear y editar ----------
function leerTema(body) {
  const d = {
    nombre: (body.nombre || '').trim(),
    descripcion: (body.descripcion || '').trim(),
    color: (body.color || '').trim().toUpperCase(),
  };
  const errores = [];
  if (!d.nombre || d.nombre.length > 80) errores.push('Escribe el nombre del tema (máximo 80 caracteres).');
  if (d.descripcion.length > 500) errores.push('La descripción puede tener hasta 500 caracteres.');
  if (!/^#[0-9A-F]{6}$/.test(d.color)) errores.push('Elige un color.');
  return { d, errores };
}

async function nombreRepetido(docenteDni, nombre, excluirId = 0) {
  const [f] = await pool.query('SELECT id FROM temas WHERE docente_dni = ? AND nombre = ? AND id <> ?', [docenteDni, nombre, excluirId]);
  return f.length > 0;
}

function formNuevo(req, res) {
  res.render('temas/form', { titulo: 'Temas', modo: 'nuevo', errores: [], COLORES, datos: { nombre: '', descripcion: '', color: COLORES[0].valor } });
}

async function crear(req, res) {
  const yo = req.session.usuario.dni;
  const { d, errores } = leerTema(req.body);
  if (!errores.length && (await nombreRepetido(yo, d.nombre))) errores.push('Ya tienes un tema con ese nombre.');
  if (errores.length) return res.status(400).render('temas/form', { titulo: 'Temas', modo: 'nuevo', errores, COLORES, datos: d });
  const [r] = await pool.query('INSERT INTO temas (nombre, descripcion, color, docente_dni) VALUES (?, ?, ?, ?)',
    [d.nombre, d.descripcion || null, d.color, yo]);
  req.session.flash = { tipo: 'exito', texto: `Se creó el tema ${d.nombre}. Ahora inscribe a tus estudiantes.` };
  res.redirect(`/docente/temas/${r.insertId}/estudiantes`);
}

async function formEditar(req, res) {
  const tema = await temaDelDocente(req.params.id, req.session.usuario.dni);
  if (!tema) return noEncontrado(res);
  const [[{ tests }]] = await pool.query('SELECT COUNT(*) AS tests FROM tests WHERE tema_id = ?', [tema.id]);
  res.render('temas/form', { titulo: 'Temas', modo: 'editar', errores: [], COLORES, tema, tests, datos: { ...tema, descripcion: tema.descripcion || '' } });
}

async function actualizar(req, res) {
  const yo = req.session.usuario.dni;
  const tema = await temaDelDocente(req.params.id, yo);
  if (!tema) return noEncontrado(res);
  const { d, errores } = leerTema(req.body);
  if (!errores.length && (await nombreRepetido(yo, d.nombre, tema.id))) errores.push('Ya tienes otro tema con ese nombre.');
  if (errores.length) {
    const [[{ tests }]] = await pool.query('SELECT COUNT(*) AS tests FROM tests WHERE tema_id = ?', [tema.id]);
    return res.status(400).render('temas/form', { titulo: 'Temas', modo: 'editar', errores, COLORES, tema, tests, datos: d });
  }
  await pool.query('UPDATE temas SET nombre = ?, descripcion = ?, color = ? WHERE id = ?', [d.nombre, d.descripcion || null, d.color, tema.id]);
  req.session.flash = { tipo: 'exito', texto: `Se guardaron los cambios del tema ${d.nombre}.` };
  res.redirect('/docente/temas');
}

async function cambiarEstado(req, res) {
  const tema = await temaDelDocente(req.params.id, req.session.usuario.dni);
  if (!tema) return noEncontrado(res);
  const nuevo = tema.estado === 'activo' ? 'inactivo' : 'activo';
  await pool.query('UPDATE temas SET estado = ? WHERE id = ?', [nuevo, tema.id]);
  req.session.flash = {
    tipo: 'exito',
    texto: nuevo === 'activo' ? `El tema ${tema.nombre} está activo.` : `El tema ${tema.nombre} quedó inactivo: sus estudiantes ya no lo ven.`,
  };
  res.redirect('/docente/temas');
}

// Solo se borra si no tiene tests; las inscripciones se borran solas (ON DELETE CASCADE)
async function eliminar(req, res) {
  const tema = await temaDelDocente(req.params.id, req.session.usuario.dni);
  if (!tema) return noEncontrado(res);
  const [[{ tests }]] = await pool.query('SELECT COUNT(*) AS tests FROM tests WHERE tema_id = ?', [tema.id]);
  if (tests) {
    req.session.flash = { tipo: 'aviso', texto: `${tema.nombre} tiene ${tests} ${tests === 1 ? 'test' : 'tests'}, así que no se puede eliminar. Puedes desactivarlo.` };
    return res.redirect('/docente/temas');
  }
  await pool.query('DELETE FROM temas WHERE id = ?', [tema.id]);
  req.session.flash = { tipo: 'exito', texto: `Se eliminó el tema ${tema.nombre}.` };
  res.redirect('/docente/temas');
}

// ---------- Docente: inscribir estudiantes en un tema ----------
async function formInscribir(req, res) {
  const yo = req.session.usuario.dni;
  const tema = await temaDelDocente(req.params.id, yo);
  if (!tema) return noEncontrado(res);
  const [estudiantes] = await pool.query(
    `SELECT u.dni, u.nombres, u.apellidos, u.estado,
       EXISTS (SELECT 1 FROM inscripciones i WHERE i.tema_id = ? AND i.estudiante_dni = u.dni) AS inscrito
     FROM usuarios u WHERE u.dni IN (${MIS_ESTUDIANTES}) ORDER BY u.apellidos, u.nombres`, [tema.id, yo, yo]);
  res.render('temas/inscribir', { titulo: 'Temas', tema, estudiantes, errores: [] });
}

async function guardarInscripciones(req, res) {
  const yo = req.session.usuario.dni;
  const tema = await temaDelDocente(req.params.id, yo);
  if (!tema) return noEncontrado(res);
  const elegidos = new Set((Array.isArray(req.body.estudiantes) ? req.body.estudiantes : req.body.estudiantes ? [req.body.estudiantes] : []).map(claves.limpiarDni));
  const [mios] = await pool.query(`SELECT dni FROM usuarios WHERE dni IN (${MIS_ESTUDIANTES})`, [yo, yo]);
  const validos = mios.map((m) => m.dni).filter((dni) => elegidos.has(dni));

  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    await con.query('DELETE FROM inscripciones WHERE tema_id = ?', [tema.id]);
    for (const dni of validos) {
      await con.query('INSERT INTO inscripciones (estudiante_dni, tema_id, inscrito_por) VALUES (?, ?, ?)', [dni, tema.id, yo]);
    }
    await con.commit();
  } catch (e) {
    await con.rollback();
    throw e;
  } finally {
    con.release();
  }
  req.session.flash = { tipo: 'exito', texto: `${tema.nombre}: ${validos.length} ${validos.length === 1 ? 'estudiante inscrito' : 'estudiantes inscritos'}.` };
  res.redirect('/docente/temas');
}

// Inscribe a un estudiante que ya tiene cuenta (por ejemplo, creada por otro docente)
async function inscribirPorDni(req, res) {
  const yo = req.session.usuario.dni;
  const tema = await temaDelDocente(req.params.id, yo);
  if (!tema) return noEncontrado(res);
  const dni = claves.limpiarDni(req.body.dni);
  const [f] = await pool.query("SELECT dni, nombres, apellidos FROM usuarios WHERE dni = ? AND rol = 'estudiante' AND estado = 'activo'", [dni]);
  if (!claves.dniValido(dni) || !f[0]) {
    req.session.flash = { tipo: 'aviso', texto: 'No hay un estudiante activo con ese DNI. Si no tiene cuenta, créala en Estudiantes.' };
    return res.redirect(`/docente/temas/${tema.id}/estudiantes`);
  }
  await pool.query('INSERT IGNORE INTO inscripciones (estudiante_dni, tema_id, inscrito_por) VALUES (?, ?, ?)', [dni, tema.id, yo]);
  req.session.flash = { tipo: 'exito', texto: `${f[0].nombres} ${f[0].apellidos} quedó inscrito en ${tema.nombre}.` };
  res.redirect(`/docente/temas/${tema.id}/estudiantes`);
}

// ---------- Administrador: asignar un tema a otro docente ----------
async function asignar(req, res) {
  const temaId = Number(req.body.tema) || 0;
  const docente = claves.limpiarDni(req.body.docente);
  const [[tema]] = await pool.query('SELECT id, nombre FROM temas WHERE id = ?', [temaId]);
  const [[doc]] = await pool.query("SELECT dni, nombres, apellidos FROM usuarios WHERE dni = ? AND rol = 'docente' AND estado = 'activo'", [docente]);
  if (!tema || !doc) {
    req.session.flash = { tipo: 'aviso', texto: 'Elige un tema y un docente activo.' };
    return res.redirect('/admin/docentes');
  }
  await pool.query('UPDATE temas SET docente_dni = ? WHERE id = ?', [doc.dni, tema.id]);
  req.session.flash = { tipo: 'exito', texto: `El tema ${tema.nombre} quedó asignado a ${doc.nombres} ${doc.apellidos}.` };
  res.redirect('/admin/docentes');
}

async function datosAsignacion() {
  const [temas] = await pool.query(
    `SELECT t.id, t.nombre, CONCAT(u.nombres, ' ', u.apellidos) AS docente
     FROM temas t JOIN usuarios u ON u.dni = t.docente_dni ORDER BY t.nombre`);
  const [docentes] = await pool.query("SELECT dni, nombres, apellidos FROM usuarios WHERE rol = 'docente' AND estado = 'activo' ORDER BY nombres, apellidos");
  return { temasTodos: temas, docentesActivos: docentes };
}

module.exports = {
  COLORES, lista, formNuevo, crear, formEditar, actualizar, cambiarEstado, eliminar,
  formInscribir, guardarInscripciones, inscribirPorDni, asignar, datosAsignacion,
};
