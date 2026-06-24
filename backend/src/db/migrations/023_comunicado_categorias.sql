CREATE TABLE IF NOT EXISTS comunicado_categorias (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(120) NOT NULL,
  slug          VARCHAR(40) NOT NULL UNIQUE,
  cor           VARCHAR(7) NOT NULL DEFAULT '#1d54e6',
  ordem         INT NOT NULL DEFAULT 0,
  ativo         TINYINT(1) NOT NULL DEFAULT 1,
  criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ativo_ordem (ativo, ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO comunicado_categorias (nome, slug, cor, ordem, ativo)
SELECT 'Recursos Humanos', 'rh', '#8a05be', 1, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM comunicado_categorias WHERE slug = 'rh' LIMIT 1);

INSERT INTO comunicado_categorias (nome, slug, cor, ordem, ativo)
SELECT 'Tecnologia', 'ti', '#1d54e6', 2, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM comunicado_categorias WHERE slug = 'ti' LIMIT 1);

INSERT INTO comunicado_categorias (nome, slug, cor, ordem, ativo)
SELECT 'Nubank Parque', 'ev', '#0e8da0', 3, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM comunicado_categorias WHERE slug = 'ev' LIMIT 1);

INSERT INTO comunicado_categorias (nome, slug, cor, ordem, ativo)
SELECT 'Compliance', 'com', '#a47d2e', 4, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM comunicado_categorias WHERE slug = 'com' LIMIT 1);

INSERT INTO comunicados (titulo, categoria_id, data_publicacao, ativo)
SELECT
  'Inscrições abertas para o programa de mentoria interna do grupo',
  (SELECT id FROM comunicado_categorias WHERE slug = 'rh' LIMIT 1),
  '2025-05-28',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Inscrições abertas para o programa de mentoria interna do grupo'
  LIMIT 1
);

INSERT INTO comunicados (titulo, categoria_id, data_publicacao, ativo)
SELECT
  'Manutenção programada do Oracle EBS no sábado, das 22h às 02h',
  (SELECT id FROM comunicado_categorias WHERE slug = 'ti' LIMIT 1),
  '2025-05-26',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Manutenção programada do Oracle EBS no sábado, das 22h às 02h'
  LIMIT 1
);

INSERT INTO comunicados (titulo, categoria_id, data_publicacao, ativo)
SELECT
  'Novo fluxo de credenciamento para dias de jogo já disponível',
  (SELECT id FROM comunicado_categorias WHERE slug = 'ev' LIMIT 1),
  '2025-05-24',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Novo fluxo de credenciamento para dias de jogo já disponível'
  LIMIT 1
);

INSERT INTO comunicados (titulo, categoria_id, data_publicacao, ativo)
SELECT
  'Atualização da Política de Privacidade e Segurança da Informação',
  (SELECT id FROM comunicado_categorias WHERE slug = 'com' LIMIT 1),
  '2025-05-21',
  1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM comunicados
  WHERE titulo = 'Atualização da Política de Privacidade e Segurança da Informação'
  LIMIT 1
);
