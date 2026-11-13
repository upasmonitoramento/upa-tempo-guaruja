# Conecta Saúde — abertura, cidade e avisos

Marca exibida: Conecta Saúde, sem cidade no nome do aplicativo. Endereço atual, identificadores de pacote, contas, permissões, ícones instalados e arquivos de publicidade foram preservados. O ícone quadrado foi removido somente da composição da abertura, por meio do vetor transparente `frontend/brand-mark.svg`.

## Entrada

A referência enviada pelo usuário mostra símbolo, revelação do nome ao lado e transição para o conteúdo. A implementação usa CSS/SVG, dura cerca de 1,9 segundo e não baixa nem reproduz o vídeo de referência. Com a preferência de reduzir movimento, a animação é dispensada.

Cada nova abertura apresenta a seleção de cidade. Há uma grade de duas colunas, com apenas Guarujá disponível nesta versão. Não são exibidas cidades fictícias. Ao selecionar, carregam-se as unidades; o botão ao lado da marca permite trocar/voltar à seleção. A consulta solicita `cidade=guaruja`; o backend inclui registros antigos sem esse campo e rejeita cidades indisponíveis. Novas cidades exigem cadastro/configuração e validação das respectivas unidades; esta revisão não anuncia cobertura inexistente.

Os launch screens nativos recebem uma ponte estática com o mesmo fundo e símbolo antes da animação compartilhada. Mudanças em arquivos nativos exigem nova compilação e distribuição; a publicação web/PWA não substitui APK/IPA já instalado. O nome não altera os application IDs existentes.

## Avisos opcionais

Administração → Avisos: título, mensagem em texto simples, escopo, início e fim opcionais. Horários digitados usam o fuso do aparelho e são transmitidos como instantes ISO. Um administrador ativo é conferido no banco a cada operação privada, não apenas pelo papel salvo no navegador.

`/admin/avisos/publico?cidade=guaruja` retorna apenas o aviso ativo dentro do período, ou null. O registro único é criado somente ao salvar. Não há aviso padrão e nenhum aviso foi publicado automaticamente por esta implementação.

O usuário fecha no X ou em sete segundos. Passar o ponteiro ou focar o aviso pausa o fechamento para leitura. A revisão já fechada é lembrada na sessão; editar/publicar gera uma nova revisão. O portal verifica atualizações a cada minuto enquanto visível e dentro da cidade. O texto nunca é inserido como HTML. Falhas na consulta de avisos não impedem o uso das unidades.

Avisar não ativa manutenção nem bloqueia o portal. Para parar um aviso, usar Desativar aviso ou definir o término. Não há envio de WhatsApp/e-mail por essa função.

## Verificações

- `node --test backend/routes/avisos.test.js`: autorização, entrada inválida, aviso ausente, futuro, ativo, expirado e desativação.
- `mobile/tools/smoke-entry.cjs`: abertura, cidade sem requisição prematura de unidades, troca de cidade, texto sem execução de HTML, X, fechamento de sete segundos, editor e desativação, com servidor fictício.
- Suítes de navegação, equipe e comercial existentes adaptadas à seleção inicial. Viewports móveis, desktop e paisagem; não equivalem a aparelho físico/Safari real.
- `npm run sync --prefix mobile` e build web.
