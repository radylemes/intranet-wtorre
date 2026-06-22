CREATE TABLE IF NOT EXISTS comunicados (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  titulo            VARCHAR(300) NOT NULL,
  categoria         ENUM('rh','ti','ev','com') NOT NULL,
  data_publicacao   DATE NOT NULL,
  ordem             INT NULL,
  ativo             TINYINT(1) NOT NULL DEFAULT 1,
  criado_por        INT NULL,
  criado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ativo_data (ativo, data_publicacao),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('comunicados', 'Comunicados', 12);

INSERT IGNORE INTO site_config (chave, valor, descricao) VALUES
  ('content.version.comunicados', '0', 'Versão de conteúdo: comunicados do mural');

INSERT INTO comunicados (titulo, categoria, data_publicacao, ativo)
SELECT 'Inscrições abertas para o programa de mentoria interna do grupo', 'rh', '2025-05-28', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Inscrições abertas para o programa de mentoria interna do grupo'
  LIMIT 1
);

INSERT INTO comunicados (titulo, categoria, data_publicacao, ativo)
SELECT 'Manutenção programada do Oracle EBS no sábado, das 22h às 02h', 'ti', '2025-05-26', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Manutenção programada do Oracle EBS no sábado, das 22h às 02h'
  LIMIT 1
);

INSERT INTO comunicados (titulo, categoria, data_publicacao, ativo)
SELECT 'Novo fluxo de credenciamento para dias de jogo já disponível', 'ev', '2025-05-24', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Novo fluxo de credenciamento para dias de jogo já disponível'
  LIMIT 1
);

INSERT INTO comunicados (titulo, categoria, data_publicacao, ativo)
SELECT 'Atualização da Política de Privacidade e Segurança da Informação', 'com', '2025-05-21', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Atualização da Política de Privacidade e Segurança da Informação'
  LIMIT 1
);
