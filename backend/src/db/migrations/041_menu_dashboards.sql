-- Página interna BI / Dashboards no menu de navegação (separado do módulo RBAC powerbi em 040_powerbi.sql)

INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Dashboards', '/dashboards', bi.id,
  COALESCE((SELECT MAX(m2.ordem) + 1 FROM menu_items m2 WHERE m2.parent_id = bi.id), 0),
  0, NULL, NULL, 1, NULL
FROM menu_items bi
WHERE bi.label = 'BI' AND bi.parent_id IS NULL AND bi.url IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items WHERE url = '/dashboards'
  )
LIMIT 1;
