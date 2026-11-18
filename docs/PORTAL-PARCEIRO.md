# Portal do parceiro — Conecta Saúde

Implementado em 18/11/2026. Entrada: `/parceiro.html`; também disponível por Conta → Portal do parceiro e pelo formulário de login. O mesmo portal é incluído no build dos aplicativos.

## Organização das telas

Três abas: **Campanhas**, **Artes** e **Conta**. No celular, navegação inferior com ícones de 20 pixels e controles de toque de tamanho adequado; no computador, navegação lateral. Fonte Outfit, azul do Conecta Saúde e detalhes recolhidos para reduzir a rolagem.

- Campanhas: estado da parceria, duração, cidade, recebimento, período, consulta da cobrança e pedido de renovação. Paginação real de 10 registros; filtros aplicados no servidor.
- Artes: formatos e dimensões reais dos espaços contratados; um envio por formato, prévia, destino do anúncio e envio para revisão. Durante a revisão, os controles de envio somem em vez de ocupar espaço bloqueados.
- Conta: nome de contato, email validado, ajuda, saída e troca de senha recolhida por padrão. CPF não é usado como senha ou identificador público de login.

## Fluxo de operação

1. Administrador cria proposta com nome, email, valor, posições e duração de **14 ou 28 dias**. Criar proposta não gera cobrança. Neste momento, somente Guarujá está habilitada para contratação/publicação.
2. O responsável aceita os termos e informa CPF/CNPJ. O fluxo atual de emissão do Pix pelo administrador é preservado.
3. O webhook consulta a cobrança no Asaas. Só `RECEIVED`, com cliente, valor, referência e identificação correspondentes, libera o convite. `CONFIRMED`, agendamento e comprovantes não equivalem a dinheiro disponível.
4. Com email configurado, o recebimento envia automaticamente o convite. O administrador também pode reenviar por Parcerias → ficha da empresa → Enviar acesso ao parceiro.
5. O link valida a posse do email e permite criar senha. Uma conta já existente precisa entrar para vincular a nova proposta; o convite não substitui sua senha silenciosamente. Convites duram uma hora e são de uso único.
6. O parceiro envia as artes e um link HTTPS opcional. A primeira lista de formatos é congelada no convite, usando os tamanhos reais cadastrados em Espaços.
7. Administrador abre Parcerias → Campanhas. A ficha reúne todas as artes e o destino. Pode solicitar ajustes, ou preparar a aprovação. O Asaas é consultado novamente.
8. A segunda etapa exibe valor, datas, cidades e formatos. É necessário confirmar que recebeu e revisou tudo, e apertar **Confirmar aprovação e programação**. A confirmação dura cinco minutos, é de uso único e está vinculada à revisão e ao administrador.
9. A primeira publicação começa no próximo dia útil após a aprovação e o recebimento. O período conta 14/28 dias corridos. Alterar artes durante o período não renova nem prolonga os dias pagos. As artes já aprovadas são mantidas no ar até aprovar a substituição.
10. O fim do período impede novas exibições nos dois endpoints públicos e no carrossel já aberto. Estorno/chargeback comunicado pelo Asaas também bloqueia a elegibilidade. Escritas parciais de uma aprovação interrompida ficam invisíveis; uma nova tentativa não duplica o anúncio.

O calendário considera feriados nacionais, estaduais de São Paulo e municipais de Guarujá (Santo Amaro, Paixão de Cristo e Corpus Christi). Ponto facultativo de repartição não é tratado automaticamente como feriado comercial. Datas adicionais podem ser informadas em `PARTNER_BUSINESS_HOLIDAYS`, separadas por vírgulas, no formato `AAAA-MM-DD`.

