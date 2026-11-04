// Conexión a la base de datos MySQL de XAMPP.
// Si tu base tiene otro nombre o tu usuario root tiene contraseña,
// cámbialo aquí (o define las variables de entorno DB_NAME, DB_USER, etc.).
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'proyectoedu',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
