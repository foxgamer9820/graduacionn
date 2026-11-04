// Guarda las sesiones en MySQL en lugar de la memoria del servidor.
// Así no se pierden cuando Render reinicia o duerme el servidor,
// y desaparece el aviso "MemoryStore is not designed for a production environment".
// La tabla "sesiones" se crea sola la primera vez.
const session = require('express-session');
const pool = require('./db');

const DOS_HORAS = 1000 * 60 * 60 * 2;
const nada = () => {};

class MySQLSessionStore extends session.Store {
  constructor() {
    super();
    // Borra las sesiones vencidas cada 15 minutos.
    setInterval(() => this.limpiar(), 15 * 60 * 1000).unref();
  }

  // Crea la tabla la primera vez (si la base no responde, lo reintenta en la siguiente petición).
  asegurarTabla() {
    if (!this.tabla) {
      this.tabla = pool.query(`
        CREATE TABLE IF NOT EXISTS sesiones (
          sid    VARCHAR(128) NOT NULL,
          datos  TEXT         NOT NULL,
          expira DATETIME     NOT NULL,
          PRIMARY KEY (sid),
          KEY idx_sesiones_expira (expira)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
        .catch((e) => { this.tabla = null; throw e; });
    }
    return this.tabla;
  }

  expiracion(sess) {
    const fecha = sess && sess.cookie && sess.cookie.expires;
    return fecha ? new Date(fecha) : new Date(Date.now() + DOS_HORAS);
  }

  get(sid, cb = nada) {
    this.asegurarTabla()
      .then(() => pool.query('SELECT datos FROM sesiones WHERE sid = ? AND expira > ? LIMIT 1', [sid, new Date()]))
      .then(([filas]) => cb(null, filas[0] ? JSON.parse(filas[0].datos) : null))
      .catch(cb);
  }

  set(sid, sess, cb = nada) {
    this.asegurarTabla()
      .then(() => pool.query(
        `INSERT INTO sesiones (sid, datos, expira) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE datos = VALUES(datos), expira = VALUES(expira)`,
        [sid, JSON.stringify(sess), this.expiracion(sess)],
      ))
      .then(() => cb(null))
      .catch(cb);
  }

  touch(sid, sess, cb = nada) {
    this.asegurarTabla()
      .then(() => pool.query('UPDATE sesiones SET expira = ? WHERE sid = ?', [this.expiracion(sess), sid]))
      .then(() => cb(null))
      .catch(cb);
  }

  destroy(sid, cb = nada) {
    this.asegurarTabla()
      .then(() => pool.query('DELETE FROM sesiones WHERE sid = ?', [sid]))
      .then(() => cb(null))
      .catch(cb);
  }

  limpiar() {
    this.asegurarTabla()
      .then(() => pool.query('DELETE FROM sesiones WHERE expira < ?', [new Date()]))
      .catch(() => {});
  }
}

module.exports = MySQLSessionStore;
