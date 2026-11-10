# Google Play — preparação das declarações

Preencher na Play Console usando o build de lançamento e as evidências abaixo. Este arquivo não é um formulário final de Segurança dos dados.

| Campo | Base para preencher | O que verificar |
|---|---|---|
| Acesso ao app | Consulta pública sem login; administração e operação restritas a contas existentes. | Em **Acesso ao app**, descrever consulta pública e fornecer instruções em inglês e acessos de revisão ativos para cada papel necessário, sem usar contas reais. |
| Segurança dos dados | O app empacota o portal; consulta HTTPS, login e sessão das contas restritas, mapa, mídia e publicidade contextual. Favoritos locais são planejados. | Inventariar dados que saem do aparelho pelo app, WebView, integrações e SDKs: credenciais e identificadores de conta, dados de perfil ou recuperação se acessíveis, IP/logs, sessão, diagnósticos, tiles/mapa, mídia, anúncios, suporte e navegação. Confirmar permissões e dados efetivamente acessados. Por fluxo, registrar coleta, compartilhamento, finalidade, proteção, retenção e se é obrigatório. Não marcar “não coleta dados” por haver modo visitante. |
| Publicidade | A versão prevista exibe publicidade contextual do portal. | Declarar **contém anúncios** se o binário os exibe, mesmo sem SDK de ads. Verificar fornecedores, destinos, conteúdo, tratamento de IP/identificadores e a ausência de personalização por dados de saúde. Revisar público-alvo e classificação. |
| Declaração de saúde | Guia informativo independente para encontrar UPAs; tempos e equipes são demonstrativos, sem dados de pacientes. | Preencher o formulário **Health apps declaration** conforme os recursos reais, inclusive para testes fechados. Não afirmar diagnóstico, tratamento, dispositivo médico, fila oficial ou vínculo público. Confirmar categoria e tipo de conta antes de pagar. |
| Exclusão de conta | Login para contas previamente provisionadas; nenhum fluxo de criação deve estar disponível pelo app. | Conferir formulário, solicitações que criem conta, links, redirecionamentos e fluxos por papel no binário final. O Google inclui criação em site para o qual o app direciona. Se existir criação, oferecer início da exclusão no app, recurso web público funcional e declarar sua URL. Sem criação, responder conforme o escopo verificado e manter canal de direitos e retenção na política. |
| Público e classificação | A definir pelo titular. | Responder questionário de classificação considerando anúncios e conteúdo final; não presumir classificação ou audiência infantil. |

## Envio

- Preparar contas demo separadas de produção, com dados fictícios, permissões por papel, credenciais reutilizáveis e acesso válido fora da rede local durante a revisão. Entregar credenciais somente nos campos privados do console, sem salvar neste repositório. [Instruções oficiais de acesso](https://support.google.com/googleplay/android-developer/answer/15748846).
- AAB assinado com a chave de upload; habilitar Play App Signing. Não armazenar arquivo de chave ou senha no repositório.
- Confirmar `targetSdkVersion` **36 ou superior** para novos envios de apps móveis desde 31/08/2026. [Requisito de API](https://support.google.com/googleplay/android-developer/answer/11926878).
- Confirmar verificação do desenvolvedor e registro do nome do pacote. [Registro do pacote](https://support.google.com/googleplay/android-developer/answer/16984799).
- Teste interno e teste fechado quando exigido. Preparar ficha, imagens e URLs de suporte e privacidade antes de pedir produção.

Referências: [Segurança dos dados](https://support.google.com/googleplay/android-developer/answer/10787469) · [Acesso e publicidade](https://support.google.com/googleplay/android-developer/answer/9859455) · [Exclusão de conta](https://support.google.com/googleplay/android-developer/answer/13327111) · [Declaração de saúde](https://support.google.com/googleplay/android-developer/answer/14738291) · [Política de saúde](https://support.google.com/googleplay/android-developer/answer/16679511) · [Verificação e tipo de conta](https://support.google.com/googleplay/android-developer/answer/10788890).
