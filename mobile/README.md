# Saúde Guarujá — Android e iPhone

App em Capacitor 8. A compilação empacota a interface aprovada do portal: navegação, mapa, detalhes das UPAs e publicidade contextual. A consulta pública não exige conta. A área da equipe usa contas já cadastradas e as permissões do portal. Os tempos e equipes são demonstrativos. Favoritos guardam apenas os identificadores das unidades no aparelho. Se a API estiver fora do ar, o diretório local permite consultar endereços e telefones sem exibir tempos ou equipes.

Em `mobile/`, execute `npm ci`, `npm run preview` para conferir no navegador e `npm run sync` para copiar a interface para Android e iPhone. Os ícones nativos e as telas de abertura usam a marca do projeto.

- [Plano de publicação e orçamento](release/README.md)
- [Compilação, assinatura e arquivos de saída](release/compilacao.md)
- [Política e suporte](release/legal/README.md)
- [Domínio, API e migração opcional de infraestrutura](release/infraestrutura.md)

`MOBILE_API_ORIGIN` aponta para a origem HTTPS da API. `MOBILE_PRIVACY_URL` e `MOBILE_SUPPORT_URL` são obrigatórias na compilação de publicação. `MOBILE_WHATSAPP_URL` é opcional e só deve ser configurada com o canal confirmado do projeto. Sem ela, o botão flutuante abre as orientações de suporte.

A API pública respondeu com cinco unidades para as origens das duas WebViews. O teste local de papéis (`tools/smoke-portal.cjs`) usa dados fictícios e não altera a produção. Antes do envio, validar o app nativo no iPhone e em um Android físico, aprovar a política com o titular, concluir as declarações e preparar acessos exclusivos de revisão.
