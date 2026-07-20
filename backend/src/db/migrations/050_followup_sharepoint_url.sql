-- URL de compartilhamento SharePoint (mesmo formato do Camarotes)
SET @dbname = DATABASE();

SET @q1 = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=@dbname AND table_name='followup_config' AND column_name='sharepoint_url') = 0,
  'ALTER TABLE followup_config ADD COLUMN sharepoint_url TEXT NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt1 FROM @q1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;
