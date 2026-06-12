const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const crypto = require("crypto")
const path = require("path")

// ==========================================
// CONFIGURAÇÃO CLOUDFLARE R2
// ==========================================
function obterEnvObrigatoria(nome) {
    const valor = process.env[nome]

    if (!valor || String(valor).trim() === "") {
        throw new Error(`Variável de ambiente obrigatória não configurada: ${nome}`)
    }

    return String(valor).trim()
}

function obterEndpointR2() {
    if (process.env.R2_ENDPOINT && String(process.env.R2_ENDPOINT).trim() !== "") {
        return String(process.env.R2_ENDPOINT).trim()
    }

    const accountId = obterEnvObrigatoria("CLOUDFLARE_ACCOUNT_ID")
    return `https://${accountId}.r2.cloudflarestorage.com`
}

let clienteR2 = null

function getClienteR2() {
    if (!clienteR2) {
        clienteR2 = new S3Client({
            region: "auto",
            endpoint: obterEndpointR2(),
            credentials: {
                accessKeyId: obterEnvObrigatoria("R2_ACCESS_KEY_ID"),
                secretAccessKey: obterEnvObrigatoria("R2_SECRET_ACCESS_KEY")
            }
        })
    }

    return clienteR2
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function limparParteCaminho(valor, padrao) {
    const limpo = String(valor || padrao)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

    return limpo || padrao
}

function montarChaveArquivo(file, { pasta = "uploads", prefixo = "arquivo" } = {}) {
    const extensao = path.extname(file.originalname || "").toLowerCase() || ".bin"
    const pastaLimpa = limparParteCaminho(pasta, "uploads")
    const prefixoLimpo = limparParteCaminho(prefixo, "arquivo")
    const aleatorio = crypto.randomBytes(16).toString("hex")

    return `${pastaLimpa}/${Date.now()}-${prefixoLimpo}-${aleatorio}${extensao}`
}

function obterUrlPublica(chave) {
    const publicUrl = obterEnvObrigatoria("R2_PUBLIC_URL").replace(/\/+$/, "")
    return `${publicUrl}/${chave}`
}

// ==========================================
// UPLOAD PARA R2
// ==========================================
async function uploadArquivoR2(file, opcoes = {}) {
    if (!file || !file.buffer) {
        throw new Error("Arquivo inválido para upload no R2.")
    }

    const bucket = obterEnvObrigatoria("R2_BUCKET_NAME")
    const chave = montarChaveArquivo(file, opcoes)

    await getClienteR2().send(new PutObjectCommand({
        Bucket: bucket,
        Key: chave,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
        CacheControl: "public, max-age=31536000, immutable"
    }))

    return {
        key: chave,
        url: obterUrlPublica(chave)
    }
}

module.exports = {
    uploadArquivoR2
}
