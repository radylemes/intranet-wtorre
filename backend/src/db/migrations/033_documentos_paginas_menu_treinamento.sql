-- Idempotente: exibir_menu_treinamento em documentos_paginas

SET @col_exibir_menu_treinamento = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documentos_paginas' AND COLUMN_NAME = 'exibir_menu_treinamento'
);
SET @sql = IF(
  @col_exibir_menu_treinamento = 0,
  'ALTER TABLE documentos_paginas ADD COLUMN exibir_menu_treinamento TINYINT(1) NOT NULL DEFAULT 0 AFTER ativo',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
