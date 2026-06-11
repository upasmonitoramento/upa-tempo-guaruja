const express = require("express")
const router = express.Router()

const User = require("../models/User")

const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

const auth = require("../middlewares/auth")
const { uploadFotoPerfil } = require("../middlewares/uploadSeguro")

// ==========================================
// VALIDAR SENHA
// ==========================================
function senhaValida(senha) {
    return senha && senha.trim().length >= 8
}

// ==========================================
// VALIDAR EMAIL
// ==========================================
function emailValido(email) {

    if (!email) return false

    const emailLimpo = String(email).trim().toLowerCase()

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

    return regex.test(emailLimpo)
}

// ==========================================
// VALIDAR CPF REAL
// ==========================================
function cpfValido(cpf) {

    cpf = String(cpf).replace(/\D/g, "")

    if (cpf.length !== 11) return false

    // bloqueia CPFs repetidos: 00000000000, 11111111111 etc.
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

// ==========================================
// REGISTRO
// ==========================================
router.post("/register", async (req, res) => {

    try {

        const { nome, email, senha, cpf } = req.body

        if (!nome || !email || !senha || !cpf) {
            return res.status(400).json({
                erro: "Preencha todos os campos"
            })
        }

        const emailLimpo = String(email).trim().toLowerCase()
        const cpfLimpo = String(cpf).replace(/\D/g, "")

        if (!emailValido(emailLimpo)) {
            return res.status(400).json({
                erro: "Informe um email válido"
            })
        }

        if (!cpfValido(cpfLimpo)) {
            return res.status(400).json({
                erro: "Informe um CPF válido"
            })
        }

        if (!senhaValida(senha)) {
            return res.status(400).json({
                erro: "A senha precisa ter no mínimo 8 caracteres"
            })
        }

        const emailExiste = await User.findOne({
            email: emailLimpo
        })

        if (emailExiste) {
            return res.status(400).json({
                erro: "Email já cadastrado"
            })
        }

        const cpfExiste = await User.findOne({
            cpf: cpfLimpo
        })

        if (cpfExiste) {
            return res.status(400).json({
                erro: "CPF já cadastrado"
            })
        }

        const senhaHash = await bcrypt.hash(senha, 10)

        const user = new User({
            nome: nome.trim(),
            email: emailLimpo,
            senha: senhaHash,
            cpf: cpfLimpo,
            tipo: "usuario",
            status: "ativo"
        })

        await user.save()

        res.json({
            msg: "Usuário criado com sucesso"
        })

    } catch (err) {

        res.status(500).json({
            erro: err.message
        })

    }

})

// ==========================================
// LOGIN
// ==========================================
router.post("/login", async (req, res) => {

    try {

        const { email, senha } = req.body

        if (!email || !senha) {
            return res.status(400).json({
                erro: "Informe email e senha"
            })
        }

        const emailLimpo = String(email).trim().toLowerCase()

        if (!emailValido(emailLimpo)) {
            return res.status(400).json({
                erro: "Informe um email válido"
            })
        }

        const user = await User.findOne({
            email: emailLimpo
        })

        if (!user) {
            return res.status(400).json({
                erro: "Usuário não encontrado"
            })
        }

        if (!user.status) {
            user.status = "ativo"
            await user.save()
        }

        if (user.status === "banido" || user.status === "removido") {
            return res.status(403).json({
                erro: "Conta bloqueada. Entre em contato com o suporte."
            })
        }

        if (user.status === "suspenso") {

            if (user.suspensoAte && new Date(user.suspensoAte) > new Date()) {
                return res.status(403).json({
                    erro: `Conta suspensa até ${new Date(user.suspensoAte).toLocaleString("pt-BR")}`
                })
            }

            user.status = "ativo"
            user.suspensoAte = null
            await user.save()
        }

        const senhaValidaBanco = await bcrypt.compare(senha, user.senha)

        if (!senhaValidaBanco) {
            return res.status(400).json({
                erro: "Senha inválida"
            })
        }

        const token = jwt.sign(
            {
                id: user._id,
                tipo: user.tipo
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        )

        res.json({

            token,

            user: {
                id: user._id,
                nome: user.nome,
                email: user.email,
                cpf: user.cpf,
                tipo: user.tipo,
                foto: user.foto,
                status: user.status,
                suspensoAte: user.suspensoAte
            }

        })

    } catch (err) {

        res.status(500).json({
            erro: err.message
        })

    }

})

// ==========================================
// PEGAR PERFIL DO USUÁRIO LOGADO
// ==========================================
router.get("/perfil", auth, async (req, res) => {

    try {

        const user = await User.findById(req.user.id).select("-senha")

        if (!user) {
            return res.status(404).json({
                erro: "Usuário não encontrado"
            })
        }

        res.json(user)

    } catch (err) {

        res.status(500).json({
            erro: err.message
        })

    }

})

// ==========================================
// ATUALIZAR PERFIL
// SOMENTE SENHA E FOTO PODEM SER ALTERADAS
// ==========================================
router.put(
    "/perfil",
    auth,
    uploadFotoPerfil,
    async (req, res) => {

        try {

            const user = await User.findById(req.user.id)

            if (!user) {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            if (user.status === "banido" || user.status === "removido") {
                return res.status(403).json({
                    erro: "Conta bloqueada. Entre em contato com o suporte."
                })
            }

            if (user.status === "suspenso") {

                if (user.suspensoAte && new Date(user.suspensoAte) > new Date()) {
                    return res.status(403).json({
                        erro: `Conta suspensa até ${new Date(user.suspensoAte).toLocaleString("pt-BR")}`
                    })
                }

                user.status = "ativo"
                user.suspensoAte = null
                await user.save()
            }

            if (req.body.senha && req.body.senha.trim() !== "") {

                if (!senhaValida(req.body.senha)) {
                    return res.status(400).json({
                        erro: "A nova senha precisa ter no mínimo 8 caracteres"
                    })
                }

                const senhaHash = await bcrypt.hash(req.body.senha, 10)

                user.senha = senhaHash
            }

            if (req.file) {
                user.foto = req.file.filename
            }

            await user.save()

            res.json({
                msg: "Perfil atualizado",
                user: {
                    id: user._id,
                    nome: user.nome,
                    email: user.email,
                    cpf: user.cpf,
                    tipo: user.tipo,
                    foto: user.foto,
                    status: user.status,
                    suspensoAte: user.suspensoAte
                }
            })

        } catch (err) {

            res.status(500).json({
                erro: err.message
            })

        }

    }
)

// ==========================================
// REDEFINIR SENHA
// email + cpf + nova senha
// ==========================================
router.post("/redefinir-senha", async (req, res) => {

    try {

        const { email, cpf, novaSenha } = req.body

        if (!email || !cpf || !novaSenha) {
            return res.status(400).json({
                erro: "Informe email, CPF e nova senha"
            })
        }

        const emailLimpo = String(email).trim().toLowerCase()
        const cpfLimpo = String(cpf).replace(/\D/g, "")

        if (!emailValido(emailLimpo)) {
            return res.status(400).json({
                erro: "Informe um email válido"
            })
        }

        if (!cpfValido(cpfLimpo)) {
            return res.status(400).json({
                erro: "Informe um CPF válido"
            })
        }

        if (!senhaValida(novaSenha)) {
            return res.status(400).json({
                erro: "A nova senha precisa ter no mínimo 8 caracteres"
            })
        }

        const user = await User.findOne({
            email: emailLimpo,
            cpf: cpfLimpo
        })

        if (!user) {
            return res.status(404).json({
                erro: "Dados não encontrados"
            })
        }

        if (user.status === "banido" || user.status === "removido") {
            return res.status(403).json({
                erro: "Conta bloqueada. Entre em contato com o suporte."
            })
        }

        if (user.status === "suspenso") {

            if (user.suspensoAte && new Date(user.suspensoAte) > new Date()) {
                return res.status(403).json({
                    erro: `Conta suspensa até ${new Date(user.suspensoAte).toLocaleString("pt-BR")}`
                })
            }

            user.status = "ativo"
            user.suspensoAte = null
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10)

        user.senha = senhaHash

        await user.save()

        res.json({
            msg: "Senha redefinida com sucesso"
        })

    } catch (err) {

        res.status(500).json({
            erro: err.message
        })

    }

})

module.exports = router