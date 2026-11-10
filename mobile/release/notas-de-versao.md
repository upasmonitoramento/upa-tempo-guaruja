# Notas de versão e atualização

## 1.0.0 — rascunho da primeira publicação

> Primeira versão do Saúde em Tempo Real para consultar UPAs do Guarujá, explorar o mapa e ver detalhes e rotas sem precisar de conta. Os dados de demonstração aparecem identificados no aplicativo.

Validar o texto contra o build testado antes de copiar para as lojas. Acrescentar favoritos no aparelho somente se o recurso estiver concluído e testado. Registrar data, revisão Git, versão Android, número de build iOS e links das versões publicadas aqui após o lançamento.

## Rotina de atualização

1. Alterou dados da API compatíveis com a versão instalada? Atualizar os dados, verificar a data e origem exibidas e testar no app já instalado.
2. Alterou telas, ícone, permissões ou comportamento empacotado? Subir versão e identificadores de build conforme a plataforma. Usar o mesmo pacote/Bundle ID e a assinatura apropriada.
3. Sincronizar e gerar novos binários, testar no Android e no iPhone, inclusive a instalação sobre a versão anterior.
4. Revalidar política, declarações, permissões e ficha se algum fluxo ou provedor mudou. Atualizar notas e capturas quando necessário.
5. Subir na faixa de teste/ TestFlight, acompanhar resultados e submeter para revisão no cadastro existente.
6. Confirmar a distribuição pública. Corrigir problemas com um novo build; não assumir que o usuário pode voltar à versão anterior.

[Atualizações na Google Play](https://support.google.com/googleplay/android-developer/answer/9859350) · [Revisão da Apple](https://developer.apple.com/app-store/review/).
