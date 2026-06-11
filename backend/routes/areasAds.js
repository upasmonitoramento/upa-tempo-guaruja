const express = require("express")
const router = express.Router()

const AreaAds = require("../models/AreaAds")
const Anuncio = require("../models/Anuncio")
const Log = require("../models/Log")
const User = require("../models/User")

const auth = require("../middlewares/auth")
const verificarTipo = require("../middlewares/role")

// 1-8 = laterais | 9-10 = rodapé | 11-15 = cards das 5 UPAs | 16 = detalhes da UPA | 17 = banner inferior
const areasPadrao = [
    {
        numero: 1,
        codigo: "ADS_01",
        nome: "1",
        descricao: "Publicidade lateral esquerda 1.",
        posicao: "lateral_esquerda",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 1
    },
    {
        numero: 2,
        codigo: "ADS_02",
        nome: "2",
        descricao: "Publicidade lateral esquerda 2.",
        posicao: "lateral_esquerda",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 2
    },
    {
        numero: 3,
        codigo: "ADS_03",
        nome: "3",
        descricao: "Publicidade lateral esquerda 3.",
        posicao: "lateral_esquerda",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 3
    },
    {
        numero: 4,
        codigo: "ADS_04",
        nome: "4",
        descricao: "Publicidade lateral esquerda 4.",
        posicao: "lateral_esquerda",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 4
    },
    {
        numero: 5,
        codigo: "ADS_05",
        nome: "5",
        descricao: "Publicidade lateral direita 1.",
        posicao: "lateral_direita",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 5
    },
    {
        numero: 6,
        codigo: "ADS_06",
        nome: "6",
        descricao: "Publicidade lateral direita 2.",
        posicao: "lateral_direita",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 6
    },
    {
        numero: 7,
        codigo: "ADS_07",
        nome: "7",
        descricao: "Publicidade lateral direita 3.",
        posicao: "lateral_direita",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 7
    },
    {
        numero: 8,
        codigo: "ADS_08",
        nome: "8",
        descricao: "Publicidade lateral direita 4.",
        posicao: "lateral_direita",
        larguraPx: 240,
        alturaPx: 235,
        ordem: 8
    },
    {
        numero: 9,
        codigo: "ADS_09",
        nome: "9",
        descricao: "Publicidade do rodapé 1.",
        posicao: "rodape",
        larguraPx: 470,
        alturaPx: 160,
        ordem: 9
    },
    {
        numero: 10,
        codigo: "ADS_10",
        nome: "10",
        descricao: "Publicidade do rodapé 2.",
        posicao: "rodape",
        larguraPx: 470,
        alturaPx: 160,
        ordem: 10
    },
    {
        numero: 11,
        codigo: "ADS_11",
        nome: "11",
        descricao: "Publicidade do card de UPA 1.",
        posicao: "card",
        larguraPx: 260,
        alturaPx: 76,
        ordem: 11
    },
    {
        numero: 12,
        codigo: "ADS_12",
        nome: "12",
        descricao: "Publicidade do card de UPA 2.",
        posicao: "card",
        larguraPx: 260,
        alturaPx: 76,
        ordem: 12
    },
    {
        numero: 13,
        codigo: "ADS_13",
        nome: "13",
        descricao: "Publicidade do card de UPA 3.",
        posicao: "card",
        larguraPx: 260,
        alturaPx: 76,
        ordem: 13
    },
    {
        numero: 14,
        codigo: "ADS_14",
        nome: "14",
        descricao: "Publicidade do card de UPA 4.",
        posicao: "card",
        larguraPx: 260,
        alturaPx: 76,
        ordem: 14
    },
    {
        numero: 15,
        codigo: "ADS_15",
        nome: "15",
        descricao: "Publicidade do card de UPA 5.",
        posicao: "card",
        larguraPx: 260,
        alturaPx: 76,
        ordem: 15
    },
    {
        numero: 16,
        codigo: "ADS_16",
        nome: "16",
        descricao: "Publicidade no final da página de detalhes da UPA.",
        posicao: "detalhe",
        larguraPx: 970,
        alturaPx: 180,
        ordem: 16
    },
    {
        numero: 17,
        codigo: "ADS_17",
        nome: "17",
        descricao: "Banner grande inferior abaixo dos cards das UPAs.",
        posicao: "banner_inferior",
        larguraPx: 970,
        alturaPx: 190,
        ordem: 17
    }
]

