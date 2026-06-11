const mongoose = require("mongoose")

const MedicoPlantaoSchema = new mongoose.Schema({
    nome: {
        type: String,
        default: ""
    },

    especialidade: {
        type: String,
        default: "Clínico Geral"
    }
}, {
    _id: false
})

const AtendimentoSchema = new mongoose.Schema({

    upa: {
        type: String,
        required: true
    },

    endereco: String,

    // Campos antigos mantidos para compatibilidade
    medico: String,
    especialidade: String,

    // Novo formato: vários médicos de plantão
    medicosPlantao: {
        type: [MedicoPlantaoSchema],
        default: []
    },

    tempo_espera: String,

    tempo_minutos: {
        type: Number,
        default: 0
    },

    status: {
        type: String,
        enum: ["normal", "lotado", "critico"],
        default: "normal"
    },

    foto: String,

    lat: Number,
    lng: Number,

    data: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
})

module.exports = mongoose.model("Atendimento", AtendimentoSchema)
