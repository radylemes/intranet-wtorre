-- Follow-up de Suprimentos: espelho da planilha SharePoint + config + sync log

CREATE TABLE IF NOT EXISTS followup_solicitacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  n_requisicao INT NOT NULL,
  requisitante VARCHAR(255) NULL,
  usuario VARCHAR(120) NOT NULL,
  status_geral VARCHAR(120) NULL,
  pedido_contrato VARCHAR(80) NULL,
  fornecedor VARCHAR(255) NULL,
  valor_total_pedido DECIMAL(14,2) NULL,
  saldo_pedido DECIMAL(14,2) NULL,
  data_emissao_pedido DATE NULL,
  data_aprovacao_rm DATE NULL,
  mapa_cotacao VARCHAR(80) NULL,
  numero_approvo VARCHAR(80) NULL,
  centro_custo VARCHAR(255) NULL,
  nome_filial VARCHAR(255) NULL,
  sincronizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_followup_n_requisicao (n_requisicao),
  KEY idx_followup_usuario (usuario),
  KEY idx_followup_status (status_geral)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS followup_matriz (
  status_geral VARCHAR(120) NOT NULL PRIMARY KEY,
  mensagem_template TEXT NOT NULL,
  colunas_lidas TEXT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS followup_config (
  id INT NOT NULL PRIMARY KEY,
  hostname VARCHAR(255) NULL,
  site_path VARCHAR(255) NULL,
  biblioteca VARCHAR(255) NULL,
  arquivo_caminho VARCHAR(512) NULL,
  item_id VARCHAR(120) NULL,
  aba_rm VARCHAR(80) NOT NULL DEFAULT 'TblRM',
  aba_matriz VARCHAR(80) NOT NULL DEFAULT 'TblMatrizMensagens',
  sync_automatica TINYINT(1) NOT NULL DEFAULT 0,
  sync_intervalo_min INT NOT NULL DEFAULT 60,
  ultima_sync TIMESTAMP NULL,
  ultima_sync_status VARCHAR(20) NULL,
  ultima_sync_linhas INT NULL,
  ultima_sync_erro TEXT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS followup_sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  iniciado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalizado_em TIMESTAMP NULL,
  status ENUM('sucesso','erro') NOT NULL,
  linhas_importadas INT NOT NULL DEFAULT 0,
  mensagem_erro TEXT NULL,
  KEY idx_followup_sync_iniciado (iniciado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO followup_config (
  id, hostname, site_path, biblioteca, arquivo_caminho, item_id,
  aba_rm, aba_matriz, sync_automatica, sync_intervalo_min
) VALUES (
  1, NULL, NULL, NULL, NULL, NULL,
  'TblRM', 'TblMatrizMensagens', 0, 60
);

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('followup-suprimentos', 'Follow-up de Suprimentos', 16);

INSERT INTO menu_items (label, url, parent_id, ordem, abrir_nova_aba, icone, cabecalho, ativo, visivel_perfil)
SELECT 'Follow-up Suprimentos', '/followup-suprimentos', NULL,
  COALESCE((SELECT MAX(ordem) + 1 FROM menu_items m2 WHERE m2.parent_id IS NULL), 1),
  0, NULL, NULL, 1, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE url = '/followup-suprimentos'
);