const codigosPadrao = areasPadrao.map(area => area.codigo)

async function obterAdmin(req) {
    const admin = await User.findById(req.user.id).select("nome email")
    return admin
}

async function garantirAreasPadrao() {
    for (const area of areasPadrao) {
        let existente = await AreaAds.findOne({ codigo: area.codigo })

        if (!existente) {
            await AreaAds.create({
                ...area,
                status: "ativo",
                anuncioAtual: null,
                anunciosAtuais: [],
                rotacionar: true,
                tempoTrocaSegundos: 6
            })
        } else {
            let alterou = false

            if (!existente.numero) { existente.numero = area.numero; alterou = true }
            if (!existente.nome || existente.nome.startsWith("ADS")) { existente.nome = area.nome; alterou = true }
            if (!existente.anunciosAtuais) { existente.anunciosAtuais = []; alterou = true }
            if (existente.rotacionar === undefined) { existente.rotacionar = true; alterou = true }
            if (!existente.tempoTrocaSegundos) { existente.tempoTrocaSegundos = 6; alterou = true }
            if (existente.posicao !== area.posicao) { existente.posicao = area.posicao; alterou = true }
            if (!existente.larguraPx || existente.larguraPx < 50) { existente.larguraPx = area.larguraPx; alterou = true }
            if (!existente.alturaPx || existente.alturaPx < 50) { existente.alturaPx = area.alturaPx; alterou = true }

            if (alterou) await existente.save()
        }
    }

    // Desativa áreas antigas que existiam em versões anteriores (18, 19, 20 e 21)
    // para não aparecerem mais no painel nem na API pública.
    await AreaAds.updateMany(
        { codigo: { $nin: codigosPadrao } },
        { $set: { status: "inativo" } }
    )
}

function anuncioDentroDoPeriodo(anuncio) {
    if (!anuncio) return false
    const agora = new Date()
    if (anuncio.dataInicio && new Date(anuncio.dataInicio) > agora) return false
    if (anuncio.dataFim && new Date(anuncio.dataFim) < agora) return false
    return true
}

function filtrarAnunciosValidos(lista) {
    if (!Array.isArray(lista)) return []
    return lista.filter(anuncio => {
        if (!anuncio) return false
        if (anuncio.status !== "ativo") return false
        if (!anuncio.patrocinador) return false
        if (anuncio.patrocinador.status !== "ativo") return false
        return anuncioDentroDoPeriodo(anuncio)
    })
}

async function buscarAreaCompleta(query) {
    return AreaAds.find(query)
        .populate({ path: "anuncioAtual", populate: { path: "patrocinador", select: "empresaNome responsavelNome email logo status" } })
        .populate({ path: "anunciosAtuais", populate: { path: "patrocinador", select: "empresaNome responsavelNome email logo status" } })
        .sort({ ordem: 1 })
}

router.get("/publicas", async (req, res) => {
    try {
        await garantirAreasPadrao()
        const areas = await buscarAreaCompleta({ status: "ativo", codigo: { $in: codigosPadrao } })
        const areasFiltradas = areas.map(area => {
            const obj = area.toObject()
            obj.anunciosAtuais = filtrarAnunciosValidos(obj.anunciosAtuais)
            if (obj.anunciosAtuais.length === 0 && obj.anuncioAtual && obj.anuncioAtual.status === "ativo" && obj.anuncioAtual.patrocinador && obj.anuncioAtual.patrocinador.status === "ativo" && anuncioDentroDoPeriodo(obj.anuncioAtual)) {
                obj.anunciosAtuais = [obj.anuncioAtual]
            }
            obj.anuncioAtual = null
            return obj
        })
        res.json(areasFiltradas)
    } catch (err) {
        res.status(500).json({ erro: err.message })
    }
})

router.get("/", auth, verificarTipo("admin"), async (req, res) => {
    try {
        await garantirAreasPadrao()
        const areas = await buscarAreaCompleta({ codigo: { $in: codigosPadrao } })
        res.json(areas)
    } catch (err) {
        res.status(500).json({ erro: err.message })
    }
})

