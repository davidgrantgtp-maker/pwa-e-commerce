-- MiApp Store - esquema de base de datos (referencia)
-- Se aplica automáticamente desde install.php

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL DEFAULT 'admin',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  creado_en DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre),
  UNIQUE KEY uq_categorias_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS productos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(60) DEFAULT NULL,
  nombre VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  categoria_id INT UNSIGNED DEFAULT NULL,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  precio_anterior DECIMAL(12,2) DEFAULT NULL,
  costo DECIMAL(12,2) DEFAULT NULL,
  stock INT NOT NULL DEFAULT 0,
  descripcion TEXT,
  imagen VARCHAR(500) DEFAULT NULL,
  etiqueta VARCHAR(80) DEFAULT NULL,
  destacado TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL,
  actualizado_en DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_slug (slug),
  UNIQUE KEY uq_productos_sku (sku),
  KEY idx_productos_categoria (categoria_id),
  KEY idx_productos_activo (activo),
  KEY idx_productos_destacado (destacado),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS importaciones (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  archivo VARCHAR(255) NOT NULL,
  total INT NOT NULL DEFAULT 0,
  creadas INT NOT NULL DEFAULT 0,
  actualizadas INT NOT NULL DEFAULT 0,
  errores INT NOT NULL DEFAULT 0,
  usuario_id INT UNSIGNED DEFAULT NULL,
  creado_en DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT UNSIGNED DEFAULT NULL,
  campo VARCHAR(40) NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  valor VARCHAR(120) DEFAULT NULL,
  motivo VARCHAR(180) DEFAULT NULL,
  usuario_id INT UNSIGNED DEFAULT NULL,
  creado_en DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_mov_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
