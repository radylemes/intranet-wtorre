#!/usr/bin/env bash
# Deploy atômico do frontend Angular para a pasta pública do site.
# Uso: WEB_ROOT=/caminho/do/site ./scripts/deploy-frontend.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/frontend/browser"
DEFAULT_WEB_ROOT="$DIST"

# Document root do nginx (intranet.nubankparque.com) — ver node_IntranetWTorreFrontend.conf
WEB_ROOT="${WEB_ROOT:-$DEFAULT_WEB_ROOT}"

if [[ -z "${WEB_ROOT}" ]]; then
  echo "Erro: defina WEB_ROOT com o caminho da pasta pública do site (document root do nginx)."
  echo "Exemplo: WEB_ROOT=/www/wwwroot/IntranetWTorre/intranet-wtorre/frontend/dist/frontend/browser $0"
  exit 1
fi

if [[ ! -d "$WEB_ROOT" ]]; then
  echo "Erro: WEB_ROOT não existe: $WEB_ROOT"
  exit 1
fi

echo ">> Build production..."
cd "$ROOT"
npm run build

if [[ ! -d "$DIST" ]]; then
  echo "Erro: build não gerou $DIST"
  exit 1
fi

if [[ "$DIST" == "$WEB_ROOT" ]]; then
  echo ">> Publicado em $WEB_ROOT (nginx serve esta pasta diretamente)"
  ls -1 "$WEB_ROOT"/main-*.js "$WEB_ROOT"/index.html 2>/dev/null || true
  echo "Limpe o cache do browser (Ctrl+Shift+R) na primeira visita após o deploy."
  exit 0
fi

echo ">> Deploy para $WEB_ROOT"
find "$WEB_ROOT" -maxdepth 1 -type f \( -name 'chunk-*.js' -o -name 'main-*.js' -o -name 'styles-*.css' -o -name 'polyfills-*.js' \) -delete 2>/dev/null || true
rsync -a --delete "$DIST/" "$WEB_ROOT/"

echo ">> Concluído. Arquivos principais:"
ls -1 "$WEB_ROOT"/main-*.js "$WEB_ROOT"/index.html 2>/dev/null || true
echo "Limpe o cache do browser (Ctrl+Shift+R) na primeira visita após o deploy."
