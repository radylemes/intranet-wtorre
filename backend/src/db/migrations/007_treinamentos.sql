CREATE TABLE IF NOT EXISTS storage_containers (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(63)  NOT NULL UNIQUE,
  rotulo    VARCHAR(120) NOT NULL,
  descricao VARCHAR(255) NULL,
  padrao    TINYINT(1)   NOT NULL DEFAULT 0,
  ativo     TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS treinamentos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  titulo        VARCHAR(180) NOT NULL,
  descricao     TEXT NULL,
  categoria     VARCHAR(40) NOT NULL,
  area          VARCHAR(80) NULL,
  duracao_seg   INT NULL,
  container     VARCHAR(63) NOT NULL,
  blob_name     VARCHAR(255) NOT NULL,
  thumb_blob    VARCHAR(255) NULL,
  destaque      TINYINT(1) NOT NULL DEFAULT 0,
  ordem         INT NULL,
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_por    VARCHAR(120) NULL,
  criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categoria (categoria),
  INDEX idx_ativo (ativo),
  INDEX idx_destaque (destaque),
  INDEX idx_container (container)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
