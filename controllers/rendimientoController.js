// Sprint 5: seguimiento del rendimiento (docente, estudiante y padre o encargado)
const pool = require('../config/db');
const { lineaCalificaciones } = require('../utils/graficos');
const { cerrarVencidos } = require('./intentosController');

const MIS_ESTUDIANTES = `
  SELECT dni FROM usuarios WHERE rol = 'estudiante' AND creado_por = ?
  UNION
  SELECT i.estudiante_dni FROM inscripciones i JOIN temas t ON t.id = i.tema_id WHERE t.docente_dni = ?`;

const noEncontrado = (res, titulo = 'No encontrado') =>
  res.status(404).render('error', { titulo, mensaje: 'No existe o no tienes acceso a esta información.' });

const corta = (d) => {
  const f = new Date(d);
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`;
};

// ---------- Consultas compartidas ----------

// Intentos terminados de un estudiante, del más antiguo al más reciente.
// Si se indica docente, solo los de sus temas.
async function historial(dni, docenteDni = null) {
  const [f] = await pool.query(
    `SELECT r.id, r.intento, r.calificacion, r.aprobado, r.correctas, r.total_preguntas, r.tiempo_segundos, r.fecha_fin,
       ts.id AS test_id, ts.nombre AS test, ts.puntaje_aprobacion, t.id AS tema_id, t.nombre AS tema, t.color AS tema_color
     FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id
     WHERE r.estudiante_dni = ? AND r.estado_intento = 'finalizado' ${docenteDni ? 'AND t.docente_dni = ?' : ''}
     ORDER BY r.fecha_fin, r.id`, docenteDni ? [dni, docenteDni] : [dni]);
  return f;
}

// Resumen a partir del historial: usa la mejor nota de cada test
function resumen(intentos) {
  const mejores = new Map();
  for (const r of intentos) {
    const previo = mejores.get(r.test_id);
    if (!previo || Number(r.calificacion) > Number(previo.calificacion)) mejores.set(r.test_id, r);
  }
  const lista = [...mejores.values()];
  const promedio = lista.length ? Math.round(lista.reduce((a, r) => a + Number(r.calificacion), 0) / lista.length) : null;
  const porTema = new Map();
  for (const r of lista) {
    const t = porTema.get(r.tema_id) || { nombre: r.tema, color: r.tema_color, suma: 0, tests: 0, aprobados: 0 };
    t.suma += Number(r.calificacion); t.tests++; if (r.aprobado) t.aprobados++;
    porTema.set(r.tema_id, t);
  }
  return {
    promedio,
    completados: lista.length,
    aprobados: lista.filter((r) => r.aprobado).length,
    mejor: lista.length ? Math.max(...lista.map((r) => Number(r.calificacion))) : null,
    intentos: intentos.length,
    porTema: [...porTema.values()].map((t) => ({ ...t, promedio: Math.round(t.suma / t.tests) })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}

function grafica(intentos, descripcion) {
  if (!intentos.length) return '';
  const minimas = new Set(intentos.map((r) => r.puntaje_aprobacion));
  return lineaCalificaciones(
    intentos.map((r) => ({ etiqueta: corta(r.fecha_fin), valor: Math.round(Number(r.calificacion)), aprobado: r.aprobado === 1, titulo: r.test })),
    { descripcion, notaMinima: minimas.size === 1 ? [...minimas][0] : null });
}

async function revisionDe(resultadoId) {
  const [f] = await pool.query(
    `SELECT re.posicion, re.opcion_elegida, re.es_correcta, p.pregunta, p.opcion1, p.opcion2, p.opcion3, p.opcion4,
       p.respuesta_correcta, p.retroalimentacion, p.imagen, p.imagen_alt, p.puntos
     FROM respuestas_estudiante re JOIN preguntas p ON p.id = re.pregunta_id WHERE re.resultado_id = ? ORDER BY re.posicion`, [resultadoId]);
  return f;
}

async function intentoConDatos(resultadoId) {
  const [f] = await pool.query(
    `SELECT r.*, ts.nombre AS test, ts.puntaje_aprobacion, ts.intentos_max, ts.mostrar_respuestas, t.nombre AS tema, t.docente_dni,
       u.nombres, u.apellidos
     FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id JOIN usuarios u ON u.dni = r.estudiante_dni
     WHERE r.id = ? AND r.estado_intento = 'finalizado'`, [Number(resultadoId) || 0]);
  return f[0] || null;
}

// ---------- Docente: panel de rendimiento ----------
async function datosDeTest(test) {
  // Estudiantes inscritos en el tema o que ya hicieron el test, con su mejor intento
  const [estudiantes] = await pool.query(
    `SELECT u.dni, u.nombres, u.apellidos,
       (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ? AND r.estudiante_dni = u.dni) AS intentos,
       (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ? AND r.estudiante_dni = u.dni AND r.estado_intento = 'en_curso') AS en_curso,
       (SELECT MAX(r.calificacion) FROM resultados_tests r WHERE r.test_id = ? AND r.estudiante_dni = u.dni AND r.estado_intento = 'finalizado') AS mejor,
       (SELECT MAX(r.aprobado) FROM resultados_tests r WHERE r.test_id = ? AND r.estudiante_dni = u.dni AND r.estado_intento = 'finalizado') AS aprobado,
       (SELECT MAX(r.fecha_fin) FROM resultados_tests r WHERE r.test_id = ? AND r.estudiante_dni = u.dni AND r.estado_intento = 'finalizado') AS ultimo,
       (SELECT r.id FROM resultados_tests r WHERE r.test_id = ? AND r.estudiante_dni = u.dni AND r.estado_intento = 'finalizado'
          ORDER BY r.calificacion DESC, r.fecha_fin DESC LIMIT 1) AS mejor_id
     FROM usuarios u
     WHERE u.dni IN (SELECT estudiante_dni FROM inscripciones WHERE tema_id = ? UNION SELECT estudiante_dni FROM resultados_tests WHERE test_id = ?)
     ORDER BY u.apellidos, u.nombres`,
    [test.id, test.id, test.id, test.id, test.id, test.id, test.tema_id, test.id]);
  const presentaron = estudiantes.filter((e) => e.mejor !== null);
  const [[{ tiempo }]] = await pool.query(
    "SELECT ROUND(AVG(tiempo_segundos)) AS tiempo FROM resultados_tests WHERE test_id = ? AND estado_intento = 'finalizado'", [test.id]);
  const [preguntas] = await pool.query(
    `SELECT p.id, p.pregunta, p.respuesta_correcta, p.opcion1, p.opcion2, p.opcion3, p.opcion4,
       COUNT(re.id) AS respuestas, COALESCE(SUM(re.es_correcta), 0) AS correctas,
       SUM(re.opcion_elegida = 1) AS o1, SUM(re.opcion_elegida = 2) AS o2, SUM(re.opcion_elegida = 3) AS o3, SUM(re.opcion_elegida = 4) AS o4,
       SUM(re.opcion_elegida IS NULL) AS en_blanco
     FROM preguntas p
     LEFT JOIN respuestas_estudiante re ON re.pregunta_id = p.id
       AND re.resultado_id IN (SELECT id FROM resultados_tests WHERE test_id = ? AND estado_intento = 'finalizado')
     WHERE p.test_id = ? GROUP BY p.id ORDER BY p.id`, [test.id, test.id]);
  preguntas.forEach((p, i) => {
    p.numero = i + 1;
    p.porcentaje = p.respuestas ? Math.round((Number(p.correctas) / p.respuestas) * 100) : null;
    // Opción incorrecta más elegida: ayuda a ver la confusión más común
    const malas = [1, 2, 3, 4].filter((n) => n !== p.respuesta_correcta).map((n) => ({ n, veces: Number(p['o' + n]) || 0 })).sort((a, b) => b.veces - a.veces);
    p.confusion = malas[0] && malas[0].veces ? { letra: 'abcd'[malas[0].n - 1], texto: p['opcion' + malas[0].n], veces: malas[0].veces } : null;
  });
  return {
    estudiantes,
    stats: {
      inscritos: estudiantes.length,
      presentaron: presentaron.length,
      aprobaron: presentaron.filter((e) => e.aprobado).length,
      promedio: presentaron.length ? Math.round(presentaron.reduce((a, e) => a + Number(e.mejor), 0) / presentaron.length) : null,
      tiempo,
    },
    preguntas,
  };
}

// Mejor nota de cada estudiante en cada test del docente (opcionalmente de un tema)
async function mejoresNotas(docenteDni, temaId) {
  const [f] = await pool.query(
    `SELECT r.test_id, r.estudiante_dni, MAX(r.calificacion) AS mejor, MAX(r.aprobado) AS aprobado
     FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id
     WHERE t.docente_dni = ? AND r.estado_intento = 'finalizado' ${temaId ? 'AND t.id = ?' : ''}
     GROUP BY r.test_id, r.estudiante_dni`, temaId ? [docenteDni, temaId] : [docenteDni]);
  return f;
}

const promedioDe = (lista) => (lista.length ? Math.round(lista.reduce((a, x) => a + Number(x.mejor), 0) / lista.length) : null);

async function panelDocente(req, res) {
  const yo = req.session.usuario.dni;
  const [temas] = await pool.query('SELECT id, nombre FROM temas WHERE docente_dni = ? ORDER BY nombre', [yo]);
  const temaId = Number(req.query.tema) || 0;
  const [tests] = await pool.query(
    `SELECT ts.id, ts.nombre, ts.estado, ts.tema_id, ts.puntaje_aprobacion, t.nombre AS tema,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.tema_id = ts.tema_id) AS inscritos
     FROM tests ts JOIN temas t ON t.id = ts.tema_id
     WHERE t.docente_dni = ? AND ts.estado <> 'borrador' ${temaId ? 'AND ts.tema_id = ?' : ''}
     ORDER BY t.nombre, ts.fecha_creacion DESC`, temaId ? [yo, temaId] : [yo]);
  const mejores = await mejoresNotas(yo, temaId);
  for (const t of tests) {
    const delTest = mejores.filter((m) => m.test_id === t.id);
    t.presentaron = delTest.length;
    t.aprobaron = delTest.filter((m) => m.aprobado).length;
    t.promedio = promedioDe(delTest);
  }
  const testId = Number(req.query.test) || 0;
  const test = tests.find((t) => t.id === testId) || null;
  if (test) {
    return res.render('rendimiento/test', { titulo: 'Rendimiento', temas, tests, temaId, test, ...(await datosDeTest(test)) });
  }

  // Vista general: estudiantes del docente con su promedio (mejor nota de cada test)
  const [estudiantes] = await pool.query(
    `SELECT u.dni, u.nombres, u.apellidos, u.ultimo_acceso FROM usuarios u
     WHERE u.dni IN (${temaId ? 'SELECT estudiante_dni FROM inscripciones WHERE tema_id = ?' : MIS_ESTUDIANTES})`,
    temaId ? [temaId] : [yo, yo]);
  for (const e of estudiantes) {
    const suyos = mejores.filter((m) => m.estudiante_dni === e.dni);
    e.completados = suyos.length;
    e.promedio = promedioDe(suyos);
  }
  estudiantes.sort((a, b) => (a.promedio === null) - (b.promedio === null) || (a.promedio ?? 0) - (b.promedio ?? 0)
    || a.apellidos.localeCompare(b.apellidos));
  res.render('rendimiento/general', { titulo: 'Rendimiento', temas, tests, temaId, estudiantes });
}

// Descarga en CSV (se abre en Excel) los resultados de un test
async function exportar(req, res) {
  const yo = req.session.usuario.dni;
  const [[test]] = await pool.query(
    'SELECT ts.id, ts.nombre, ts.tema_id, t.nombre AS tema FROM tests ts JOIN temas t ON t.id = ts.tema_id WHERE ts.id = ? AND t.docente_dni = ?',
    [Number(req.params.id) || 0, yo]);
  if (!test) return noEncontrado(res, 'Test no encontrado');
  const { estudiantes } = await datosDeTest(test);
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['DNI', 'Nombres', 'Apellidos', 'Intentos', 'Mejor nota', 'Estado', 'Último intento']];
  for (const e of estudiantes) {
    const estado = e.mejor === null ? (e.en_curso ? 'En curso' : 'Sin presentar') : e.aprobado ? 'Aprobado' : 'Reprobado';
    filas.push([e.dni, e.nombres, e.apellidos, e.intentos, e.mejor === null ? '' : Number(e.mejor), estado, e.ultimo ? res.locals.fecha(e.ultimo, true) : '']);
  }
  const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
  const nombre = `resultados-${test.nombre}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${nombre}.csv"`);
  res.send(csv);
}

