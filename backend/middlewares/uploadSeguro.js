const multer = require("multer")
const path = require("path")

const { uploadArquivoR2 } = require("../config/r2")

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
// FILTRO DE ARQUIVO
// ==========================================
function criarFiltro(tiposPermitidos, mensagemFormatos) {
    return (req, file, cb) => {
        const extensao = path.extname(file.originalname || "").toLowerCase()
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
// CRIA UPLOAD SEGURO COM CLOUDFLARE R2
// ==========================================
function criarUploadSeguro({ prefixo, pasta, limiteMB, tiposPermitidos, mensagemFormatos }) {
    const upload = multer({
        storage: multer.memoryStorage(),

        limits: {
            fileSize: limiteMB * 1024 * 1024
        },

        fileFilter: criarFiltro(tiposPermitidos, mensagemFormatos)
    })

    return (campo) => {
        return (req, res, next) => {
            upload.single(campo)(req, res, async (err) => {
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

                try {
                    if (req.file) {
                        const enviado = await uploadArquivoR2(req.file, {
                            pasta,
                            prefixo
                        })

                        // Mantém compatibilidade com as rotas antigas.
                        // Onde o sistema usa req.file.filename, agora receberá a URL pública do R2.
                        req.file.filename = enviado.url
                        req.file.r2Url = enviado.url
                        req.file.r2Key = enviado.key
                    }

                    next()
                } catch (erroUpload) {
                    console.error("Erro ao enviar arquivo para o Cloudflare R2:", erroUpload)

                    return res.status(500).json({
                        erro: "Erro ao enviar arquivo para o armazenamento. Tente novamente."
                    })
                }
            })
        }
    }
}

// ==========================================
// EXPORTA UPLOADS PRONTOS
// ==========================================
const uploadFotoPerfil = criarUploadSeguro({
    prefixo: "perfil",
    pasta: "perfis",
    limiteMB: 2,
    tiposPermitidos: imagensPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG ou WEBP"
})("foto")

const uploadFotoAtendimento = criarUploadSeguro({
    prefixo: "atendimento",
    pasta: "atendimentos",
    limiteMB: 5,
    tiposPermitidos: imagensPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG ou WEBP"
})("foto")

const uploadLogoPatrocinador = criarUploadSeguro({
    prefixo: "patrocinador",
    pasta: "patrocinadores",
    limiteMB: 3,
    tiposPermitidos: imagensPermitidas,
    mensagemFormatos: "JPG, JPEG, PNG ou WEBP"
})("logo")

const uploadMidiaAnuncio = criarUploadSeguro({
    prefixo: "anuncio",
    pasta: "anuncios",
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
