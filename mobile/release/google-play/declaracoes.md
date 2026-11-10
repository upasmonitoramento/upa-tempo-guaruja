# Google Play — preparação das declarações

Preencher na Play Console usando o build de lançamento e as evidências abaixo. Este arquivo não é um formulário final de Segurança dos dados.

| Campo | Base para preencher | O que verificar |
|---|---|---|
| Acesso ao app | Consulta pública, sem conta. | Confirmar que não há cadastro nem telas administrativas no app; descrever acesso de revisor sem senha. |
| Segurança dos dados | Favoritos e diretório básico ficam no aparelho; consulta HTTPS sem credenciais. O app não incorpora mapa nem solicita localização: o usuário abre rotas externamente, com o endereço ou coordenada de destino da unidade. | Conferir logs e IP, diagnósticos, dependências nativas, suporte e navegação externa. Para cada fluxo, anotar coleta, compartilhamento, finalidade, retenção e se é obrigatório. Não marcar “não coleta dados” antes de auditar. |
| Publicidade | O app público preparado nesta etapa não exibe anúncios nem integra SDK de anúncios. O site é separado. | Testar a compilação final e seus fluxos de navegação. Se o escopo mudar e passar a exibir anúncios, revisar a ficha e as declarações antes de enviar. |
| Declaração de saúde | Guia informativo independente para encontrar UPAs. | Declarar a funcionalidade real no formulário, inclusive na faixa fechada. Não afirmar diagnóstico, atendimento médico, dispositivo médico ou vínculo público. Confirmar categoria e conta adequadas antes de pagar. |
| Exclusão de conta | App público proposto sem criação de conta. | Verificar ausência de criação de conta e de redirecionamentos que ofereçam cadastro pelo app. Se esse escopo mudar, revisar requisitos de exclusão e política. |
| Público e classificação | A definir pelo titular. | Responder questionário de classificação considerando anúncios e conteúdo final; não presumir classificação ou audiência infantil. |

## Envio

- AAB assinado com a chave de upload; habilitar Play App Signing. Não armazenar arquivo de chave ou senha no repositório.
- Confirmar `targetSdkVersion` **36 ou superior** para novos envios de apps móveis desde 31/08/2026. [Requisito de API](https://support.google.com/googleplay/android-developer/answer/11926878).
- Confirmar verificação do desenvolvedor e registro do nome do pacote. [Registro do pacote](https://support.google.com/googleplay/android-developer/answer/16984799).
- Teste interno e teste fechado quando exigido. Preparar ficha, imagens e URLs de suporte e privacidade antes de pedir produção.

Referências: [Segurança dos dados](https://support.google.com/googleplay/android-developer/answer/10787469) · [Declaração de saúde](https://support.google.com/googleplay/android-developer/answer/14738291) · [Política de saúde](https://support.google.com/googleplay/android-developer/answer/16679511) · [Verificação e tipo de conta](https://support.google.com/googleplay/android-developer/answer/10788890).
