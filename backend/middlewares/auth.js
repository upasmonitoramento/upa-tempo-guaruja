const jwt = require("jsonwebtoken")
const { isOwner } = require("../config/owner")

module.exports = (req, res, next) => {

    if (!process.env.JWT_SECRET) return res.status(503).json({ erro: "Autenticação indisponível." })

    const token = req.headers.authorization

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

        if (isOwner(decoded.id)) decoded.tipo = "admin"
        req.user = decoded

        next()

    } catch {

        return res.status(401).json({
            erro: "Token inválido"
        })
    }
}
