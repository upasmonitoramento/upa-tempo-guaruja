const express = require("express")
const router = express.Router()

const Patrocinador = require("../models/Patrocinador")
const Log = require("../models/Log")
const User = require("../models/User")

const auth = require("../middlewares/auth")
const verificarTipo = require("../middlewares/role")

const { uploadLogoPatrocinador } = require("../middlewares/uploadSeguro")

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
async function obterAdmin(req) {
    const admin = await User.findById(req.user.id).select("nome email")
    return admin
}

function somenteNumeros(valor) {
    return String(valor || "").replace(/\D/g, "")
}

function emailValido(email) {

    if (!email) return false

    const emailLimpo = String(email).trim().toLowerCase()

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    return regex.test(emailLimpo)
}

function cpfValido(cpf) {

    cpf = somenteNumeros(cpf)

    if (cpf.length !== 11) return false

    if (/^(\d)\1+$/.test(cpf)) return false

    let soma = 0
    let resto

    for (let i = 1; i <= 9; i++) {
        soma += parseInt(cpf.substring(i - 1, i)) * (11 - i)
    }

    resto = (soma * 10) % 11

    if (resto === 10 || resto === 11) resto = 0

    if (resto !== parseInt(cpf.substring(9, 10))) return false

    soma = 0

    for (let i = 1; i <= 10; i++) {
        soma += parseInt(cpf.substring(i - 1, i)) * (12 - i)
    }

    resto = (soma * 10) % 11

    if (resto === 10 || resto === 11) resto = 0

    if (resto !== parseInt(cpf.substring(10, 11))) return false

    return true
}

function cnpjValido(cnpj) {

    cnpj = somenteNumeros(cnpj)

    if (cnpj.length !== 14) return false

    if (/^(\d)\1+$/.test(cnpj)) return false

    let tamanho = cnpj.length - 2
    let numeros = cnpj.substring(0, tamanho)
    let digitos = cnpj.substring(tamanho)
    let soma = 0
    let pos = tamanho - 7

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--
        if (pos < 2) pos = 9
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11

    if (resultado !== Number(digitos.charAt(0))) return false

    tamanho = tamanho + 1
    numeros = cnpj.substring(0, tamanho)
    soma = 0
    pos = tamanho - 7

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--
        if (pos < 2) pos = 9
    }

    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11

    if (resultado !== Number(digitos.charAt(1))) return false

    return true
}

function validarDocumento(tipo, documento) {

    if (tipo === "cpf") {
        return cpfValido(documento)
    }

    if (tipo === "cnpj") {
        return cnpjValido(documento)
    }

    return false
}

