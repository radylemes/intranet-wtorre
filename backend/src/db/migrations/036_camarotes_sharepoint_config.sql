-- Armazena URL e aba do arquivo SharePoint no banco de dados
SET @dbname = DATABASE();

SET @q1 = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@dbname AND table_name='camarotes_config' AND column_name='sharepoint_url') = 0,
  'ALTER TABLE camarotes_config ADD COLUMN sharepoint_url TEXT NULL AFTER sync_frequencia',
  'SELECT 1'
);
PREPARE stmt1 FROM @q1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @q2 = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@dbname AND table_name='camarotes_config' AND column_name='sharepoint_sheet') = 0,
  'ALTER TABLE camarotes_config ADD COLUMN sharepoint_sheet VARCHAR(100) NULL DEFAULT \'Camarotes\' AFTER sharepoint_url',
  'SELECT 1'
);
PREPARE stmt2 FROM @q2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
