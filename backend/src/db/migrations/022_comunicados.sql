CREATE TABLE IF NOT EXISTS comunicados (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  titulo            VARCHAR(300) NOT NULL,
  categoria_id      INT NULL,
  data_publicacao   DATE NOT NULL,
  ordem             INT NULL,
  ativo             TINYINT(1) NOT NULL DEFAULT 1,
  criado_por        INT NULL,
  criado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ativo_data (ativo, data_publicacao),
  INDEX idx_categoria_id (categoria_id),
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('comunicados', 'Comunicados', 12);

INSERT IGNORE INTO site_config (chave, valor, descricao) VALUES
  ('content.version.comunicados', '0', 'Versão de conteúdo: comunicados do mural');
