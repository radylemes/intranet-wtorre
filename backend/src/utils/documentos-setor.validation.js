const setorRepo = require('../repositories/documentos-setores.repository');

async function validateSetorId(setorId, { obrigatorio = true } = {}) {
  if (setorId == null || setorId === '') {
    if (!obrigatorio) return null;
    const err = new Error('setor_id é obrigatório.');
    err.status = 400;
    throw err;
  }
  const id = Number(setorId);
  if (!id) {
    const err = new Error('setor_id inválido.');
    err.status = 400;
    throw err;
  }
  const setor = await setorRepo.findById(id);
  if (!setor || !setor.ativo) {
    const err = new Error('Setor não encontrado.');
    err.status = 404;
    throw err;
  }
  return id;
}

module.exports = { validateSetorId };
