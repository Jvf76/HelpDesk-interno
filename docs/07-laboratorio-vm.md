# Laboratório ativo nesta VM — 27/10/2026

Este documento descreve a instalação real em execução. Não instala agentes e não homologa atendimento remoto Windows.

## Endereços e serviços

IP da VM: **131.0.112.23/27**, interface ens18, gateway **131.0.112.1**.

| Componente | Endereço | Exposição |
|---|---|---|
| Painel React/API HTTPS | https://suporte.internal:18443 | TLS; lista de origens permitidas |
| MeshCentral HTTPS/WSS | https://mesh.internal:14433 | TLS; mesma restrição de origem |
| Spring Boot | 127.0.0.1:18080 | Apenas proxy local |
| Mesh interno | 127.0.0.1:14434 | TLS também entre proxy e motor |
| PostgreSQL 16.15 | 127.0.0.1:55433 | Banco uai_lab, SCRAM, usuário próprio; socket privado |
| Nginx do laboratório | 18443/14433 | Processo/configuração próprios; não usa o nginx de 80/443 |

No provisionamento havia aproximadamente 8 GB de memória disponível e 28 GB livres. Docker não estava instalado e não havia sudo sem senha; foram usados Java 21, Node 24, PostgreSQL 16 e Nginx existentes, com serviços systemd do usuário agenda. Mantida a stack da aplicação. Nginx substitui o Caddy apenas como terminador TLS/servidor estático nesta implantação.

**Não foram alterados** os serviços anteriores em 80/443, PostgreSQL 5432, backend antigo 8080 ou outros aplicativos. Não foi alterado /etc/hosts, /etc/nginx nem firewall global. Os artefatos do laboratório são snapshots em .tools/lab; compilar novamente o projeto não substitui automaticamente a aplicação em execução.

**Não apagar .tools/lab:** agora contém banco, identidades, certificados e segredos persistentes, não apenas cache de testes. Fazer backup protegido desse diretório e das unidades antes de mover o workspace.

Unidades: uai-lab-postgres, uai-lab-backend, uai-lab-mesh, uai-lab-web e uai-lab.target. Target habilitado no systemd do usuário. Linger já estava habilitado, permitindo iniciar sem sessão gráfica. Reinício completo da VM não foi testado; parada e partida das unidades foram testadas.

## Origem Windows e conectividade externa

O IP configurado na VM é público, não RFC1918. As portas novas aceitam inicialmente somente loopback e a própria VM. Outras origens recebem 403 no Nginx, inclusive se falsificarem X-Forwarded-For. A liberação exige o IP de origem do Windows, o IP público de saída do NAT corporativo ou a rede autorizada da VPN.

Na VM, dentro do repositório, para liberar uma origem conhecida:

    python3 scripts/labctl.py allow IP_DE_ORIGEM/32

Para voltar a bloquear clientes externos:

    python3 scripts/labctl.py block-external

Não usar 0.0.0.0/0. Um IP local Windows 192.168.x.x não serve na regra se o servidor enxerga o IP público do NAT; deve-se usar o endereço observado na chegada à VM.

Não há NAT configurado por este laboratório. Pelo endereço e rota observados na VM, não é necessário criar um redirecionamento local de portas. **Não foi possível verificar** firewall do hipervisor, provedor, roteador ou rota a partir do Windows. Se houver filtro externo, a regra necessária é: permitir TCP **18443 e 14433**, da origem autorizada, para **131.0.112.23**; permitir a saída correspondente na rede do Windows. Não liberar 18080, 14434 ou 55433.

Se o administrador de rede informar que existe DNAT externo, ele precisa mapear as duas portas públicas para 131.0.112.23:18443 e :14433. Não anunciar essa hipótese como uma configuração existente. VPN com rota para 131.0.112.23/32 também pode fornecer acesso; o IP visto no servidor continua sujeito à lista de origens.

## Contas administrativas e segredos

Contas criadas exclusivamente neste banco/motor:

- Painel: admin-lab.
- Mesh: mesh-admin-lab.
- Serviço interno: uai-integration, **não administrador de servidor**, limitado ao grupo vazio Uai-Laboratorio, desktop e guest sharing; sem terminal, arquivos, AMT, registry, console ou comandos.

Senhas aleatórias e distintas, não publicadas. Na própria VM, o operador agenda pode abrir localmente o arquivo:

    .tools/lab/secrets/admin-access.json

Permissão 0600, diretórios 0700. Abra em editor local, copie a senha para o gerenciador seguro da equipe e não envie esse arquivo no chat/Git. Credenciais de serviço ficam separadas em service-secrets.json/backend.env. A senha de bootstrap foi retirada do ambiente após criação e validação da conta; reiniciar não recria nem altera usuários.

O usuário PostgreSQL da aplicação não é superusuário e não pode criar bancos/papéis. A conta local agenda administra somente esse cluster pelo socket privado. Processos do mesmo usuário de SO pertencem à mesma fronteira de confiança; não é isolamento de container/multitenant.

