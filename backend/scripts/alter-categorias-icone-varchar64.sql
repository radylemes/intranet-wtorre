-- Gerado por build-icon-catalog.mjs — MAX icone = 61 chars (> 50)
-- Executar manualmente em produção ANTES de liberar ícones com slugs longos.
ALTER TABLE categorias_documentos MODIFY COLUMN icone VARCHAR(64) NULL;
