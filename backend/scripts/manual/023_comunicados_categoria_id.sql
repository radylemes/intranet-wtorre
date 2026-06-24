-- Executar manualmente UMA VEZ apenas em bancos legados que ainda têm a coluna `categoria` (ENUM).
-- Installs novos: 022/023 já usam categoria_id — este script NÃO é necessário.
-- (ALTER não entra no migrate automático — ver docs/padrao-modulos-admin.md)

ALTER TABLE comunicados ADD COLUMN categoria_id INT NULL AFTER titulo;

UPDATE comunicados c
INNER JOIN comunicado_categorias cat ON cat.slug = c.categoria
SET c.categoria_id = cat.id;

ALTER TABLE comunicados MODIFY categoria_id INT NOT NULL;

ALTER TABLE comunicados
  ADD CONSTRAINT fk_comunicados_categoria
  FOREIGN KEY (categoria_id) REFERENCES comunicado_categorias(id);

ALTER TABLE comunicados DROP COLUMN categoria;