// Detalle de un estudiante: su progreso en los tests del docente
async function estudianteDocente(req, res) {
  const yo = req.session.usuario.dni;
  const [[est]] = await pool.query(
    `SELECT dni, nombres, apellidos, ultimo_acceso FROM usuarios WHERE dni = ? AND dni IN (${MIS_ESTUDIANTES})`, [req.params.dni, yo, yo]);
  if (!est) return noEncontrado(res, 'Estudiante no encontrado');
  const intentos = await historial(est.dni, yo);
  res.render('rendimiento/estudiante', {
    titulo: 'Rendimiento', est, intentos: intentos.slice().reverse(), resumen: resumen(intentos),
    grafica: grafica(intentos, `Calificaciones de ${est.nombres} ${est.apellidos}`), volver: '/docente/rendimiento', base: '/docente/rendimiento',
  });
}

async function intentoDocente(req, res) {
  const intento = await intentoConDatos(req.params.rid);
  if (!intento || intento.docente_dni !== req.session.usuario.dni) return noEncontrado(res, 'Intento no encontrado');
  res.render('rendimiento/intento', {
    titulo: 'Rendimiento', intento, revision: await revisionDe(intento.id), mostrar: true,
    volver: `/docente/rendimiento/estudiantes/${intento.estudiante_dni}`, textoVolver: `Volver a ${intento.nombres} ${intento.apellidos}`,
  });
}

