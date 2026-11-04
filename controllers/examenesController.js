// Sprint 3: gestión de exámenes (tests de selección única) y sus preguntas
const pool = require('../config/db');
const { borrarImagen, RUTA_PUBLICA } = require('../utils/subidas');

const ESTADOS = ['borrador', 'publicado', 'archivado'];

const noEncontrado = (res) => res.status(404).render('error', { titulo: 'Test no encontrado', mensaje: 'No existe o no pertenece a tus temas.' });

// ---------- Consultas de apoyo ----------
async function testDelDocente(id, docenteDni) {
  const [f] = await pool.query(
    `SELECT ts.*, t.nombre AS tema, t.color AS tema_color,
       (SELECT COUNT(*) FROM preguntas p WHERE p.test_id = ts.id) AS total_preguntas,
       (SELECT COALESCE(SUM(p.puntos), 0) FROM preguntas p WHERE p.test_id = ts.id) AS total_puntos,
       (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ts.id) AS intentos_realizados
     FROM tests ts JOIN temas t ON t.id = ts.tema_id WHERE ts.id = ? AND t.docente_dni = ?`,
    [Number(id) || 0, docenteDni]);
  return f[0] || null;
}

async function temasDelDocente(docenteDni) {
  const [f] = await pool.query('SELECT id, nombre, estado FROM temas WHERE docente_dni = ? ORDER BY nombre', [docenteDni]);
  return f;
}

// Date de MySQL -> valor para <input type="datetime-local">
function aInput(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- Lista ----------
async function lista(req, res) {
  const yo = req.session.usuario.dni;
  const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : '';
  const temaId = Number(req.query.tema) || 0;
  const where = ['t.docente_dni = ?'];
  const params = [yo];
  if (temaId) { where.push('ts.tema_id = ?'); params.push(temaId); }
  const [todos] = await pool.query(
    `SELECT ts.id, ts.nombre, ts.estado, ts.duracion_min, ts.intentos_max, ts.fecha_cierre, t.nombre AS tema, t.color AS tema_color,
       (SELECT COUNT(*) FROM preguntas p WHERE p.test_id = ts.id) AS preguntas,
       (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ts.id) AS intentos_realizados
     FROM tests ts JOIN temas t ON t.id = ts.tema_id WHERE ${where.join(' AND ')}
     ORDER BY FIELD(ts.estado, 'publicado', 'borrador', 'archivado'), ts.fecha_creacion DESC`, params);
  const conteo = { '': todos.length, publicado: 0, borrador: 0, archivado: 0 };
  todos.forEach((x) => { conteo[x.estado]++; });
  const tests = estado ? todos.filter((x) => x.estado === estado) : todos;
  res.render('examenes/lista', { titulo: 'Exámenes', tests, conteo, estado, temaId, temas: await temasDelDocente(yo) });
}

// ---------- Crear y editar la configuración ----------
function leerTest(body, temasValidos) {
  const n = (v) => (v === undefined || v === '' ? NaN : Number(v));
  const d = {
    nombre: (body.nombre || '').trim(),
    descripcion: (body.descripcion || '').trim(),
    tema_id: Number(body.tema_id) || 0,
    duracion_min: n(body.duracion_min),
    intentos_max: n(body.intentos_max),
    puntaje_aprobacion: n(body.puntaje_aprobacion),
    fecha_apertura: body.fecha_apertura || '',
    fecha_cierre: body.fecha_cierre || '',
    mostrar_respuestas: body.mostrar_respuestas ? 1 : 0,
  };
  const e = [];
  if (!d.nombre || d.nombre.length > 100) e.push('Escribe el nombre del test (máximo 100 caracteres).');
  if (d.descripcion.length > 500) e.push('La descripción puede tener hasta 500 caracteres.');
  if (!temasValidos.some((t) => t.id === d.tema_id)) e.push('Elige uno de tus temas.');
  if (!Number.isInteger(d.duracion_min) || d.duracion_min < 1 || d.duracion_min > 600) e.push('La duración debe ser de 1 a 600 minutos.');
  if (!Number.isInteger(d.intentos_max) || d.intentos_max < 1 || d.intentos_max > 20) e.push('Los intentos deben ser de 1 a 20.');
  if (!Number.isInteger(d.puntaje_aprobacion) || d.puntaje_aprobacion < 0 || d.puntaje_aprobacion > 100) e.push('La nota mínima debe ser de 0 a 100.');
  const fecha = (v) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? new Date(v) : null);
  if (d.fecha_apertura && !fecha(d.fecha_apertura)) e.push('La fecha de apertura no es válida.');
  if (d.fecha_cierre && !fecha(d.fecha_cierre)) e.push('La fecha de cierre no es válida.');
  if (fecha(d.fecha_apertura) && fecha(d.fecha_cierre) && fecha(d.fecha_cierre) <= fecha(d.fecha_apertura)) {
    e.push('La fecha de cierre debe ser posterior a la de apertura.');
  }
  return { d, errores: e };
}