// ==========================================
// LISTAR PATROCINADORES
// GET /patrocinadores?busca=&status=
// SOMENTE ADMIN
// ==========================================
router.get(
    "/",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const { busca, status } = req.query

            let query = {}

            if (busca && busca.trim() !== "") {

                const termo = busca.trim()
                const numeros = somenteNumeros(termo)

                query.$or = [
                    { responsavelNome: { $regex: termo, $options: "i" } },
                    { empresaNome: { $regex: termo, $options: "i" } },
                    { email: { $regex: termo, $options: "i" } },
                    { documentoResponsavel: { $regex: numeros, $options: "i" } },
                    { empresaCnpj: { $regex: numeros, $options: "i" } },
                    { segmento: { $regex: termo, $options: "i" } }
                ]
            }

            if (status === "ativo" || status === "inativo") {
                query.status = status
            }

            const patrocinadores = await Patrocinador.find(query)
                .sort({ createdAt: -1 })

            res.json(patrocinadores)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// VER UM PATROCINADOR
// SOMENTE ADMIN
// ==========================================
router.get(
    "/:id",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const patrocinador = await Patrocinador.findById(req.params.id)

            if (!patrocinador) {
                return res.status(404).json({
                    erro: "Patrocinador não encontrado"
                })
            }

            res.json(patrocinador)

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// CADASTRAR PATROCINADOR
// SOMENTE ADMIN
// ==========================================
router.post(
    "/",
    auth,
    verificarTipo("admin"),
    uploadLogoPatrocinador,
    async (req, res) => {

        try {

            const {
                responsavelNome,
                tipoDocumentoResponsavel,
                documentoResponsavel,
                email,
                telefone,
                dataNascimento,
                empresaNome,
                empresaCnpj,
                segmento,
                observacoes
            } = req.body

            if (!responsavelNome || !tipoDocumentoResponsavel || !documentoResponsavel || !email || !empresaNome) {
                return res.status(400).json({
                    erro: "Preencha responsável, documento, email e nome da empresa"
                })
            }

            const emailLimpo = String(email).trim().toLowerCase()
            const documentoLimpo = somenteNumeros(documentoResponsavel)
            const empresaCnpjLimpo = somenteNumeros(empresaCnpj)

            if (!emailValido(emailLimpo)) {
                return res.status(400).json({
                    erro: "Informe um email válido"
                })
            }

            if (!validarDocumento(tipoDocumentoResponsavel, documentoLimpo)) {
                return res.status(400).json({
                    erro: "Documento do responsável inválido"
                })
            }

            if (empresaCnpjLimpo && !cnpjValido(empresaCnpjLimpo)) {
                return res.status(400).json({
                    erro: "CNPJ da empresa inválido"
                })
            }

            const documentoExiste = await Patrocinador.findOne({
                documentoResponsavel: documentoLimpo
            })

            if (documentoExiste) {
                return res.status(400).json({
                    erro: "Já existe patrocinador com esse CPF/CNPJ do responsável"
                })
            }

            const patrocinador = new Patrocinador({
                responsavelNome: responsavelNome.trim(),
                tipoDocumentoResponsavel,
                documentoResponsavel: documentoLimpo,
                email: emailLimpo,
                telefone,
                dataNascimento: dataNascimento || null,
                empresaNome: empresaNome.trim(),
                empresaCnpj: empresaCnpjLimpo || null,
                segmento,
                observacoes,
                logo: req.file ? req.file.filename : null,
                status: "ativo"
            })

            await patrocinador.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Cadastrou patrocinador",
                alvo: patrocinador.empresaNome,
                detalhes: `Responsável: ${patrocinador.responsavelNome} | Email: ${patrocinador.email}`
            })

            res.json({
                msg: "Patrocinador cadastrado com sucesso",
                patrocinador
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// EDITAR PATROCINADOR
// SOMENTE ADMIN
// ==========================================
router.put(
    "/:id",
    auth,
    verificarTipo("admin"),
    uploadLogoPatrocinador,
    async (req, res) => {

        try {

            const patrocinador = await Patrocinador.findById(req.params.id)

            if (!patrocinador) {
                return res.status(404).json({
                    erro: "Patrocinador não encontrado"
                })
            }

            const antes = {
                responsavelNome: patrocinador.responsavelNome,
                email: patrocinador.email,
                telefone: patrocinador.telefone,
                empresaNome: patrocinador.empresaNome,
                empresaCnpj: patrocinador.empresaCnpj,
                segmento: patrocinador.segmento,
                status: patrocinador.status,
                logo: patrocinador.logo
            }

            const {
                responsavelNome,
                tipoDocumentoResponsavel,
                documentoResponsavel,
                email,
                telefone,
                dataNascimento,
                empresaNome,
                empresaCnpj,
                segmento,
                observacoes,
                status
            } = req.body

            if (email && !emailValido(email)) {
                return res.status(400).json({
                    erro: "Informe um email válido"
                })
            }

            if (tipoDocumentoResponsavel && documentoResponsavel) {

                const docLimpo = somenteNumeros(documentoResponsavel)

                if (!validarDocumento(tipoDocumentoResponsavel, docLimpo)) {
                    return res.status(400).json({
                        erro: "Documento do responsável inválido"
                    })
                }

                patrocinador.tipoDocumentoResponsavel = tipoDocumentoResponsavel
                patrocinador.documentoResponsavel = docLimpo
            }

            const empresaCnpjLimpo = somenteNumeros(empresaCnpj)

            if (empresaCnpjLimpo && !cnpjValido(empresaCnpjLimpo)) {
                return res.status(400).json({
                    erro: "CNPJ da empresa inválido"
                })
            }

            if (responsavelNome) patrocinador.responsavelNome = responsavelNome.trim()
            if (email) patrocinador.email = String(email).trim().toLowerCase()
            if (telefone !== undefined) patrocinador.telefone = telefone
            if (dataNascimento !== undefined) patrocinador.dataNascimento = dataNascimento || null
            if (empresaNome) patrocinador.empresaNome = empresaNome.trim()
            if (empresaCnpj !== undefined) patrocinador.empresaCnpj = empresaCnpjLimpo || null
            if (segmento !== undefined) patrocinador.segmento = segmento
            if (observacoes !== undefined) patrocinador.observacoes = observacoes

            if (status === "ativo" || status === "inativo") {
                patrocinador.status = status
            }

            if (req.file) {
                patrocinador.logo = req.file.filename
            }

            await patrocinador.save()

            const depois = {
                responsavelNome: patrocinador.responsavelNome,
                email: patrocinador.email,
                telefone: patrocinador.telefone,
                empresaNome: patrocinador.empresaNome,
                empresaCnpj: patrocinador.empresaCnpj,
                segmento: patrocinador.segmento,
                status: patrocinador.status,
                logo: patrocinador.logo
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
                acao: "Editou patrocinador",
                alvo: patrocinador.empresaNome,
                detalhes: alteracoes.length > 0 ? alteracoes.join(" | ") : "Nenhuma alteração relevante"
            })

            res.json({
                msg: "Patrocinador atualizado com sucesso",
                patrocinador
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// ATIVAR / INATIVAR PATROCINADOR
// SOMENTE ADMIN
// ==========================================
router.put(
    "/:id/status",
    auth,
    verificarTipo("admin"),
    async (req, res) => {

        try {

            const { status } = req.body

            if (status !== "ativo" && status !== "inativo") {
                return res.status(400).json({
                    erro: "Status inválido"
                })
            }

            const patrocinador = await Patrocinador.findById(req.params.id)

            if (!patrocinador) {
                return res.status(404).json({
                    erro: "Patrocinador não encontrado"
                })
            }

            const statusAnterior = patrocinador.status

            patrocinador.status = status

            await patrocinador.save()

            const admin = await obterAdmin(req)

            await Log.create({
                usuarioId: req.user.id,
                usuarioNome: admin ? admin.nome : "Admin",
                acao: "Alterou status do patrocinador",
                alvo: patrocinador.empresaNome,
                detalhes: `${statusAnterior} → ${status}`
            })

            res.json({
                msg: "Status atualizado com sucesso",
                patrocinador
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

module.exports = router