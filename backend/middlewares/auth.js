const jwt = require("jsonwebtoken")

module.exports = (req, res, next) => {

    const token = req.headers.authorization

    if (!token) {
        return res.status(401).json({
            erro: "Token não enviado"
        })
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "SEGREDO"
        )

        req.user = decoded

        next()

    } catch {

        return res.status(401).json({
            erro: "Token inválido"
        })
    }
}