const aSql = (v) => (v ? v.replace('T', ' ') + ':00' : null);

async function formNuevo(req, res) {
  const temas = await temasDelDocente(req.session.usuario.dni);
  const temaId = Number(req.query.tema) || (temas.find((t) => t.estado === 'activo') || temas[0] || {}).id || 0;
  res.render('examenes/form', {
    titulo: 'Exámenes', errores: [], temas,
    datos: { nombre: '', descripcion: '', tema_id: temaId, duracion_min: 20, intentos_max: 1, puntaje_aprobacion: 70, fecha_apertura: '', fecha_cierre: '', mostrar_respuestas: 1 },
  });
}

async function crear(req, res) {
  const temas = await temasDelDocente(req.session.usuario.dni);
  const { d, errores } = leerTest(req.body, temas);
  if (errores.length) return res.status(400).render('examenes/form', { titulo: 'Exámenes', errores, temas, datos: d });
  const [r] = await pool.query(
    `INSERT INTO tests (tema_id, nombre, descripcion, duracion_min, intentos_max, puntaje_aprobacion, fecha_apertura, fecha_cierre, mostrar_respuestas, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador')`,
    [d.tema_id, d.nombre, d.descripcion || null, d.duracion_min, d.intentos_max, d.puntaje_aprobacion, aSql(d.fecha_apertura), aSql(d.fecha_cierre), d.mostrar_respuestas]);
  req.session.flash = { tipo: 'exito', texto: `Se creó el test ${d.nombre} como borrador. Ahora agrega sus preguntas.` };
  res.redirect(`/docente/examenes/${r.insertId}`);
}

async function editor(req, res) {
  const yo = req.session.usuario.dni;
  const test = await testDelDocente(req.params.id, yo);
  if (!test) return noEncontrado(res);
  const [preguntas] = await pool.query('SELECT * FROM preguntas WHERE test_id = ? ORDER BY id', [test.id]);
  res.render('examenes/editor', {
    titulo: 'Exámenes', test, preguntas, temas: await temasDelDocente(yo), errores: [],
    datos: { ...test, descripcion: test.descripcion || '', fecha_apertura: aInput(test.fecha_apertura), fecha_cierre: aInput(test.fecha_cierre) },
  });
}

async function actualizar(req, res) {
  const yo = req.session.usuario.dni;
  const test = await testDelDocente(req.params.id, yo);
  if (!test) return noEncontrado(res);
  const temas = await temasDelDocente(yo);
  const { d, errores } = leerTest(req.body, temas);
  if (errores.length) {
    const [preguntas] = await pool.query('SELECT * FROM preguntas WHERE test_id = ? ORDER BY id', [test.id]);
    return res.status(400).render('examenes/editor', { titulo: 'Exámenes', test, preguntas, temas, errores, datos: d });
  }
  await pool.query(
    `UPDATE tests SET tema_id = ?, nombre = ?, descripcion = ?, duracion_min = ?, intentos_max = ?, puntaje_aprobacion = ?,
       fecha_apertura = ?, fecha_cierre = ?, mostrar_respuestas = ? WHERE id = ?`,
    [d.tema_id, d.nombre, d.descripcion || null, d.duracion_min, d.intentos_max, d.puntaje_aprobacion, aSql(d.fecha_apertura), aSql(d.fecha_cierre), d.mostrar_respuestas, test.id]);
  req.session.flash = { tipo: 'exito', texto: 'Se guardó la configuración del test.' };
  res.redirect(`/docente/examenes/${test.id}`);
}

