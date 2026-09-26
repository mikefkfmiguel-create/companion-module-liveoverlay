@echo off
setlocal EnableExtensions

REM ==============================================================================
REM Copia a pasta "companion-plugins" (que tem de estar ao lado deste .bat,
REM dentro do mesmo zip) para o sitio FIXO que os modulos das apps do Mike
REM usam, para nunca mais haver duvida sobre que caminho por no
REM "Developer Modules Path" do Companion -- e sempre este, em qualquer PC.
REM O Companion so aceita UM caminho: este modulo, o do Cue Timer e o do
REM Cue4All partilham a pasta MikeAppsCompanion, cada um na sua subpasta.
REM Nao mexe nas subpastas dos outros modulos.
REM ==============================================================================

set "DESTINO=%LOCALAPPDATA%\MikeAppsCompanion"
set "MODULO=%DESTINO%\live-overlay"
set "ORIGEM=%~dp0companion-plugins"

echo ==============================================================
echo   INSTALAR MODULO COMPANION - LIVE OVERLAY ENGINE
echo ==============================================================
echo.

if not exist "%ORIGEM%" (
    echo ERRO: nao encontrei a pasta "companion-plugins" ao lado deste
    echo ficheiro. Confirma que extraiste o zip inteiro, com este .bat
    echo e a pasta companion-plugins no mesmo sitio.
    echo.
    pause
    exit /b 1
)

if exist "%MODULO%" (
    echo A substituir a versao anterior em %MODULO% ...
    rmdir /s /q "%MODULO%"
)

mkdir "%DESTINO%" 2>nul
xcopy "%ORIGEM%" "%MODULO%" /E /I /H /Y >nul

if exist "%MODULO%\companion\manifest.json" (
    echo Instalado com sucesso em:
    echo   %MODULO%
    echo.
    echo No Companion ^(no launcher, icone da engrenagem, separador
    echo Developer^): ativa "Enable Developer Modules" e poe o
    echo "Developer Modules Path" exatamente como ^(sem espacos antes ou depois^):
    echo.
    echo   %DESTINO%
    echo.
    echo Depois reinicia o Companion por completo ^(Quit + abrir^).
    echo.
    echo Na app Live Overlay Engine, na janela Comando, secao
    echo "Comando a distancia", esta a porta ^(8790^) e o codigo de
    echo ligacao que o modulo pede.
) else (
    echo ALGO CORREU MAL -- nao encontrei o manifest.json depois de copiar.
    echo Contacta quem te deu este ficheiro.
)

echo ==============================================================
pause
