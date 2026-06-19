const permissoesRepo = require('../repositories/permissoes.repository');
const usersRepo = require('../repositories/users.repository');
const colaboradoresRepo = require('../repositories/colaboradores.repository');
const auditRepo = require('../repositories/auditLog.repository');
const permissoesService = require('../services/permissoes.service');

function auditMeta(req) {
  return {
    userId: req.user?.id,
    requestId: req.requestId,
    ip: req.ip,
  };
}

async function listarModulos(_req, res) {
  return res.json(permissoesService.listarModulosCatalogo());
}

async function listarPerfis(_req, res) {
  try {
    const perfis = await permissoesRepo.listarPerfis();
    return res.json(perfis);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function criarPerfil(req, res) {
  try {
    const { nome, descricao, ativo = true } = req.body;
    if (!nome?.trim()) {
      return res.status(400).json({ mensagem: 'Nome é obrigatório.' });
    }
    const perfil = await permissoesRepo.createPerfil({
      nome: nome.trim(),
      descricao: descricao?.trim() || null,
      ativo: ativo !== false,
    });
    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_PERFIL_CREATE',
      email: perfil.nome,
    });
    return res.status(201).json(perfil);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Já existe um perfil com este nome.' });
    }
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function atualizarPerfil(req, res) {
  try {
    const id = Number(req.params.id);
    const existente = await permissoesRepo.findPerfilById(id);
    if (!existente) {
      return res.status(404).json({ mensagem: 'Perfil não encontrado.' });
    }

    const { nome, descricao, ativo } = req.body;
    if (!nome?.trim()) {
      return res.status(400).json({ mensagem: 'Nome é obrigatório.' });
    }

    const novoAtivo = ativo !== false;
    const ativoMudou = existente.ativo !== novoAtivo;

    const perfil = await permissoesRepo.updatePerfil(id, {
      nome: nome.trim(),
      descricao: descricao?.trim() || null,
      ativo: novoAtivo,
    });

    if (ativoMudou) {
      await permissoesService.invalidarCachePorPerfil(id);
    }

    const auditEmail = ativoMudou ? `${perfil.nome} (ativo=${novoAtivo ? 1 : 0})` : perfil.nome;
    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_PERFIL_UPDATE',
      email: auditEmail,
    });

    return res.json(perfil);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'Já existe um perfil com este nome.' });
    }
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function excluirPerfil(req, res) {
  try {
    const id = Number(req.params.id);
    const existente = await permissoesRepo.findPerfilById(id);
    if (!existente) {
      return res.status(404).json({ mensagem: 'Perfil não encontrado.' });
    }

    const vinculados = await permissoesRepo.contarUsuariosDoPerfil(id);
    if (vinculados > 0) {
      return res.status(409).json({
        mensagem: `Perfil em uso por ${vinculados} usuário(s). Remova os vínculos antes de excluir.`,
      });
    }

    await permissoesService.invalidarCachePorPerfil(id);
    await permissoesRepo.deletePerfil(id);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_PERFIL_DELETE',
      email: existente.nome,
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function definirModulosPerfil(req, res) {
  try {
    const id = Number(req.params.id);
    const existente = await permissoesRepo.findPerfilById(id);
    if (!existente) {
      return res.status(404).json({ mensagem: 'Perfil não encontrado.' });
    }

    const { modulos } = req.body;
    if (!Array.isArray(modulos)) {
      return res.status(400).json({ mensagem: 'modulos deve ser um array.' });
    }

    permissoesService.validarCodigosModulos(modulos);
    await permissoesRepo.setModulosDoPerfil(id, modulos);
    await permissoesService.invalidarCachePorPerfil(id);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_PERFIL_MODULOS',
      email: `${id}:${modulos.join(',')}`,
    });

    const perfil = await permissoesRepo.findPerfilById(id);
    return res.json(perfil);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function listarUsuarios(_req, res) {
  try {
    const usuarios = await usersRepo.listComPermissoes();
    return res.json(usuarios);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function buscarColaboradores(req, res) {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const colaboradores = await colaboradoresRepo.findAll({ busca: q, ativoOnly: true });
    const result = [];
    for (const c of colaboradores) {
      const full = await colaboradoresRepo.findById(c.id);
      let ja_cadastrado = false;
      let usuario_id = null;
      if (full?.ad_id) {
        const user = await usersRepo.findByMicrosoftId(full.ad_id);
        if (user) {
          ja_cadastrado = true;
          usuario_id = user.id;
        }
      }
      result.push({
        id: c.id,
        ad_id: full?.ad_id,
        nome: c.nome,
        email: c.email,
        departamento: c.departamento,
        empresa: c.empresa,
        ja_cadastrado,
        usuario_id,
      });
    }
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function obterUsuario(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await usersRepo.findById(id);
    if (!user) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    const perfis = await permissoesRepo.listarPerfisDoUsuario(id);
    const modulos_extra = await permissoesRepo.listarModulosExtraDoUsuario(id);
    const modulos = await permissoesService.resolveModulos(user);

    return res.json({ ...user, perfis, modulos_extra, modulos });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function atualizarUsuario(req, res) {
  try {
    if (req.body.perfil !== undefined) {
      return res.status(400).json({
        mensagem: 'Use PATCH /usuarios/:id/perfil para alterar o perfil ADMIN/USER.',
      });
    }

    let usuarioId = Number(req.params.id);
    let user = usuarioId > 0 ? await usersRepo.findById(usuarioId) : null;

    if (!user && req.body.colaborador_id) {
      user = await permissoesService.provisionarUsuarioDeColaborador(
        Number(req.body.colaborador_id)
      );
      usuarioId = user.id;
    }

    if (!user) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    if (user.perfil === 'ADMIN') {
      return res.status(400).json({
        mensagem: 'Perfis e módulos RBAC não se aplicam a super-admins. Use PATCH /perfil para rebaixar.',
      });
    }

    const { perfil_ids, modulos_extra } = req.body;
    if (!Array.isArray(perfil_ids) || !Array.isArray(modulos_extra)) {
      return res.status(400).json({ mensagem: 'perfil_ids e modulos_extra são obrigatórios.' });
    }

    permissoesService.validarCodigosModulos(modulos_extra);

    await permissoesRepo.setPerfisDoUsuario(usuarioId, perfil_ids.map(Number));
    await permissoesRepo.setModulosExtra(usuarioId, modulos_extra);
    await permissoesService.invalidarCache(usuarioId);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_USUARIO_UPDATE',
      email: user.email,
    });

    const perfis = await permissoesRepo.listarPerfisDoUsuario(usuarioId);
    const extras = await permissoesRepo.listarModulosExtraDoUsuario(usuarioId);
    const atualizado = await usersRepo.findById(usuarioId);
    const modulos = await permissoesService.resolveModulos(atualizado);

    return res.json({ ...atualizado, perfis, modulos_extra: extras, modulos });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function patchPerfilUsuario(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await usersRepo.findById(id);
    if (!user) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    const { perfil } = req.body;
    if (perfil !== 'ADMIN' && perfil !== 'USER') {
      return res.status(400).json({ mensagem: 'perfil deve ser ADMIN ou USER.' });
    }

    if (user.perfil === perfil) {
      const perfis = await permissoesRepo.listarPerfisDoUsuario(id);
      const modulos_extra = await permissoesRepo.listarModulosExtraDoUsuario(id);
      const modulos = await permissoesService.resolveModulos(user);
      return res.json({ ...user, perfis, modulos_extra, modulos });
    }

    if (perfil === 'USER' && user.perfil === 'ADMIN') {
      const adminsRestantes = await usersRepo.countAdminsAtivos(id);
      if (adminsRestantes < 1) {
        return res.status(400).json({
          mensagem: 'Não é possível rebaixar o último super-admin ativo do sistema.',
        });
      }
    }

    const atualizado = await usersRepo.setPerfil(id, perfil);
    await permissoesService.invalidarCache(id);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_USUARIO_PERFIL',
      email: `${user.email} → ${perfil}`,
    });

    const perfis = await permissoesRepo.listarPerfisDoUsuario(id);
    const modulos_extra = await permissoesRepo.listarModulosExtraDoUsuario(id);
    const modulos = await permissoesService.resolveModulos(atualizado);

    return res.json({ ...atualizado, perfis, modulos_extra, modulos });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function patchAtivoUsuario(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await usersRepo.findById(id);
    if (!user) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') {
      return res.status(400).json({ mensagem: 'ativo deve ser boolean.' });
    }

    if (!ativo && user.perfil === 'ADMIN') {
      const adminsRestantes = await usersRepo.countAdminsAtivos(id);
      if (adminsRestantes < 1) {
        return res.status(400).json({
          mensagem: 'Não é possível desativar o último super-admin ativo do sistema.',
        });
      }
    }

    const atualizado = await usersRepo.setAtivo(id, ativo);
    await permissoesService.invalidarCache(id);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_USUARIO_ATIVO',
      email: `${user.email} → ${ativo ? 'ativo' : 'inativo'}`,
    });

    return res.json(atualizado);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function excluirUsuario(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await usersRepo.findById(id);
    if (!user) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    if (req.user?.id === id) {
      return res.status(400).json({ mensagem: 'Não é possível excluir o próprio usuário.' });
    }

    if (user.perfil === 'ADMIN' && user.ativo) {
      const adminsRestantes = await usersRepo.countAdminsAtivos(id);
      if (adminsRestantes < 1) {
        return res.status(400).json({
          mensagem: 'Não é possível excluir o último super-admin ativo do sistema.',
        });
      }
    }

    await permissoesService.invalidarCache(id);
    await usersRepo.deleteById(id);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'PERMISSOES_USUARIO_DELETE',
      email: user.email,
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  listarModulos,
  listarPerfis,
  criarPerfil,
  atualizarPerfil,
  excluirPerfil,
  definirModulosPerfil,
  listarUsuarios,
  buscarColaboradores,
  obterUsuario,
  atualizarUsuario,
  patchPerfilUsuario,
  patchAtivoUsuario,
  excluirUsuario,
};
