const jwt = require("jsonwebtoken")
const { isOwner } = require("../config/owner")
const User = require("../models/User")

module.exports = async (req, res, next) => {

    if (!process.env.JWT_SECRET) return res.status(503).json({ erro: "Autenticação indisponível." })

    const authorization = req.headers.authorization
    const token = typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, "") : null

    if (!token) {
        return res.status(401).json({
            erro: "Token não enviado"
        })
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        )

        if (!decoded.id || !/^[a-f\d]{24}$/i.test(String(decoded.id))) throw new Error("Invalid subject")
        let user
        try {
            user = await User.findById(decoded.id).select("tipo status suspensoAte +sessionVersion")
        } catch {
            return res.status(503).json({ erro: "Não foi possível validar sua sessão. Tente novamente." })
        }
        if (!user || Number(decoded.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
            return res.status(401).json({ erro: "Sessão encerrada. Entre novamente." })
        }
        const suspensionExpired = user.status === "suspenso" && user.suspensoAte && new Date(user.suspensoAte) <= new Date()
        if (user.status && user.status !== "ativo" && !suspensionExpired) {
            return res.status(403).json({ erro: "Conta bloqueada ou suspensa. Entre em contato com o suporte." })
        }
        decoded.tipo = isOwner(decoded.id) ? "admin" : user.tipo
        req.user = decoded

        next()

    } catch {

        return res.status(401).json({
            erro: "Token inválido"
        })
    }
}
