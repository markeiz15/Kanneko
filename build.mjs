// Gera index.html: o Provador criptografado + tela de senha.  Uso:  node build.mjs
// Lê provador.html (código aberto, fica só neste computador) e .chave-provador.json (criado por senha.mjs).
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const aqui = (f) => new URL('./' + f, import.meta.url);
if (!existsSync(aqui('.chave-provador.json'))) {
  console.log('Falta a senha. Rode primeiro:  node senha.mjs');
  process.exit(1);
}
const conf = JSON.parse(readFileSync(aqui('.chave-provador.json'), 'utf8'));
let fonte = readFileSync(aqui('provador.html'), 'utf8');

// Controle de pedidos/financeiro/estoque (fonte/): entra junto, criptografado.
if (existsSync(aqui('fonte/controle.js'))) {
  const cfg = existsSync(aqui('.controle.json')) ? JSON.parse(readFileSync(aqui('.controle.json'), 'utf8')) : null;
  const config = cfg && cfg.url ? '<script>window.KANNEKO_CONTROLE = ' + JSON.stringify({ url: cfg.url, chave: cfg.chave }) + ';</script>\n' : '';
  fonte = fonte.replace('<!--CONTROLE-->', () => config +
    '<style>\n' + readFileSync(aqui('fonte/controle.css'), 'utf8') + '</style>\n<script>\n' + readFileSync(aqui('fonte/controle.js'), 'utf8') + '</script>');
  console.log(config ? 'Controle incluído (planilha configurada).' : 'Controle incluído, ainda sem planilha (só modo ?demo).');
}
const app = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="kanneko-logo.png" type="image/png"></head><body>\n' + fonte + '\n</body></html>';

const chave = await crypto.subtle.importKey('raw', Buffer.from(conf.k, 'base64'), 'AES-GCM', false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(app)));
const dados = { salt: conf.salt, iter: conf.iter, wiv: conf.wiv, wrapped: conf.wrapped, iv: Buffer.from(iv).toString('base64'), ct: Buffer.from(cifrado).toString('base64') };

const pagina = readFileSync(aqui('cadeado.html'), 'utf8').replace('/*DADOS*/null', JSON.stringify(dados));
writeFileSync(aqui('index.html'), pagina);
console.log('index.html gerado (' + Math.round(pagina.length / 1024) + ' KB), Provador criptografado.');
