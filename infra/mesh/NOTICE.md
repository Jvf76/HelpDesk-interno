# MeshCentral no laboratório Uai

MeshCentral 1.3.1, copyright Intel Corporation e contribuidores; Apache-2.0 em UPSTREAM-LICENSE.txt e na distribuição npm. MeshAgent/dependências mantêm avisos originais.

Modificações Uai Telecom, 26–27/10/2026:

- patch-bootstrap.mjs alinha bootstrap a compression 1.8.2, express 4.22.3 e node-forge 1.4.1. qs fixado em 6.16.1 no lockfile.
- patch-session.mjs adiciona o módulo uai-session.cjs e altera pontos de meshuser.js, meshrelay.js, meshagent.js , agents/meshcore.js e views/sharing.handlebars: consulta/lease de sessão, conexão única, filtro de tráfego, eventos, consentimento sem cache e barra obrigatória; remove exportação de screenshot e opção de secure desktop do viewer.
- Patches preservam copyrights, identificam alterações e recusam versões/âncoras inesperadas.

Não foi modificada criptografia. Audit em 27/10/2026: zero alertas. Homologação Windows, distribuição assinada e validação completa do binário continuam pendentes. Detalhes em docs/06-integracao-e-seguranca-remota.md.
