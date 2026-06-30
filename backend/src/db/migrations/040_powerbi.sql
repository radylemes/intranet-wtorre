CREATE TABLE IF NOT EXISTS departamento_setor (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  departamento VARCHAR(160) NOT NULL,
  setor_id     INT          NOT NULL,
  ativo        TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uk_departamento (departamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS powerbi_relatorios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  report_id     VARCHAR(64)  NOT NULL,
  dataset_id    VARCHAR(64)  NULL,
  titulo        VARCHAR(160) NOT NULL,
  descricao     VARCHAR(400) NULL,
  ordem         INT          NOT NULL DEFAULT 0,
  ativo         TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_powerbi_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS powerbi_relatorio_setores (
  report_id  VARCHAR(64) NOT NULL,
  setor_id   INT         NOT NULL,
  PRIMARY KEY (report_id, setor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS powerbi_setor_rls_role (
  setor_id  INT          NOT NULL PRIMARY KEY,
  rls_role  VARCHAR(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS powerbi_access_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NULL,
  email        VARCHAR(200) NULL,
  report_id    VARCHAR(64)  NULL,
  setor_id     INT          NULL,
  departamento VARCHAR(160) NULL,
  acao         VARCHAR(40)  NOT NULL,
  criado_em    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_powerbi_access_log_criado_em (criado_em),
  INDEX idx_powerbi_access_log_acao (acao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('powerbi', 'Power BI', 14);
