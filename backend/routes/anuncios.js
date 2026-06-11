const express = require("express")
const router = express.Router()

const Anuncio = require("../models/Anuncio")
const Patrocinador = require("../models/Patrocinador")
const Log = require("../models/Log")
const User = require("../models/User")
const AreaAds = require("../models/AreaAds")

const auth = require("../middlewares/auth")
const verificarTipo = require("../middlewares/role")
const { uploadMidiaAnuncio } = require("../middlewares/uploadSeguro")

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
async function obterAdmin(req) {
    const admin = await User.findById(req.user.id).select("nome email")
    return admin
}

function detectarTipoMidia(nomeArquivo) {
    const valor = String(nomeArquivo || "").toLowerCase()

    if (valor.endsWith(".mp4") || valor.endsWith(".webm")) {
        return "video"
    }

    return "imagem"
}

function anuncioDentroDoPeriodo(anuncio) {
    const agora = new Date()

    if (anuncio.dataInicio && new Date(anuncio.dataInicio) > agora) {
        return false
    }

    if (anuncio.dataFim && new Date(anuncio.dataFim) < agora) {
        return false
    }

    return true
}

function montarQuery(req) {
    const { busca, status, posicao, patrocinador } = req.query

    let query = {}

    if (busca && busca.trim() !== "") {
        const termo = busca.trim()

        query.$or = [
            { nome: { $regex: termo, $options: "i" } },
            { descricao: { $regex: termo, $options: "i" } },
            { posicao: { $regex: termo, $options: "i" } },
            { status: { $regex: termo, $options: "i" } }
        ]
    }

    if (status === "ativo" || status === "pausado" || status === "expirado" || status === "removido") {
        query.status = status
    } else {
        query.status = { $ne: "removido" }
    }

    if (
        posicao === "lateral_esquerda" ||
        posicao === "lateral_direita" ||
        posicao === "banner_inferior" ||
        posicao === "mobile" ||
        posicao === "rodape" ||
        posicao === "card" ||
        posicao === "detalhe"
    ) {
        query.posicao = posicao
    }

    if (patrocinador) {
        query.patrocinador = patrocinador
    }

    return query
}

function normalizarTempo(valor) {
    const numero = Number(valor)

    if (!numero || numero < 2) {
        return 6
    }

    return Math.floor(numero)
}

// ==========================================
// LISTAR ANÚNCIOS PÚBLICOS ATIVOS
// GET /anuncios/publicos
// ==========================================
router.get("/publicos", async (req, res) => {

    try {

        const anuncios = await Anuncio.find({
            status: "ativo"
        })
            .populate("patrocinador", "empresaNome logo status")
            .sort({ createdAt: -1 })

        const filtrados = anuncios.filter(anuncio => {

            if (!anuncio.patrocinador) return false

            if (anuncio.patrocinador.status !== "ativo") return false

            return anuncioDentroDoPeriodo(anuncio)
        })

        res.json(filtrados)

    } catch (err) {

        res.status(500).json({
            erro: err.message
        })

    }

})

