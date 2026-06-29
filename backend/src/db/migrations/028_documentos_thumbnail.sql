-- Idempotente: thumbnail_path em documentos

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentos' AND COLUMN_NAME = 'thumbnail_path'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE documentos ADD COLUMN thumbnail_path VARCHAR(255) NULL AFTER descricao',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
