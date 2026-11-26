#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo="$PWD"
dotnet_bin="${DOTNET_ROOT:-$repo/.tools/dotnet}/dotnet"
output="$repo/dist/UaiSuporte-Impressoras-LAB-20261126"
"$dotnet_bin" publish desktop/UaiSuporte.App -c Release -r win-x64 --self-contained true -p:Version=0.8.3-printerlab -o "$output"
python3 - "$output" <<'PY'
from pathlib import Path
import sys,zipfile,hashlib
output=Path(sys.argv[1])
(output/'Abrir-Teste-Impressora.cmd').write_bytes(b'@echo off\r\nstart "" "%~dp0UaiSuporte.exe" --printer-lab\r\n')
(output/'LEIA-ME.txt').write_text('''UAI SUPORTE - IMPRESSORAS LAB - 26/11/2026

1. Extraia todo o ZIP. Nao copie por cima da instalacao atual.
2. Abra Abrir-Teste-Impressora.cmd.
3. Confira o relogio do Windows e valide a coleta pelo botao da janela.
4. Digite a senha SMTP e clique em Ativar teste de hoje as 14h.
5. Aguarde a confirmacao Agendado. Deixe o PC ligado e este aplicativo na bandeja.

Teste unico as 14h de Brasilia (17h UTC). A ativacao deve ocorrer antes das 14h.
Se ficar offline, a coleta pode atrasar ate 14h30. Depois disso, expira.
Nao e um agendamento mensal. Nao instala tarefa nem inicializacao automatica.
Se reiniciar, reabra este modo LAB ate 14h30 para recuperar o agendamento.

Impressora: Lexmark MX511de, 192.168.30.200, serie 701533HH09191.
Remetente: uaisuporte@uaitelecom.com.br
Destino: joaocaixeta@uaitelecom.com.br
Nenhuma senha vem no pacote. A senha digitada fica protegida pelo Windows.
O PDF identifica a fonte eletronica em teste; nao e exportacao nativa.
Nenhuma impressao fisica e solicitada. Nenhum contador e zerado.

Resultados: %LOCALAPPDATA%\\UaiTelecom\\UaiSuporte\\PrinterLab-20261126
O X esconde a janela. Sair da bandeja interrompe a execucao local.
Resultado incerto de SMTP nao causa reenvio automatico: confira a caixa.

Pacote Windows x64 com .NET incluido. Sem instalacao ou alteracao do servico.
Ainda nao homologado em Windows real. Pacote LAB sem assinatura digital;
se a politica corporativa bloquear, solicite distribuicao assinada pela TI.
''',encoding='utf-8')
archive=output.with_suffix('.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(output.rglob('*')):
  if p.is_file() and p.suffix!='.pdb':z.write(p,Path(output.name)/p.relative_to(output))
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(digest+'  '+archive.name+'\n')
print(archive,archive.stat().st_size,digest)
PY
