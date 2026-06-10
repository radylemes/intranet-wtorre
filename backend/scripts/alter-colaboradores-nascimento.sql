-- Executar UMA VEZ no banco já existente (não colocar em migrations).
ALTER TABLE colaboradores
  ADD COLUMN telefone_fixo VARCHAR(60) NULL AFTER ramal,
  ADD COLUMN nasc_dia TINYINT NULL,
  ADD COLUMN nasc_mes TINYINT NULL,
  ADD COLUMN nasc_ano SMALLINT NULL;
CREATE INDEX idx_nasc_mes ON colaboradores (nasc_mes);
