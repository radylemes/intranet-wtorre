const nubankparqueElementor = require('./nubankparque-elementor.parser');
const wixEventList = require('./wix-event-list.parser');

const PARSERS = {
  [nubankparqueElementor.codigo]: nubankparqueElementor,
  [wixEventList.codigo]: wixEventList,
};

function getParser(tipo) {
  return PARSERS[tipo] || null;
}

function isParserValido(tipo) {
  return Boolean(getParser(tipo));
}

function listarTipos() {
  return Object.values(PARSERS).map((p) => ({
    codigo: p.codigo,
    nome: p.nome,
    descricao: p.descricao,
  }));
}

module.exports = {
  getParser,
  isParserValido,
  listarTipos,
};
