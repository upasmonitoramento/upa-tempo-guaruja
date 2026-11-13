# Portal Saúde — navegação e identidade, revisão 4

## Escopo

Mesma fonte pública para desktop, navegador móvel, PWA e conteúdo empacotado no Capacitor. Não altera contas, permissões, dados das unidades, pagamentos ou contratos. A Área do Parceiro discutida no planejamento comercial não é implementada por esta revisão visual.

- Desktop: cabeçalho com Início, Mapa, Favoritas e Conta. Favoritos também passam a existir no site.
- Celular: cabeçalho compacto e quatro destinos com ícone e texto na barra inferior.
- Detalhes: cabeçalho contextual com voltar e coração, sem cabeçalho global ou barra inferior no celular. A seta restaura o destino de origem: lista, favoritas ou mapa.
- Conta: perfil e ações curtas por permissão. Atualizar atendimento, Administração e Publicidade saem do topo das páginas públicas e ficam nesta área.
- Favoritos: somente identificadores de unidades no aparelho; nenhum dado de paciente. Reutiliza a chave já usada no app, preservando favoritos existentes.
- Divulgação: espaços e proporções de anúncios preservados nas páginas públicas; rodapé não ocupa as telas de conta e tarefas internas.

## Identidade

Paleta principal `#1554B5`; texto `#172B46`; texto secundário `#607086`; superfície `#F7F9FC`; borda `#E5EAF0`; detalhe do símbolo `#14B88A`. Cores de situação de espera e WhatsApp mantêm significado próprio. Fonte padrão do sistema: `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`, sem download de fontes.

Vetor original em `frontend/brand-symbol.svg`. Exportação reproduzível com `mobile/tools/generate-brand-assets.cjs`, usando Sharp disponível no runtime de desenvolvimento. Nenhuma biblioteca é adicionada ao site. Foram atualizados favicon, ícones PWA/maskable/Apple, aliases de marca, mipmaps Android, ícone iOS e ícones de submissão às lojas.

Ícone PNG 512: cerca de 7,2 KB; 192: cerca de 2,8 KB. Zona segura do maskable e do foreground Android considerada na exportação. Marca plana e legível em tamanhos pequenos, sem textos dentro do ícone.

Manifest com cache-busting de ícones `?v=4`, worker `saude-guaruja-v11` para renovar a estrutura. Fotos e publicidade continuam fora do cache gerenciado pelo worker. O iOS pode manter o ícone de um atalho já instalado; se não atualizar, remover o atalho e adicionar novamente pelo Safari. APKs e versões iOS já distribuídos precisam de uma nova compilação/versão para incorporar os arquivos empacotados.

## Verificação

- `npm run sync --prefix mobile`: gera e sincroniza os arquivos compartilhados de Android e iOS.
- `mobile/tools/smoke-modern.cjs`: web e app empacotado, navegação e favoritos, conta/permissões, telas de 375, 390 e 1440 CSS px. Usa API fictícia, sem dados ou cobranças reais.
- `mobile/tools/smoke-portal.cjs`: usuário, funcionário, administrador, formulários, mapa e diretório offline sem tempos/equipe antigos.
- `mobile/tools/smoke-comercial.cjs`: painel comercial existente.
- Conferência visual das capturas em `../tmp/modern-review` (fora do repositório).

## Referências de interação

- [Android — destinos principais e navegação](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [Apple — tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [W3C — alvos de toque ampliados](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

As imagens enviadas pelo usuário inspiraram a organização e a redução de blocos, sem copiar marcas ou produtos de terceiros. A retirada da barra inferior nos detalhes segue a preferência explícita do usuário. Não constitui certificação formal de acessibilidade nem teste em aparelho físico.
