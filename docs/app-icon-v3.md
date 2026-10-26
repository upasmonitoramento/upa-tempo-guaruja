# Ícone do aplicativo, versão 3

Arte criada com a ferramenta integrada `imagegen`, usando o ícone anterior como referência. A identidade do aplicativo, os dados e as demais telas foram preservados.

## Arquivos finais

- `frontend/app-icon-192-v3.png`: 192 × 192, 14.735 bytes.
- `frontend/app-icon-512-v3.png`: 512 × 512, 73.017 bytes.
- `frontend/app-icon-maskable-512-v3.png`: 512 × 512, 72.279 bytes.
- `frontend/apple-touch-icon-v3.png`: 180 × 180, 13.450 bytes.

PNG opaco, paleta de 256 cores, exportado com Sharp/Lanczos3. O maskable tem margem própria: pixels claros e verdes do símbolo ficam dentro do círculo central de raio 40% da largura; raio máximo medido de 31,8%. Apenas o PNG 192 entra nas oito entradas fixas do cache do PWA. Os originais de alta resolução foram preservados na pasta `identidade-visual`, ao lado do repositório no workspace.

## Prompt principal

Use case: logo-brand, app icon redesign. Existing Saúde em Tempo Real app icon as reference. One finished premium smartphone home-screen icon. Keep the healthcare location pin and ECG pulse concept, with the existing blue/green identity. Full-bleed opaque deep cobalt blue background (#0d47a1), subtle electric-blue to navy gradient and emerald ambient glow. Center an almost frontal white porcelain location pin with a substantial softly beveled rim, specular highlights, layered depth and a restrained shadow. Within its circular aperture, a recessed cobalt glass medallion contains a thick mint-green ECG heartbeat stroke with softly beveled edges. Instantly legible at small size. Contemporary healthcare technology brand, refined dimensional material and crisp silhouette. No text, outer corner mask, phone frame, extra symbols or watermark.

## Prompt da variante maskable

Keep the white porcelain pin, mint ECG, cobalt glass, colors, materials and lighting unchanged. Reduce the complete central pin and shadow about 15%, optically centered. Extend the cobalt/emerald background seamlessly to all edges. All essential white/green artwork must fit comfortably inside the central circle of diameter 80% of the canvas. No visible safety circle, labels, outer rounded corners, frame or other graphic.

## Integração e atualização

Manifest com versões 192, 512 e maskable, Apple touch 180 e imagem do diálogo de instalação. Identidade, nome, URL de início, favicon e logo do cabeçalho/rodapé preservados. Worker v10 remove os caches Saúde anteriores sem guardar fotos offline.

Ícones já instalados podem precisar da aprovação da atualização do aplicativo no Android. O iPhone pode manter o ícone anterior no atalho existente; nesse caso, remover o atalho e adicioná-lo novamente pelo Safari é uma solução prática. Nenhum aparelho físico foi controlado ou validado nesta alteração.

Referências: [W3C: zona segura](https://w3c.github.io/manifest/), [Chrome: maskable](https://web.dev/articles/maskable-icon), [Chrome: atualização de aplicativos, 2026](https://developer.chrome.com/blog/improvements-to-web-app-updates), [WebKit: ícones no iOS](https://webkit.org/blog/13878/), [Apple: adicionar à tela inicial](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
