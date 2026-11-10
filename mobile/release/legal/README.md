# Política e suporte

Estes HTML são modelos para a versão pública sem conta, ainda não publicados. A política do site atual é separada: o site mantém fluxos de cadastro e administração.

1. Copie `config.example.json` para um arquivo local fora do Git. Preencha com o titular real, canais monitorados, vigência e levantamento validado de logs, fornecedores, transferências, retenção e bases legais. Revise a descrição fixa contra a versão final do app (links, permissões, favoritos e diretório offline).
2. Depois da revisão, marque `revisaoConcluida` como verdadeiro e execute `node prepare.cjs <caminho-do-config>`. A saída será criada em `mobile/release/out/site/`.
3. Publique os HTML revisados no domínio público, sem login. Verifique HTTPS, links recíprocos e o envio de e-mail. Use as URLs públicas no app e nas fichas das lojas.

Não declarar “nenhum dado coletado” até verificar logs da API, hospedagem e os serviços realmente usados na compilação. Se o escopo mudar, atualizar política e formulários juntos.

Fontes: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [Google Play — segurança dos dados](https://support.google.com/googleplay/android-developer/answer/10787469), [Apple — privacidade](https://developer.apple.com/app-store/app-privacy-details/).
