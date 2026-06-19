-- Módulo admin Rodapé (Gestão de Conteúdo)
UPDATE modulos_admin SET ordem = ordem + 1 WHERE ordem >= 2;

INSERT IGNORE INTO modulos_admin (codigo, nome, ordem) VALUES
  ('rodape', 'Rodapé', 2);

INSERT IGNORE INTO site_config (chave, valor, descricao) VALUES
  ('footer.config', '{
  "marca": {
    "titulo": "GRUPO WTORRE",
    "descricao": "Intranet corporativa unificada. Conectando pessoas, sistemas e os destinos do grupo em uma única plataforma."
  },
  "colunas": [
    {
      "id": "empresas",
      "titulo": "Empresas",
      "links": [
        { "label": "WTorre", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Nubank Parque", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Base Coworking", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Novo Anhangabaú", "url": null, "tipo_destino": "interna", "nova_aba": false }
      ]
    },
    {
      "id": "atalhos",
      "titulo": "Atalhos",
      "links": [
        { "label": "Abertura de Chamados", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Sistemas Corporativos", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Documentos", "url": "/documentos", "tipo_destino": "interna", "nova_aba": false },
        { "label": "Oportunidades", "url": null, "tipo_destino": "interna", "nova_aba": false }
      ]
    },
    {
      "id": "suporte",
      "titulo": "Suporte",
      "links": [
        { "label": "Service Desk · 4040", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Segurança da Informação", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Compliance", "url": null, "tipo_destino": "interna", "nova_aba": false },
        { "label": "Fale com o RH", "url": null, "tipo_destino": "interna", "nova_aba": false }
      ]
    }
  ],
  "legal": {
    "copyright": "© 2026 Grupo WTorre · Uso interno e confidencial",
    "links_texto": "Política de Privacidade · Termos de Uso · v2.4"
  }
}', 'Configuração do rodapé da intranet');
