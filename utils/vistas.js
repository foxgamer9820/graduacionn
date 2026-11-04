// Funciones y datos que usan todas las vistas EJS
const iconosSvg = require('./iconos.json');

const MENUS = {
  administrador: [
    { icono: 'MdSchool', texto: 'Docentes', ruta: '/admin/docentes' },
    { icono: 'MdPerson', texto: 'Mi perfil', ruta: '/perfil' },
  ],
  docente: [
    { icono: 'MdDashboard', texto: 'Inicio', ruta: '/docente' },
    { icono: 'MdPeople', texto: 'Estudiantes', ruta: '/docente/estudiantes' },
    { icono: 'MdMenuBook', texto: 'Temas', ruta: '/docente/temas' },
    { icono: 'MdQuiz', texto: 'Exámenes', ruta: '/docente/examenes' },
    { icono: 'MdBarChart', texto: 'Rendimiento', ruta: '/docente/rendimiento' },
    { icono: 'MdPerson', texto: 'Mi perfil', ruta: '/perfil' },
  ],
  estudiante: [
    { icono: 'MdHome', texto: 'Inicio', ruta: '/estudiante' },
    { icono: 'MdTrendingUp', texto: 'Mi progreso', ruta: '/estudiante/progreso' },
    { icono: 'MdPerson', texto: 'Mi perfil', ruta: '/perfil' },
  ],
  tutor: [
    { icono: 'MdFamilyRestroom', texto: 'Mis estudiantes', ruta: '/tutor' },
    { icono: 'MdPerson', texto: 'Mi perfil', ruta: '/perfil' },
  ],
};

const NOMBRE_ROL = { administrador: 'Administrador', docente: 'Docente', estudiante: 'Estudiante', tutor: 'Padre o encargado' };

const RUTA_INICIO = { administrador: '/admin/docentes', docente: '/docente', estudiante: '/estudiante', tutor: '/tutor' };

function icono(nombre) {
  return iconosSvg[nombre] || '';
}

// Palabras que no cuentan como apellido: "de", "del", "la"...
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

function primerNombre(texto) {
  const palabras = (texto || '').trim().split(/\s+/).filter(Boolean);
  return palabras.find((p) => !PARTICULAS.has(p.toLowerCase())) || palabras[0] || '';
}

function iniciales(nombres, apellidos) {
  return ((primerNombre(nombres)[0] || '') + (primerNombre(apellidos)[0] || '')).toUpperCase();
}

function fecha(valor, conHora = false) {
  if (!valor) return '—';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  let t = `${dd}/${mm}/${d.getFullYear()}`;
  if (conHora) t += ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return t;
}

// Estado que se muestra en las tablas de cuentas
function estadoCuenta(u) {
  if (u.estado === 'inactivo') return { texto: 'Inactiva', clase: 'gris' };
  if (u.debe_cambiar_clave) return { texto: 'Pendiente', clase: 'naranja' };
  return { texto: 'Activa', clase: 'verde' };
}

// Calificación para mostrar: 80 o 66.7
function nota(valor) {
  if (valor === null || valor === undefined) return '—';
  const n = Number(valor);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

// 760 -> "12 min 40 s"
function duracionTexto(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const m = Math.floor(segundos / 60), s = segundos % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

module.exports = { MENUS, NOMBRE_ROL, RUTA_INICIO, icono, iniciales, primerNombre, fecha, estadoCuenta, nota, duracionTexto };
