INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Ferramentas de PDF', '/ferramentas/pdf', NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, 'picture_as_pdf', NULL, 1, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE url = '/ferramentas/pdf'
);
