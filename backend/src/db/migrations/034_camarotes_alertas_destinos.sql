CREATE TABLE IF NOT EXISTS camarotes_alertas_destinos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  gatilho_dias INT NOT NULL,
  final_locacao DATE NOT NULL,
  tentativa_em DATETIME(3) NOT NULL,
  destinatario VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NULL,
  provider ENUM('smtp', 'acs') NOT NULL,
  status ENUM('enviado', 'entregue', 'bounce', 'falha') NOT NULL DEFAULT 'enviado',
  erro TEXT NULL,
  enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status_atualizado_em TIMESTAMP NULL,
  KEY idx_message_id (message_id),
  KEY idx_dispatch (unidade_id, gatilho_dias, final_locacao, tentativa_em),
  KEY idx_enviado_em (enviado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
