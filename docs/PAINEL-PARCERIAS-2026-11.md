# Painel de parcerias — revisão de novembro de 2026

## Navegação

- Administração: atalhos quadrados para Parcerias, Usuários, Patrocinadores, Anúncios, Espaços e Histórico. Mantidas as rotinas existentes.
- Publicidade: tela inteira; menu lateral no computador e três atalhos no celular: Resumo, Parcerias e Campanhas.
- Resumo: propostas recentes em sete dias, Pix recebidos, pendências e contratos pagos dentro do período. Estes indicadores contam propostas, não empresas únicas.
- Parcerias: busca local por empresa/e-mail/pacote; filtros; agrupamento por nome e e-mail; ficha com histórico de propostas disponível no retorno do servidor.
- Campanhas: consulta do contratado e acesso ao painel existente de anúncios/artes. Pagamento recebido não significa publicação automática.

## Limites e permissões

O servidor retorna até 100 propostas recentes, indicado no painel. A ficha não deve ser apresentada como histórico completo de um CRM ilimitado. Antes de escalar para milhares de contratos, implementar paginação e cadastro próprio de parceiro com identificador estável; a associação atual por nome/e-mail preserva o modelo existente e não é uma identidade fiscal.

CPF/CNPJ, token privado e identificador do cliente no Asaas continuam excluídos do retorno administrativo. Não criar novo campo de dados pessoais apenas por motivo de layout.

Na produção, sem ativação comercial válida, apenas GET /comercial/painel é liberado para administrador ativo autenticado. Criação, aceite e Pix permanecem fechados; o modo preparation desabilita os botões correspondentes. A exibição do painel não ativa cobranças. Sandbox e produção continuam separados.

Filtros/abas não repetem a requisição. Atualizar dados busca o estado mais recente; não há promessa de atualização instantânea sem recarregar a lista. Não foram adicionadas bibliotecas, fontes remotas ou imagens ao painel.

## Verificação

- node --test backend/routes/comercial.test.js: regras de autorização, preparação sem cobrança e proposta/aceite/Pix com provedor simulado.
- mobile/tools/smoke-portal.cjs: usuário, funcionário e administrador em viewports Pixel 7 e iPhone 15 Pro.
- mobile/tools/smoke-comercial.cjs: busca/filtros, agrupamento/ficha, estado somente consulta, atualização manual e ausência de transbordamento em celular e desktop. Dados fictícios interceptados; não movimenta dinheiro.
- Build compartilhado do portal em mobile/public. Não equivale a publicar novas versões nas lojas ou testar num aparelho físico.

## Referências

- WCAG 2.2: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- Alvos ampliados: https://www.w3.org/WAI/WCAG21/Understanding/target-size
- Segmentação de clientes no Shopify: https://help.shopify.com/en/manual/customers/customer-segmentation

Aplicação: controles principais com pelo menos 44–48 CSS px, foco visível, campos com fonte de 16 px, estados com texto além de cor e respeito à preferência de reduzir movimentos. A revisão não constitui certificação formal de acessibilidade.
