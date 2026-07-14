CREATE TABLE IF NOT EXISTS salas_config (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  ativo TINYINT(1) NOT NULL DEFAULT 0,
  api_base_url VARCHAR(512) NOT NULL DEFAULT '',
  localidade_padrao VARCHAR(80) NOT NULL DEFAULT 'WTorre',
  localidades_json JSON NOT NULL,
  admin_api_key_ciphertext TEXT NULL,
  admin_api_key_hint VARCHAR(4) NULL,
  ui_config_json JSON NOT NULL DEFAULT (JSON_OBJECT()),
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('salas', 'Reservas de Salas', 15);

INSERT IGNORE INTO salas_config (id, localidades_json) VALUES
  (1, JSON_ARRAY(JSON_OBJECT('label', 'WTorre', 'localidade', 'WTorre')));
