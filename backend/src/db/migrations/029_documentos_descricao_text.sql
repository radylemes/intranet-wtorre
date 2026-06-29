-- Ampliar descricao de documentos (textarea no admin pode exceder VARCHAR(400))

ALTER TABLE documentos
  MODIFY COLUMN descricao TEXT NULL;
