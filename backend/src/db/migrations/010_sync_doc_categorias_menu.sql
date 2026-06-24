-- Garante agrupador Documentos no menu (sync de filhos via reconcileAll em runtime)
INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Documentos', '/documentos', NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, NULL, 'Repositórios', 1, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE url = '/documentos' AND parent_id IS NULL
);