## Windows: DNS/hosts, CA e script

Após confirmar a rota e liberar a origem, criar dois registros DNS A apontando para 131.0.112.23, ou adicionar esta linha ao arquivo C:\Windows\System32\drivers\etc\hosts com privilégios administrativos normais:

    131.0.112.23 suporte.internal mesh.internal

Não colocar portas no hosts. As URLs precisam incluir :18443 e :14433.

O pacote público fica em .tools/lab/exports/uai-lab-conectividade.zip. Contém SOMENTE uai-lab-ca.cer, Test-UaiConnection.ps1, identificação e instruções. Não contém agentes, senha, token ou chave privada. Pode ser copiado da VM por canal autenticado (por exemplo, SCP com chave do host SSH conferida) ou pelo arquivo entregue na conversa. Após confiar na CA e liberar a origem, o script também está em:

    https://suporte.internal:18443/lab/Test-UaiConnection.ps1

CA exclusiva desta instalação:

- Subject: CN=Uai Suporte LAB 131.0.112.23 2026-10-27, O=Uai Telecom Laboratory.
- Serial: 5374D68B9804EB7959CF987EFBE9A0B3051ADD14.
- Validade: 27/10/2026 12:17:30 UTC até 27/10/2027 12:17:30 UTC.
- SHA-256 do certificado DER/arquivo uai-lab-ca.cer:

    A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138

Antes de confiar, comparar com essa identificação recebida por canal confiável:

    Get-FileHash .\uai-lab-ca.cer -Algorithm SHA256

Somente se corresponder exatamente, instalar para o usuário Windows que fará o teste:

    certutil -user -addstore Root .\uai-lab-ca.cer

Confia-se em **uma CA de laboratório**, não em qualquer certificado autoassinado. Essa instalação nativa não usa a CA Caddy citada no roteiro genérico Docker. Não importar chaves .key, certificados de assinatura de código ou a CA interna de identidade do Mesh. O mesmo certificado TLS de servidor é usado no proxy e no Mesh, evitando divergência no pin do agente, sem desativar validações.

O certificado de servidor dura 90 dias; renovação automática ainda não configurada. Validar vencimento antes de retomar uma prova futura. A confiança nessa CA permite certificados emitidos por ela; use apenas os computadores autorizados para o laboratório e remova-a ao terminar.

Com nomes/CA/origem configurados, o comando exato para o teste completo será:

    .\Test-UaiConnection.ps1 -PanelHost suporte.internal -PanelPort 18443 -MeshHost mesh.internal -MeshPort 14433

Não usar ExecutionPolicy Bypass, SkipCertificateCheck ou ignorar avisos TLS. Se a política bloquear o script, enviar o erro e seguir o processo corporativo.

## Controle e logs na VM

A partir do repositório:

    cd "/home/agenda/Área de trabalho/helpdesk"
    python3 scripts/labctl.py status
    python3 scripts/labctl.py stop
    python3 scripts/labctl.py start
    python3 scripts/labctl.py restart

Stop/start preservam dados e não afetam serviços anteriores. Para desligar também a inicialização automática: systemctl --user disable uai-lab.target, além de stop. Start pode precisar de até um minuto até o motor concluir inicialização; verificar endpoints, não apenas o estado do processo.

Logs:

    journalctl --user -u uai-lab-backend -u uai-lab-mesh -u uai-lab-web --since "10 minutes ago" --no-pager

PostgreSQL: .tools/lab/logs/postgres.log. Proxy: nginx-access.log/nginx-error.log no mesmo diretório. Access log usa URI sem query string e não registra cookies/corpos. Nunca enviar arquivos secrets/ ou dados brutos do Mesh. Avisos Authenticode permanecem visíveis; não foram contornados.

Testes locais reproduzíveis:

    python3 scripts/verify-lab.py

Esse teste faz login/logout administrativo usando arquivo privado e confirma inventário/chamados vazios; não cria dispositivos nem sessões remotas. Configure-lab-mesh.cjs provisiona/verifica apenas o grupo vazio e direitos da integração.

## Evidências e primeiro passo guiado

Verificado **dentro da VM**: HTTPS dos dois endereços; rejeição sem CA; login ADMIN/logout/cookie; API 401 sem login; banco/migrações V1/V2; integração Java por WSS com CA/hostname validados; capacidades/lease Uai; restrição de grupo; origens negadas com 403; parada e reinício dos serviços; senhas ausentes dos logs examinados.

**Ainda não verificado:** chegada de tráfego de um Windows, firewall externo, DNS/hosts Windows, confiança de CA Windows ou qualquer sessão remota. Assinatura Authenticode de Mesh/C# continua pendente; nenhum agente instalado.

Agora executar SOMENTE este primeiro comando em um Windows:

    Test-NetConnection 131.0.112.23 -Port 18443

Enviar o resultado, principalmente TcpTestSucceeded. Isso testa TCP e não altera hosts/certificados. Aguardar análise antes do próximo passo. A liberação HTTP externa ainda depende da origem autorizada solicitada ao operador.
