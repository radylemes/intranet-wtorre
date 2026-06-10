const colaboradoresRepo = require('../repositories/colaboradores.repository');

function parseMes(queryMes) {
  if (queryMes == null || queryMes === '') {
    return new Date().getMonth() + 1;
  }
  const mes = Number(queryMes);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    const err = new Error('Parâmetro mes inválido (use 1 a 12).');
    err.status = 400;
    throw err;
  }
  return mes;
}

async function list(req, res) {
  try {
    const mes = parseMes(req.query.mes);
    const aniversariantes = await colaboradoresRepo.findAniversariantesByMes(mes);
    return res.json({ aniversariantes, mes });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = { list };
