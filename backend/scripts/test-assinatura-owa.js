/**
 * Valida geração de HTML OWA para todos os domínios mapeados.
 * Uso: node scripts/test-assinatura-owa.js
 */
const { DOMINIOS } = require('../src/utils/assinatura-domains');
const { buildAssinaturaHtmlForOwa } = require('../src/utils/assinatura-html.util');

const sampleSig = {
  nome: 'Teste Usuario',
  cargo: 'Cargo Teste',
  telefone: '+55 (11) 0000-0000',
  celular: '+55 (11) 90000-0000',
  tipo: 'pessoal',
};

let failed = 0;

for (const dominio of Object.keys(DOMINIOS)) {
  const email = `teste@${dominio}`;
  const html = buildAssinaturaHtmlForOwa({ ...sampleSig, email });

  const checks = [
    ['html gerado', !!html],
    ['sem @font-face', !html?.includes('@font-face')],
    ['banner presente', html?.includes(DOMINIOS[dominio].banner)],
    ['email presente', html?.includes(email)],
    ['tabela presente', html?.includes('<table')],
  ];

  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length) {
    failed += 1;
    console.error(`FALHA ${dominio}:`, bad.map(([label]) => label).join(', '));
  } else {
    console.log(`OK ${dominio} (${html.length} chars)`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`\nTodos os ${Object.keys(DOMINIOS).length} domínios passaram.`);
