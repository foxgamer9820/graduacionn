// Rutas del administrador
const router = require('express').Router();
const { requiereRol } = require('../middleware/auth');
const cuentas = require('../controllers/cuentasController');
const temas = require('../controllers/temasController');

router.use(requiereRol('administrador'), cuentas.contexto('admin'));

router.get('/', (req, res) => res.redirect('/admin/docentes'));
router.get('/docentes', cuentas.lista);
router.get('/docentes/nuevo', cuentas.formNuevo);
router.post('/docentes', cuentas.crear);
router.get('/docentes/:dni/editar', cuentas.formEditar);
router.post('/docentes/:dni', cuentas.actualizar);
router.post('/docentes/:dni/clave', cuentas.restablecerClave);
router.post('/docentes/:dni/estado', cuentas.cambiarEstado);
router.post('/docentes/:dni/eliminar', cuentas.eliminar);

// Asignar un tema a un docente (Sprint 2)
router.post('/temas/asignar', temas.asignar);

module.exports = router;