// ---------- Estudiante: mi progreso ----------
async function miProgreso(req, res) {
  const yo = req.session.usuario.dni;
  await cerrarVencidos(yo);
  const intentos = await historial(yo);
  res.render('rendimiento/estudiante', {
    titulo: 'Mi progreso', est: null, intentos: intentos.slice().reverse(), resumen: resumen(intentos),
    grafica: grafica(intentos, 'Mis calificaciones en el tiempo'), volver: null, base: '/estudiante',
  });
}

// ---------- Padre o encargado ----------
async function estudiantesDelTutor(tutorDni) {
  const [f] = await pool.query(
    `SELECT e.dni, e.nombres, e.apellidos, e.ultimo_acceso, te.parentesco
     FROM tutores_estudiantes te JOIN usuarios e ON e.dni = te.estudiante_dni WHERE te.tutor_dni = ? ORDER BY e.nombres`, [tutorDni]);
  return f;
}

async function panelTutor(req, res) {
  const estudiantes = await estudiantesDelTutor(req.session.usuario.dni);
  const elegido = estudiantes.find((e) => e.dni === req.query.e) || estudiantes[0] || null;
  let datos = {};
  if (elegido) {
    await cerrarVencidos(elegido.dni);
    const intentos = await historial(elegido.dni);
    const [pendientes] = await pool.query(
      `SELECT ts.id, ts.nombre, ts.fecha_cierre, ts.intentos_max, t.nombre AS tema,
         (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ?) AS usados
       FROM tests ts JOIN temas t ON t.id = ts.tema_id JOIN inscripciones i ON i.tema_id = t.id AND i.estudiante_dni = ?
       WHERE ts.estado = 'publicado' AND t.estado = 'activo'
         AND (ts.fecha_apertura IS NULL OR ts.fecha_apertura <= NOW()) AND (ts.fecha_cierre IS NULL OR ts.fecha_cierre >= NOW())
         AND NOT EXISTS (SELECT 1 FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ? AND r.aprobado = 1)
         AND (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ?) < ts.intentos_max
       ORDER BY ts.fecha_cierre IS NULL, ts.fecha_cierre`, [elegido.dni, elegido.dni, elegido.dni, elegido.dni]);
    const [[{ disponibles }]] = await pool.query(
      `SELECT COUNT(*) AS disponibles FROM tests ts JOIN inscripciones i ON i.tema_id = ts.tema_id AND i.estudiante_dni = ?
       JOIN temas t ON t.id = ts.tema_id WHERE ts.estado = 'publicado' AND t.estado = 'activo'`, [elegido.dni]);
    datos = {
      intentos: intentos.slice().reverse(), resumen: resumen(intentos), pendientes, disponibles,
      grafica: grafica(intentos, `Calificaciones de ${elegido.nombres} ${elegido.apellidos}`),
    };
  }
  res.render('tutor/inicio', { titulo: 'Mis estudiantes', estudiantes, elegido, ...datos });
}

async function intentoTutor(req, res) {
  const intento = await intentoConDatos(req.params.rid);
  const mios = await estudiantesDelTutor(req.session.usuario.dni);
  if (!intento || !mios.some((e) => e.dni === intento.estudiante_dni)) return noEncontrado(res, 'Resultado no encontrado');
  res.render('rendimiento/intento', {
    titulo: 'Mis estudiantes', intento, revision: intento.mostrar_respuestas ? await revisionDe(intento.id) : [], mostrar: !!intento.mostrar_respuestas,
    volver: `/tutor?e=${intento.estudiante_dni}`, textoVolver: `Volver a ${intento.nombres}`,
  });
}

module.exports = { panelDocente, exportar, estudianteDocente, intentoDocente, miProgreso, panelTutor, intentoTutor };
