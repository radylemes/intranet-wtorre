-- Idempotente: destaque e destaque_ordem em documentos

SET @col_destaque = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentos' AND COLUMN_NAME = 'destaque'
);
SET @sql = IF(
  @col_destaque = 0,
  'ALTER TABLE documentos ADD COLUMN destaque TINYINT(1) NOT NULL DEFAULT 0 AFTER ativo',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_ordem = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentos' AND COLUMN_NAME = 'destaque_ordem'
);
SET @sql = IF(
  @col_ordem = 0,
  'ALTER TABLE documentos ADD COLUMN destaque_ordem INT NOT NULL DEFAULT 0 AFTER destaque',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentos' AND INDEX_NAME = 'idx_doc_destaque'
);
SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE documentos ADD INDEX idx_doc_destaque (destaque, destaque_ordem)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
