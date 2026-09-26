# Live Overlay Engine — módulo do Companion

Comanda os presets do [Live Overlay Engine](https://things-on.mike-app.com/liveoverlay.html)
a partir do Bitfocus Companion: põe grafismos no ar, tira-os, e os botões
acendem sozinhos conforme o que está a sair.

## Antes de começar

Na app, na janela **Comando**, secção **Comando à distância**: ali está a
porta (8790 por omissão) e o **código de ligação**. Sem o código não se
liga — é o que impede uma máquina qualquer da rede do evento de mandar
grafismo para o ar por engano.

## Ligar

Na instância do Companion:

| Campo | O que pôr |
|---|---|
| Endereço da máquina | O IP do PC onde corre o Live Overlay Engine (`127.0.0.1` se for o mesmo) |
| Porta | 8790 |
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

**Pelo zip (o caminho normal).** Descarrega o `liveoverlay-companion-*.zip`
da [página da app](https://things-on.mike-app.com/liveoverlay.html),
descompacta e corre o **`Instalar_Modulo_Companion.bat`**. Põe o módulo em
`%LOCALAPPDATA%\MikeAppsCompanion\live-overlay` e diz o resto: no
Companion, em **Settings → Developer modules path**, aponta-se para a
pasta `MikeAppsCompanion` e reinicia-se o Companion por completo.

O caminho é fixo de propósito. O Companion só aceita **um** developer
modules path, e os módulos das apps do Mike (este, o do Cue Timer, o do
Cue4All) partilham a pasta `MikeAppsCompanion`, cada um na sua subpasta —
o `.bat` só mexe na sua.

**Como módulo de programador** (para mexer no código): clonar este
repositório, correr `npm install` e apontar o developer modules path para
a pasta *de cima* (a que contém esta).

## Empacotar para o site

O zip que se publica não é este repositório tal e qual: tem o `.bat` à
cabeça e o módulo dentro de uma pasta chamada `companion-plugins`, que é o
nome que o `.bat` procura.

```
Instalar_Modulo_Companion.bat      <- instalador/Instalar_Modulo_Companion.bat
companion-plugins/main.js
companion-plugins/package.json
companion-plugins/package-lock.json
companion-plugins/companion/manifest.json
companion-plugins/node_modules/    <- o resultado de `npm install`
```

O `node_modules` vai dentro: quem instala não tem Node nem corre nada, o
módulo tem de vir pronto.

Ao subir a versão, mudar **os dois** sítios — `package.json` e
`companion/manifest.json` — e confirmar que a porta no `main.js` e a que o
`.bat` menciona no fim são a mesma (hoje **8790**; eram 8770 até chocarem
com o mkmonitor em `127.0.0.1`).

`npx companion-module-build` (o `.tgz` para **Import module package**) foi
tentado e deixou-se de lado: nesta máquina o Windows bloqueia o PowerShell
que a ferramenta usa para chamar o webpack, e o zip com o `.bat` instala
igual sem depender disso.
