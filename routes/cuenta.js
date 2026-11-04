// Rutas comunes a todos los roles (requieren sesión)
const router = require('express').Router();
const auth = require('../controllers/authController');
const perfil = require('../controllers/perfilController');
const cuentas = require('../controllers/cuentasController');

router.get('/cambiar-clave', auth.mostrarCambioClave);
router.post('/cambiar-clave', auth.guardarCambioClave);

router.get('/perfil', perfil.mostrar);
router.post('/perfil', perfil.guardarDatos);
router.post('/perfil/clave', perfil.guardarClave);

router.get('/cuenta-creada', cuentas.cuentaCreada);

module.exports = router;
