# Live Overlay Engine — módulo do Companion

Comanda os presets do [Live Overlay Engine](https://things-on.mike-app.com/liveoverlay.html)
a partir do Bitfocus Companion: põe grafismos no ar, tira-os, e os botões
acendem sozinhos conforme o que está a sair.

## Antes de começar

Na app, na janela **Comando**, secção **Comando à distância**: ali está a
porta (8770 por omissão) e o **código de ligação**. Sem o código não se
liga — é o que impede uma máquina qualquer da rede do evento de mandar
grafismo para o ar por engano.

## Ligar

Na instância do Companion:

| Campo | O que pôr |
|---|---|
| Endereço da máquina | O IP do PC onde corre o Live Overlay Engine (`127.0.0.1` se for o mesmo) |
| Porta | 8770 |
| Código de ligação | O código que a app mostra |

Se a app ainda não estiver aberta, o módulo fica a tentar sozinho — não é
preciso mexer em nada quando ela arrancar.

## O que dá para fazer

**Ações**

- **Preset: alternar** — se aquele preset já está no ar, sai; senão,
  entra. É a ação para um botão só.
- **Preset: pôr no ar** e **Preset: tirar do ar**.
- **Preset: carregar sem pôr no ar** — prepara o próximo grafismo sem
  mexer no que está a sair.
- **Emissão** — mostrar, esconder ou alternar o grafismo que está
  carregado.
- **Modo** — composição (não sai nada para o switcher) ou direto.

**Feedbacks**

- **Este preset está no ar** — o botão daquele preset acende a vermelho.
- **Há grafismo no ar**.
- **Está em direto**.

**Variáveis**

`$(liveoverlay:preset_no_ar)`, `$(liveoverlay:preset_carregado)`,
`$(liveoverlay:no_ar)`, `$(liveoverlay:modo)`, `$(liveoverlay:presets)`.

Há também botões já feitos (categorias **Presets** e **Emissão**), para
não se começar de uma folha em branco.

## Como está feito

O módulo fala com a porta da app por HTTP e fica ligado a um fluxo de
eventos (`/api/eventos`, Server-Sent Events): o estado chega a cada
mudança, e é por isso que os botões acompanham sem andar a perguntar de
segundo a segundo. Se a ligação cair, tenta outra vez de 4 em 4 segundos.

## Instalar

**Pelo pacote (o caminho normal).** Descarrega o `liveoverlay-1.0.0.tgz`
da [página da app](https://things-on.mike-app.com/liveoverlay.html) e, no
Companion, em **Modules**, usa **Import module package**. O Companion
trata do resto.

**Como módulo de programador** (para mexer no código): clona este
repositório, corre `npm install`, e em **Settings → Developer modules
path** aponta para a pasta *de cima* (a que contém esta).

## Gerar o pacote

`npx companion-module-build` é o caminho oficial, mas nesta máquina o
Windows bloqueia o PowerShell que a ferramenta usa para chamar o webpack.
Quando isso acontece, corre-se o webpack à mão e monta-se o pacote:

```bash
node node_modules/webpack/bin/webpack.js   -c node_modules/@companion-module/tools/webpack.config.cjs   --env ROOT=<esta pasta> --env MODULETYPE=connection
```

Depois junta-se `pkg/main.js`, `pkg/package.json` e
`pkg/companion/manifest.json` (com `runtime.entrypoint` em `../main.js`,
`runtime.api` em `nodejs-ipc` e `runtime.apiVersion` na versão do
`@companion-module/base`) num `.tgz` com a pasta `pkg` à cabeça.

A base fica na **1.x** de propósito: o Companion 5 corre-a bem (é o que os
módulos instalados usam) e a 2.x mudou o arranque do módulo.
