const mongoose = require("mongoose")

const LogSchema = new mongoose.Schema({

    usuarioId: String,

    usuarioNome: String,

    acao: String,

    alvo: String,

    detalhes: String,

    data: {
        type: Date,
        default: Date.now
    }

})

module.exports = mongoose.model("Log", LogSchema)