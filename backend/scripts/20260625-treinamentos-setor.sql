-- Idempotente: setor_id em treinamentos (substitui area gradualmente)

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'treinamentos' AND COLUMN_NAME = 'setor_id'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE treinamentos ADD COLUMN setor_id INT NULL AFTER categoria_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'treinamentos' AND CONSTRAINT_NAME = 'fk_trein_setor'
);
SET @sql = IF(
  @fk_exists = 0,
  'ALTER TABLE treinamentos ADD CONSTRAINT fk_trein_setor FOREIGN KEY (setor_id) REFERENCES documentos_setores(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill por nome (case-insensitive)
UPDATE treinamentos t
INNER JOIN documentos_setores s ON LOWER(TRIM(t.area)) COLLATE utf8mb4_unicode_ci = LOWER(TRIM(s.nome)) COLLATE utf8mb4_unicode_ci
SET t.setor_id = s.id
WHERE t.setor_id IS NULL AND t.area IS NOT NULL AND TRIM(t.area) <> '';

-- Variações comuns
UPDATE treinamentos t
INNER JOIN documentos_setores s ON s.slug = 'ti'
SET t.setor_id = s.id
WHERE t.setor_id IS NULL AND t.area IS NOT NULL
  AND LOWER(TRIM(t.area)) IN ('t.i.', 'ti', 't.i', 'tecnologia', 't.i');
