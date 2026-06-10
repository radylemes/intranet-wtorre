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

async function seedCategoriasDocumentos(pool) {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM categorias_documentos');
  if (rows[0].total > 0) {
    console.log('Categorias de documentos já existem, seed ignorado.');
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
      `INSERT INTO categorias_documentos (nome, slug, icone, ordem, ativo)
       VALUES (?, ?, ?, ?, 1)`,
      [cat.nome, cat.slug, cat.icone, cat.ordem]
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
      `INSERT INTO categorias_documentos (nome, slug, parent_id, ordem, ativo)
       VALUES (?, ?, ?, ?, 1)`,
      [child.nome, child.slug, rootIds[child.parentSlug], child.ordem]
    );
  }

  console.log('Categorias de documentos criadas.');
}

async function seed() {
  const pool = getPool();
  await seedAdmin(pool);
  await seedCategoriasDocumentos(pool);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erro no seed:', err.message);
  process.exit(1);
});
