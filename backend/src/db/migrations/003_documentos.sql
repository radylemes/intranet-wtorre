CREATE TABLE IF NOT EXISTS categorias_documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  descricao VARCHAR(300) NULL,
  icone VARCHAR(50) NULL,
  parent_id INT NULL,
  pagina_id INT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categorias_documentos(id) ON DELETE CASCADE,
  INDEX idx_cat_parent_ordem (parent_id, ordem)
);

CREATE TABLE IF NOT EXISTS documentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  descricao VARCHAR(400) NULL,
  nome_original VARCHAR(255) NOT NULL,
  arquivo_path VARCHAR(255) NOT NULL,
  mime VARCHAR(120) NOT NULL,
  extensao VARCHAR(10) NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  criado_por INT NULL,
  setor_id INT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias_documentos(id) ON DELETE CASCADE,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_doc_categoria (categoria_id)
);
