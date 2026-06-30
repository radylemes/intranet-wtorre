-- Executar UMA VEZ em bancos que já tinham usuarios sem setor_id.
-- Não colocar em migrations. Pode reexecutar sem erro (guarda via information_schema).

SET @db := DATABASE();

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'setor_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE usuarios ADD COLUMN setor_id INT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
