CREATE TABLE IF NOT EXISTS paginas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  titulo VARCHAR(200) NOT NULL,
  descricao VARCHAR(500) NULL,
  blocos JSON NOT NULL DEFAULT ('[]'),
  status ENUM('rascunho','publicada') NOT NULL DEFAULT 'rascunho',
  criado_por INT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('paginas', 'Páginas', 9);
