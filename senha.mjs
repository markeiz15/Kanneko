// Define ou troca a senha do Provador.  Uso:  node senha.mjs
// A senha não é salva em lugar nenhum. Ela só "embrulha" a chave que criptografa o Provador;
// a chave fica em .chave-provador.json, que nunca vai para o GitHub.
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const ARQ = new URL('./.chave-provador.json', import.meta.url);
const ITER = 600000;
const b64 = (u8) => Buffer.from(u8).toString('base64');

function perguntar(texto) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mostrando = true;
    rl._writeToOutput = (s) => { if (mostrando) rl.output.write(s); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write('\n'); ok(r); });
    mostrando = false;   // a partir daqui, o que for digitado não aparece na tela
  });
}

export async function embrulhar(chave, senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const embrulhada = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, chave));
  return { salt: b64(salt), iter: ITER, wiv: b64(iv), wrapped: b64(embrulhada) };
}

async function main() {
  const atual = existsSync(ARQ) ? JSON.parse(readFileSync(ARQ, 'utf8')) : null;
  const nova = process.argv.includes('--nova-chave') || !atual;
  const senha = await perguntar('Nova senha do Provador: ');
  if (senha.length < 8) { console.log('Use pelo menos 8 caracteres. Nada foi alterado.'); process.exit(1); }
  const conf = await perguntar('Repita a senha: ');
  if (senha !== conf) { console.log('As senhas não conferem. Nada foi alterado.'); process.exit(1); }
  const chave = nova ? crypto.getRandomValues(new Uint8Array(32)) : Buffer.from(atual.k, 'base64');
  writeFileSync(ARQ, JSON.stringify({ k: b64(chave), ...(await embrulhar(chave, senha)) }, null, 2));
  console.log(nova
    ? 'Senha definida. Aparelhos que tinham "lembrar" marcado vão pedir a senha de novo depois da próxima publicação.'
    : 'Senha trocada. Aparelhos com "lembrar neste aparelho" continuam entrando sem pedir.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
