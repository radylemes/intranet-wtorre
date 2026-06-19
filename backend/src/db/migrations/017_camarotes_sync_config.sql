ALTER TABLE camarotes_config
  ADD COLUMN sync_automatica TINYINT(1) NOT NULL DEFAULT 1 AFTER envio_ativo,
  ADD COLUMN sync_frequencia ENUM('1h','6h','12h','24h','semanal') NOT NULL DEFAULT '24h' AFTER sync_automatica;
