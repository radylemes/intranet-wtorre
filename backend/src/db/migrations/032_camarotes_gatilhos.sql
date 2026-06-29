CREATE TABLE IF NOT EXISTS camarotes_gatilhos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dias INT NOT NULL,
  template_codigo ENUM('90dias','30dias','hoje') NOT NULL,
  assunto VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_dias (dias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS camarotes_alertas_envio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  gatilho_dias INT NOT NULL,
  final_locacao DATE NOT NULL,
  enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_envio (unidade_id, gatilho_dias, final_locacao),
  KEY idx_enviado_em (enviado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS camarotes_alertas_settings (
  id INT PRIMARY KEY,
  horario_envio VARCHAR(5) NOT NULL DEFAULT '08:00',
  envio_apos_sync TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO camarotes_gatilhos (dias, template_codigo, assunto, ativo) VALUES
  (90, '90dias', 'Camarote Nº [XXX] — Vencimento em 90 dias', 1),
  (30, '30dias', 'Camarote Nº [XXX] — Vencimento em 30 dias', 1),
  (0, 'hoje', 'Camarote Nº [XXX] — Vence hoje', 1);

INSERT IGNORE INTO camarotes_alertas_settings (id, horario_envio, envio_apos_sync)
VALUES (1, '08:00', 0);
