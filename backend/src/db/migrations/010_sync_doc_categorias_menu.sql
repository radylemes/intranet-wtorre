-- Sincroniza categorias raiz de documentos com menu_items

-- Garante agrupador Documentos no menu
INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Documentos', '/documentos', NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, NULL, 'Repositórios', 1, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE url = '/documentos' AND parent_id IS NULL
);

-- Atualiza itens existentes cujo url corresponde a uma categoria raiz
UPDATE menu_items m
INNER JOIN categorias_documentos c ON m.url = CONCAT('/documentos/', c.slug)
SET
  m.label = c.nome,
  m.parent_id = (SELECT id FROM (SELECT id FROM menu_items WHERE url = '/documentos' AND parent_id IS NULL LIMIT 1) AS doc_parent),
  m.ordem = c.ordem,
  m.abrir_nova_aba = 0,
  m.ativo = c.ativo
WHERE c.parent_id IS NULL;

-- Cria itens ausentes para categorias raiz ativas
INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, ativo)
SELECT
  c.nome,
  CONCAT('/documentos/', c.slug),
  (SELECT id FROM menu_items WHERE url = '/documentos' AND parent_id IS NULL LIMIT 1),
  c.ordem,
  0,
  c.ativo
FROM categorias_documentos c
WHERE c.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items m WHERE m.url = CONCAT('/documentos/', c.slug)
  );

-- Remove itens de menu órfãos (/documentos/* sem categoria raiz correspondente)
DELETE m FROM menu_items m
WHERE m.url LIKE '/documentos/%'
  AND m.url != '/documentos'
  AND NOT EXISTS (
    SELECT 1 FROM categorias_documentos c
    WHERE c.parent_id IS NULL
      AND m.url = CONCAT('/documentos/', c.slug)
  );
