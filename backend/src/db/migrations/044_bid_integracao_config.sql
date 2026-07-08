CREATE TABLE IF NOT EXISTS bid_integracao_config (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  ativo TINYINT(1) NOT NULL DEFAULT 0,
  api_base_url VARCHAR(512) NOT NULL DEFAULT '',
  api_key_ciphertext TEXT NULL,
  api_key_hint VARCHAR(4) NULL,
  app_url VARCHAR(512) NOT NULL DEFAULT 'https://bid.nubankparque.com',
  cache_ttl_min SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  sync_automatica TINYINT(1) NOT NULL DEFAULT 1,
  sync_intervalo_min SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  ultima_sync TIMESTAMP NULL,
  ultima_sync_erro TEXT NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO bid_integracao_config (id) VALUES (1);
