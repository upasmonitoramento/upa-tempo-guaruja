const bcrypt = require("bcrypt")
const mongoose = require("mongoose")
const User = require("../backend/models/User")
const Atendimento = require("../backend/models/atendimento")
const units = require("../frontend/images/units.json")

async function main() {
    const uri = process.env.PILOTO_MONGO_URI
    const password = process.env.PILOTO_ADMIN_SENHA
    if (!uri || !password || password.length < 16) {
        throw new Error("Informe o banco e uma senha exclusiva de pelo menos 16 caracteres.")
    }
    const { pathname } = new URL(uri)
    if (pathname !== "/portal_saude_piloto") {
        throw new Error("A URI deve apontar para o banco portal_saude_piloto.")
    }
    await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 })
    await mongoose.connection.collection(Atendimento.collection.name).bulkWrite(units.map(unit => ({
        updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(unit.id) },
            update: { $setOnInsert: {
                upa: unit.name, foto: unit.originalURL, tempo_minutos: 20, tempo_espera: "20 min",
                status: "normal", data: new Date("2026-03-19T15:06:00Z")
            } },
            upsert: true
        }
    })))
    await mongoose.connection.collection(User.collection.name).updateOne({ email: "admin@piloto.example" }, { $setOnInsert: {
        nome: "Administrador do piloto", senha: await bcrypt.hash(password, 12),
        cpf: "00000000000", tipo: "admin", status: "ativo"
    } }, { upsert: true })
    console.log("Banco piloto preparado. Login: admin@piloto.example")
}

main().catch(error => {
    console.error(error.name === "MongoServerError" ? "MongoDB recusou a operação no banco piloto." :
        "Falha ao preparar o piloto. Confira a URI, a senha e o acesso ao banco.")
    process.exitCode = 1
}).finally(() => mongoose.disconnect())
