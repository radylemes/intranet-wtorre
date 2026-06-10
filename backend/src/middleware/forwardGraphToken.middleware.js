function forwardGraphToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ mensagem: 'Token Microsoft não fornecido.' });
  }
  req.graphToken = header.slice(7);
  next();
}

module.exports = forwardGraphToken;
