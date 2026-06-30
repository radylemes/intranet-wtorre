const { env } = require('../../config/env');

function getPbiAuthority() {
  return `https://login.microsoftonline.com/${env.pbiTenantId}`;
}

function getPbiScope() {
  return 'https://analysis.windows.net/powerbi/api/.default';
}

function getPbiApiBase() {
  return 'https://api.powerbi.com/v1.0/myorg';
}

module.exports = {
  getPbiAuthority,
  getPbiScope,
  getPbiApiBase,
};
