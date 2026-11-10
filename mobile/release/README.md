# Lançamento do Saúde em Tempo Real

Plano de execução para Android e iPhone. Este diretório contém materiais editáveis, não representa aprovação das lojas. Preparação iniciada em 10/11/2026.

## Atualização de 10/11/2026

- **Concluído:** interface pública sem conta e sem anúncios no app, layout móvel preservado, favoritos locais, fallback do diretório sem conexão, fotos e ícones da marca, sincronização Android/iOS e fichas, declarações e artes separadas.
- **Validado:** prévia responsiva com dados simulados em 320, 390 e 688 px; filtros, favoritos persistentes, detalhes e comportamento quando a API falha. O build do site e os nove testes do cache PWA passaram.
- **Pendente antes da primeira beta:** Android SDK/JDK ou Mac/Xcode para compilar; HTTPS/CORS da API real; conferência das unidades; aprovação dos dados da política e dos contatos de suporte. Depois, capturas dos aparelhos e teste nativo.
- **Pendente antes da publicação:** titular e tipo de conta, assinatura, verificação das lojas, URLs públicas finais e submissão.

Referências de interface: [Apple — navegação](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Material — barra superior e atalhos](https://m3.material.io/components/app-bars/), [NHS — cards](https://service-manual.nhs.uk/design-system/components/card) e [W3C — telas estreitas](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). Foram usadas para refinar hierarquia, navegação, alvos de toque e layout, preservando o painel azul do portal.

## Ordem de trabalho

| Etapa | O que fazer | Quando podemos considerar concluída |
|---|---|---|
| 1. Versão pública | Empacotar consulta de unidades, detalhes, rotas e favoritos locais; manter cadastro e administração no site. | Teste em aparelho confirma consulta sem login, ausência dos fluxos de conta e identificação dos dados de demonstração. |
| 2. Privacidade e suporte | Confirmar titular, e-mail, fontes das informações, provedores, dados que saem do aparelho e retenção. | Política e suporte publicados em HTTPS, abertos pelo app e acessíveis sem login. Declarações batem com o binário. |
| 3. Compilação e materiais | Validar SDKs e identidade do pacote, preparar ícone, capturas da versão real e textos. | Builds instaláveis e capturas conferidos; lista de dados e permissões revisada. |
| 4. Contas e assinatura | Confirmar elegibilidade e tipo de conta antes de pagar. O titular verifica identidade, aceita termos, paga e concede acesso por convite, se necessário. | Titular e cadastros verificados; chaves e credenciais guardadas fora do Git. |
| 5. Beta | Android: teste interno e depois fechado se aplicável. iPhone: TestFlight. | Instalação, atualização, consulta, favoritos e ausência de conexão testadas em aparelhos. |
| 6. Revisão e publicação | Enviar os binários assinados, fichas e declarações. Revisar a divulgação de dados antes de enviar. | Aprovado por cada loja, com links públicos confirmados. |
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
