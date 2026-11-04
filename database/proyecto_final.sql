-- =============================================================
-- Software educativo de tests de selección única
-- Proyecto de Graduación IEREQ01 - UPNFM CURNAC
-- Versión 4 (definitiva, ajustada al diseño de pantallas)
-- Compatible con MariaDB 10.4+ (XAMPP) y MySQL 8.0.16+
--
-- Cómo importarlo en phpMyAdmin:
--   1. Crea la base (o usa la que ya tienes, por ejemplo proyectoedu)
--      con el cotejamiento utf8mb4_unicode_ci.
--   2. Haz clic en esa base en la columna izquierda.
--   3. Pestaña Importar, elige este archivo y pulsa Importar.
--
-- ATENCIÓN: borra y vuelve a crear las 8 tablas del sistema en la
-- base seleccionada. Los datos que tengan se pierden.
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS respuestas_estudiante;
DROP TABLE IF EXISTS resultados_tests;
DROP TABLE IF EXISTS preguntas;
DROP TABLE IF EXISTS tests;
DROP TABLE IF EXISTS inscripciones;
DROP TABLE IF EXISTS temas;
DROP TABLE IF EXISTS tutores_estudiantes;
DROP TABLE IF EXISTS usuarios;

SET FOREIGN_KEY_CHECKS = 1;

