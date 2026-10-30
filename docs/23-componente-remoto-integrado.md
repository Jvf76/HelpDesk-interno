# Distribuição única e componente remoto interno

O produto apresentado ao funcionário é **Uai Suporte**: um instalador, um aplicativo
visível e uma entrada em Aplicativos Instalados com esse nome. O processo de captura
continua separado, com seu executável e assinatura originais. Não se renomeia editor,
não se modifica o PE assinado e não se promete um único processo no Gerenciador de
Tarefas. Licenças e atribuições dos componentes ficam em `Application/licenses`.

## Implementação

O instalador extrai o agente incorporado e confere SHA-256 e Authenticode antes de
prepará-lo. A primeira ativação no aplicativo configura e comprova o vínculo seguro;
nenhum agente é iniciado para recepção antes dessa autorização. Depois, o aplicativo
inicia o componente automaticamente, sem comando, atalho, assistente ou configuração
separada para o funcionário. A execução do componente não abre console próprio.
O aplicativo, as confirmações e a indicação de acesso permanecem visíveis.

A desinstalação única revoga as credenciais, remove o aplicativo, dados do componente,
inicialização automática e arquivos pertencentes à instalação. A ausência de confirmação
de revogação mantém bloqueio e limpeza pendente. Atalhos de desinstaladores LAB antigos
continuam reconhecidos para limpeza, sem gerar uma segunda entrada de produto.

O domínio do motor suporta personalização de título de consentimento e texto da barra;
`infra/mesh/config.example.json` define ambos como Uai Suporte. Isso não remove a
confirmação nativa, os nomes dos participantes, o botão de parada ou a barra obrigatória.
Não alterar o binário assinado para substituir títulos. A personalização deve ser
conferida nas janelas reais do Windows antes de declarar que não resta interface técnica.

## Atualizações

Não existe atualizador independente do agente entregue ao usuário. Cada versão do
instalador deve incluir aplicativo, agente aprovado, hashes e configuração compatíveis;
falha na verificação impede a execução. Ainda **não há atualização transacional no lugar**
da instalação existente. O procedimento LAB suportado é fechar o aplicativo, desinstalar
com revogação, reiniciar quando solicitado, instalar o pacote completo e ativar novamente.
A recuperação do mesmo código público exige token administrativo direcionado.

Uma atualização sem reinstalação deverá preparar os dois componentes, validar a nova
assinatura/hash, preservar o cadastro protegido, trocar ambos com rollback e recuperar
interrupções de energia. Esse fluxo não deve ser substituído por cópia informal de DLLs
ou executáveis enquanto o aplicativo estiver aberto. Continua pendente de implementação
e teste Windows; não anunciar atualização automática ou preservação de identidade por
upgrade antes dessa prova.

## Estado da entrega

Estas alterações são para o próximo pacote. O instalador LAB 0.6.0 já entregue permanece
inalterado. Não houve instalação remota, reinício do motor ou alteração de configuração
ativa durante o teste Windows do usuário. A configuração de marca deve ser incorporada
ao próximo deploy controlado do motor. O título do consentimento e a barra nativa ainda
precisam ser conferidos entre dois Windows.

## Verificação na VM

Compilação do aplicativo e 48 verificações de políticas do instalador. React: 23
verificações do aplicativo sem login, 14 de login web, 2 de qualidade e visualizador
com transporte simulado. O SHA-256 do MeshAgent permanece
`4cb9aab0e6f9d90249f29bf15e46e66c702a282bc9f991bbb9b6ef0b78478019`.
Nenhuma edição no executável assinado. A compilação isolada do código do instalador
usa payload histórico como fixture, sem publicação; não é uma nova entrega LAB.
