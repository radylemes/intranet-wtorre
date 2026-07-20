/**
 * Isolado para casar o usuário logado com a coluna `Usuario` da planilha
 * (formato nome.sobrenome). Ajuste aqui sem espalhar pelo código.
 *
 * Regra atual: prefixo do e-mail/UPN antes de @, em minúsculas.
 * Fallback: username do registro local.
 */
function resolveLoginFromUser(user) {
  if (!user) return null;
  const email = String(user.email || '').trim().toLowerCase();
  if (email.includes('@')) {
    return email.split('@')[0] || null;
  }
  const username = String(user.username || '').trim().toLowerCase();
  return username || null;
}

module.exports = { resolveLoginFromUser };
