# LAB 0.7.1 — preparação local

O log do Windows de 2026-11-03 confirma hash/Authenticode e runtime aprovados, seguido de InvalidOperationException na preparação local e rollback com reinício necessário. Não identifica a operação interna exata.

A revisão encontrou atribuição desnecessária de propriedade ao SYSTEM na pasta Mesh durante execução administrativa. Foi substituída pela política comum DeviceStore.SecureDirectory: proprietário Administradores; acesso apenas SYSTEM e Administradores, sem concessão ao usuário comum. A raiz recebe proteção antes de copiar o motor. Nenhuma validação TLS, assinatura ou hash foi desativada.

PrepareForActivation agora registra etapas constantes (verificação de estado, hash, assinatura, proteção da raiz/pasta, cópia e configuração DPAPI). Não registra caminhos, tokens, credenciais ou mensagens de exceção. A operação que falhar será identificável pelo último marcador. O serviço e a ativação continuam separados; o motor não é executado isoladamente.

Isso corrige um problema de permissões encontrado no código, mas não comprova a causa da falha reportada nem a instalação no Windows. Testar somente em laboratório, uma etapa por vez, após reinício do rollback. Não remover dados manualmente nem contornar proteções. LAB 0.7.0 e 0.6.0 preservados; sem instalação remota.

## Entrega e verificações

- `/home/agenda/uai-entregas/UaiSuporte-Setup-0.7.1-Lab.exe`
- 533948754 bytes.
- SHA-256: `DB0B5BA665B1CB57959467D9CBFEBFD7355323CCC9D02ACFD1D3BD207565450F`
- Executável externo LAB não assinado; motor assinado permanece inalterado.
- 48 verificações de política do instalador, 131 de serviço e 67 de agendamento aprovadas. Compilação/publish Windows x64 e conferência dos recursos, versões 0.7.1, marcadores de diagnóstico e bundle do executável aprovados na VM. ZIP interno verificado.
- Não foram executados ACL/DPAPI/SCM nem instalação no Windows. Não foi repetida a suíte backend: não houve alterações backend neste corretivo.
- Durante a preparação, o shell de build foi interrompido após gerar o ZIP por edição do script em execução. A sintaxe final passou em bash -n; o ZIP foi verificado integralmente e o build Inno posterior concluiu normalmente.