// ---------- Estado: publicar, archivar, volver a borrador ----------
async function cambiarEstado(req, res) {
  const test = await testDelDocente(req.params.id, req.session.usuario.dni);
  if (!test) return noEncontrado(res);
  const accion = req.body.accion;
  const volver = `/docente/examenes/${test.id}`;
  const aviso = (texto) => { req.session.flash = { tipo: 'aviso', texto }; return res.redirect(volver); };

  if (accion === 'publicar') {
    if (!test.total_preguntas) return aviso('Agrega al menos una pregunta antes de publicar.');
    if (test.fecha_cierre && new Date(test.fecha_cierre) < new Date()) return aviso('La fecha de cierre ya pasó. Cámbiala antes de publicar.');
    await pool.query("UPDATE tests SET estado = 'publicado' WHERE id = ?", [test.id]);
    req.session.flash = { tipo: 'exito', texto: `${test.nombre} está publicado: tus estudiantes de ${test.tema} ya lo pueden ver.` };
  } else if (accion === 'archivar') {
    await pool.query("UPDATE tests SET estado = 'archivado' WHERE id = ?", [test.id]);
    req.session.flash = { tipo: 'exito', texto: `${test.nombre} quedó archivado. Las notas se conservan.` };
  } else if (accion === 'borrador') {
    if (test.intentos_realizados) return aviso('Este test ya tiene intentos de estudiantes, así que no puede volver a borrador. Puedes archivarlo.');
    await pool.query("UPDATE tests SET estado = 'borrador' WHERE id = ?", [test.id]);
    req.session.flash = { tipo: 'exito', texto: `${test.nombre} volvió a borrador: los estudiantes ya no lo ven.` };
  }
  res.redirect(volver);
}

// Copia el test y sus preguntas como borrador nuevo
async function duplicar(req, res) {
  const test = await testDelDocente(req.params.id, req.session.usuario.dni);
  if (!test) return noEncontrado(res);
  const con = await pool.getConnection();
  let nuevoId;
  try {
    await con.beginTransaction();
    const [r] = await con.query(
      `INSERT INTO tests (tema_id, nombre, descripcion, duracion_min, intentos_max, puntaje_aprobacion, fecha_apertura, fecha_cierre, mostrar_respuestas, estado)
       SELECT tema_id, LEFT(CONCAT(nombre, ' (copia)'), 100), descripcion, duracion_min, intentos_max, puntaje_aprobacion, NULL, NULL, mostrar_respuestas, 'borrador'
       FROM tests WHERE id = ?`, [test.id]);
    nuevoId = r.insertId;
    // La imagen se comparte entre la original y la copia
    await con.query(
      `INSERT INTO preguntas (test_id, pregunta, opcion1, opcion2, opcion3, opcion4, respuesta_correcta, retroalimentacion, imagen, imagen_alt, puntos)
       SELECT ?, pregunta, opcion1, opcion2, opcion3, opcion4, respuesta_correcta, retroalimentacion, imagen, imagen_alt, puntos
       FROM preguntas WHERE test_id = ? ORDER BY id`, [nuevoId, test.id]);
    await con.commit();
  } catch (e) {
    await con.rollback();
    throw e;
  } finally {
    con.release();
  }
  req.session.flash = { tipo: 'exito', texto: `Se creó una copia de ${test.nombre} como borrador.` };
  res.redirect(`/docente/examenes/${nuevoId}`);
}

// Solo se borra si nadie lo ha hecho; si tiene intentos, se archiva
async function eliminar(req, res) {
  const test = await testDelDocente(req.params.id, req.session.usuario.dni);
  if (!test) return noEncontrado(res);
  if (test.intentos_realizados) {
    await pool.query("UPDATE tests SET estado = 'archivado' WHERE id = ?", [test.id]);
    req.session.flash = { tipo: 'aviso', texto: `${test.nombre} tiene intentos de estudiantes, así que no se borró: quedó archivado para conservar las notas.` };
    return res.redirect('/docente/examenes');
  }
  const [imagenes] = await pool.query('SELECT imagen FROM preguntas WHERE test_id = ? AND imagen IS NOT NULL', [test.id]);
  await pool.query('DELETE FROM tests WHERE id = ?', [test.id]); // las preguntas se borran solas (ON DELETE CASCADE)
  for (const { imagen } of imagenes) await borrarImagenSinUso(imagen);
  req.session.flash = { tipo: 'exito', texto: `Se eliminó el test ${test.nombre}.` };
  res.redirect('/docente/examenes');
}

