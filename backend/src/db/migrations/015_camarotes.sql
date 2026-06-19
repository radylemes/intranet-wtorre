CREATE TABLE IF NOT EXISTS camarotes_unidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_unidade ENUM('camarote','lounge') NOT NULL,
  andar VARCHAR(20) NULL,
  setor VARCHAR(20) NULL,
  numero VARCHAR(20) NOT NULL,
  capacidade INT NULL,
  cessionario VARCHAR(255) NULL,
  tipo_cessionario VARCHAR(40) NULL,
  primeira_locacao DATE NULL,
  inicio_locacao DATE NULL,
  final_locacao DATE NULL,
  tempo_anos INT NULL,
  tempo_meses INT NULL,
  valor_total DECIMAL(14,2) NULL,
  valor_cessao DECIMAL(14,2) NULL,
  valor_anual DECIMAL(14,2) NULL,
  entrada DECIMAL(14,2) NULL,
  valor_parcelado DECIMAL(14,2) NULL,
  valor_vagas DECIMAL(14,2) NULL,
  qtd_parcelas INT NULL,
  vagas_vvip INT NULL,
  credencial_staff VARCHAR(255) NULL,
  categorias_staff VARCHAR(255) NULL,
  pack30 TINYINT(1) NOT NULL DEFAULT 0,
  status_contrato VARCHAR(60) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tipo_numero (tipo_unidade, numero),
  KEY idx_final_locacao (final_locacao),
  KEY idx_setor (setor),
  KEY idx_tipo_cessionario (tipo_cessionario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS camarotes_sync (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo_unidade ENUM('camarote','lounge') NOT NULL,
  executado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  linhas_lidas INT NOT NULL DEFAULT 0,
  linhas_gravadas INT NOT NULL DEFAULT 0,
  status ENUM('ok','erro') NOT NULL,
  erro TEXT NULL,
  duracao_ms INT NOT NULL DEFAULT 0,
  KEY idx_executado_em (executado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS camarotes_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emails_alerta JSON NOT NULL,
  dias_vence_breve INT NOT NULL DEFAULT 90,
  cadencia ENUM('diaria','semanal') NOT NULL DEFAULT 'diaria',
  envio_ativo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_envio TIMESTAMP NULL,
  ultima_sync TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('camarotes', 'Camarotes e Lounges', 10);

INSERT IGNORE INTO camarotes_config (id, emails_alerta, dias_vence_breve, cadencia, envio_ativo)
VALUES (1, '[]', 90, 'diaria', 1);
