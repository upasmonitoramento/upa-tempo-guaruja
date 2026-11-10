# Saúde Guarujá — Android e iPhone

App público em Capacitor 8. A interface em `web/` preserva o visual móvel do portal. Consulta sem conta, favoritos no aparelho e diretório básico sem conexão. Ao perder acesso à API, o app oculta tempos e equipes de exemplo. Não empacota a área de cadastro, administração ou anúncios do site.

Em `mobile/`, execute `npm ci`, `npm run preview` para conferir no navegador e `npm run sync` para copiar a interface para Android e iPhone. Os ícones nativos e as telas de abertura usam a marca do projeto.

- [Plano de publicação e orçamento](release/README.md)
- [Compilação, assinatura e arquivos de saída](release/compilacao.md)
- [Política e suporte](release/legal/README.md)
- [Domínio, API e migração opcional de infraestrutura](release/infraestrutura.md)

Estado: interface e sincronização verificadas. A prévia confirmou favoritos locais e diretório sem conexão; a API real ainda precisa de verificação HTTPS em rede confiável. Compilação nativa, testes em aparelhos e revisão das lojas são etapas posteriores. Não há binários assinados ou planos contratados nesta etapa.
