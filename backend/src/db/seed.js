require('dotenv').config();
const bcrypt = require('bcrypt');
const { getPool } = require('./pool');

async function seedAdmin(pool) {
  const email = process.env.ADMIN_EMAIL || 'admin@grupowtorre.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn('ADMIN_PASSWORD não definido — seed admin ignorado.');
    return;
  }

  const [existing] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existing.length > 0) {
    console.log('Admin já existe, seed admin ignorado.');
    return;
  }

  const senhaHash = await bcrypt.hash(password, 12);
  const username = email.split('@')[0];

  await pool.execute(
    `INSERT INTO usuarios (username, nome_completo, email, senha_hash, perfil, is_ad_user, ativo)
     VALUES (?, ?, ?, ?, 'ADMIN', 0, 1)`,
    [username, 'Administrador Intranet', email, senhaHash]
  );

  console.log(`Admin criado: ${email}`);
}

async function seedDocumentosPaginas(pool) {
  const paginas = [
    { nome: 'WTorre', slug: 'wtorre', ordem: 1 },
    { nome: 'Nubank Parque', slug: 'nubank-parque', ordem: 2 },
    { nome: 'Base Coworking', slug: 'base-coworking', ordem: 3 },
    { nome: 'Novo Anhangabaú', slug: 'novo-anhangabau', ordem: 4 },
  ];

  for (const p of paginas) {
    await pool.execute(
      `INSERT IGNORE INTO documentos_paginas (nome, slug, ordem, ativo) VALUES (?, ?, ?, 1)`,
      [p.nome, p.slug, p.ordem]
    );
  }

  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM documentos_paginas');
  if (rows[0].total > 0) {
    console.log('Páginas de documentos verificadas.');
  }
}

async function seedDocumentosSetores(pool) {
  const setores = [
    { nome: 'TI', slug: 'ti', cor: '#1d54e6', ordem: 1 },
    { nome: 'Operações', slug: 'operacoes', cor: '#1a9d57', ordem: 2 },
    { nome: 'RH', slug: 'rh', cor: '#c8881b', ordem: 3 },
  ];

  for (const s of setores) {
    await pool.execute(
      `INSERT IGNORE INTO documentos_setores (nome, slug, cor, ordem, ativo) VALUES (?, ?, ?, ?, 1)`,
      [s.nome, s.slug, s.cor, s.ordem]
    );
  }
}

async function seedCategoriasDocumentos(pool) {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM categorias_documentos');
  if (rows[0].total > 0) {
    console.log('Categorias de documentos já existem, seed ignorado.');
    return;
  }

  const [paginaRows] = await pool.execute(
    'SELECT id FROM documentos_paginas WHERE slug = ? LIMIT 1',
    ['wtorre']
  );
  const paginaId = paginaRows[0]?.id;
  if (!paginaId) {
    console.warn('Página WTorre não encontrada — seed de categorias ignorado.');
    return;
  }

  const roots = [
    { nome: 'Compliance', slug: 'compliance', icone: 'shield', ordem: 0 },
    { nome: 'Políticas e Procedimentos', slug: 'politicas-procedimentos', icone: 'file', ordem: 1 },
    { nome: 'Manuais de Marca', slug: 'manuais-marca', icone: 'brand', ordem: 2 },
    { nome: 'Treinamento', slug: 'treinamento', icone: 'cap', ordem: 3 },
  ];

  const rootIds = {};
  for (const cat of roots) {
    const [result] = await pool.execute(
      `INSERT INTO categorias_documentos (nome, slug, icone, pagina_id, ordem, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [cat.nome, cat.slug, cat.icone, paginaId, cat.ordem]
    );
    rootIds[cat.slug] = result.insertId;
  }

  const children = [
    { nome: 'Brandbook', slug: 'brandbook', ordem: 0, parentSlug: 'manuais-marca' },
    {
      nome: 'Apresentação institucional',
      slug: 'apresentacao-institucional',
      ordem: 1,
      parentSlug: 'manuais-marca',
    },
    { nome: 'Papelaria', slug: 'papelaria', ordem: 2, parentSlug: 'manuais-marca' },
  ];

  for (const child of children) {
    await pool.execute(
      `INSERT INTO categorias_documentos (nome, slug, parent_id, pagina_id, ordem, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [child.nome, child.slug, rootIds[child.parentSlug], paginaId, child.ordem]
    );
  }

  console.log('Categorias de documentos criadas.');
}

async function seed() {
  const pool = getPool();
  await seedAdmin(pool);
  await seedDocumentosPaginas(pool);
  await seedDocumentosSetores(pool);
  await seedCategoriasDocumentos(pool);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erro no seed:', err.message);
  process.exit(1);
});
