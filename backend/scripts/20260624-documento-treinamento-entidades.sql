-- Backfill idempotente: documento_entidades e treinamento_entidades
-- Rodar após migration 027 (ou se tabelas já existirem)

INSERT IGNORE INTO documento_entidades (documento_id, pagina_id, categoria_id)
SELECT d.id, c.pagina_id, d.categoria_id
FROM documentos d
INNER JOIN categorias_documentos c ON c.id = d.categoria_id
WHERE c.pagina_id IS NOT NULL;

INSERT IGNORE INTO treinamento_entidades (treinamento_id, pagina_id, categoria_id)
SELECT t.id, t.pagina_id, t.categoria_id
FROM treinamentos t
WHERE t.pagina_id IS NOT NULL;
