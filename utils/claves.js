// Utilidades para contraseñas y DNI
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const COSTO_BCRYPT = 10;
const HORAS_VIGENCIA_TEMPORAL = 72;

// Sin 0/O, 1/l/I para que no se confundan al dictarlas
const CARACTERES = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generarClaveTemporal(largo = 8) {
  let clave = '';
  for (let i = 0; i < largo; i++) clave += CARACTERES[crypto.randomInt(CARACTERES.length)];
  // Garantiza al menos un número
  if (!/\d/.test(clave)) clave = clave.slice(0, -1) + String(crypto.randomInt(2, 10));
  return clave;
}

function vencimientoTemporal() {
  return new Date(Date.now() + HORAS_VIGENCIA_TEMPORAL * 60 * 60 * 1000);
}

function hash(clave) {
  return bcrypt.hash(clave, COSTO_BCRYPT);
}

function comparar(clave, hashGuardado) {
  return bcrypt.compare(clave, hashGuardado);
}

// Devuelve una lista de problemas; vacía si la contraseña es válida
function validarNuevaClave(nueva, confirmar) {
  const errores = [];
  if (!nueva || nueva.length < 8) errores.push('La contraseña debe tener al menos 8 caracteres.');
  if (!/\d/.test(nueva || '')) errores.push('La contraseña debe tener al menos un número.');
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(nueva || '')) errores.push('La contraseña debe tener al menos una letra.');
  if (nueva !== confirmar) errores.push('Las dos contraseñas no coinciden.');
  return errores;
}

// Quita guiones y espacios: "0601-2008-01234" -> "0601200801234"
function limpiarDni(dni) {
  return String(dni || '').replace(/[\s-]/g, '');
}

function dniValido(dni) {
  return /^\d{13}$/.test(dni);
}

module.exports = {
  HORAS_VIGENCIA_TEMPORAL, generarClaveTemporal, vencimientoTemporal, hash, comparar,
  validarNuevaClave, limpiarDni, dniValido,
};
