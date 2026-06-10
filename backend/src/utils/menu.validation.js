function isValidMenuUrl(url) {
  if (url == null || url === '' || url === '#') return true;
  const trimmed = String(url).trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (lower.includes('://')) {
    return lower.startsWith('http://') || lower.startsWith('https://');
  }
  if (trimmed.startsWith('/')) return true;
  return false;
}

function normalizeMenuUrl(url) {
  if (url == null || url === '' || url === '#') return url === '#' ? '#' : null;
  return String(url).trim();
}

module.exports = { isValidMenuUrl, normalizeMenuUrl };
