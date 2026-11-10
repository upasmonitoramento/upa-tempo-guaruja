# App Store — preparação das declarações

## App Privacy e informações de revisão

| Campo | Base para preencher | O que verificar |
|---|---|---|
| Política de privacidade | Link HTTPS público no cadastro e no app. | Testar sem login em dispositivo e fora da rede de desenvolvimento. |
| Dados coletados | Favoritos e diretório básico locais; consulta HTTPS à API pública sem credenciais. Sem anúncios, rastreamento, mapa incorporado ou permissão de localização no app preparado nesta etapa. A rota é aberta externamente por escolha do usuário. | Revisar IP/logs, diagnósticos, dependências nativas, suporte e navegação externa; verificar dados vinculados ao usuário, finalidades e rastreamento conforme definições da Apple. Não presumir “Data Not Collected”. |
| Privacidade no binário | Dependências e APIs nativas entram na revisão. | Conferir os manifests de privacidade e motivos de uso das APIs exigidas; cruzar o relatório do Xcode com o formulário. |
| Conta e acesso | Consulta pública, sem conta. | Confirmar ausência de login, cadastro e administração no build. Se o escopo mudar, revisar exclusão de conta dentro do app. |
| Enquadramento | Guia informativo independente, sem prontuário ou atendimento médico. | Confirmar se o escopo exige entidade jurídica prestadora antes de pagar pela conta. Não usar marcas ou afiliações que o projeto não possa comprovar. |
| Exportação e criptografia | O app acessa a API via HTTPS. | Responder ao questionário com base no código, nas dependências e no uso real de criptografia. Não copiar resposta padrão. |

**Nota de revisão sugerida (adaptar ao build):**

> Saúde em Tempo Real is an independent informational guide to urgent care units in Guarujá, Brazil. No sign-in is required. Open a unit to see available details and directions. Use the favorite control to save a unit, then open Favorites; these preferences are stored on the device. Demonstration data is labeled. The app is not affiliated with the municipality or SUS and does not provide medical diagnosis, treatment or emergency dispatch. The privacy and support links in the listing are publicly accessible.

Se a versão final exigir demonstração extra, anexar vídeo do fluxo real e links das fontes. Confirmar que o app entrega utilidade além de um site empacotado, inclusive favoritos locais e navegação adequada, para a revisão sob a regra 4.2. A aprovação é decisão da Apple.

## Envio

1. Em macOS, verificar Xcode e SDK aceitos na data do envio. Desde 28/04/2026, o piso publicado é Xcode 26 e SDK de iOS 26. [Requisito Apple](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).
2. Selecionar o time do titular no Xcode, confirmar Bundle ID, versão e build, arquivar e enviar ao App Store Connect.
3. Testar pelo TestFlight e completar capturas, ficha, classificação indicativa, privacidade e contato do revisor. Enviar a versão para App Review após o teste.

Referências: [Detalhes de privacidade](https://developer.apple.com/app-store/app-privacy-details/) · [Diretrizes de revisão](https://developer.apple.com/app-store/review/guidelines/) · [TestFlight](https://developer.apple.com/testflight/).
