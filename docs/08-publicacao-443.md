# Publicação pela porta 443

Estado em 27/10/2026: publicação aplicada na porta443 e verificada na VM por
HTTPS e WSS autenticado. O operador confirmou no Windows resolução dos dois
hosts, TCP443 e abertura do painel após importar a CA verificada. Origem
externa autorizada: 131.0.115.234/32. Portas18443/14433 somente em loopback.
Os virtual hosts anteriores foram preservados. Este procedimento substitui
os endereços externos com portas altas do documento07.

## Origem autorizada

No PowerShell local do Windows da Uai (não no terminal SSH da VM):

```powershell
(Invoke-RestMethod -Uri "https://api.ipify.org?format=json").ip
```

Se houver proxy, VPN ou múltiplos links, confirme com a equipe de rede o IP de
NAT usado para conexão direta à VM. O resultado acima pode ser o IP do proxy.

## Aplicação na VM

Substitua IP_PUBLICO_UAI pelo IPv4 confirmado, não pelo IP da VM:

```bash
cd '/home/agenda/Área de trabalho/helpdesk'
sudo python3 scripts/install-lab-443.py --source IP_PUBLICO_UAI/32
```

A senha sudo deve ser digitada somente no terminal. O instalador:

- Valida a configuração atual com nginx -t.
- Salva /etc/nginx completo em /var/backups/uai-lab-443/<data>/nginx.
- Cria sites-available/zz-uai-lab-443.conf e seu link em sites-enabled, mais
  /etc/nginx/uai-lab-443 para certificado, chave do servidor, CA pública, ACL e logs.
- Não adiciona default_server, nem altera a porta80 ou os hosts existentes.
- Valida novamente, faz reload e verifica que o PID mestre permaneceu.
- Atualiza aliasPort do Mesh e MESH_URL do backend para443; reinicia somente
  esses dois serviços do laboratório e testa HTTPS e WebSocket autenticado.
- Em falha, restaura configurações internas, retira o novo virtual host e
  recarrega o Nginx. Preserva o diretório novo para diagnóstico e recusa
  sobrescrevê-lo em outra tentativa. Não restaura todo /etc/nginx sobre outros sites.

Somente loopback e a origem informada podem acessar os novos hosts. Não há
alteração do firewall. A ACL não afeta sites existentes. Para alterar origens
depois, edite somente /etc/nginx/uai-lab-443/allow.conf com sudo, preserve
deny all; execute sudo nginx -t e sudo systemctl reload nginx.
O labctl recusa alterações de ACL quando a borda443 está ativa.

TLS é validado entre Windows e borda, entre borda e proxy interno, e entre
proxy interno e Mesh. A API HTTP fica em loopback. O mesmo certificado de
servidor é usado na borda e no motor para preservar o pin do MeshAgent.
A chave privada da CA nunca é copiada. WebSocket usa HTTP/1.1,
Upgrade/Connection e buffering desativado. Logs novos omitem query strings.

## Próximo teste no Windows, após aplicar

Edite como administrador C:\Windows\System32\drivers\etc\hosts:

```text
131.0.112.23 suporte.internal mesh.internal
```

No PowerShell local do Windows:

```powershell
Test-NetConnection suporte.internal -Port 443
Test-NetConnection mesh.internal -Port 443
```

Envie ambos os resultados antes de avançar. TCP True confirma apenas a porta;
não confirma SNI, autorização HTTP, confiança na CA ou sessão remota.
URLs após aplicação: https://suporte.internal e https://mesh.internal.

Depois de confirmar TCP, siga o documento07 para confiar somente na CA do
laboratório. SHA256 DER esperado:
A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138.
Não ignore erros de certificado. O script está em scripts/Test-UaiConnection.ps1
e no pacote privado .tools/lab/exports. Depois de confiar na CA correta:

```powershell
.\Test-UaiConnection.ps1 -PanelHost suporte.internal -PanelPort 443 -MeshHost mesh.internal -MeshPort 443
```

Não instalar agentes nesta etapa.

## Evidência e diagnóstico

Testado na VM: nginx -t do proxy temporário, roteamento dos dois hosts,
login/logout/API, rejeição de CA não confiada, WSS autenticado com capacidades
Uai, HTTP403 para origem127.0.0.2 mesmo com XFF forjado. Proxy temporário encerrado.
PostgreSQL/backend/Mesh/web ativos. Aplicação no Nginx principal e acesso ao
painel pelo Windows confirmados posteriormente. Atendimento remoto real ainda
não validado.

Logs da borda: /etc/nginx/uai-lab-443/access.log e error.log.
Logs internos: .tools/lab/logs e journalctl --user -u uai-lab-mesh -u uai-lab-backend.
Falhas de reload: sudo journalctl -u nginx.
HTTP403 indica origem não autorizada; HTTP502 indica falha no upstream.
Não libere toda a internet para diagnosticar.

Parar/reiniciar apenas o laboratório:

```bash
python3 scripts/labctl.py stop
python3 scripts/labctl.py start
python3 scripts/labctl.py restart
```

O Nginx principal e os outros sites permanecem ativos. Os novos hosts retornam
erro de upstream enquanto o laboratório estiver parado.
