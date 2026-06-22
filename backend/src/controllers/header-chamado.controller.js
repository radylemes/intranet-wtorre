const configuracoesController = require('./configuracoes.controller');

module.exports = {
  getHeaderChamado: configuracoesController.getHeaderChamadoPublic,
  putHeaderChamado: configuracoesController.putHeaderChamado,
};
