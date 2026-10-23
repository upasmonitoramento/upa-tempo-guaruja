# Publicação na Vercel

Importar `upasmonitoramento/upa-tempo-guaruja` na conta Vercel de
upasmonitoramento, com o nome `saude-em-tempo-real`, usando o plano Hobby.
Selecionar a raiz do repositório (não `backend` nem `frontend`).
O arquivo `vercel.json` configura o build e as rotas da API.

Configurar como segredos de Production as variáveis já existentes no ambiente
local: MONGO_URI, JWT_SECRET, CLOUDFLARE_ACCOUNT_ID, R2_ENDPOINT,
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL.
Não adicionar arquivos `.env` ao Git nem às publicações.

Após conectar o GitHub, alterações enviadas para `main` publicam a produção.
Usar credenciais separadas de desenvolvimento para previews, evitando acesso
ao banco de produção por branches de teste.

## Validação

`npm ci` e `npm run build` preparam os arquivos públicos.
As rotas públicas de leitura são `/atendimento`, `/anuncios/publicos` e
`/areas-ads/publicas`. `/auth/perfil` deve responder 401 sem token.

O acesso ao MongoDB foi validado localmente com as cinco unidades existentes.
A publicação na conta correta ainda depende da conexão Vercel.

## Limitações pendentes

- Uploads passam pelo backend: a Vercel limita o corpo completo da requisição
  a 4,5 MB. Os limites antigos de fotos de 5 MB e vídeos de 30 MB não funcionam
  nessa hospedagem. Para arquivos maiores, implementar upload direto ao R2
  com autorização e URL assinada.
- O acesso ao R2 ainda precisa ser corrigido e validado antes de confirmar uploads.
- Arquivos antigos em `/uploads` do Railway não são transferidos automaticamente.
- O plano Hobby requer uso pessoal não comercial e respeito às cotas gratuitas.
