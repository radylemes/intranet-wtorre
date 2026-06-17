CREATE TABLE IF NOT EXISTS modulos_admin (
  codigo    VARCHAR(40) PRIMARY KEY,
  nome      VARCHAR(120) NOT NULL,
  descricao VARCHAR(255) NULL,
  ordem     INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS perfis_acesso (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(120) NOT NULL UNIQUE,
  descricao VARCHAR(255) NULL,
  ativo     TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS perfil_modulos (
  perfil_id     INT NOT NULL,
  modulo_codigo VARCHAR(40) NOT NULL,
  PRIMARY KEY (perfil_id, modulo_codigo),
  FOREIGN KEY (perfil_id)     REFERENCES perfis_acesso(id) ON DELETE CASCADE,
  FOREIGN KEY (modulo_codigo) REFERENCES modulos_admin(codigo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuario_perfis (
  usuario_id INT NOT NULL,
  perfil_id  INT NOT NULL,
  PRIMARY KEY (usuario_id, perfil_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (perfil_id)  REFERENCES perfis_acesso(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuario_modulos_extra (
  usuario_id    INT NOT NULL,
  modulo_codigo VARCHAR(40) NOT NULL,
  PRIMARY KEY (usuario_id, modulo_codigo),
  FOREIGN KEY (usuario_id)    REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (modulo_codigo) REFERENCES modulos_admin(codigo) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('menu',          'Gestão do Menu',   1),
  ('documentos',    'Documentos',       2),
  ('treinamentos',  'Treinamentos',     3),
  ('containers',    'Containers',       4),
  ('tenants',       'Tenants Azure',    5),
  ('colaboradores', 'Sincronização AD', 6);
