function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(pool, baseSlug, excludeId = null, paginaId = null) {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const params = [];
    let sql = 'SELECT id FROM categorias_documentos WHERE slug = ?';
    params.push(slug);

    if (paginaId != null) {
      sql += ' AND pagina_id = ?';
      params.push(paginaId);
    }

    if (excludeId != null) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    sql += ' LIMIT 1';
    const [rows] = await pool.execute(sql, params);
    if (rows.length === 0) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function uniqueEntitySlug(pool, table, baseSlug, excludeId = null) {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const params = excludeId != null ? [slug, excludeId] : [slug];
    const sql =
      excludeId != null
        ? `SELECT id FROM ${table} WHERE slug = ? AND id != ? LIMIT 1`
        : `SELECT id FROM ${table} WHERE slug = ? LIMIT 1`;
    const [rows] = await pool.execute(sql, params);
    if (rows.length === 0) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

module.exports = { slugify, uniqueSlug, uniqueEntitySlug };
