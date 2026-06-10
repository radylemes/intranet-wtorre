CREATE TABLE IF NOT EXISTS colaboradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ad_id VARCHAR(64) NOT NULL,
  tenant_id INT NULL,
  empresa VARCHAR(120) NULL,
  nome VARCHAR(200) NOT NULL,
  cargo VARCHAR(200) NULL,
  departamento VARCHAR(200) NULL,
  email VARCHAR(200) NULL,
  celular VARCHAR(60) NULL,
  ramal VARCHAR(30) NULL,
  telefone_fixo VARCHAR(60) NULL,
  nasc_dia TINYINT NULL,
  nasc_mes TINYINT NULL,
  nasc_ano SMALLINT NULL,
  tem_foto TINYINT(1) NULL DEFAULT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  sincronizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ad_id (ad_id),
  INDEX idx_empresa (empresa),
  INDEX idx_departamento (departamento),
  INDEX idx_nasc_mes (nasc_mes),
  FOREIGN KEY (tenant_id) REFERENCES azure_tenants(id) ON DELETE SET NULL
);

UPDATE menu_items SET url = '/ramais', abrir_nova_aba = 0 WHERE label = 'Ramais' AND (url IS NULL OR url = '');
