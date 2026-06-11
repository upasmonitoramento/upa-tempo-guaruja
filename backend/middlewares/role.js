module.exports = (...tiposPermitidos) => {

    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                erro: "Usuário não autenticado"
            })
        }

        if (!tiposPermitidos.includes(req.user.tipo)) {
            return res.status(403).json({
                erro: "Sem permissão"
            })
        }

        next()
    }
}