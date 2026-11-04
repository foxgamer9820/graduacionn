// Sprint 4: el estudiante realiza el test, se califica automáticamente y recibe retroalimentación
const crypto = require('crypto');
const pool = require('../config/db');

const GRACIA_SEGUNDOS = 15; // margen para la última respuesta cuando se acaba el tiempo

const noEncontrado = (res, titulo = 'Test no disponible') =>
  res.status(404).render('error', { titulo, mensaje: 'No existe o no tienes acceso a él.' });

// ---------- Consultas de apoyo ----------

// Test que el estudiante puede ver: publicado, de un tema activo en el que está inscrito
async function testDelEstudiante(testId, dni) {
  const [f] = await pool.query(
    `SELECT ts.*, t.nombre AS tema, t.color AS tema_color, CONCAT(d.nombres, ' ', d.apellidos) AS docente,
       (SELECT COUNT(*) FROM preguntas p WHERE p.test_id = ts.id) AS total_preguntas,
       (ts.fecha_apertura IS NULL OR ts.fecha_apertura <= NOW()) AS ya_abrio,
       (ts.fecha_cierre IS NULL OR ts.fecha_cierre >= NOW()) AS sin_cerrar
     FROM tests ts JOIN temas t ON t.id = ts.tema_id JOIN usuarios d ON d.dni = t.docente_dni
     JOIN inscripciones i ON i.tema_id = t.id AND i.estudiante_dni = ?
     WHERE ts.id = ? AND ts.estado = 'publicado' AND t.estado = 'activo'`,
    [dni, Number(testId) || 0]);
  return f[0] || null;
}

// Intento del estudiante, con los datos del test que hacen falta
async function intentoDelEstudiante(resultadoId, dni) {
  const [f] = await pool.query(
    `SELECT r.*, ts.nombre AS test, ts.duracion_min, ts.puntaje_aprobacion, ts.mostrar_respuestas, ts.intentos_max,
       ts.estado AS estado_test, ts.fecha_cierre, ts.fecha_apertura, t.nombre AS tema, t.estado AS estado_tema,
       GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), r.fecha_inicio + INTERVAL ts.duracion_min MINUTE)) AS segundos_restantes,
       NOW() > r.fecha_inicio + INTERVAL ts.duracion_min MINUTE + INTERVAL ${GRACIA_SEGUNDOS} SECOND AS fuera_de_tiempo
     FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id
     WHERE r.id = ? AND r.estudiante_dni = ?`,
    [Number(resultadoId) || 0, dni]);
  return f[0] || null;
}

