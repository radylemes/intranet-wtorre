-- Executar UMA VEZ em bancos que já tinham camarotes_config sem sync_automatica/sync_frequencia.
-- Não colocar em migrations. Pode reexecutar sem erro (guarda via information_schema).
-- Installs limpos: as colunas vêm do CREATE em 015_camarotes.sql.

SET @db := DATABASE();

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'camarotes_config' AND COLUMN_NAME = 'sync_automatica');
SET @sql1 := IF(@c1 = 0,
  'ALTER TABLE camarotes_config ADD COLUMN sync_automatica TINYINT(1) NOT NULL DEFAULT 1 AFTER envio_ativo',
  'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'camarotes_config' AND COLUMN_NAME = 'sync_frequencia');
SET @sql2 := IF(@c2 = 0,
  'ALTER TABLE camarotes_config ADD COLUMN sync_frequencia ENUM(''1h'',''6h'',''12h'',''24h'',''semanal'') NOT NULL DEFAULT ''24h'' AFTER sync_automatica',
  'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;
