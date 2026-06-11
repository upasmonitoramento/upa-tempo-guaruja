const express = require("express")
const router = express.Router()

const User = require("../models/User")
const Log = require("../models/Log")

const auth = require("../middlewares/auth")
const verificarTipo = require("../middlewares/role")

// ==========================================
// FUNÇÃO AUXILIAR PARA PEGAR ADMIN LOGADO
// ==========================================
async function obterAdmin(req) {
    const admin = await User.findById(req.user.id).select("nome email")
    return admin
}

// ==========================================
// LISTAR USUÁRIOS COM BUSCA E FILTRO
// SOMENTE ADMIN
// ==========================================
router.get(
    "/usuarios",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const { busca, filtro } = req.query

            let query = {}

            // 🔥 BUSCA POR NOME, EMAIL OU CPF
            if (busca && busca.trim() !== "") {

                const termo = busca.trim()

                query.$or = [
                    { nome: { $regex: termo, $options: "i" } },
                    { email: { $regex: termo, $options: "i" } },
                    { cpf: { $regex: termo.replace(/\D/g, ""), $options: "i" } }
                ]
            }

            // 🔥 FILTROS
            if (filtro === "admins") {
                query.tipo = "admin"
                query.status = { $ne: "banido" }
            }

            if (filtro === "funcionarios") {
                query.tipo = "funcionario"
                query.status = { $ne: "banido" }
            }

            if (filtro === "usuarios") {
                query.tipo = "usuario"
                query.status = { $ne: "banido" }
            }

            if (filtro === "banidos") {
                query.status = "banido"
            }

            if (filtro === "suspensos") {
                query.status = "suspenso"
            }

            if (filtro === "removidos") {
                query.status = "removido"
            }

            const usuarios = await User.find(query)
                .select("-senha")
                .sort({ createdAt: -1 })

            res.json(usuarios)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// VER DADOS COMPLETOS DE UM USUÁRIO
// SEM MOSTRAR SENHA
// SOMENTE ADMIN
// ==========================================
router.get(
    "/usuarios/:id",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const usuario = await User.findById(req.params.id)
                .select("-senha")

            if (!usuario) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            res.json(usuario)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// ALTERAR TIPO DO USUÁRIO
// usuario | funcionario | admin
// SOMENTE ADMIN
// ==========================================
router.put(
    "/usuarios/:id/tipo",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            if (String(req.params.id) === String(req.user.id)) {
                return res.status(400).json({
                    erro: "Você não pode alterar sua própria permissão"
                })
            }

            const { tipo } = req.body

            const tiposPermitidos = [
                "usuario",
                "funcionario",
                "admin"
            ]

            if (!tiposPermitidos.includes(tipo)) {
                return res.status(400).json({
                    erro: "Tipo inválido"
                })
            }

            const usuario = await User.findById(req.params.id)

            if (!usuario) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            const tipoAnterior = usuario.tipo

            usuario.tipo = tipo

            await usuario.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Alterou permissão de usuário",
                alvo: usuario.email,
                detalhes: `${tipoAnterior} → ${tipo}`
            })

            res.json({
                msg: "Permissão alterada com sucesso",
                usuario
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// SUSPENDER USUÁRIO POR TEMPO DETERMINADO
// SOMENTE ADMIN
// ==========================================
router.put(
    "/usuarios/:id/suspender",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            if (String(req.params.id) === String(req.user.id)) {
                return res.status(400).json({
                    erro: "Você não pode suspender sua própria conta"
                })
            }

            const { quantidade, unidade } = req.body

            if (!quantidade || !unidade) {
                return res.status(400).json({
                    erro: "Informe quantidade e unidade"
                })
            }

            const unidadesPermitidas = [
                "horas",
                "dias",
                "meses"
            ]

            if (!unidadesPermitidas.includes(unidade)) {
                return res.status(400).json({
                    erro: "Unidade inválida"
                })
            }

            const usuario = await User.findById(req.params.id)

            if (!usuario) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            const agora = new Date()
            let suspensoAte = new Date()

            if (unidade === "horas") {
                suspensoAte.setHours(agora.getHours() + Number(quantidade))
            }

            if (unidade === "dias") {
                suspensoAte.setDate(agora.getDate() + Number(quantidade))
            }

            if (unidade === "meses") {
                suspensoAte.setMonth(agora.getMonth() + Number(quantidade))
            }

            usuario.status = "suspenso"
            usuario.suspensoAte = suspensoAte

            await usuario.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Suspendeu usuário",
                alvo: usuario.email,
                detalhes: `Suspenso por ${quantidade} ${unidade}. Até: ${suspensoAte.toLocaleString("pt-BR")}`
            })

            res.json({
                msg: "Usuário suspenso com sucesso",
                usuario
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// BANIR USUÁRIO
// SOMENTE ADMIN
// ==========================================
router.put(
    "/usuarios/:id/banir",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            if (String(req.params.id) === String(req.user.id)) {
                return res.status(400).json({
                    erro: "Você não pode banir sua própria conta"
                })
            }

            const usuario = await User.findById(req.params.id)

            if (!usuario) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            usuario.status = "banido"
            usuario.banidoEm = new Date()

            await usuario.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Baniu usuário",
                alvo: usuario.email,
                detalhes: "Conta banida pelo painel administrativo"
            })

            res.json({
                msg: "Usuário banido com sucesso",
                usuario
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// REMOVER USUÁRIO DA LISTA ATIVA
// NÃO APAGA DO BANCO, SÓ MARCA COMO REMOVIDO
// SOMENTE ADMIN
// ==========================================
router.put(
    "/usuarios/:id/remover",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            if (String(req.params.id) === String(req.user.id)) {
                return res.status(400).json({
                    erro: "Você não pode remover sua própria conta"
                })
            }

            const usuario = await User.findById(req.params.id)

            if (!usuario) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            usuario.status = "removido"
            usuario.removidoEm = new Date()

            await usuario.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Removeu usuário",
                alvo: usuario.email,
                detalhes: "Conta marcada como removida"
            })

            res.json({
                msg: "Usuário removido com sucesso",
                usuario
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// REATIVAR USUÁRIO
// REMOVE SUSPENSÃO, BANIMENTO OU REMOÇÃO
// SOMENTE ADMIN
// ==========================================
router.put(
    "/usuarios/:id/reativar",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const usuario = await User.findById(req.params.id)

            if (!usuario) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            const statusAnterior = usuario.status

            usuario.status = "ativo"
            usuario.suspensoAte = null
            usuario.banidoEm = null
            usuario.removidoEm = null

            await usuario.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Reativou usuário",
                alvo: usuario.email,
                detalhes: `${statusAnterior} → ativo`
            })

            res.json({
                msg: "Usuário reativado com sucesso",
                usuario
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// LISTAR LOGS
// SOMENTE ADMIN
// ==========================================
router.get(
    "/logs",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const logs = await Log.find()
                .sort({ data: -1 })
                .limit(150)

            res.json(logs)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

module.exports = router