// Califica y cierra un intento: puntos obtenidos sobre el total, llevado a 100
async function finalizar(resultadoId) {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    const [[r]] = await con.query(
      `SELECT r.id, r.estado_intento, r.fecha_inicio, ts.duracion_min, ts.puntaje_aprobacion
       FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id WHERE r.id = ? FOR UPDATE`, [resultadoId]);
    if (!r || r.estado_intento !== 'en_curso') { await con.commit(); return; }
    await con.query('UPDATE respuestas_estudiante SET es_correcta = 0 WHERE resultado_id = ? AND opcion_elegida IS NULL', [r.id]);
    const [[t]] = await con.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(re.es_correcta), 0) AS correctas,
         COALESCE(SUM(p.puntos), 0) AS puntos_total, COALESCE(SUM(IF(re.es_correcta = 1, p.puntos, 0)), 0) AS puntos_obtenidos
       FROM respuestas_estudiante re JOIN preguntas p ON p.id = re.pregunta_id WHERE re.resultado_id = ?`, [r.id]);
    const calificacion = t.puntos_total ? Math.round((t.puntos_obtenidos / t.puntos_total) * 10000) / 100 : 0;
    const segundos = Math.min(Math.round((Date.now() - new Date(r.fecha_inicio).getTime()) / 1000), r.duracion_min * 60);
    await con.query(
      `UPDATE resultados_tests SET estado_intento = 'finalizado', correctas = ?, calificacion = ?, aprobado = ?,
         tiempo_segundos = ?, fecha_fin = NOW() WHERE id = ?`,
      [t.correctas, calificacion, calificacion >= r.puntaje_aprobacion ? 1 : 0, Math.max(0, segundos), r.id]);
    await con.commit();
  } catch (e) {
    await con.rollback();
    throw e;
  } finally {
    con.release();
  }
}

// Cierra los intentos del estudiante a los que ya se les acabó el tiempo
async function cerrarVencidos(dni) {
  const [vencidos] = await pool.query(
    `SELECT r.id FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id
     WHERE r.estudiante_dni = ? AND r.estado_intento = 'en_curso'
       AND NOW() > r.fecha_inicio + INTERVAL ts.duracion_min MINUTE + INTERVAL ? SECOND`, [dni, GRACIA_SEGUNDOS]);
  for (const v of vencidos) await finalizar(v.id);
}

// ---------- Pantalla previa al test ----------
async function previa(req, res) {
  const yo = req.session.usuario.dni;
  await cerrarVencidos(yo);
  const test = await testDelEstudiante(req.params.id, yo);
  if (!test) return noEncontrado(res);
  const [intentos] = await pool.query(
    `SELECT id, intento, estado_intento, calificacion, aprobado, correctas, total_preguntas, tiempo_segundos, fecha_fin
     FROM resultados_tests WHERE test_id = ? AND estudiante_dni = ? ORDER BY intento`, [test.id, yo]);
  const enCurso = intentos.find((i) => i.estado_intento === 'en_curso');
  const quedan = test.intentos_max - intentos.length;
  let motivo = null;
  if (!test.ya_abrio) motivo = `Este test abre el ${res.locals.fecha(test.fecha_apertura, true)}.`;
  else if (!test.sin_cerrar) motivo = 'Este test ya cerró.';
  else if (quedan <= 0) motivo = 'Ya usaste todos tus intentos.';
  res.render('estudiante/previa', { titulo: test.nombre, test, intentos, enCurso, quedan, motivo, seccion: '/estudiante' });
}

// Baraja con crypto (Fisher-Yates)
function barajar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Comenzar: crea el intento con las preguntas en orden aleatorio ----------
async function comenzar(req, res) {
  const yo = req.session.usuario.dni;
  await cerrarVencidos(yo);
  const test = await testDelEstudiante(req.params.id, yo);
  if (!test) return noEncontrado(res);
  const volver = (texto) => { req.session.flash = { tipo: 'aviso', texto }; return res.redirect(`/estudiante/tests/${test.id}`); };

  const [[actual]] = await pool.query(
    "SELECT id FROM resultados_tests WHERE test_id = ? AND estudiante_dni = ? AND estado_intento = 'en_curso'", [test.id, yo]);
  if (actual) return res.redirect(`/estudiante/intentos/${actual.id}/1`);
  if (!test.ya_abrio || !test.sin_cerrar) return volver('Este test no está abierto en este momento.');
  const [[{ usados }]] = await pool.query('SELECT COUNT(*) AS usados FROM resultados_tests WHERE test_id = ? AND estudiante_dni = ?', [test.id, yo]);
  if (usados >= test.intentos_max) return volver('Ya usaste todos tus intentos.');
  const [preguntas] = await pool.query('SELECT id FROM preguntas WHERE test_id = ?', [test.id]);
  if (!preguntas.length) return volver('Este test todavía no tiene preguntas.');

  const orden = barajar(preguntas.map((p) => p.id));
  const con = await pool.getConnection();
  let resultadoId;
  try {
    await con.beginTransaction();
    const [r] = await con.query(
      'INSERT INTO resultados_tests (estudiante_dni, test_id, intento, total_preguntas) VALUES (?, ?, ?, ?)',
      [yo, test.id, usados + 1, orden.length]);
    resultadoId = r.insertId;
    await con.query('INSERT INTO respuestas_estudiante (resultado_id, pregunta_id, posicion) VALUES ?',
      [orden.map((pid, i) => [resultadoId, pid, i + 1])]);
    await con.commit();
  } catch (e) {
    await con.rollback();
    if (e.code === 'ER_DUP_ENTRY') return res.redirect(`/estudiante/tests/${test.id}`); // doble clic en Comenzar
    throw e;
  } finally {
    con.release();
  }
  res.redirect(`/estudiante/intentos/${resultadoId}/1`);
}

// Revisa que el intento siga abierto; si se acabó el tiempo, lo cierra y manda al resultado
async function intentoAbierto(req, res) {
  const intento = await intentoDelEstudiante(req.params.rid, req.session.usuario.dni);
  if (!intento) { noEncontrado(res, 'Intento no encontrado'); return null; }
  if (intento.estado_intento !== 'en_curso') { res.redirect(`/estudiante/resultados/${intento.id}`); return null; }
  return intento;
}

async function preguntaEnPosicion(resultadoId, posicion) {
  const [f] = await pool.query(
    `SELECT re.id AS respuesta_id, re.posicion, re.opcion_elegida, p.id, p.pregunta, p.opcion1, p.opcion2, p.opcion3, p.opcion4, p.imagen, p.imagen_alt, p.puntos
     FROM respuestas_estudiante re JOIN preguntas p ON p.id = re.pregunta_id WHERE re.resultado_id = ? AND re.posicion = ?`,
    [resultadoId, posicion]);
  return f[0] || null;
}

async function mapaRespuestas(resultadoId) {
  const [f] = await pool.query('SELECT posicion, opcion_elegida IS NOT NULL AS respondida FROM respuestas_estudiante WHERE resultado_id = ? ORDER BY posicion', [resultadoId]);
  return f;
}

// ---------- Mostrar una pregunta ----------
async function verPregunta(req, res) {
  const intento = await intentoAbierto(req, res);
  if (!intento) return;
  if (intento.segundos_restantes <= 0) { await finalizar(intento.id); return res.redirect(`/estudiante/resultados/${intento.id}`); }
  const posicion = Math.min(Math.max(1, Number(req.params.pos) || 1), intento.total_preguntas);
  const pregunta = await preguntaEnPosicion(intento.id, posicion);
  if (!pregunta) return noEncontrado(res, 'Pregunta no encontrada');
  res.render('estudiante/pregunta', { titulo: intento.test, intento, pregunta, posicion, mapa: await mapaRespuestas(intento.id) });
}

// ---------- Guardar la respuesta y moverse ----------
async function responder(req, res) {
  const intento = await intentoDelEstudiante(req.params.rid, req.session.usuario.dni);
  const ajax = req.body.ajax === '1';
  if (!intento) return ajax ? res.status(404).json({ ok: false }) : noEncontrado(res, 'Intento no encontrado');
  if (intento.estado_intento !== 'en_curso') {
    return ajax ? res.status(409).json({ ok: false, terminado: true, url: `/estudiante/resultados/${intento.id}` }) : res.redirect(`/estudiante/resultados/${intento.id}`);
  }
  const vencido = intento.segundos_restantes <= 0;
  const pasado = Boolean(intento.fuera_de_tiempo);
  const posicion = Number(req.params.pos) || 0;
  const opcion = Number(req.body.opcion) || 0;

  // Se guarda la respuesta si llegó dentro del tiempo (con un pequeño margen)
  if (!pasado && [1, 2, 3, 4].includes(opcion)) {
    await pool.query(
      `UPDATE respuestas_estudiante re JOIN preguntas p ON p.id = re.pregunta_id
       SET re.opcion_elegida = ?, re.es_correcta = (p.respuesta_correcta = ?), re.fecha_respuesta = NOW()
       WHERE re.resultado_id = ? AND re.posicion = ?`, [opcion, opcion, intento.id, posicion]);
  }
  if (vencido || req.body.ir === 'terminar') {
    if (vencido || req.body.confirmado === '1') {
      await finalizar(intento.id);
      return ajax ? res.json({ ok: true, terminado: true, url: `/estudiante/resultados/${intento.id}` }) : res.redirect(`/estudiante/resultados/${intento.id}`);
    }
    return res.redirect(`/estudiante/intentos/${intento.id}/revisar`);
  }
  if (ajax) return res.json({ ok: true, guardada: [1, 2, 3, 4].includes(opcion) });
  let destino = posicion;
  if (req.body.ir === 'siguiente') destino = posicion + 1;
  else if (req.body.ir === 'anterior') destino = posicion - 1;
  else if (/^\d+$/.test(req.body.ir || '')) destino = Number(req.body.ir);
  if (destino > intento.total_preguntas) return res.redirect(`/estudiante/intentos/${intento.id}/revisar`);
  res.redirect(`/estudiante/intentos/${intento.id}/${Math.max(1, destino)}`);
}

// ---------- Revisar antes de entregar ----------
async function revisar(req, res) {
  const intento = await intentoAbierto(req, res);
  if (!intento) return;
  if (intento.segundos_restantes <= 0) { await finalizar(intento.id); return res.redirect(`/estudiante/resultados/${intento.id}`); }
  const mapa = await mapaRespuestas(intento.id);
  res.render('estudiante/revisar', { titulo: intento.test, intento, mapa, sinResponder: mapa.filter((m) => !m.respondida).length });
}

async function entregar(req, res) {
  const intento = await intentoAbierto(req, res);
  if (!intento) return;
  await finalizar(intento.id);
  res.redirect(`/estudiante/resultados/${intento.id}`);
}

// ---------- Resultado con retroalimentación ----------
async function resultado(req, res) {
  const yo = req.session.usuario.dni;
  let intento = await intentoDelEstudiante(req.params.rid, yo);
  if (!intento) return noEncontrado(res, 'Resultado no encontrado');
  if (intento.estado_intento === 'en_curso') {
    if (intento.segundos_restantes > 0) return res.redirect(`/estudiante/intentos/${intento.id}/1`);
    await finalizar(intento.id);
    intento = await intentoDelEstudiante(req.params.rid, yo);
  }
  let revision = [];
  if (intento.mostrar_respuestas) {
    [revision] = await pool.query(
      `SELECT re.posicion, re.opcion_elegida, re.es_correcta, p.pregunta, p.opcion1, p.opcion2, p.opcion3, p.opcion4,
         p.respuesta_correcta, p.retroalimentacion, p.imagen, p.imagen_alt, p.puntos
       FROM respuestas_estudiante re JOIN preguntas p ON p.id = re.pregunta_id WHERE re.resultado_id = ? ORDER BY re.posicion`, [intento.id]);
  }
  const [[{ usados }]] = await pool.query('SELECT COUNT(*) AS usados FROM resultados_tests WHERE test_id = ? AND estudiante_dni = ?', [intento.test_id, yo]);
  const test = await testDelEstudiante(intento.test_id, yo);
  const puedeReintentar = Boolean(test && test.ya_abrio && test.sin_cerrar && usados < intento.intentos_max);
  res.render('estudiante/resultado', { titulo: 'Resultado', intento, revision, usados, puedeReintentar, seccion: '/estudiante' });
}

module.exports = { previa, comenzar, verPregunta, responder, revisar, entregar, resultado, cerrarVencidos, finalizar };
