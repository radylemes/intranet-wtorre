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
