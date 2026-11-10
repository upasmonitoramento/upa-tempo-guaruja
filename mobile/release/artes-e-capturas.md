# Artes e capturas de lançamento

Usar a identidade existente do Saúde em Tempo Real. Capturar a versão de loja em aparelhos ou simuladores com os tamanhos aceitos. Não reutilizar captura do site como se fosse do app, nem exibir dados pessoais, credenciais, publicidade de teste ou promessas de atualização ao vivo ainda não cumpridas.

Arquivos de arte preparados: [ícone Google Play](google-play/icone-512.png), [imagem de destaque Google Play](google-play/arte-destaque-1024x500.png) e [ícone App Store](app-store/artes/icone-1024.png). As capturas ficam pendentes até rodar o build. O script [preparar-icone-apple.ps1](preparar-icone-apple.ps1) regenera o ícone da App Store a partir do original quadrado da marca no Windows.

| Plataforma | Entrega | Especificação |
|---|---|---|
| Google Play | Ícone de loja | PNG 512 × 512 px, até 1.024 KB. É separado dos ícones adaptativos do app. |
| Google Play | Imagem de destaque | 1.024 × 500 px, JPEG ou PNG sem transparência. |
| Google Play | Capturas de telefone | Preparar pelo menos duas capturas reais; sugestão: 1080 × 1920 px quando a resolução do aparelho permitir. Conferir exigências adicionais das categorias de dispositivos habilitadas. |
| App Store | Ícone | Arte principal quadrada de 1.024 × 1.024 px no catálogo de ícones do projeto Xcode; conferir o ícone no build. |
| App Store | Capturas iPhone | Planejar pelo menos uma na classe Dynamic Island média, por exemplo **1179 × 2556 px** ou **1206 × 2622 px** em retrato. A Apple permite até 10 por tamanho. Confirmar os tamanhos exigidos no cadastro. |
| App Store | Capturas iPad | Se o build suportar iPad, planejar captura de 13 polegadas, por exemplo **2064 × 2752 px** em retrato. |

Ordem sugerida das capturas: (1) lista das UPAs; (2) mapa; (3) detalhes com endereço e rota; (4) favoritas, somente se estiverem funcionando no build testado. As capturas públicas não precisam mostrar a administração; não omitir funções restritas nas instruções de revisão. Usar dados fictícios nos fluxos internos. Não usar selo de Prefeitura ou SUS sem autorização.

Fontes: [Artes da Google Play](https://support.google.com/googleplay/android-developer/answer/9866151) · [Capturas da App Store](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) · [Ícones da Apple](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon/).
