# App Store — preparação das declarações

## App Privacy e informações de revisão

| Campo | Base para preencher | O que verificar |
|---|---|---|
| Política de privacidade | Link HTTPS público no cadastro e no app. | Aprovação pelo titular com base no binário. Testar sem login em aparelho e fora da rede de desenvolvimento. |
| Dados coletados | Portal empacotado com consulta HTTPS, mapa, anúncios contextuais, login e sessão das contas restritas. Favoritos locais planejados. | Auditar WebView, servidor, dependências e terceiros: credenciais/identificadores, perfil ou recuperação se presentes, IP/logs, sessão, diagnósticos, mapas/tiles, mídia, publicidade e suporte. Declarar finalidades, vinculação e rastreamento conforme definições Apple. Anúncio contextual por si só não é autorização para rastrear; validar fornecedores e necessidade de ATT. Não presumir “Data Not Collected”. |
| Privacidade no binário | Dependências e APIs nativas entram na revisão. | Conferir os manifests de privacidade e motivos de uso das APIs exigidas; cruzar o relatório do Xcode com o formulário. |
| Conta e acesso | Consulta sem login; áreas de funcionários e administradores usam contas existentes. | Fornecer credenciais de demonstração ativas para as áreas restritas, ou modo de demonstração completo se aprovado pela Apple. Usar dados fictícios e privilégios necessários, com serviço acessível durante a revisão. Não colocar credenciais reais no Git. |
| Criação e exclusão de conta | Nenhum fluxo de criação de conta deve estar disponível pelo app. | Testar todos os papéis e links: autocadastro, solicitação que crie conta, criação pelo painel e redirecionamentos externos. Se houver criação, a regra 5.1.1(v) exige iniciar exclusão dentro do app, inclusive se o cadastro abre no navegador. Manter canal de direitos mesmo sem criação pelo app. |
| Enquadramento | Guia informativo independente, sem prontuário ou atendimento médico. | Confirmar se o escopo exige entidade jurídica prestadora antes de pagar pela conta. Não usar marcas ou afiliações que o projeto não possa comprovar. |
| Exportação e criptografia | O app acessa a API via HTTPS. | Responder ao questionário com base no código, nas dependências e no uso real de criptografia. Não copiar resposta padrão. |

**Nota de revisão sugerida (adaptar ao build):**

> Saúde em Tempo Real is an independent informational guide to urgent care units in Guarujá, Brazil. Visitors can browse without signing in and use the map and unit details. Waiting-time and staffing examples are labeled as demonstration data and contain no patient records. The app is not affiliated with the municipality or SUS and does not provide diagnosis, treatment or emergency dispatch. Contextual sponsorship is shown in the portal. Sign-in is only for pre-provisioned staff and administrator accounts. Review credentials and role-specific instructions are provided in the private App Review Information fields.

Usar essa nota somente após validar o binário, completar as URLs e fornecer o acesso de revisão. Se útil, anexar vídeo do fluxo real com dados fictícios e links de fontes. Pela regra **4.2**, empacotar o portal localmente não basta: testar e demonstrar utilidade e experiência próprias do app. Favoritos locais são planejados; só apresentá-los se implementados e verificados. Nenhuma dessas medidas garante aprovação.

## Envio

1. Em macOS, verificar Xcode e SDK aceitos na data do envio. Desde 28/04/2026, o piso publicado é Xcode 26 e SDK de iOS 26. [Requisito Apple](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).
2. Selecionar o time do titular no Xcode, confirmar Bundle ID, versão e build, arquivar e enviar ao App Store Connect.
3. Testar pelo TestFlight e completar capturas, ficha, classificação indicativa, privacidade e contato do revisor. Enviar a versão para App Review após o teste.

Referências: [Detalhes de privacidade](https://developer.apple.com/app-store/app-privacy-details/) · [Diretrizes 2.1, 4.2 e 5.1](https://developer.apple.com/app-store/review/guidelines/) · [Exclusão de conta](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/) · [TestFlight](https://developer.apple.com/testflight/).