// Borra el archivo solo si ninguna otra pregunta lo usa (las copias comparten imagen)
async function borrarImagenSinUso(imagen) {
  if (!imagen) return;
  const [[{ usos }]] = await pool.query('SELECT COUNT(*) AS usos FROM preguntas WHERE imagen = ?', [imagen]);
  if (!usos) borrarImagen(imagen);
}

// ---------- Preguntas ----------
function leerPregunta(req) {
  const b = req.body;
  const d = {
    pregunta: (b.pregunta || '').trim(),
    opcion1: (b.opcion1 || '').trim(), opcion2: (b.opcion2 || '').trim(),
    opcion3: (b.opcion3 || '').trim(), opcion4: (b.opcion4 || '').trim(),
    respuesta_correcta: Number(b.respuesta_correcta) || 0,
    retroalimentacion: (b.retroalimentacion || '').trim(),
    imagen_alt: (b.imagen_alt || '').trim(),
    puntos: b.puntos === '' || b.puntos === undefined ? NaN : Number(b.puntos),
    quitar_imagen: b.quitar_imagen === '1',
  };
  const e = [];
  if (req.errorSubida) e.push(req.errorSubida);
  if (!d.pregunta || d.pregunta.length > 2000) e.push('Escribe el enunciado de la pregunta (máximo 2000 caracteres).');
  [1, 2, 3, 4].forEach((i) => {
    const o = d['opcion' + i];
    if (!o || o.length > 255) e.push(`Escribe la opción ${'abcd'[i - 1]} (máximo 255 caracteres).`);
  });
  const opciones = [d.opcion1, d.opcion2, d.opcion3, d.opcion4].filter(Boolean).map((o) => o.toLowerCase());
  if (new Set(opciones).size < opciones.length) e.push('Las cuatro opciones deben ser distintas.');
  if (![1, 2, 3, 4].includes(d.respuesta_correcta)) e.push('Marca cuál es la respuesta correcta.');
  if (d.retroalimentacion.length > 2000) e.push('La retroalimentación puede tener hasta 2000 caracteres.');
  if (!Number.isInteger(d.puntos) || d.puntos < 1 || d.puntos > 100) e.push('Los puntos deben ser de 1 a 100.');
  if (d.imagen_alt.length > 255) e.push('La descripción de la imagen puede tener hasta 255 caracteres.');
  return { d, errores: e };
}

async function testEditable(req, res) {
  const test = await testDelDocente(req.params.id, req.session.usuario.dni);
  if (!test) { noEncontrado(res); return null; }
  if (test.intentos_realizados) {
    req.session.flash = { tipo: 'aviso', texto: 'Este test ya tiene intentos de estudiantes: sus preguntas no se pueden cambiar para no alterar las notas. Duplícalo para hacer una versión nueva.' };
    res.redirect(`/docente/examenes/${test.id}`);
    return null;
  }
  return test;
}

function quitarArchivoSubido(req) {
  if (req.file) borrarImagen(RUTA_PUBLICA + req.file.filename);
}

async function formNuevaPregunta(req, res) {
  const test = await testEditable(req, res);
  if (!test) return;
  res.render('examenes/pregunta', {
    titulo: 'Exámenes', test, modo: 'nueva', errores: [],
    datos: { pregunta: '', opcion1: '', opcion2: '', opcion3: '', opcion4: '', respuesta_correcta: 0, retroalimentacion: '', imagen: null, imagen_alt: '', puntos: 1 },
  });
}

