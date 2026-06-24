-- Executar UMA VEZ após 20260623-documentos-pagina-setor.sql (precisa de documentos_paginas e categorias_documentos).
-- Não colocar em migrations. Pode reexecutar sem erro (guarda via information_schema).

SET @db := DATABASE();

-- 1. pagina_id (sem FK)
SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treinamentos' AND COLUMN_NAME = 'pagina_id');
SET @sql1 := IF(@c1 = 0,
  'ALTER TABLE treinamentos ADD COLUMN pagina_id INT NULL AFTER categoria',
  'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;

-- 2. categoria_id (sem FK)
SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treinamentos' AND COLUMN_NAME = 'categoria_id');
SET @sql2 := IF(@c2 = 0,
  'ALTER TABLE treinamentos ADD COLUMN categoria_id INT NULL AFTER pagina_id',
  'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- 3. categoria legada nullable
SET @sql3 := 'ALTER TABLE treinamentos MODIFY COLUMN categoria VARCHAR(40) NULL';
PREPARE s3 FROM @sql3; EXECUTE s3; DEALLOCATE PREPARE s3;

-- 4. Backfill pagina_id → WTorre
UPDATE treinamentos
SET pagina_id = (SELECT id FROM documentos_paginas WHERE slug = 'wtorre' LIMIT 1)
WHERE pagina_id IS NULL;

-- 5. Índices se ausentes
SET @idx_pag := (SELECT COUNT(*) FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treinamentos' AND INDEX_NAME = 'idx_pagina');
SET @sql4 := IF(@idx_pag = 0,
  'ALTER TABLE treinamentos ADD INDEX idx_pagina (pagina_id)',
  'SELECT 1');
PREPARE s4 FROM @sql4; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @idx_cat := (SELECT COUNT(*) FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treinamentos' AND INDEX_NAME = 'idx_categoria_id');
SET @sql5 := IF(@idx_cat = 0,
  'ALTER TABLE treinamentos ADD INDEX idx_categoria_id (categoria_id)',
  'SELECT 1');
PREPARE s5 FROM @sql5; EXECUTE s5; DEALLOCATE PREPARE s5;

-- 6. pagina_id NOT NULL após backfill (só se não houver NULLs)
SET @null_pag := (SELECT COUNT(*) FROM treinamentos WHERE pagina_id IS NULL);
SET @sql6 := IF(@null_pag = 0,
  'ALTER TABLE treinamentos MODIFY COLUMN pagina_id INT NOT NULL',
  'SELECT 1');
PREPARE s6 FROM @sql6; EXECUTE s6; DEALLOCATE PREPARE s6;

-- 7. FK pagina_id → documentos_paginas
SET @fk1 := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treinamentos'
               AND CONSTRAINT_NAME = 'fk_trein_pagina' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql7 := IF(@fk1 = 0,
  'ALTER TABLE treinamentos ADD CONSTRAINT fk_trein_pagina FOREIGN KEY (pagina_id) REFERENCES documentos_paginas(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE s7 FROM @sql7; EXECUTE s7; DEALLOCATE PREPARE s7;

-- 8. FK categoria_id → categorias_documentos
SET @fk2 := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'treinamentos'
               AND CONSTRAINT_NAME = 'fk_trein_categoria' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql8 := IF(@fk2 = 0,
  'ALTER TABLE treinamentos ADD CONSTRAINT fk_trein_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_documentos(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE s8 FROM @sql8; EXECUTE s8; DEALLOCATE PREPARE s8;
