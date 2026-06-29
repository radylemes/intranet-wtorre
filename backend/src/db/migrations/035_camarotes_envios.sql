CREATE TABLE IF NOT EXISTS camarotes_envios (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
  executado_em DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  origem       ENUM('manual','cron') NOT NULL DEFAULT 'manual',
  total_itens  INT              NOT NULL DEFAULT 0,
  destinatarios JSON            NULL,
  enviados     INT              NOT NULL DEFAULT 0,
  erros        JSON             NULL,
  status       ENUM('ok','parcial','erro') NOT NULL DEFAULT 'ok'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
