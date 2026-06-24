-- Executar UMA VEZ em bancos que já tinham categorias_documentos/documentos sem pagina_id/setor_id.
-- Não colocar em migrations. Pode reexecutar sem erro (guarda via information_schema).
-- Installs limpos: colunas nullable vêm do CREATE em 003; FK/unique/backfill via seed + script.

SET @db := DATABASE();

-- 1. pagina_id (sem FK)
SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categorias_documentos' AND COLUMN_NAME = 'pagina_id');
SET @sql1 := IF(@c1 = 0,
  'ALTER TABLE categorias_documentos ADD COLUMN pagina_id INT NULL AFTER parent_id',
  'SELECT 1');
PREPARE s1 FROM @sql1; EXECUTE s1; DEALLOCATE PREPARE s1;

-- 2. setor_id (sem FK)
SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documentos' AND COLUMN_NAME = 'setor_id');
SET @sql2 := IF(@c2 = 0,
  'ALTER TABLE documentos ADD COLUMN setor_id INT NULL AFTER criado_por',
  'SELECT 1');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- 3. Backfill pagina_id → WTorre
UPDATE categorias_documentos
SET pagina_id = (SELECT id FROM documentos_paginas WHERE slug = 'wtorre' LIMIT 1)
WHERE pagina_id IS NULL;

-- 4. Drop UNIQUE global de slug (se existir)
SET @idx_slug := (SELECT COUNT(*) FROM information_schema.STATISTICS
                  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categorias_documentos'
                    AND INDEX_NAME = 'slug' AND NON_UNIQUE = 0);
SET @sql3 := IF(@idx_slug > 0,
  'ALTER TABLE categorias_documentos DROP INDEX slug',
  'SELECT 1');
PREPARE s3 FROM @sql3; EXECUTE s3; DEALLOCATE PREPARE s3;

-- 4b. Criar UNIQUE (pagina_id, slug) se ausente
SET @idx_pag_slug := (SELECT COUNT(*) FROM information_schema.STATISTICS
                      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categorias_documentos'
                        AND INDEX_NAME = 'uk_cat_pagina_slug');
SET @sql4 := IF(@idx_pag_slug = 0,
  'ALTER TABLE categorias_documentos ADD UNIQUE KEY uk_cat_pagina_slug (pagina_id, slug)',
  'SELECT 1');
PREPARE s4 FROM @sql4; EXECUTE s4; DEALLOCATE PREPARE s4;

-- 5. FK pagina_id → documentos_paginas
SET @fk1 := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categorias_documentos'
               AND CONSTRAINT_NAME = 'fk_cat_pagina' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql5 := IF(@fk1 = 0,
  'ALTER TABLE categorias_documentos ADD CONSTRAINT fk_cat_pagina FOREIGN KEY (pagina_id) REFERENCES documentos_paginas(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE s5 FROM @sql5; EXECUTE s5; DEALLOCATE PREPARE s5;

-- 6. FK setor_id → documentos_setores
SET @fk2 := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'documentos'
               AND CONSTRAINT_NAME = 'fk_doc_setor' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql6 := IF(@fk2 = 0,
  'ALTER TABLE documentos ADD CONSTRAINT fk_doc_setor FOREIGN KEY (setor_id) REFERENCES documentos_setores(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE s6 FROM @sql6; EXECUTE s6; DEALLOCATE PREPARE s6;

-- 7. Alinhar collation com menu_items/categorias (utf8mb4_general_ci)
ALTER TABLE documentos_paginas CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE documentos_setores CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
