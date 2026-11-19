# Publicidade: organização e cortesias

Decisões do usuário registradas em 18/11/2026, após testar o aplicativo no celular.

## Objetivo
Um único painel de publicidade, reaproveitando os anúncios e empresas existentes. A operação manual deve funcionar desde o início. Automação pelo WhatsApp e cobrança são opcionais e futuras; não devem impedir anúncios próprios ou cortesias.

## Estrutura proposta
Conta → Administração → Publicidade (o atalho Publicidade pode levar exatamente ao mesmo painel).

- Resumo: números úteis, campanhas ativas, novidades e tarefas de revisão; sem cadastro repetido.
- Parceiros: ficha da empresa/pessoa, contato, contratos/campanhas anteriores e criação de campanha. Evitar cadastro duplicado de patrocinador e parceiro.
- Campanhas: artes + destino + cidade + espaços + período + situação. Filtros para em revisão, ativas, encerradas e renovação. Inserção pelo administrador ou pelo próprio parceiro na mesma campanha. Espaços e pacotes ficam como ferramentas secundárias.
- Administração geral: usuários/permissões, avisos e histórico. Não é um segundo gerenciador de anúncios.
- Portal do parceiro: visão restrita às próprias campanhas, artes e conta. Não é uma segunda administração.

Campanha é a exibição de um conjunto de artes de uma empresa em determinados locais, cidades e datas. Anúncio é a peça (imagem/vídeo) usada nessa campanha. O painel atual ainda possui entidades antigas separadas; elas precisam ser migradas preservando arquivos, IDs e exibições existentes.

## Cortesia solicitada
O pai do titular não precisa pagar por divulgação própria. Criar modalidade explícita `cortesia`, separada de `paga` e de status do Asaas. Nunca marcar um Pix fictício como recebido nem gerar cobrança para liberar cortesia.

Primeiro teste solicitado: conta de parceiro com email **ianeirmao11@gmail.com**, separada da conta administradora já existente, para enviar a arte da C7. Não modificar senha ou privilégio da conta administradora. Convite real ainda depende do serviço de email; não criar senha fixa nem dispensar validação silenciosamente.

Campos da autorização: administrador responsável, justificativa, data de concessão/revogação, duração, cidade e espaços. Somente administrador ativo concede/revoga. Parceiro não altera gratuidade nem pagamento. A aprovação mantém confirmação em duas etapas e histórico. A campanha paga continua exigindo recebimento real consultado no Asaas; a cortesia usa autorização administrativa verificada no servidor.

Revisar todos os pontos antes de liberar: convite, recuperação, envio e revisão, programação, elegibilidade pública, suspensão/expiração, renovação e indicadores. A interface deve mostrar **Cortesia**, sem preço ou recibo inventados. Reaproveitar a arte antiga da C7 por vínculo e migração, sem duplicar mídia ou interromper exibição existente.

## Correções implementadas nesta etapa
- Gerenciar espaços seleciona Espaços; Anúncios manuais seleciona Anúncios; Empresas seleciona Patrocinadores.
- Ferramentas existentes oferecem Voltar à publicidade, retomando a aba Campanhas.
- Avisos tem símbolo de sino e texto do mesmo tamanho dos demais botões.
- Bloqueio das propostas pagas explica que cobranças estão desligadas e aponta para envio manual.
- Atalho Parcerias da administração passa a se chamar Publicidade, igual ao painel de destino.

## Pendências registradas em 18/11 — ver atualização abaixo
- Unificar efetivamente fichas de patrocinadores/parceiros e cadastro manual dentro do painel, sem transição entre telas antigas.
- Implementar e testar cortesia em todos os pontos listados; criar o convite real de teste após email conectado.
- Catálogo de pacotes, automação WhatsApp, renovação e limpeza agendada de arquivos.
- Remover duplicidades de navegação somente após migração e testes com dados existentes.

O domínio foi adiado pelo usuário para conversar com o pai. Não comprar domínio nem habilitar cobranças reais automaticamente.

## Atualização em 19/11/2026

Concluído: modalidade de cortesia explícita, criação administrativa, referência à empresa existente, motivo/autor/data, envio manual de artes, mesma revisão e aprovação em duas etapas, programação, portal do parceiro e encerramento. Cortesia não depende de ativação comercial do Asaas; pagamentos reais continuam desativados.

Concluído: ferramentas de empresas, anúncios manuais e espaços reutilizadas dentro do painel de publicidade. Formulários existentes também ficam dentro do diálogo ativo; retorno e fechamento restauram a navegação. Não é necessário saltar para Usuários para usar essas ferramentas.

Pendente: ativar email para enviar convite real ao titular, consolidação histórica de todas as peças antigas em campanhas e catálogo/automação/renovação/limpeza. Nenhuma conta de parceiro foi criada sem validação de email, e a arte existente da C7 foi preservada.

Domínio escolhido pelo titular: `conectasaudeofc.com.br`. Disponibilidade informada pelo titular, não equivale a registro. Compra adiada para segunda-feira, 23/11/2026. Nenhuma compra, DNS, mudança de origem ou nova contratação realizada. Após o registro: conectar domínio e verificar HTTPS; validar remetente de email, configurar chaves no servidor; enviar convite e conferir entrega/ativação real. Não ativar cobranças reais por causa da compra do domínio.
