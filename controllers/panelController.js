// Pantallas de inicio de cada rol
const pool = require('../config/db');

async function inicioDocente(req, res) {
  const yo = req.session.usuario.dni;
  const [[conteos]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM (
          SELECT dni FROM usuarios WHERE rol = 'estudiante' AND creado_por = ?
          UNION SELECT i.estudiante_dni FROM inscripciones i JOIN temas t ON t.id = i.tema_id WHERE t.docente_dni = ?) x) AS estudiantes,
       (SELECT COUNT(*) FROM temas WHERE docente_dni = ? AND estado = 'activo') AS temas,
       (SELECT COUNT(*) FROM tests ts JOIN temas t ON t.id = ts.tema_id WHERE t.docente_dni = ? AND ts.estado = 'publicado') AS tests,
       (SELECT ROUND(AVG(r.calificacion)) FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id
          WHERE t.docente_dni = ? AND r.estado_intento = 'finalizado') AS promedio`,
    [yo, yo, yo, yo, yo]);
  const [porTema] = await pool.query(
    `SELECT t.nombre, t.color, ROUND(AVG(r.calificacion)) AS promedio
     FROM temas t JOIN tests ts ON ts.tema_id = t.id JOIN resultados_tests r ON r.test_id = ts.id AND r.estado_intento = 'finalizado'
     WHERE t.docente_dni = ? GROUP BY t.id ORDER BY t.nombre`, [yo]);
  const [ultimos] = await pool.query(
    `SELECT r.id, u.nombres, u.apellidos, ts.nombre AS test, r.calificacion, r.aprobado
     FROM resultados_tests r JOIN usuarios u ON u.dni = r.estudiante_dni JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id
     WHERE t.docente_dni = ? AND r.estado_intento = 'finalizado' ORDER BY r.fecha_fin DESC LIMIT 5`, [yo]);
  res.render('docente/inicio', { conteos, porTema, ultimos });
}

async function inicioEstudiante(req, res) {
  const yo = req.session.usuario.dni;
  await require('./intentosController').cerrarVencidos(yo);
  const [temas] = await pool.query(
    `SELECT t.id, t.nombre, t.color, CONCAT(d.nombres, ' ', d.apellidos) AS docente,
       (SELECT COUNT(*) FROM tests ts WHERE ts.tema_id = t.id AND ts.estado = 'publicado') AS tests,
       (SELECT COUNT(DISTINCT r.test_id) FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id
          WHERE ts.tema_id = t.id AND ts.estado = 'publicado' AND r.estudiante_dni = ? AND r.aprobado = 1) AS aprobados
     FROM inscripciones i JOIN temas t ON t.id = i.tema_id JOIN usuarios d ON d.dni = t.docente_dni
     WHERE i.estudiante_dni = ? AND t.estado = 'activo' ORDER BY t.nombre`, [yo, yo]);
  // Tests abiertos de sus temas, con lo que ya hizo en cada uno
  const [tests] = await pool.query(
    `SELECT ts.id, ts.nombre, ts.duracion_min, ts.intentos_max, ts.fecha_cierre, t.nombre AS tema, t.color AS tema_color,
       (SELECT COUNT(*) FROM preguntas p WHERE p.test_id = ts.id) AS preguntas,
       (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ?) AS intentos,
       (SELECT r.id FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ? AND r.estado_intento = 'en_curso' LIMIT 1) AS en_curso,
       (SELECT MAX(r.calificacion) FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ? AND r.estado_intento = 'finalizado') AS mejor_nota,
       (SELECT MAX(r.aprobado) FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ? AND r.estado_intento = 'finalizado') AS aprobado
     FROM tests ts JOIN temas t ON t.id = ts.tema_id JOIN inscripciones i ON i.tema_id = t.id AND i.estudiante_dni = ?
     WHERE ts.estado = 'publicado' AND t.estado = 'activo'
       AND (ts.fecha_apertura IS NULL OR ts.fecha_apertura <= NOW()) AND (ts.fecha_cierre IS NULL OR ts.fecha_cierre >= NOW())
     ORDER BY (SELECT COUNT(*) FROM resultados_tests r WHERE r.test_id = ts.id AND r.estudiante_dni = ?) >= ts.intentos_max,
       ts.fecha_cierre IS NULL, ts.fecha_cierre, ts.nombre`, [yo, yo, yo, yo, yo, yo]);
  const [recientes] = await pool.query(
    `SELECT r.id, r.calificacion, r.aprobado, r.intento, r.fecha_fin, ts.nombre AS test, t.nombre AS tema
     FROM resultados_tests r JOIN tests ts ON ts.id = r.test_id JOIN temas t ON t.id = ts.tema_id
     WHERE r.estudiante_dni = ? AND r.estado_intento = 'finalizado' ORDER BY r.fecha_fin DESC LIMIT 5`, [yo]);
  const [[{ promedio }]] = await pool.query(
    "SELECT ROUND(AVG(calificacion)) AS promedio FROM resultados_tests WHERE estudiante_dni = ? AND estado_intento = 'finalizado'", [yo]);
  const pendientes = tests.filter((t) => !t.aprobado && t.intentos < t.intentos_max).length;
  res.render('estudiante/inicio', { temas, tests, recientes, promedio, pendientes });
}

// Pantallas de los siguientes sprints
function proximamente(titulo, sprint) {
  return (req, res) => res.render('proximamente', { titulo, sprint });
}

module.exports = { inicioDocente, inicioEstudiante, proximamente };
