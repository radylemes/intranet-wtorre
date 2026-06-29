-- Visibilidade de documentos e treinamentos por entidade (N:N)

CREATE TABLE IF NOT EXISTS documento_entidades (
  documento_id INT NOT NULL,
  pagina_id INT NOT NULL,
  categoria_id INT NULL,
  PRIMARY KEY (documento_id, pagina_id),
  CONSTRAINT fk_de_documento FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
  CONSTRAINT fk_de_pagina FOREIGN KEY (pagina_id) REFERENCES documentos_paginas(id) ON DELETE CASCADE,
  CONSTRAINT fk_de_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_documentos(id) ON DELETE SET NULL,
  INDEX idx_de_pagina_categoria (pagina_id, categoria_id)
);

CREATE TABLE IF NOT EXISTS treinamento_entidades (
  treinamento_id INT NOT NULL,
  pagina_id INT NOT NULL,
  categoria_id INT NULL,
  PRIMARY KEY (treinamento_id, pagina_id),
  CONSTRAINT fk_te_treinamento FOREIGN KEY (treinamento_id) REFERENCES treinamentos(id) ON DELETE CASCADE,
  CONSTRAINT fk_te_pagina FOREIGN KEY (pagina_id) REFERENCES documentos_paginas(id) ON DELETE CASCADE,
  CONSTRAINT fk_te_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_documentos(id) ON DELETE SET NULL,
  INDEX idx_te_pagina_categoria (pagina_id, categoria_id)
);

INSERT IGNORE INTO documento_entidades (documento_id, pagina_id, categoria_id)
SELECT d.id, c.pagina_id, d.categoria_id
FROM documentos d
INNER JOIN categorias_documentos c ON c.id = d.categoria_id
WHERE c.pagina_id IS NOT NULL;

INSERT IGNORE INTO treinamento_entidades (treinamento_id, pagina_id, categoria_id)
SELECT t.id, t.pagina_id, t.categoria_id
FROM treinamentos t
WHERE t.pagina_id IS NOT NULL;
