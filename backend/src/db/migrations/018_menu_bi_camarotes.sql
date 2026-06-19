-- Página interna BI / Camarotes no menu de navegação

-- Agrupador BI (sem URL)
INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'BI', NULL, NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, NULL, NULL, 1, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE label = 'BI' AND parent_id IS NULL AND url IS NULL
);

-- Item filho Camarotes → /bi/camarotes
INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Camarotes', '/bi/camarotes', bi.id,
  COALESCE((SELECT MAX(m2.ordem) + 1 FROM menu_items m2 WHERE m2.parent_id = bi.id), 0),
  0, NULL, NULL, 1, NULL
FROM menu_items bi
WHERE bi.label = 'BI' AND bi.parent_id IS NULL AND bi.url IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items WHERE url = '/bi/camarotes'
  )
LIMIT 1;
