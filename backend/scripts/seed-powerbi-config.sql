-- Seed Power BI — idempotente (INSERT IGNORE).
-- Revisar mapeamento departamento→setor_id antes do go-live (passo 0.5 do plano).
-- setor_id: 1=TI, 2=Operações, 3=RH (documentos_setores)

-- departamento_setor (cobertura dos departamentos ativos no AD em 2026-06-30)
INSERT IGNORE INTO departamento_setor (departamento, setor_id) VALUES
  ('ADM PESSOAL', 3),
  ('Administrativo', 2),
  ('ATC', 2),
  ('ATC ASSIST TECNICA CLIENTE', 2),
  ('Atendimento de Patrocinio', 2),
  ('Atividades Diarias', 2),
  ('Auditoria', 2),
  ('Base Coworking - Administrativo', 2),
  ('Catering', 2),
  ('CCO - Lider Segurança', 2),
  ('Comercial', 2),
  ('Comunicação', 2),
  ('CONTABILIDADE /FISCAL', 2),
  ('Conteúdo - AZP', 2),
  ('Conteúdo e Programação', 2),
  ('Controladoria', 2),
  ('DESENVOLVIMENTO IMOBILIARIO', 2),
  ('Diretoria', 2),
  ('Diretoria Adm Financeira', 2),
  ('Diretoria Admin./Financ', 2),
  ('Diretoria Admin./Financ.', 2),
  ('Diretoria de Constr/Obras', 2),
  ('Diretoria de Construção', 2),
  ('Diretoria de Novos Negocios', 2),
  ('Diretoria de Operações', 2),
  ('Diretoria Superintendencia', 2),
  ('EC - Controladoria - CSC', 2),
  ('EC PATRIMONIO', 2),
  ('Engenharia', 2),
  ('Engenharia e Facilities', 2),
  ('Estruturação Financeira', 2),
  ('FINANCEIRO', 2),
  ('Gerencia Geral', 2),
  ('Gestao Terceiros e Suprimentos', 2),
  ('Juridico', 2),
  ('Juridico Pl', 2),
  ('Manutenção', 2),
  ('Marketing', 2),
  ('Novos Negocios', 2),
  ('Operações', 2),
  ('Operações - Coordenador de Operações', 2),
  ('Operações - Diretor de Operações', 2),
  ('Presidência', 2),
  ('Presidencia - SA', 2),
  ('Produção', 2),
  ('Produtos', 2),
  ('Projeto PNU  Fase 3', 2),
  ('Projeto PNU Indiretos Fase 2', 2),
  ('PROJETO SEND COOLIVING', 2),
  ('Projetos', 2),
  ('R.H.', 3),
  ('Responsabilidade Social', 2),
  ('RH', 3),
  ('Segurança', 2),
  ('T.I,', 1),
  ('T.I.', 1),
  ('Tecnologia da Informação', 1),
  ('TI', 1),
  ('Vale Anhangabau', 2),
  ('Vale Anhangabau - Produtor 2', 2),
  ('WTMorumbi', 2);

-- RLS estático: nomes EXATOS das roles no dataset Power BI (ajustar após diagnóstico Fase 0)
INSERT IGNORE INTO powerbi_setor_rls_role (setor_id, rls_role) VALUES
  (1, 'TI'),
  (2, 'Operacoes'),
  (3, 'RH');

-- Relatórios: substituir report_id pelos GUIDs reais do workspace após sync-powerbi-reports.js
-- INSERT IGNORE INTO powerbi_relatorios (report_id, titulo, ordem) VALUES ('...', 'Dashboard Exemplo', 1);
-- INSERT IGNORE INTO powerbi_relatorio_setores (report_id, setor_id) VALUES ('...', 1), ('...', 2), ('...', 3);
