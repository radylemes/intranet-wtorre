-- Adiciona barra de empresas (sponsors) ao footer.config existente
UPDATE site_config
SET valor = JSON_SET(
  valor,
  '$.sponsors',
  JSON_ARRAY(
    JSON_OBJECT('label', 'WTORRE'),
    JSON_OBJECT('label', 'NUBANK PARQUE'),
    JSON_OBJECT('label', 'BASE COWORKING'),
    JSON_OBJECT('label', 'NOVO ANHANGABAÚ')
  )
)
WHERE chave = 'footer.config'
  AND JSON_EXTRACT(valor, '$.sponsors') IS NULL;
