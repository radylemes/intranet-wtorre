const containersRepo = require('../repositories/storage-containers.repository');
const blobService = require('../services/blob.service');
const { validarNomeContainer } = require('../utils/container-nome.validation');

async function listar(req, res) {
  try {
    await containersRepo.bootstrapContainerPadrao();
    const cadastrados = await containersRepo.listar();

    if (req.query.conta !== '1') {
      return res.json(cadastrados);
    }

    const nomesConta = await blobService.listarContainersDaConta();
    const nomesCadastrados = new Set(cadastrados.map((c) => c.nome));
    const extras = nomesConta
      .filter((nome) => !nomesCadastrados.has(nome))
      .map((nome) => ({
        id: null,
        nome,
        rotulo: nome,
        descricao: null,
        padrao: false,
        ativo: true,
        qtd_videos: 0,
        importado: false,
      }));

    return res.json([
      ...cadastrados.map((c) => ({ ...c, importado: true })),
      ...extras,
    ]);
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao listar containers.',
    });
  }
}

async function criar(req, res) {
  try {
    const { nome, rotulo, descricao, padrao, criarNoAzure } = req.body;
    if (!nome || !rotulo?.trim()) {
      return res.status(400).json({ mensagem: 'nome e rotulo são obrigatórios.' });
    }

    const v = validarNomeContainer(nome);
    if (!v.ok) return res.status(400).json({ mensagem: v.mensagem });

    const existente = await containersRepo.findByNome(v.nome);
    if (existente) {
      return res.status(409).json({ mensagem: 'Container já cadastrado.' });
    }

    if (criarNoAzure) {
      await blobService.garantirContainer(v.nome);
    } else {
      const existe = await blobService.containerExiste(v.nome);
      if (!existe) {
        return res.status(400).json({
          mensagem: 'Container não existe no Azure. Marque "Criar no Azure" ou importe um existente.',
        });
      }
    }

    const container = await containersRepo.criar({
      nome: v.nome,
      rotulo: rotulo.trim(),
      descricao: descricao?.trim() || null,
      padrao: !!padrao,
      ativo: true,
    });

    if (padrao) {
      await containersRepo.definirPadrao(container.id);
      const atualizado = await containersRepo.findById(container.id);
      return res.status(201).json(atualizado);
    }

    return res.status(201).json(container);
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao criar container.',
    });
  }
}

async function atualizar(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await containersRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Container não encontrado.' });
    }

    const { rotulo, descricao, padrao, ativo } = req.body;
    const data = {};
    if (rotulo !== undefined) {
      const t = rotulo?.trim();
      if (!t) return res.status(400).json({ mensagem: 'rotulo é obrigatório.' });
      data.rotulo = t;
    }
    if (descricao !== undefined) data.descricao = descricao?.trim() || null;
    if (ativo !== undefined) data.ativo = !!ativo;
    if (padrao !== undefined) data.padrao = !!padrao;

    let updated = await containersRepo.atualizar(id, data);
    if (padrao) {
      await containersRepo.definirPadrao(id);
      updated = await containersRepo.findById(id);
    }

    return res.json(updated);
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao atualizar container.',
    });
  }
}

async function excluir(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await containersRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Container não encontrado.' });
    }

    const emUso = await containersRepo.contarTreinamentosPorContainer(existing.nome);
    if (emUso > 0) {
      return res.status(409).json({
        mensagem:
          'Container em uso por treinamentos. Mova ou exclua os vídeos antes de remover o cadastro.',
      });
    }

    await containersRepo.remover(id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({
      mensagem: err.message || 'Erro ao remover container.',
    });
  }
}

module.exports = { listar, criar, atualizar, excluir };
