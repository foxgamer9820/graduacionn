// Rutas públicas: inicio y cierre de sesión
const router = require('express').Router();
const auth = require('../controllers/authController');

router.get('/', auth.irAlInicio);
router.get('/login', auth.mostrarLogin);
router.post('/login', auth.iniciarSesion);
router.post('/logout', auth.cerrarSesion);

module.exports = router;
