CREATE TABLE IF NOT EXISTS empresa_dominios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dominio VARCHAR(150) NOT NULL UNIQUE,
  empresa VARCHAR(120) NOT NULL,
  classe VARCHAR(30) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO empresa_dominios (dominio, empresa, classe) VALUES
  ('grupowtorre.com',     'WTorre',          'wtorre'),
  ('nubankparque.com',    'Nubank Parque',   'nubank'),
  ('basecoworking.space', 'Base Coworking',  'base'),
  ('novoanhangabau.com',  'Novo Anhangabaú', 'novo');
