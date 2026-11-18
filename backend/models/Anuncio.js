const mongoose = require("mongoose")

const AnuncioSchema = new mongoose.Schema({

    partnership: { type: mongoose.Schema.Types.ObjectId, ref: 'CommercialPartnership' },
    publicationRevision: Number,
    slot: String,
    cities: [String],
    storageKey: { type: String, select: false },
    thumbnailKey: { type: String, select: false },

    patrocinador: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patrocinador",
        required: true
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

    tipoMidia: {
        type: String,
        enum: ["imagem", "video"],
        required: true
    },

    midia: {
        type: String,
        required: true
    },

    linkDestino: String,

    tempoExibicaoSegundos: {
        type: Number,
        default: 6,
        min: 2
    },

    dataInicio: Date,

    dataFim: Date,

    status: {
        type: String,
        default: "ativo",
        enum: ["ativo", "pausado", "expirado", "removido"]
    },

    removidoEm: Date

}, {
    timestamps: true
})

AnuncioSchema.index({ partnership: 1, publicationRevision: 1, slot: 1 }, { unique: true, partialFilterExpression: { partnership: { $type: 'objectId' } } })
module.exports = mongoose.model("Anuncio", AnuncioSchema)
