const mongoose = require("mongoose")

const AreaAdsSchema = new mongoose.Schema({

    numero: {
        type: Number,
        required: true,
        unique: true
    },

    codigo: {
        type: String,
        required: true,
        unique: true
    },

    nome: {
        type: String,
        required: true
    },

    descricao: String,

    posicao: {
        type: String,
        enum: [
            "lateral_esquerda",
            "lateral_direita",
            "banner_inferior",
            "mobile",
            "rodape",
            "card",
            "detalhe"
        ],
        required: true
    },

    anuncioAtual: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Anuncio",
        default: null
    },

    anunciosAtuais: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Anuncio"
    }],

    rotacionar: {
        type: Boolean,
        default: true
    },

    tempoTrocaSegundos: {
        type: Number,
        default: 6
    },

    larguraPx: {
        type: Number,
        default: 240
    },

    alturaPx: {
        type: Number,
        default: 235
    },

    ordem: {
        type: Number,
        default: 1
    },

    status: {
        type: String,
        default: "ativo",
        enum: ["ativo", "inativo"]
    }

}, {
    timestamps: true
})

module.exports = mongoose.model("AreaAds", AreaAdsSchema)
