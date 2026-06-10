const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const tenantsRepo = require('../repositories/tenants.repository');

const clients = new Map();

function getJwksClient(tid) {
  if (!clients.has(tid)) {
    clients.set(
      tid,
      jwksClient({
        jwksUri: `https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`,
        cache: true,
        rateLimit: true,
      })
    );
  }
  return clients.get(tid);
}

function decodeUnsafe(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.payload) return null;
  return decoded.payload;
}

async function validateMicrosoftToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ mensagem: 'Token Microsoft não fornecido.' });
  }

  const token = header.slice(7);
  const claims = decodeUnsafe(token);
  if (!claims?.tid || !claims?.oid) {
    return res.status(401).json({ mensagem: 'Token Microsoft inválido.' });
  }

  const tenant = await tenantsRepo.findByTid(claims.tid);
  if (!tenant) {
    return res.status(401).json({
      mensagem:
        'Tenant Azure não autorizado. Contacte o administrador para cadastrar a empresa do grupo.',
    });
  }

  const allowedIds = await tenantsRepo.getAllowedClientIds();
  const principal = await tenantsRepo.findPrincipal();
  const validAudiences = new Set([...allowedIds, principal?.client_id].filter(Boolean));

  if (!validAudiences.has(claims.aud)) {
    return res.status(401).json({ mensagem: 'Audience do token não corresponde ao client_id configurado.' });
  }

  try {
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header?.kid;
    const client = getJwksClient(claims.tid);
    const key = await client.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      audience: [...validAudiences],
    });

    req.azureUser = { ...verified, tid: claims.tid };
    next();
  } catch (err) {
    return res.status(401).json({ mensagem: 'Falha na validação do token Microsoft.', detalhe: err.message });
  }
}

module.exports = validateMicrosoftToken;
