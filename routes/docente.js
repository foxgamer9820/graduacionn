// Rutas del docente
const router = require('express').Router();
const { requiereRol } = require('../middleware/auth');
const cuentas = require('../controllers/cuentasController');
const panel = require('../controllers/panelController');
const temas = require('../controllers/temasController');
const examenes = require('../controllers/examenesController');
const { imagenPregunta } = require('../utils/subidas');
const rendimiento = require('../controllers/rendimientoController');

router.use(requiereRol('docente'));

router.get('/', panel.inicioDocente);

// Cuentas de estudiantes y de padres o encargados
router.use('/estudiantes', cuentas.contexto('docente'));
router.get('/estudiantes', cuentas.lista);
router.get('/estudiantes/nuevo', cuentas.formNuevo);
router.post('/estudiantes', cuentas.crear);
router.get('/estudiantes/:dni/editar', cuentas.formEditar);
router.post('/estudiantes/:dni', cuentas.actualizar);
router.post('/estudiantes/:dni/clave', cuentas.restablecerClave);
router.post('/estudiantes/:dni/estado', cuentas.cambiarEstado);
router.post('/estudiantes/:dni/eliminar', cuentas.eliminar);

// Temas de estudio (Sprint 2)
router.get('/temas', temas.lista);
router.get('/temas/nuevo', temas.formNuevo);
router.post('/temas', temas.crear);
router.get('/temas/:id/editar', temas.formEditar);
router.post('/temas/:id', temas.actualizar);
router.post('/temas/:id/estado', temas.cambiarEstado);
router.post('/temas/:id/eliminar', temas.eliminar);
router.get('/temas/:id/estudiantes', temas.formInscribir);
router.post('/temas/:id/estudiantes', temas.guardarInscripciones);
router.post('/temas/:id/estudiantes/dni', temas.inscribirPorDni);

// Exámenes y preguntas (Sprint 3)
router.get('/examenes', examenes.lista);
router.get('/examenes/nuevo', examenes.formNuevo);
router.post('/examenes', examenes.crear);
router.get('/examenes/:id', examenes.editor);
router.post('/examenes/:id', examenes.actualizar);
router.post('/examenes/:id/estado', examenes.cambiarEstado);
router.post('/examenes/:id/duplicar', examenes.duplicar);
router.post('/examenes/:id/eliminar', examenes.eliminar);
router.get('/examenes/:id/preguntas/nueva', examenes.formNuevaPregunta);
router.post('/examenes/:id/preguntas', imagenPregunta, examenes.crearPregunta);
router.get('/examenes/:id/preguntas/:pid/editar', examenes.formEditarPregunta);
router.post('/examenes/:id/preguntas/:pid', imagenPregunta, examenes.actualizarPregunta);
router.post('/examenes/:id/preguntas/:pid/eliminar', examenes.eliminarPregunta);

// Seguimiento del rendimiento (Sprint 5)
router.get('/rendimiento', rendimiento.panelDocente);
router.get('/rendimiento/tests/:id/exportar', rendimiento.exportar);
router.get('/rendimiento/estudiantes/:dni', rendimiento.estudianteDocente);
router.get('/rendimiento/intentos/:rid', rendimiento.intentoDocente);

module.exports = router;
