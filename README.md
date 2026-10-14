# Provador de Canecas · Kanneko

Mockup 3D de canecas personalizadas para a cliente aprovar a arte.

- **Provador:** https://markeiz15.github.io/Kanneko/. Nele você carrega a arte, escolhe as cores e gera a imagem de aprovação, o vídeo girando ou o link 3D.
- **Link 3D da cliente:** `https://markeiz15.github.io/Kanneko/v/#código.chave`. Ela gira a caneca no celular sem instalar nada.

## Como os links 3D funcionam

Cada link vira um arquivo `m/<código>.bin` no ramo `dados` deste repositório. A arte e os dados do pedido vão **criptografados** (AES-GCM). A chave fica só no link, depois do `#`, e nunca é enviada ao GitHub. Por isso, quem olhar o repositório não consegue ver as artes.

Para enviar, o Provador usa um token do GitHub com acesso só a este repositório (Contents: Read and write). O token fica salvo apenas no navegador onde foi configurado.

### Limpeza automática

Todo dia 1º do mês, às 03:00, a tarefa **Limpeza dos links 3D** (aba *Actions* do GitHub) apaga os links com mais de **90 dias** e recria o ramo `dados`, para o espaço ser liberado de verdade. Links apagados param de abrir. Para rodar na hora ou com outro prazo, abra *Actions → Limpeza dos links 3D → Run workflow*.

## Medidas

Caneca Live Sub 325 ml, Ø 81 mm, ~10 cm de altura. Área de impressão padrão: 210 × 98 mm.

## Acesso ao Provador

O Provador fica **criptografado** no site e só abre com a senha da KANNEKO. O código aberto (`provador.html`) e a chave (`.chave-provador.json`) ficam apenas no computador de quem mantém o site; nunca vão para o GitHub.

- Trocar a senha: `node senha.mjs`
- Publicar uma atualização: `node build.mjs` e enviar o `index.html` gerado.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `index.html` | Provador criptografado + tela de senha (gerado por `build.mjs`) |
| `cadeado.html` | Modelo da tela de senha |
| `senha.mjs` / `build.mjs` | Definem a senha e geram o `index.html` |
| `v/index.html` | Página que a cliente abre |
| `mug3d.js` | Caneca 3D (Three.js) e criptografia dos links, usada pelas duas páginas |
| `og.jpg` | Cartão de prévia que aparece no WhatsApp |
