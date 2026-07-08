CREATE TABLE IF NOT EXISTS bid_sync_snapshot (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  payload_eventos JSON NULL,
  payload_usuarios JSON NULL,
  gerado_em_eventos VARCHAR(32) NULL,
  gerado_em_usuarios VARCHAR(32) NULL,
  sincronizado_em TIMESTAMP NULL,
  status ENUM('ok', 'erro') NOT NULL DEFAULT 'ok',
  ultimo_erro TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO bid_sync_snapshot (id) VALUES (1);

-- PRODUÇÃO — executar manualmente UMA vez se bid_integracao_config já existir:
--
-- ALTER TABLE bid_integracao_config
--   ADD COLUMN sync_automatica TINYINT(1) NOT NULL DEFAULT 1 AFTER cache_ttl_min,
--   ADD COLUMN sync_intervalo_min SMALLINT UNSIGNED NOT NULL DEFAULT 15 AFTER sync_automatica,
--   ADD COLUMN ultima_sync TIMESTAMP NULL AFTER sync_intervalo_min,
--   ADD COLUMN ultima_sync_erro TEXT NULL AFTER ultima_sync;
