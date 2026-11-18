const express = require("express")
const router = express.Router()

const User = require("../models/User")

const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const crypto = require("node:crypto")
const rateLimit = require("express-rate-limit")
const PasswordReset = require("../models/PasswordReset")
const recoveryEmail = require("../config/recoveryEmail")
const recoveryLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } })
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

const auth = require("../middlewares/auth")
const { uploadFotoPerfil } = require("../middlewares/uploadSeguro")

// ==========================================
// VALIDAR SENHA
// ==========================================
function senhaValida(senha) {
    return typeof senha === 'string' && senha.trim().length >= 8 && Buffer.byteLength(senha, 'utf8') <= 72
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

        if (typeof nome !== 'string' || typeof email !== 'string' || typeof senha !== 'string' || typeof cpf !== 'string' || !nome.trim() || nome.length > 160 || !email || !senha || !cpf) {
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
router.post("/login", recoveryLimit, async (req, res) => {

    try {

        const { email, senha } = req.body

        if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha || Buffer.byteLength(senha, 'utf8') > 72) {
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
        }).select('+sessionVersion')

        if (!user) {
            return res.status(400).json({
                erro: "Email ou senha inválidos"
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
                erro: "Email ou senha inválidos"
            })
        }

        const token = jwt.sign(
            {
                id: user._id,
                tipo: user.tipo,
                sessionVersion: user.sessionVersion || 0
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

            const user = await User.findById(req.user.id).select('+sessionVersion')

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
                user.sessionVersion = Number(user.sessionVersion || 0) + 1
            }

            if (req.file) {
                user.foto = req.file.filename
            }

            await user.save()

            if (req.body.senha) await PasswordReset.deleteOne({ _id: user._id })

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
// Somente um código aleatório, de uso único, enviado ao email cadastrado.
// ==========================================
router.post('/solicitar-redefinicao', recoveryLimit, async (req, res) => {
    if (!recoveryEmail.configured()) return res.status(503).json({ erro: 'A recuperação por email ainda não está disponível. Entre em contato com o suporte.' })
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    if (!emailValido(email)) return res.status(400).json({ erro: 'Informe um email válido.' })
    const message = { msg: 'Se existir uma conta ativa com esse email, enviaremos um código. Confira também o spam.' }
    try {
        const user = await User.findOne({ email, $or: [{ status: 'ativo' }, { status: { $exists: false } }] })
        if (!user) return res.json(message)
        const now = new Date()
        const token = crypto.randomBytes(32).toString('hex')
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
        let reset
        try {
            reset = await PasswordReset.findOneAndUpdate({ _id: user._id, issuedAt: { $lte: new Date(+now - 60000) } },
                { $set: { tokenHash, issuedAt: now, expiresAt: new Date(+now + 20 * 60000) } }, { upsert: true, new: true })
        } catch (error) {
            if (error.code === 11000) return res.json(message)
            throw error
        }
        try { await recoveryEmail.sendRecovery(email, token) }
        catch (error) {
            await PasswordReset.deleteOne({ _id: reset._id, tokenHash })
            throw error
        }
        return res.json(message)
    } catch (error) {
        console.error('Recuperação de senha indisponível:', error.name)
        return res.status(503).json({ erro: 'Não foi possível enviar o email. Tente novamente mais tarde.' })
    }
})

router.post("/redefinir-senha", recoveryLimit, async (req, res) => {

    try {

        const { token, novaSenha } = req.body

        if (typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token)) {
            return res.status(400).json({
                erro: "Solicite e informe o código enviado ao seu email."
            })
        }

        if (!senhaValida(novaSenha)) {
            return res.status(400).json({
                erro: "A nova senha precisa ter no mínimo 8 caracteres"
            })
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
        const reset = await PasswordReset.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } })
        const user = reset ? await User.findById(reset._id).select('+sessionVersion') : null

        if (!user) {
            return res.status(400).json({
                erro: "Código inválido ou expirado. Solicite um novo código."
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
        user.sessionVersion = Number(user.sessionVersion || 0) + 1

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
