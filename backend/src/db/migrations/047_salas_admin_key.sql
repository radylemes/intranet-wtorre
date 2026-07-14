-- Chave admin cifrada para proxy das rotas /admin/* da API externa.
--
-- PRODUÇÃO — executar manualmente UMA vez se salas_config já existir:
--
-- ALTER TABLE salas_config
--   ADD COLUMN admin_api_key_ciphertext TEXT NULL,
--   ADD COLUMN admin_api_key_hint VARCHAR(4) NULL;
--
-- Idempotente no migrate automatizado:
SELECT 1;
