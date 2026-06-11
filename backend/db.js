const dns = require("dns")
const mongoose = require("mongoose")

// 🔥 Força o Node a usar DNS confiáveis para resolver o MongoDB Atlas
dns.setServers([
    "8.8.8.8",
    "1.1.1.1"
])

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB conectado 🚀")
    })
    .catch(err => {
        console.log("❌ Erro MongoDB:", err)
    })