Fontes do calendário: [Registro nacional de 2026](https://www.gov.br/gestao/pt-br/assuntos/noticias/2025/dezembro/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026), [Diário Oficial de Guarujá de 09/12/2025](https://www.guaruja.sp.gov.br/plataforma/wp-content/uploads/2025/12/09-1uQY2289y2-2025.pdf).

## Segurança e mídia

- Parceiros usam coleção e audiência JWT próprias, separadas de usuários/funcionários/administradores. O servidor confere titularidade de cada campanha e estado atual da conta. Saber um CPF ou ID não concede acesso.
- Após três senhas incorretas, a conta é bloqueada no MongoDB, as sessões antigas são invalidadas e é enviado um link de desbloqueio. O link permite validar o email e criar nova senha; dura 20 minutos e só funciona uma vez.
- Recuperação e convite armazenam somente hashes dos tokens. Os links chegam como fragmento da URL, são removidos da barra e não entram na URL das chamadas da API.
- Dados fiscais e email do responsável não são expostos nos anúncios ou espaços públicos.
- Imagens são verificadas e recodificadas em WebP, sem EXIF, com miniatura leve. O portal carrega a miniatura; a arte completa/vídeo só abre sob solicitação.
- Arquivos: até 4 MB por envio; dimensões exatas do formato. Vídeos: MP4 H.264 ou WebM VP8/VP9, até 15 segundos, com tamanho e duração lidos no servidor.
- Há controle de concorrência por revisão e uma trava por envio. Duas abas não sobrescrevem a mesma revisão silenciosamente. Artes substituídas que ainda não estão publicadas são removidas; artes em uso por uma publicação são preservadas.
- O service worker não armazena API do parceiro, dados comerciais ou imagens.
- Bibliotecas do backend atualizadas; Mongoose 9.12.2. A auditoria npm desta versão não apontou vulnerabilidades conhecidas.

## O que depende de conexão externa

**Email:** faltam domínio/remetente verificado e chave do serviço de envio. Configurações da Vercel: `RESEND_API_KEY` (segredo) e `AUTH_EMAIL_FROM` (remetente autorizado). `PUBLIC_SITE_ORIGIN` deve acompanhar o domínio oficial quando ele mudar. Sem email configurado, não são criados acessos fictícios nem liberadas contas sem validação.

**Cobranças reais:** continuam desativadas. A operação comercial depende de `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, webhook configurado no Asaas e ativação explícita de `PORTAL_COMERCIAL_PRODUCAO=1`. Não habilitar apenas para demonstrar o layout. Nenhuma cobrança real foi criada nesta implementação.

**WhatsApp:** número e integração oficial ainda pendentes. O fluxo previsto pode emitir/encaminhar a cobrança e, depois do recebimento confirmado, direcionar para o convite do portal. A senha é criada no site, nunca pedida pelo bot.

## Etapas que ainda não estão automatizadas

- Catálogo de pacotes com preços e regras comerciais editáveis. Hoje as condições são definidas em cada proposta pelo administrador.
- Renovação com nova proposta e cobrança automática por pacote. Nesta versão, o parceiro solicita manter ou trocar as artes; o pedido aparece no administrador. Não há cobrança automática por apertar “Solicitar renovação”.
- Lembrete pelo WhatsApp dois dias antes do vencimento. O aviso de vencimento já aparece dentro do portal.
- Limpeza agendada de arquivos antigos de publicações encerradas e retenção fiscal/contratual definida. A limpeza imediata cobre rascunhos substituídos, sem apagar artes ainda em uso.
- Novas cidades, com unidades e espaços correspondentes; vídeos maiores por upload direto ao R2; publicação final nas lojas e conclusão dos textos legais gerais do site.

## Validação executada

- Testes de backend, regras de mídia/calendário, criação de propostas e segurança.
- Integração HTTP com MongoDB real em banco QA isolado e removido ao concluir: convite, validação, isolamento, paginação, envio, revisão, falha parcial, aprovação, substituição sem dias extras, estorno e desbloqueio. Asaas, emails e armazenamento foram simulados nesse teste.
- Teste separado de envio/leitura/remoção de uma arte temporária no R2 real, sem dados pessoais.
- Layout e navegação em 320/390/1440 pixels, build nativo e motor WebKit/Safari. Prévia e confirmação do administrador em celular e computador.
- Os testes não equivalem à entrega de email real nem à homologação em aparelho físico/lojas.

Executar `npm test`; a integração real isolada é opt-in: `PARTNER_INTEGRATION_LOCAL=1 node --test backend/routes/partner-flow.integration.test.js`. Nunca apontar os modelos para o banco principal do projeto durante esse teste: o script gera e verifica seu próprio nome de banco QA antes de removê-lo.
