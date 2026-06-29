-- Corrige ambientes que já rodaram 031 com ativo=0 enquanto SMTP estava ativo.
UPDATE email_provider_config e
INNER JOIN smtp_config s ON s.id = 1
SET e.ativo = s.ativo
WHERE e.id = 1 AND e.ativo = 0 AND s.ativo = 1;
