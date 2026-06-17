CREATE TABLE IF NOT EXISTS site_config (
  chave         VARCHAR(80) PRIMARY KEY,
  valor         TEXT NULL,
  descricao     VARCHAR(255) NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('configuracoes', 'Configurações', 7);

INSERT IGNORE INTO site_config (chave, valor, descricao) VALUES
  ('header.chamado.label', 'Abrir Chamado', 'Texto do botão no header'),
  ('header.chamado.url', NULL, 'Destino do botão (/ramais ou https://...)'),
  ('header.chamado.ativo', '0', 'Exibir botão no header (1=sim)'),
  ('header.chamado.nova_aba', '1', 'Abrir destino em nova aba (1=sim)');
