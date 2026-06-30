-- Purga registros antigos de powerbi_access_log (reexecutável).
-- Ajuste o INTERVAL conforme política (90 ou 180 dias).

DELETE FROM powerbi_access_log
WHERE criado_em < DATE_SUB(NOW(), INTERVAL 90 DAY);
