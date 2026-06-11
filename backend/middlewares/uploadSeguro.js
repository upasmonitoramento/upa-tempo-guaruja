const multer = require("multer")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")

// ==========================================
// GARANTE QUE A PASTA UPLOADS EXISTE
// ==========================================
const pastaUploads = path.join(__dirname, "..", "uploads")

if (!fs.existsSync(pastaUploads)) {
    fs.mkdirSync(pastaUploads)
}

// ==========================================
// TIPOS PERMITIDOS
// ==========================================
const imagensPermitidas = {
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".webp": ["image/webp"]
}

const midiasAnuncioPermitidas = {
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".webp": ["image/webp"],
    ".mp4": ["video/mp4"],
    ".webm": ["video/webm"]
}

// ==========================================
// FUNÇÃO PARA CRIAR NOME SEGURO
// ==========================================
function gerarNomeSeguro(file, prefixo) {
    const extensao = path.extname(file.originalname).toLowerCase()
    const nomeAleatorio = crypto.randomBytes(10).toString("hex")

    return `${Date.now()}-${prefixo}-${nomeAleatorio}${extensao}`
}

// ==========================================
// STORAGE SEGURO
// ==========================================
function criarStorage(prefixo) {
    return multer.diskStorage({

        destination: (req, file, cb) => {
            cb(null, pastaUploads)
        },

        filename: (req, file, cb) => {
            cb(null, gerarNomeSeguro(file, prefixo))
        }

    })
}

// ==========================================
// FILTRO DE ARQUIVO
// ==========================================
function criarFiltro(tiposPermitidos, mensagemFormatos) {
    return (req, file, cb) => {

        const extensao = path.extname(file.originalname).toLowerCase()
        const mimetype = file.mimetype

        const tiposDaExtensao = tiposPermitidos[extensao]

        if (!tiposDaExtensao) {
            return cb(new Error(`Formato de arquivo não permitido. Use ${mensagemFormatos}.`))
        }

        if (!tiposDaExtensao.includes(mimetype)) {
            return cb(new Error("Tipo de arquivo inválido ou suspeito."))
        }

        cb(null, true)
    }
}

// ==========================================
// CRIA UPLOAD SEGURO
// ==========================================
function criarUploadSeguro({ prefixo, limiteMB, tiposPermitidos, mensagemFormatos }) {

    const upload = multer({
        storage: criarStorage(prefixo),

        limits: {
            fileSize: limiteMB * 1024 * 1024
        },

        fileFilter: criarFiltro(tiposPermitidos, mensagemFormatos)
    })

    return (campo) => {
        return (req, res, next) => {
            upload.single(campo)(req, res, (err) => {

                if (err) {

                    if (err.code === "LIMIT_FILE_SIZE") {
                        return res.status(400).json({
                            erro: `Arquivo muito grande. O limite é ${limiteMB} MB.`
                        })
                    }

                    return res.status(400).json({
                        erro: err.message || "Erro ao enviar arquivo."
                    })
                }

                next()
            })
        }
    }
}

// ==========================================
// EXPORTA UPLOADS PRONTOS
// ==========================================
const uploadFotoPerfil = criarUploadSeguro({
    prefixo: "perfil",
    limiteMB: 2,
    tiposPermitidos: imagensPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG ou WEBP"
})("foto")

const uploadFotoAtendimento = criarUploadSeguro({
    prefixo: "atendimento",
    limiteMB: 5,
    tiposPermitidos: imagensPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG ou WEBP"
})("foto")

const uploadLogoPatrocinador = criarUploadSeguro({
    prefixo: "patrocinador",
    limiteMB: 3,
    tiposPermitidos: imagensPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG ou WEBP"
})("logo")

const uploadMidiaAnuncio = criarUploadSeguro({
    prefixo: "anuncio",
    limiteMB: 30,
    tiposPermitidos: midiasAnuncioPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG, WEBP, MP4 ou WEBM"
})("midia")

module.exports = {
    uploadFotoPerfil,
    uploadFotoAtendimento,
    uploadLogoPatrocinador,
    uploadMidiaAnuncio
}