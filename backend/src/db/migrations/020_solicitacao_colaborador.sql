CREATE TABLE IF NOT EXISTS solicitacoes_colaborador (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitante_usuario_id INT NULL,
  solicitante_nome VARCHAR(255) NOT NULL,
  solicitante_email VARCHAR(255) NOT NULL,
  tipo ENUM('novo','reposicao','mudanca') NOT NULL,
  nome VARCHAR(120) NOT NULL,
  sobrenome VARCHAR(120) NOT NULL,
  email_novo VARCHAR(255) NULL,
  data_nascimento DATE NULL,
  cpf VARCHAR(20) NULL,
  rg VARCHAR(20) NULL,
  departamento VARCHAR(120) NULL,
  cargo VARCHAR(120) NULL,
  supervisor VARCHAR(120) NULL,
  centro_custo VARCHAR(120) NULL,
  empresa VARCHAR(120) NULL,
  local_trabalho VARCHAR(120) NULL,
  foto_url VARCHAR(500) NULL,
  boas_vindas_url VARCHAR(500) NULL,
  credencial_veiculo_url VARCHAR(500) NULL,
  precisa_ramal TINYINT(1) NOT NULL DEFAULT 0,
  precisa_celular TINYINT(1) NOT NULL DEFAULT 0,
  equipamento ENUM('desktop','notebook','nao') NOT NULL DEFAULT 'nao',
  credencial_estacionamento TINYINT(1) NOT NULL DEFAULT 0,
  data_inicio DATE NULL,
  status ENUM('recebida','enviada','parcial','erro') NOT NULL DEFAULT 'recebida',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT NULL,
  FOREIGN KEY (solicitante_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  KEY idx_status (status),
  KEY idx_tipo (tipo),
  KEY idx_criado_em (criado_em),
  KEY idx_solicitante (solicitante_usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS solicitacao_grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  destinatarios JSON NOT NULL,
  campos JSON NOT NULL,
  assunto VARCHAR(255) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_nome (nome),
  KEY idx_ativo_ordem (ativo, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS solicitacao_emails_individuais (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NULL,
  email VARCHAR(255) NOT NULL,
  assunto VARCHAR(255) NULL,
  campos JSON NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email (email),
  KEY idx_ativo_ordem (ativo, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS solicitacao_envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitacao_id INT NOT NULL,
  grupo_id INT NULL,
  email_individual_id INT NULL,
  grupo_nome VARCHAR(120) NOT NULL,
  destinatarios JSON NOT NULL,
  status ENUM('ok','erro') NOT NULL,
  erro TEXT NULL,
  message_id VARCHAR(255) NULL,
  enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_colaborador(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id) REFERENCES solicitacao_grupos(id) ON DELETE SET NULL,
  FOREIGN KEY (email_individual_id) REFERENCES solicitacao_emails_individuais(id) ON DELETE SET NULL,
  KEY idx_solicitacao (solicitacao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS solicitacao_visualizadores (
  usuario_id INT NOT NULL PRIMARY KEY,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('solicitacao-colaborador', 'Solicitação de Colaborador', 11);

INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Solicitação de Colaborador', '/solicitacao-colaborador', NULL, calc.novo_ordem,
  0, NULL, NULL, 1, NULL
FROM (
  SELECT COALESCE(MAX(ordem) + 1, 1) AS novo_ordem
  FROM menu_items
  WHERE parent_id IS NULL
) AS calc
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT id FROM menu_items WHERE url = '/solicitacao-colaborador') AS chk
);
