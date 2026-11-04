// Conexión a la base de datos MySQL.
// En tu computadora usa XAMPP (localhost, root sin contraseña, base proyectoedu).
// En internet (Render) los datos llegan por variables de entorno: DB_HOST, DB_USER, etc.
const fs = require('fs');
const mysql = require('mysql2/promise');

const opciones = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'proyectoedu',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
};

// Bases en la nube (Aiven y similares) exigen conexión cifrada con su certificado.
if (process.env.DB_CA_FILE) {
  opciones.ssl = { ca: fs.readFileSync(process.env.DB_CA_FILE, 'utf8') };
}

const pool = mysql.createPool(opciones);

// Los servidores en la nube trabajan en hora UTC. Así NOW() usa la hora de Honduras
// y coincide con las fechas que calcula Node (en Render se define TZ=America/Tegucigalpa).
pool.pool.on('connection', (conexion) => {
  conexion.query(`SET time_zone = '${process.env.DB_TIME_ZONE || '-06:00'}'`);
});

module.exports = pool;
module.exports.opciones = opciones;
