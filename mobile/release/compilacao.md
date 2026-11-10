# Compilar e preparar o envio

1. Em `mobile/`: `npm ci`, `npm run preview` para a prévia local, `npm run sync` para copiar a versão pública aos projetos nativos. `npm run assets:stores` separa artes em `release/out/`.
2. Android: configurar Android Studio, SDK API 36 e JDK 21 conforme [Capacitor 8](https://capacitorjs.com/docs/getting-started/environment-setup). Com JAVA_HOME e ANDROID_HOME definidos, executar `.\tools\build-android.ps1` para APK de teste em `release/out/testes/`.
3. iPhone: no Mac com Xcode compatível com a loja, executar `npm run sync -- ios` e abrir `ios/App/App.xcodeproj`. Testar em simulador e aparelho. O projeto usa Swift Package Manager e o alvo é iPhone.
4. Antes do build de envio, confirmar o identificador provisório `br.com.saudeemtemporeal.guaruja` com o titular. Confirmar API, domínio, links públicos de suporte e privacidade, endereço/telefone das unidades e versão. Executar `npm run check:release` para verificar as origens dos apps e as páginas públicas.

## Variáveis públicas de build

- `MOBILE_API_ORIGIN`: origem HTTPS da API, sem caminho. Padrão para teste: portal atual.
- `MOBILE_SITE_ORIGIN`: origem HTTPS do portal.
- `MOBILE_PRIVACY_URL` e `MOBILE_SUPPORT_URL`: páginas revisadas e já publicadas, acessíveis sem login.
- `MOBILE_RELEASE=1`: exige os links finais na compilação. Não incluir credenciais nessas variáveis.

Para AAB assinado, definir `SAUDE_UPLOAD_KEYSTORE` (caminho absoluto), `SAUDE_UPLOAD_STORE_PASSWORD`, `SAUDE_UPLOAD_KEY_ALIAS` e `SAUDE_UPLOAD_KEY_PASSWORD` em ambiente local seguro. Executar `.\tools\build-android.ps1 -Release`. Saída em `release/out/google-play/`. Chaves e senhas ficam fora do Git e do chat.

Para iPhone, sincronizar com `MOBILE_RELEASE=1` e URLs finais no Mac, selecionar a equipe de assinatura do titular no Xcode e usar **Product → Archive → Distribute App**. O build é enviado ao App Store Connect.

Teste em aparelhos: primeira abertura da interface empacotada, navegação sem login, API e atualização, sem conexão e reconexão, mapa, detalhes, rotas, chamadas, mídia contextual, privacidade/suporte, voltar, leitor de tela e áreas seguras. Conferir que não há cadastro, solicitação de cadastro nem link que leve a esse fluxo; testar login e logout, sessão expirada, recuperação se disponível e permissões distintas de administrador e funcionário em ambiente fictício. Validar favoritos após reabrir quando implementados. Suba o número de build em atualizações e mantenha o identificador do mesmo cadastro da loja.
