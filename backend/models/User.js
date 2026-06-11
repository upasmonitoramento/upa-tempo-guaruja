const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({

    nome: String,

    email: {
        type: String,
        unique: true
    },

    senha: String,

    cpf: {
        type: String,
        unique: true
    },

    foto: String,

    data_nascimento: Date,

    tipo: {
        type: String,
        default: "usuario" // usuario | funcionario | admin
    },

    // 🔥 CONTROLE ADMINISTRATIVO
    status: {
        type: String,
        default: "ativo" // ativo | suspenso | banido | removido
    },

    suspensoAte: Date,

    banidoEm: Date,

    removidoEm: Date

}, {
    timestamps: true
})

module.exports = mongoose.model("User", UserSchema)