async function crearPregunta(req, res) {
  const test = await testEditable(req, res);
  if (!test) return quitarArchivoSubido(req);
  const { d, errores } = leerPregunta(req);
  const imagen = req.file ? RUTA_PUBLICA + req.file.filename : null;
  if (imagen && !d.imagen_alt) errores.push('Describe la imagen para las personas que usan lector de pantalla.');
  if (errores.length) {
    quitarArchivoSubido(req);
    return res.status(400).render('examenes/pregunta', { titulo: 'Exámenes', test, modo: 'nueva', errores, datos: { ...d, imagen: null } });
  }
  await pool.query(
    `INSERT INTO preguntas (test_id, pregunta, opcion1, opcion2, opcion3, opcion4, respuesta_correcta, retroalimentacion, imagen, imagen_alt, puntos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [test.id, d.pregunta, d.opcion1, d.opcion2, d.opcion3, d.opcion4, d.respuesta_correcta, d.retroalimentacion || null, imagen, imagen ? d.imagen_alt : null, d.puntos]);
  req.session.flash = { tipo: 'exito', texto: `Pregunta ${test.total_preguntas + 1} guardada.` };
  res.redirect(req.body.siguiente === 'otra' ? `/docente/examenes/${test.id}/preguntas/nueva` : `/docente/examenes/${test.id}`);
}

async function preguntaDelTest(test, pid) {
  const [f] = await pool.query('SELECT * FROM preguntas WHERE id = ? AND test_id = ?', [Number(pid) || 0, test.id]);
  return f[0] || null;
}

async function formEditarPregunta(req, res) {
  const test = await testEditable(req, res);
  if (!test) return;
  const pregunta = await preguntaDelTest(test, req.params.pid);
  if (!pregunta) return noEncontrado(res);
  res.render('examenes/pregunta', { titulo: 'Exámenes', test, modo: 'editar', pregunta, errores: [], datos: { ...pregunta, retroalimentacion: pregunta.retroalimentacion || '', imagen_alt: pregunta.imagen_alt || '' } });
}

async function actualizarPregunta(req, res) {
  const test = await testEditable(req, res);
  if (!test) return quitarArchivoSubido(req);
  const pregunta = await preguntaDelTest(test, req.params.pid);
  if (!pregunta) { quitarArchivoSubido(req); return noEncontrado(res); }
  const { d, errores } = leerPregunta(req);
  let imagen = pregunta.imagen;
  if (d.quitar_imagen) imagen = null;
  if (req.file) imagen = RUTA_PUBLICA + req.file.filename;
  if (imagen && !d.imagen_alt) errores.push('Describe la imagen para las personas que usan lector de pantalla.');
  if (errores.length) {
    quitarArchivoSubido(req);
    return res.status(400).render('examenes/pregunta', { titulo: 'Exámenes', test, modo: 'editar', pregunta, errores, datos: { ...d, imagen: pregunta.imagen } });
  }
  await pool.query(
    `UPDATE preguntas SET pregunta = ?, opcion1 = ?, opcion2 = ?, opcion3 = ?, opcion4 = ?, respuesta_correcta = ?,
       retroalimentacion = ?, imagen = ?, imagen_alt = ?, puntos = ? WHERE id = ?`,
    [d.pregunta, d.opcion1, d.opcion2, d.opcion3, d.opcion4, d.respuesta_correcta, d.retroalimentacion || null, imagen, imagen ? d.imagen_alt : null, d.puntos, pregunta.id]);
  if (pregunta.imagen && pregunta.imagen !== imagen) await borrarImagenSinUso(pregunta.imagen);
  req.session.flash = { tipo: 'exito', texto: 'Pregunta actualizada.' };
  res.redirect(`/docente/examenes/${test.id}`);
}

async function eliminarPregunta(req, res) {
  const test = await testEditable(req, res);
  if (!test) return;
  const pregunta = await preguntaDelTest(test, req.params.pid);
  if (!pregunta) return noEncontrado(res);
  await pool.query('DELETE FROM preguntas WHERE id = ?', [pregunta.id]);
  await borrarImagenSinUso(pregunta.imagen);
  // Un test publicado sin preguntas vuelve a borrador
  if (test.estado === 'publicado' && test.total_preguntas === 1) {
    await pool.query("UPDATE tests SET estado = 'borrador' WHERE id = ?", [test.id]);
    req.session.flash = { tipo: 'aviso', texto: 'Se eliminó la última pregunta, así que el test volvió a borrador.' };
  } else {
    req.session.flash = { tipo: 'exito', texto: 'Pregunta eliminada.' };
  }
  res.redirect(`/docente/examenes/${test.id}`);
}

module.exports = {
  lista, formNuevo, crear, editor, actualizar, cambiarEstado, duplicar, eliminar,
  formNuevaPregunta, crearPregunta, formEditarPregunta, actualizarPregunta, eliminarPregunta,
};
