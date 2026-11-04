// Rutas del padre, madre o encargado (solo consulta)
const router = require('express').Router();
const { requiereRol } = require('../middleware/auth');
const rendimiento = require('../controllers/rendimientoController');

router.use(requiereRol('tutor'));

router.get('/', rendimiento.panelTutor);
router.get('/resultados/:rid', rendimiento.intentoTutor);

module.exports = router;
