# Interface e armazenamento do PWA

## Decisões

- Azul e verde existentes, fontes do sistema, transparência apenas no cabeçalho. Transições curtas, sem efeitos em execução contínua. Preferência de movimento reduzido respeitada.
- Resumo nos cards; pessoas aguardando somente nos detalhes. Tempos, equipes e datas atuais identificados como demonstração, inclusive no mapa.
- Fotos responsivas WebP, carregamento adiado e dimensões reservadas. Originais atuais: 4.495.842 bytes; conjunto compacto: 110.868 bytes; conjunto maior: 321.576 bytes. O navegador escolhe uma variante, sem baixar obrigatoriamente ambas. Novas fotos usam o endereço cadastrado até serem otimizadas novamente.
- Leaflet 1.9.4 local carregado somente ao abrir o mapa; atribuição OpenStreetMap preservada.
- Anúncios montados quando visíveis; vídeos e rotação pausados fora da tela ou com página oculta. Economia de dados e movimento reduzido suspendem reprodução automática e rotação.
- Service Worker v9 mantém somente oito entradas fixas da estrutura. Revalida os arquivos online e oferece a estrutura offline. Fotos/API não entram no CacheStorage. Atualizações substituem entradas, e versões antigas do cache Saúde são removidas. Login não é apagado.
- O navegador ainda transfere e decodifica imagens para exibi-las, e controla seu próprio cache HTTP para mídia externa. Não há promessa de zero armazenamento ou zero memória. Dados de atendimento exigem internet; a conexão automática com as UPAs ainda não está ativa.

## Verificação

`npm run build` e `node --test scripts/verify-pwa-cache.cjs` (nove testes). Verificação visual no navegador em 320, 390 e 1440 pixels: início, cards, detalhes, filtros com resultados e vazios, mapa, login e instruções de instalação. Nenhuma rolagem horizontal da página nos tamanhos conferidos. Os testes do worker cobrem limpeza de versões, exclusão de mídias/API, atualização de entradas fixas e navegação offline.

Não foi realizado benchmark Lighthouse/Core Web Vitals nem teste em aparelhos físicos iPhone/Android. Não se atribui nota ou garantia de ausência de travamentos a esta revisão.

## Referências oficiais

- [Apple: materiais e transparência](https://developer.apple.com/design/human-interface-guidelines/materials)
- [NHS: cards](https://service-manual.nhs.uk/design-system/components/card/)
- [W3C: reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [web.dev: animações eficientes](https://web.dev/articles/animations-guide)
- [web.dev: movimento reduzido](https://web.dev/articles/prefers-reduced-motion)
- [web.dev: carregamento adiado de imagens](https://web.dev/articles/browser-level-image-lazy-loading)
- [MDN: visibilidade da página](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
