# Lançamento do Saúde em Tempo Real

Plano de execução para Android e iPhone. Este diretório contém materiais editáveis, não representa aprovação das lojas. Preparação iniciada em 10/11/2026.

## Atualização de 10/11/2026

- **Escopo em preparação:** portal aprovado empacotado localmente com navegação, mapa, detalhes e anúncios contextuais. A consulta é pública. O login é para contas já provisionadas de administradores e funcionários. Não oferecer criação de conta no app nem encaminhar para esse fluxo fora dele. Favoritos locais estão planejados.
- **Validado:** a API pública respondeu em HTTPS com cinco unidades para as origens Android e iOS no teste em rede CAASP. As fichas, declarações e artes estão preparadas como rascunhos. Testes da interface pública anterior não validam o novo pacote com portal e login.
- **Pendente antes da primeira beta:** validar a compilação em aparelho, conferência das unidades, comportamento sem rede, login e permissões, mapa, anúncios, bloqueio de cadastro e links públicos de política e suporte. Usar apenas dados fictícios nos testes de escrita.
- **Pendente antes da publicação:** aprovação da política pelo titular, conferência de dados e provedores do build, acesso de revisão para áreas restritas, assinatura, verificação das contas, URLs finais e submissão.

Referências de interface: [Apple — navegação](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Material — barra superior e atalhos](https://m3.material.io/components/app-bars/), [NHS — cards](https://service-manual.nhs.uk/design-system/components/card) e [W3C — telas estreitas](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Foram usadas para refinar hierarquia, navegação, alvos de toque e layout, preservando o painel azul do portal.

## Ordem de trabalho

| Etapa | O que fazer | Quando podemos considerar concluída |
|---|---|---|
| 1. Versão do portal | Empacotar navegação, unidades, mapa, detalhes, publicidade contextual e login para contas existentes; implementar e validar favoritos locais. | Aparelho confirma consulta sem login, ausência de criação de conta, rotas e anúncios funcionando, dados de demonstração identificados e acesso restrito conforme o papel. |
| 2. Privacidade e suporte | Confirmar titular, e-mail, fontes, provedores, dados enviados e retenção. Revisar login, mapa, anúncios, armazenamento e links. | Titular aprovou o texto e as declarações do binário. Política e suporte publicados em HTTPS, abertos pelo app e acessíveis sem login. |
| 3. Compilação e materiais | Validar SDKs e identidade do pacote, preparar ícone, capturas da versão real e textos. | Builds instaláveis e capturas conferidos; lista de dados e permissões revisada. |
| 4. Contas e assinatura | Confirmar elegibilidade e tipo de conta antes de pagar. O titular verifica identidade, aceita termos, paga e concede acesso por convite, se necessário. | Titular e cadastros verificados; chaves e credenciais guardadas fora do Git. |
| 5. Beta | Android: teste interno e depois fechado se aplicável. iPhone: TestFlight. | Instalação, atualização, navegação, favoritos, ausência de conexão e perfis de acesso testados em aparelhos. |
| 6. Revisão e publicação | Enviar os binários assinados, fichas, declarações e instruções de acesso às funções restritas com ambiente fictício. Revisar os dados e a funcionalidade mínima da Apple. | Aprovado por cada loja, com links públicos confirmados. |
| 7. Atualizações | Versionar, testar e enviar novos builds no mesmo cadastro. | Atualização instala sobre a anterior e preserva favoritos. |

Não comprar uma conta pessoal só para acelerar. O Google exige conta de organização para apps enquadrados em serviços de saúde, como apps médicos, e pede D-U-N-S para organizações. O aplicativo é um guia independente de unidades; confirme o enquadramento antes de escolher a conta. A Apple pede que serviços de saúde regulados ou apps que exigem informações sensíveis sejam submetidos pela entidade que presta o serviço. Isso não classifica automaticamente um guia informativo como serviço clínico. [Google: tipo de conta](https://support.google.com/googleplay/android-developer/answer/13634885) · [Apple: diretrizes, seção 5.1.1(ix)](https://developer.apple.com/app-store/review/guidelines/#privacy) · [Apple: inscrição](https://developer.apple.com/help/account/membership/program-enrollment/).

Para contas pessoais novas do Google sujeitas à regra, planeje teste fechado com **12 testadores inscritos continuamente por 14 dias** e solicitação de acesso à produção. Teste interno não substitui esse período. [Requisitos do teste](https://support.google.com/googleplay/android-developer/answer/14151465).

## Orçamento de referência

Câmbio de planejamento: R$ 6,00/US$. Gasto novo na preparação: R$ 0. Valores de referência do plano, sujeitos a cotação, impostos e consumo.

| Despesa | Frequência | Base | Em reais |
|---|---|---:|---:|
| [Vercel Pro](https://vercel.com/pricing) | Mensal | US$ 20 | R$ 120 |
| [Supabase Pro](https://supabase.com/pricing) | Mensal | US$ 25 | R$ 150 |
| Domínio .com.br, reserva de orçamento | Anual | R$ 40 | R$ 40 |
| [Apple Developer Program](https://developer.apple.com/programs/) | Anual | US$ 99 | R$ 594 |
| [Google Play Console](https://support.google.com/googleplay/android-developer/answer/6112435) | Uma vez | US$ 25 | R$ 150 |
| **Lançamento, se tudo for pago no mesmo mês** | | | **R$ 1.054** |
| **Primeiro ano** | | | **R$ 4.024** |
| **A partir do segundo ano** | Anual | | **R$ 3.874** |

Primeiro ano: R$ 270 × 12 + R$ 40 + R$ 594 + R$ 150. A compilação em Mac remoto, e-mail, armazenamento, backups e tráfego adicional de vídeos ficam fora desta estimativa. O cenário pago não é pré-requisito para desenvolver. Nenhuma compra ou migração é feita por este kit.

## Arquivos e entrega

- [Ficha Google Play](google-play/ficha-pt-BR.md) · [Declarações Google Play](google-play/declaracoes.md)
- [Ficha App Store](app-store/ficha-pt-BR.md) · [Declarações App Store](app-store/declaracoes.md)
- [Checklist de artes e capturas](artes-e-capturas.md)
- [Conferência de fontes e dados das unidades](fontes-das-unidades.md)
- [Notas de versão e rotina de atualização](notas-de-versao.md)
- [Compilação, assinatura e arquivos de saída](compilacao.md)
- [Modelos de política de privacidade e suporte](legal/README.md)
- [Domínio e migração opcional para Supabase](infraestrutura.md)

Antes da submissão: confirmar nome do titular, contatos, domínio e URLs definitivas. Gerar AAB Android assinado e build iOS no Xcode com a equipe de assinatura correta. Atualizar números de versão. Enviar somente após o teste com a API final, inclusive se o endereço ou a infraestrutura mudar. O cadastro nas lojas, a revisão e a entrega de assinatura não são substituídos por trocar o domínio.
