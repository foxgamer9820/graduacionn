// Ejecuta un archivo .sql en la base de datos indicada en un archivo de variables.
// Sirve para crear las tablas en la base de internet (Aiven) con database/proyecto_final.sql.
//
// Uso (en la terminal de VS Code):
//   node --env-file=.env.nube scripts/importar-sql.js database/proyecto_final.sql
//
// ATENCIÓN: proyecto_final.sql borra y vuelve a crear las tablas. Úsalo solo la primera vez.
const fs = require('fs');
const mysql = require('mysql2/promise');
const { opciones } = require('../config/db');

async function main() {
  const archivo = process.argv[2];
  if (!archivo || !fs.existsSync(archivo)) {
    console.log('Uso: node --env-file=.env.nube scripts/importar-sql.js database/proyecto_final.sql');
    process.exit(1);
  }
  if (opciones.host === 'localhost') {
    console.log('Aviso: se va a importar en tu XAMPP (localhost). Para la nube usa --env-file=.env.nube');
  }

  const conexion = await mysql.createConnection({ ...opciones, multipleStatements: true });
  console.log(`Importando ${archivo} en ${opciones.host} / ${opciones.database}...`);
  await conexion.query(fs.readFileSync(archivo, 'utf8'));
  const [tablas] = await conexion.query('SHOW TABLES');
  console.log(`✔ Listo. Tablas en la base: ${tablas.map((t) => Object.values(t)[0]).join(', ')}`);
  await conexion.end();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('✘ Error al importar:', e.message);
  process.exit(1);
});