-- -------------------------------------------------------------
-- 1. usuarios
-- Las cuentas las crea otro usuario (administrador o docente)
-- con una contraseña temporal. No existe registro público.
-- -------------------------------------------------------------
CREATE TABLE usuarios (
  dni                   CHAR(13)     NOT NULL,
  nombres               VARCHAR(60)  NOT NULL,
  apellidos             VARCHAR(60)  NOT NULL,
  email                 VARCHAR(100) NULL,
  password_hash         CHAR(60)     NOT NULL,
  rol                   ENUM('estudiante','docente','tutor','administrador') NOT NULL,
  telefono              VARCHAR(15)  NULL,
  foto                  VARCHAR(255) NULL,
  estado                ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  debe_cambiar_clave    TINYINT(1)   NOT NULL DEFAULT 1,
  clave_temporal_expira DATETIME     NULL,
  creado_por            CHAR(13)     NULL,
  fecha_registro        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso         DATETIME     NULL,
  PRIMARY KEY (dni),
  UNIQUE KEY uq_usuarios_email (email),
  KEY idx_usuarios_rol (rol),
  CONSTRAINT chk_usuarios_dni CHECK (dni REGEXP '^[0-9]{13}$'),
  CONSTRAINT fk_usuarios_creado_por FOREIGN KEY (creado_por)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. tutores_estudiantes
-- Vincula a padres, madres o encargados con sus estudiantes.
-- La cuenta del tutor y el vínculo los crea el docente.
-- -------------------------------------------------------------
CREATE TABLE tutores_estudiantes (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tutor_dni      CHAR(13)     NOT NULL,
  estudiante_dni CHAR(13)     NOT NULL,
  parentesco     ENUM('padre','madre','tutor','otro') NOT NULL,
  creado_por     CHAR(13)     NULL,
  fecha_registro DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tutor_estudiante (tutor_dni, estudiante_dni),
  CONSTRAINT fk_te_tutor FOREIGN KEY (tutor_dni)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_te_estudiante FOREIGN KEY (estudiante_dni)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_te_creado_por FOREIGN KEY (creado_por)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3. temas
-- -------------------------------------------------------------
CREATE TABLE temas (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(80)  NOT NULL,
  descripcion    VARCHAR(500) NULL,
  color          CHAR(7)      NOT NULL DEFAULT '#3B82F6',
  estado         ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  docente_dni    CHAR(13)     NOT NULL,
  fecha_creacion DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_temas_docente (docente_dni),
  CONSTRAINT chk_temas_color CHECK (color REGEXP '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT fk_temas_docente FOREIGN KEY (docente_dni)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. inscripciones
-- El docente inscribe a sus estudiantes en cada tema.
-- -------------------------------------------------------------
CREATE TABLE inscripciones (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  estudiante_dni CHAR(13)     NOT NULL,
  tema_id        INT UNSIGNED NOT NULL,
  inscrito_por   CHAR(13)     NULL,
  fecha          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inscripcion (estudiante_dni, tema_id),
  KEY idx_inscripciones_tema (tema_id),
  CONSTRAINT fk_insc_estudiante FOREIGN KEY (estudiante_dni)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_insc_tema FOREIGN KEY (tema_id)
    REFERENCES temas (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_insc_inscrito_por FOREIGN KEY (inscrito_por)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. tests
-- Las preguntas siempre se presentan en orden aleatorio.
-- -------------------------------------------------------------
CREATE TABLE tests (
  id                 INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  tema_id            INT UNSIGNED      NOT NULL,
  nombre             VARCHAR(100)      NOT NULL,
  descripcion        VARCHAR(500)      NULL,
  duracion_min       SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  intentos_max       TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  puntaje_aprobacion TINYINT UNSIGNED  NOT NULL DEFAULT 70,
  fecha_apertura     DATETIME          NULL,
  fecha_cierre       DATETIME          NULL,
  mostrar_respuestas TINYINT(1)        NOT NULL DEFAULT 1,
  estado             ENUM('borrador','publicado','archivado') NOT NULL DEFAULT 'borrador',
  fecha_creacion     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tests_tema (tema_id),
  CONSTRAINT chk_tests_duracion CHECK (duracion_min > 0),
  CONSTRAINT chk_tests_intentos CHECK (intentos_max > 0),
  CONSTRAINT chk_tests_aprobacion CHECK (puntaje_aprobacion <= 100),
  CONSTRAINT chk_tests_fechas CHECK (
    fecha_apertura IS NULL OR fecha_cierre IS NULL OR fecha_cierre > fecha_apertura
  ),
  CONSTRAINT fk_tests_tema FOREIGN KEY (tema_id)
    REFERENCES temas (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 6. preguntas
-- Cuatro opciones, una correcta. Sin columna de orden.
-- -------------------------------------------------------------
CREATE TABLE preguntas (
  id                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  test_id            INT UNSIGNED     NOT NULL,
  pregunta           TEXT             NOT NULL,
  opcion1            VARCHAR(255)     NOT NULL,
  opcion2            VARCHAR(255)     NOT NULL,
  opcion3            VARCHAR(255)     NOT NULL,
  opcion4            VARCHAR(255)     NOT NULL,
  respuesta_correcta TINYINT UNSIGNED NOT NULL,
  retroalimentacion  TEXT             NULL,
  imagen             VARCHAR(255)     NULL,
  imagen_alt         VARCHAR(255)     NULL,
  puntos             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_preguntas_test (test_id),
  CONSTRAINT chk_preguntas_correcta CHECK (respuesta_correcta BETWEEN 1 AND 4),
  CONSTRAINT chk_preguntas_puntos CHECK (puntos > 0),
  CONSTRAINT fk_preguntas_test FOREIGN KEY (test_id)
    REFERENCES tests (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 7. resultados_tests
-- Un registro por cada intento de un estudiante en un test.
-- "aprobado" se guarda al terminar, comparando la calificación con
-- la nota mínima vigente en ese momento. Así el resultado no cambia
-- si el docente modifica después la nota mínima del test.
-- -------------------------------------------------------------
CREATE TABLE resultados_tests (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  estudiante_dni  CHAR(13)          NOT NULL,
  test_id         INT UNSIGNED      NOT NULL,
  intento         TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  estado_intento  ENUM('en_curso','finalizado','abandonado') NOT NULL DEFAULT 'en_curso',
  calificacion    DECIMAL(5,2)      NULL,
  correctas       SMALLINT UNSIGNED NULL,
  total_preguntas SMALLINT UNSIGNED NOT NULL,
  tiempo_segundos INT UNSIGNED      NULL,
  aprobado        TINYINT(1)        NULL,
  fecha_inicio    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin       DATETIME          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resultado_intento (estudiante_dni, test_id, intento),
  KEY idx_resultados_test (test_id),
  CONSTRAINT chk_resultados_intento CHECK (intento > 0),
  CONSTRAINT chk_resultados_calificacion CHECK (
    calificacion IS NULL OR calificacion BETWEEN 0 AND 100
  ),
  CONSTRAINT chk_resultados_correctas CHECK (
    correctas IS NULL OR correctas <= total_preguntas
  ),
  CONSTRAINT fk_resultados_estudiante FOREIGN KEY (estudiante_dni)
    REFERENCES usuarios (dni) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_resultados_test FOREIGN KEY (test_id)
    REFERENCES tests (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 8. respuestas_estudiante
-- Se crean todas las filas al iniciar el intento, ya en orden
-- aleatorio (posicion) y con opcion_elegida en NULL. Cada
-- respuesta del estudiante actualiza su fila.
-- -------------------------------------------------------------
CREATE TABLE respuestas_estudiante (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  resultado_id    INT UNSIGNED      NOT NULL,
  pregunta_id     INT UNSIGNED      NOT NULL,
  posicion        SMALLINT UNSIGNED NOT NULL,
  opcion_elegida  TINYINT UNSIGNED  NULL,
  es_correcta     TINYINT(1)        NULL,
  fecha_respuesta DATETIME          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_respuesta_pregunta (resultado_id, pregunta_id),
  UNIQUE KEY uq_respuesta_posicion (resultado_id, posicion),
  KEY idx_respuestas_pregunta (pregunta_id),
  CONSTRAINT chk_respuestas_opcion CHECK (
    opcion_elegida IS NULL OR opcion_elegida BETWEEN 1 AND 4
  ),
  CONSTRAINT fk_respuestas_resultado FOREIGN KEY (resultado_id)
    REFERENCES resultados_tests (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_respuestas_pregunta FOREIGN KEY (pregunta_id)
    REFERENCES preguntas (id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 9. Usuario administrador inicial
-- DNI: 0000000000000   Contraseña temporal: Admin2026
-- El sistema le pedirá cambiarla en el primer inicio de sesión.
-- -------------------------------------------------------------
INSERT INTO usuarios (dni, nombres, apellidos, password_hash, rol, debe_cambiar_clave)
VALUES ('0000000000000', 'Administrador', 'del sistema',
        '$2b$10$zlQUsTsl8ZHPY6i0QKgg3.9CPTPfZICZ9V/fHuHI.DGqFOyZtBb8G',
        'administrador', 1);
