const mongoose = require("mongoose")
let conexaoPendente
module.exports = async function conectarBanco() {
    if (mongoose.connection.readyState === 1) return mongoose
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI não configurada")
    if (!conexaoPendente) {
        conexaoPendente = mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: 5,
            autoIndex: false
        }).catch(erro => {
            conexaoPendente = null
            throw erro
        })
    }
    return conexaoPendente
}
