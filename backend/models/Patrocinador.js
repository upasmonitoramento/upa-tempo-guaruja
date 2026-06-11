const mongoose = require("mongoose")

const PatrocinadorSchema = new mongoose.Schema({

    // ==========================================
    // DADOS DO RESPONSÁVEL
    // ==========================================
    responsavelNome: {
        type: String,
        required: true
    },

    documentoResponsavel: {
        type: String,
        required: true
    },

    tipoDocumentoResponsavel: {
        type: String,
        enum: ["cpf", "cnpj"],
        required: true
    },

    email: {
        type: String,
        required: true
    },

    telefone: String,

    dataNascimento: Date,

    // ==========================================
    // DADOS DA EMPRESA
    // ==========================================
    empresaNome: {
        type: String,
        required: true
    },

    empresaCnpj: String,

    segmento: String,

    logo: String,

    observacoes: String,

    // ==========================================
    // STATUS
    // ==========================================
    status: {
        type: String,
        default: "ativo", // ativo | inativo
        enum: ["ativo", "inativo"]
    }

}, {
    timestamps: true
})

module.exports = mongoose.model("Patrocinador", PatrocinadorSchema)