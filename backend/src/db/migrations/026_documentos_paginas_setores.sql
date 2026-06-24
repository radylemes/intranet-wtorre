CREATE TABLE IF NOT EXISTS documentos_paginas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  descricao VARCHAR(255) NULL,
  logo_url VARCHAR(500) NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pagina_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS documentos_setores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  cor VARCHAR(9) NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_setor_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO documentos_paginas (nome, slug, ordem) VALUES
  ('WTorre', 'wtorre', 1),
  ('Nubank Parque', 'nubank-parque', 2),
  ('Base Coworking', 'base-coworking', 3),
  ('Novo Anhangabaú', 'novo-anhangabau', 4);

INSERT IGNORE INTO documentos_setores (nome, slug, cor, ordem) VALUES
  ('TI', 'ti', '#1d54e6', 1),
  ('Operações', 'operacoes', '#1a9d57', 2),
  ('RH', 'rh', '#c8881b', 3);
