const CONTAINER_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

function validarNomeContainer(nome) {
  if (!nome || typeof nome !== 'string') {
    return { ok: false, mensagem: 'Nome do container é obrigatório.' };
  }
  const trimmed = nome.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 63) {
    return { ok: false, mensagem: 'Nome do container deve ter entre 3 e 63 caracteres.' };
  }
  if (!CONTAINER_NAME_RE.test(trimmed)) {
    return {
      ok: false,
      mensagem:
        'Nome inválido: use apenas letras minúsculas, números e hífens; deve começar e terminar com letra ou número; sem hífens duplos.',
    };
  }
  if (trimmed.includes('--')) {
    return { ok: false, mensagem: 'Nome do container não pode conter hífens consecutivos.' };
  }
  return { ok: true, nome: trimmed };
}

module.exports = { validarNomeContainer, CONTAINER_NAME_RE };