// ==========================================
// LISTAR ANÚNCIOS NO ADMIN
// GET /anuncios?busca=&status=&posicao=&patrocinador=
// SOMENTE ADMIN
// ==========================================
router.get(
    "/",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const query = montarQuery(req)

            const anuncios = await Anuncio.find(query)
                .populate("patrocinador", "empresaNome responsavelNome email logo status")
                .sort({ createdAt: -1 })

            res.json(anuncios)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// VER UM ANÚNCIO
// SOMENTE ADMIN
// ==========================================
router.get(
    "/:id",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const anuncio = await Anuncio.findById(req.params.id)
                .populate("patrocinador", "empresaNome responsavelNome email logo status")

            if (!anuncio) {
                return res.status(404).json({
                    erro: "Anúncio não encontrado"
                })
            }

            res.json(anuncio)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// CADASTRAR ANÚNCIO
// SOMENTE ADMIN
// ==========================================
router.post(
    "/",
    auth,
    verificarTipo("admin"),
    uploadMidiaAnuncio,
    async (req, res) => {

        try {

            const {
                patrocinador,
                nome,
                descricao,
                posicao,
                linkDestino,
                tempoExibicaoSegundos,
                dataInicio,
                dataFim,
                status,
                midiaUrl
            } = req.body

            if (!patrocinador || !nome || !posicao) {
                return res.status(400).json({
                    erro: "Informe patrocinador, nome do anúncio e posição"
                })
            }

            const patrocinadorExiste = await Patrocinador.findById(patrocinador)

            if (!patrocinadorExiste) {
                return res.status(404).json({
                    erro: "Patrocinador não encontrado"
                })
            }

            let midia = null
            let tipoMidia = null

            if (req.file) {
                midia = req.file.filename
                tipoMidia = req.file.mimetype.startsWith("video") ? "video" : "imagem"
            } else if (midiaUrl && midiaUrl.trim() !== "") {
                midia = midiaUrl.trim()
                tipoMidia = detectarTipoMidia(midia)
            } else {
                return res.status(400).json({
                    erro: "Envie uma imagem/vídeo ou informe uma URL de mídia"
                })
            }

            const anuncio = new Anuncio({
                patrocinador,
                nome: nome.trim(),
                descricao,
                posicao,
                tipoMidia,
                midia,
                linkDestino,
                tempoExibicaoSegundos: normalizarTempo(tempoExibicaoSegundos),
                dataInicio: dataInicio || null,
                dataFim: dataFim || null,
                status: status || "ativo"
            })

            await anuncio.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Cadastrou anúncio",
                alvo: anuncio.nome,
                detalhes: `Patrocinador: ${patrocinadorExiste.empresaNome} | Posição: ${anuncio.posicao} | Tipo: ${anuncio.tipoMidia}`
            })

            res.json({
                msg: "Anúncio cadastrado com sucesso",
                anuncio
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// EDITAR ANÚNCIO
// SOMENTE ADMIN
// ==========================================
router.put(
    "/:id",
    auth,
    verificarTipo("admin"),
    uploadMidiaAnuncio,
    async (req, res) => {

        try {

            const anuncio = await Anuncio.findById(req.params.id)

            if (!anuncio) {
                return res.status(404).json({
                    erro: "Anúncio não encontrado"
                })
            }

            const antes = {
                nome: anuncio.nome,
                posicao: anuncio.posicao,
                tipoMidia: anuncio.tipoMidia,
                midia: anuncio.midia,
                status: anuncio.status,
                tempoExibicaoSegundos: anuncio.tempoExibicaoSegundos
            }

            const {
                patrocinador,
                nome,
                descricao,
                posicao,
                linkDestino,
                tempoExibicaoSegundos,
                dataInicio,
                dataFim,
                status,
                midiaUrl
            } = req.body

            if (patrocinador) {
                const patrocinadorExiste = await Patrocinador.findById(patrocinador)

                if (!patrocinadorExiste) {
                    return res.status(404).json({
                        erro: "Patrocinador não encontrado"
                    })
                }

                anuncio.patrocinador = patrocinador
            }

            if (nome) anuncio.nome = nome.trim()
            if (descricao !== undefined) anuncio.descricao = descricao
            if (posicao) anuncio.posicao = posicao
            if (linkDestino !== undefined) anuncio.linkDestino = linkDestino
            if (tempoExibicaoSegundos !== undefined) anuncio.tempoExibicaoSegundos = normalizarTempo(tempoExibicaoSegundos)
            if (dataInicio !== undefined) anuncio.dataInicio = dataInicio || null
            if (dataFim !== undefined) anuncio.dataFim = dataFim || null

            if (status === "ativo" || status === "pausado" || status === "expirado") {
                anuncio.status = status
            }

            if (req.file) {
                anuncio.midia = req.file.filename
                anuncio.tipoMidia = req.file.mimetype.startsWith("video") ? "video" : "imagem"
            } else if (midiaUrl && midiaUrl.trim() !== "") {
                anuncio.midia = midiaUrl.trim()
                anuncio.tipoMidia = detectarTipoMidia(anuncio.midia)
            }

            await anuncio.save()

            const depois = {
                nome: anuncio.nome,
                posicao: anuncio.posicao,
                tipoMidia: anuncio.tipoMidia,
                midia: anuncio.midia,
                status: anuncio.status,
                tempoExibicaoSegundos: anuncio.tempoExibicaoSegundos
            }

            let alteracoes = []

            Object.keys(antes).forEach(campo => {
                if (String(antes[campo] || "") !== String(depois[campo] || "")) {
                    alteracoes.push(`${campo}: ${antes[campo] || "-"} → ${depois[campo] || "-"}`)
                }
            })

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Editou anúncio",
                alvo: anuncio.nome,
                detalhes: alteracoes.length > 0 ? alteracoes.join(" | ") : "Nenhuma alteração relevante"
            })

            res.json({
                msg: "Anúncio atualizado com sucesso",
                anuncio
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// ALTERAR STATUS DO ANÚNCIO
// SOMENTE ADMIN
// ==========================================
router.put(
    "/:id/status",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const { status } = req.body

            if (status !== "ativo" && status !== "pausado" && status !== "expirado") {
                return res.status(400).json({
                    erro: "Status inválido"
                })
            }

            const anuncio = await Anuncio.findById(req.params.id)

            if (!anuncio) {
                return res.status(404).json({
                    erro: "Anúncio não encontrado"
                })
            }

            const statusAnterior = anuncio.status

            anuncio.status = status

            await anuncio.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Alterou status do anúncio",
                alvo: anuncio.nome,
                detalhes: `${statusAnterior} → ${status}`
            })

            res.json({
                msg: "Status do anúncio atualizado com sucesso",
                anuncio
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)


// ==========================================
// REMOVER ANÚNCIO
// Marca como removido, remove das áreas e mantém histórico
// SOMENTE ADMIN
// ==========================================
router.put(
    "/:id/remover",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const anuncio = await Anuncio.findById(req.params.id)

            if (!anuncio) {
                return res.status(404).json({
                    erro: "Anúncio não encontrado"
                })
            }

            anuncio.status = "removido"
            anuncio.removidoEm = new Date()

            await anuncio.save()

            await AreaAds.updateMany(
                { anunciosAtuais: anuncio._id },
                { $pull: { anunciosAtuais: anuncio._id } }
            )

            await AreaAds.updateMany(
                { anuncioAtual: anuncio._id },
                { $set: { anuncioAtual: null } }
            )

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Removeu anúncio",
                alvo: anuncio.nome,
                detalhes: "Anúncio marcado como removido e retirado das áreas de ADS"
            })

            res.json({
                msg: "Anúncio removido com sucesso",
                anuncio
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }
    }
)

module.exports = router
