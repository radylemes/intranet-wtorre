-- Assunto personalizável em grupos + cadastro de e-mails individuais.
--
-- PRODUÇÃO — executar manualmente UMA vez (migrate não reaplica ALTER):
--
-- ALTER TABLE solicitacao_grupos
--   ADD COLUMN assunto VARCHAR(255) NULL AFTER campos;
--
-- CREATE TABLE IF NOT EXISTS solicitacao_emails_individuais (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   nome VARCHAR(120) NULL,
--   email VARCHAR(255) NOT NULL,
--   assunto VARCHAR(255) NULL,
--   campos JSON NOT NULL,
--   ativo TINYINT(1) NOT NULL DEFAULT 1,
--   ordem INT NOT NULL DEFAULT 0,
--   criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   UNIQUE KEY uk_email (email),
--   KEY idx_ativo_ordem (ativo, ordem)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--
-- ALTER TABLE solicitacao_envios
--   ADD COLUMN email_individual_id INT NULL AFTER grupo_id,
--   ADD CONSTRAINT fk_solicitacao_envios_email_individual
--     FOREIGN KEY (email_individual_id) REFERENCES solicitacao_emails_individuais(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS solicitacao_emails_individuais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NULL,
  email VARCHAR(255) NOT NULL,
  assunto VARCHAR(255) NULL,
  campos JSON NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email),
  KEY idx_ativo_ordem (ativo, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Idempotente no migrate automatizado (ALTERs de produção são manuais):
SELECT 1;
