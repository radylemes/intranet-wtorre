CREATE TABLE IF NOT EXISTS email_provider_config (
  id INT PRIMARY KEY,
  provider VARCHAR(10) NOT NULL DEFAULT 'smtp',
  acs_connection_string_ciphertext TEXT NULL,
  acs_sender VARCHAR(255) NOT NULL DEFAULT '',
  ocultar_para TINYINT(1) NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO email_provider_config (id, provider, ocultar_para, ativo)
SELECT 1, 'smtp', 0, COALESCE((SELECT ativo FROM smtp_config WHERE id = 1 LIMIT 1), 0);