router.get("/:id", auth, verificarTipo("admin"), async (req, res) => {
    try {
        const area = await AreaAds.findById(req.params.id)
            .populate({ path: "anuncioAtual", populate: { path: "patrocinador", select: "empresaNome responsavelNome email logo status" } })
            .populate({ path: "anunciosAtuais", populate: { path: "patrocinador", select: "empresaNome responsavelNome email logo status" } })
        if (!area) return res.status(404).json({ erro: "Área de ADS não encontrada" })
        res.json(area)
    } catch (err) {
        res.status(500).json({ erro: err.message })
    }
})

router.put("/:id", auth, verificarTipo("admin"), async (req, res) => {
    try {
        const area = await AreaAds.findById(req.params.id)
        if (!area) return res.status(404).json({ erro: "Área de ADS não encontrada" })

        const antes = {
            nome: area.nome,
            anunciosAtuais: (area.anunciosAtuais || []).join(","),
            larguraPx: area.larguraPx,
            alturaPx: area.alturaPx,
            status: area.status,
            rotacionar: area.rotacionar,
            tempoTrocaSegundos: area.tempoTrocaSegundos
        }

        const { nome, anunciosAtuais, anuncioAtual, larguraPx, alturaPx, status, rotacionar, tempoTrocaSegundos } = req.body

        if (nome) area.nome = String(nome).replace(/\D/g, "") || area.nome

        if (larguraPx !== undefined) {
            const largura = Number(larguraPx)
            if (!largura || largura < 50) return res.status(400).json({ erro: "Largura inválida" })
            area.larguraPx = largura
        }

        if (alturaPx !== undefined) {
            const altura = Number(alturaPx)
            if (!altura || altura < 50) return res.status(400).json({ erro: "Altura inválida" })
            area.alturaPx = altura
        }

        if (status === "ativo" || status === "inativo") area.status = status
        if (rotacionar !== undefined) area.rotacionar = Boolean(rotacionar)

        if (tempoTrocaSegundos !== undefined) {
            const tempo = Number(tempoTrocaSegundos)
            if (!tempo || tempo < 2) return res.status(400).json({ erro: "Tempo de troca inválido. Use pelo menos 2 segundos." })
            area.tempoTrocaSegundos = tempo
        }

        let listaAnuncios = []
        if (Array.isArray(anunciosAtuais)) listaAnuncios = anunciosAtuais.filter(Boolean)
        else if (typeof anunciosAtuais === "string" && anunciosAtuais.trim() !== "") listaAnuncios = anunciosAtuais.split(",").map(id => id.trim()).filter(Boolean)
        else if (anuncioAtual) listaAnuncios = [anuncioAtual]

        if (listaAnuncios.length > 0) {
            const totalEncontrado = await Anuncio.countDocuments({ _id: { $in: listaAnuncios } })
            if (totalEncontrado !== listaAnuncios.length) return res.status(404).json({ erro: "Um ou mais anúncios não foram encontrados" })
        }

        area.anunciosAtuais = listaAnuncios
        area.anuncioAtual = listaAnuncios.length > 0 ? listaAnuncios[0] : null
        await area.save()

        const depois = {
            nome: area.nome,
            anunciosAtuais: (area.anunciosAtuais || []).join(","),
            larguraPx: area.larguraPx,
            alturaPx: area.alturaPx,
            status: area.status,
            rotacionar: area.rotacionar,
            tempoTrocaSegundos: area.tempoTrocaSegundos
        }

        let alteracoes = []
        Object.keys(antes).forEach(campo => {
            if (String(antes[campo] || "") !== String(depois[campo] || "")) alteracoes.push(`${campo}: ${antes[campo] || "-"} → ${depois[campo] || "-"}`)
        })

        const admin = await obterAdmin(req)
        await Log.create({
            usuarioId: req.user.id,
            usuarioNome: admin ? admin.nome : "Admin",
            acao: "Editou área de ADS",
            alvo: area.nome,
            detalhes: alteracoes.length > 0 ? alteracoes.join(" | ") : "Nenhuma alteração relevante"
        })

        const areaAtualizada = await AreaAds.findById(area._id)
            .populate({ path: "anunciosAtuais", populate: { path: "patrocinador", select: "empresaNome responsavelNome email logo status" } })

        res.json({ msg: "Área de ADS atualizada com sucesso", area: areaAtualizada })
    } catch (err) {
        res.status(500).json({ erro: err.message })
    }
})

module.exports = router
