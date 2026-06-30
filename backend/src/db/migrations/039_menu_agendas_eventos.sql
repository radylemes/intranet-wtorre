-- Menu Agendas (agrupador) + filho Eventos → /agendas

INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Agendas', NULL, NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, NULL, NULL, 1, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE label = 'Agendas' AND parent_id IS NULL AND url IS NULL
);

INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Eventos', '/agendas', ag.id,
  COALESCE((SELECT MAX(m2.ordem) + 1 FROM menu_items m2 WHERE m2.parent_id = ag.id), 0),
  0, NULL, NULL, 1, NULL
FROM menu_items ag
WHERE ag.label = 'Agendas' AND ag.parent_id IS NULL AND ag.url IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items WHERE url = '/agendas'
  )
LIMIT 1;
