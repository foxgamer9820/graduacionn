// Rutas del estudiante
const router = require('express').Router();
const { requiereRol } = require('../middleware/auth');
const panel = require('../controllers/panelController');
const intentos = require('../controllers/intentosController');
const rendimiento = require('../controllers/rendimientoController');

router.use(requiereRol('estudiante'));

router.get('/', panel.inicioEstudiante);

// Realizar tests (Sprint 4)
router.get('/tests/:id', intentos.previa);
router.post('/tests/:id/comenzar', intentos.comenzar);
router.get('/intentos/:rid/revisar', intentos.revisar);
router.post('/intentos/:rid/entregar', intentos.entregar);
router.get('/intentos/:rid/:pos', intentos.verPregunta);
router.post('/intentos/:rid/:pos', intentos.responder);
router.get('/resultados/:rid', intentos.resultado);

// Mi progreso (Sprint 5)
router.get('/progreso', rendimiento.miProgreso);

module.exports = router;
