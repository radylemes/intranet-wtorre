INSERT IGNORE INTO site_config (chave, valor, descricao) VALUES
  ('login.config', '{
  "marca_topo": {
    "titulo": "GRUPO WTORRE",
    "subtitulo": "INTRANET CORPORATIVA"
  },
  "hero": {
    "titulo_linha1": "Um só grupo.",
    "titulo_destaque": "Quatro grandes destinos.",
    "lead": "Acesse sistemas, documentos e serviços das empresas do grupo em uma única plataforma segura."
  },
  "pill": {
    "texto": "PÁGINA CORPORATIVA · ACESSO RESTRITO"
  },
  "auth": {
    "titulo": "Entrar na intranet",
    "subtitulo": "Use sua conta corporativa Microsoft para continuar."
  },
  "aviso_seguranca": "Aviso de segurança. Este é um sistema de uso exclusivo do Grupo WTorre. O acesso é monitorado e registrado. O uso não autorizado é proibido e pode estar sujeito a medidas disciplinares e legais. Ao continuar, você concorda com a Política de Segurança da Informação.",
  "rodape": {
    "copyright": "© 2026 Grupo WTorre · Uso interno e confidencial",
    "contato": "CCO: Ramal 6673 · TEL.: (11) 4800-6673"
  },
  "empresas_titulo": "Empresas do grupo",
  "empresas": [
    {
      "id": "wtorre",
      "nome": "WTORRE",
      "variante": "wt",
      "imagem_url": null,
      "ordem": 0
    },
    {
      "id": "nubank",
      "nome": "Nubank Parque",
      "variante": "nb",
      "imagem_url": null,
      "ordem": 1
    },
    {
      "id": "base",
      "nome": "base",
      "variante": "bs",
      "imagem_url": null,
      "ordem": 2
    },
    {
      "id": "anhangabau",
      "nome": "Anhangabaú",
      "variante": "an",
      "imagem_url": null,
      "ordem": 3
    }
  ]
}', 'Configuração da página de login');
