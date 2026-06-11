const express = require("express")
const router = express.Router()

const Atendimento = require("../models/atendimento")
const auth = require("../middlewares/auth")
const verificarTipo = require("../middlewares/role")
const { uploadFotoAtendimento } = require("../middlewares/uploadSeguro")

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function somenteNumeros(valor) {
    return String(valor || "").replace(/\D/g, "")
}

function calcularStatusPorTempo(minutos) {
    const m = Number(minutos || 0)

    if (m <= 25) return "normal"
    if (m < 70) return "lotado"
    return "critico"
}

function formatarTempo(minutos) {
    const m = Number(minutos || 0)

    if (!m) return "-"

    const horas = Math.floor(m / 60)
    const resto = m % 60

    if (horas > 0) {
        if (resto > 0) return `${horas}h ${resto}min`
        return `${horas}h`
    }

    return `${m} min`
}

function parseMedicosPlantao(valor) {
    try {
        if (!valor) return []

        let lista = valor

        if (typeof valor === "string") {
            lista = JSON.parse(valor)
        }

        if (!Array.isArray(lista)) return []

        return lista
            .map(medico => ({
                nome: String(medico.nome || "").trim(),
                especialidade: String(medico.especialidade || "Clínico Geral").trim()
            }))
            .filter(medico => medico.nome || medico.especialidade)

    } catch {
        return []
    }
}

// ==========================================
// LISTAR ATENDIMENTOS
// ROTA PÚBLICA
// ==========================================
router.get("/", async (req, res) => {

    try {

        const atendimentos = await Atendimento.find()
            .sort({ upa: 1 })

        res.json(atendimentos)

    } catch (err) {

        res.status(500).json({
            erro: err.message
        })

    }

})

// ==========================================
// CADASTRAR ATENDIMENTO
// FUNCIONÁRIO OU ADMIN
// ==========================================
router.post(
    "/",
    auth,
    verificarTipo("funcionario", "admin"),
    uploadFotoAtendimento,
    async (req, res) => {

        try {

            const {
                upa,
                endereco,
                medico,
                especialidade,
                medicosPlantao,
                tempo_espera,
                tempo_minutos,
                lat,
                lng,
                foto
            } = req.body

            if (!upa) {
                return res.status(400).json({
                    erro: "Informe o nome da UPA/PAN"
                })
            }

            const minutos = Number(somenteNumeros(tempo_minutos || tempo_espera)) || 0
            const medicos = parseMedicosPlantao(medicosPlantao)

            const atendimento = new Atendimento({
                upa,
                endereco,
                medico: medico || medicos.map(m => m.nome).filter(Boolean).join(", "),
                especialidade: especialidade || medicos.map(m => m.especialidade).filter(Boolean).join(", "),
                medicosPlantao: medicos,
                tempo_espera: tempo_espera || formatarTempo(minutos),
                tempo_minutos: minutos,
                status: calcularStatusPorTempo(minutos),
                lat: lat ? Number(lat) : undefined,
                lng: lng ? Number(lng) : undefined,
                foto: req.file ? req.file.filename : (foto || null),
                data: new Date()
            })

            await atendimento.save()

            res.json({
                msg: "Atendimento cadastrado com sucesso",
                atendimento
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// ATUALIZAR ATENDIMENTO EXISTENTE
// FUNCIONÁRIO OU ADMIN
// ==========================================
router.put(
    "/:id",
    auth,
    verificarTipo("funcionario", "admin"),
    uploadFotoAtendimento,
    async (req, res) => {

        try {

            const atendimento = await Atendimento.findById(req.params.id)

            if (!atendimento) {
                return res.status(404).json({
                    erro: "Atendimento não encontrado"
                })
            }

            const {
                upa,
                endereco,
                medico,
                especialidade,
                medicosPlantao,
                tempo_espera,
                tempo_minutos,
                lat,
                lng,
                foto
            } = req.body

            const minutos = Number(somenteNumeros(tempo_minutos || tempo_espera || atendimento.tempo_minutos || atendimento.tempo_espera)) || 0
            const medicos = parseMedicosPlantao(medicosPlantao)

            if (upa !== undefined) atendimento.upa = upa
            if (endereco !== undefined) atendimento.endereco = endereco

            if (medicos.length > 0) {
                atendimento.medicosPlantao = medicos
                atendimento.medico = medicos.map(m => m.nome).filter(Boolean).join(", ")
                atendimento.especialidade = medicos.map(m => m.especialidade).filter(Boolean).join(", ")
            } else {
                if (medico !== undefined) atendimento.medico = medico
                if (especialidade !== undefined) atendimento.especialidade = especialidade
            }

            atendimento.tempo_minutos = minutos
            atendimento.tempo_espera = tempo_espera || formatarTempo(minutos)
            atendimento.status = calcularStatusPorTempo(minutos)

            if (lat !== undefined && lat !== "") atendimento.lat = Number(lat)
            if (lng !== undefined && lng !== "") atendimento.lng = Number(lng)

            // Se mandar arquivo, troca a foto.
            // Se mandar URL, troca a foto.
            // Se não mandar nada, mantém a foto antiga.
            if (req.file) {
                atendimento.foto = req.file.filename
            } else if (foto && String(foto).trim() !== "") {
                atendimento.foto = String(foto).trim()
            }

            atendimento.data = new Date()

            await atendimento.save()

            res.json({
                msg: "Atendimento atualizado com sucesso",
                atendimento
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

module.exports = router
