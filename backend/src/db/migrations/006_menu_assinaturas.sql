INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Assinaturas de E-mail', '/assinaturas', NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, 'envelope', NULL, 1, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE url = '/assinaturas' OR label = 'Assinaturas de E-mail'
);
