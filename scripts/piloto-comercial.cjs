const { randomBytes } = require("node:crypto")
const bcrypt = require("bcrypt")

const password = process.env.PILOTO_ADMIN_SENHA
const checkAsaas = process.argv.includes("--asaas")
const port = checkAsaas ? 3211 : 3210
if (!password || password.length < 12) {
    console.error("Defina PILOTO_ADMIN_SENHA com pelo menos 12 caracteres.")
    process.exit(1)
}
process.env.PORTAL_COMERCIAL_LOCAL = "1"
process.env.PORTAL_COMERCIAL_TESTE = "1"
process.env.MONGO_URI = "mongodb://127.0.0.1:27319/portal_saude_piloto"
process.env.JWT_SECRET = randomBytes(32).toString("hex")
for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]) {
    delete process.env[name]
}

const connect = require("../backend/db")
const User = require("../backend/models/User")
const Atendimento = require("../backend/models/atendimento")
const units = require("../frontend/images/units.json")
const app = require("../backend/server")

async function main() {
    if (checkAsaas) {
        const key = process.env.ASAAS_SANDBOX_API_KEY
        if (!key) throw new Error("Informe a chave do Asaas Sandbox.")
        const response = await fetch("https://api-sandbox.asaas.com/v3/payments?limit=1", {
            headers: { access_token: key, "User-Agent": "PortalSaude/1.0" },
            signal: AbortSignal.timeout(10000)
        }).catch(() => null)
        if (!response) throw new Error("Nao foi possivel acessar o Asaas Sandbox.")
        if (!response.ok) throw new Error(`Asaas Sandbox recusou a consulta (HTTP ${response.status}).`)
        console.log("Chave do Asaas Sandbox validada.")
    }
    const mongoose = await connect()
    await mongoose.connection.collection(Atendimento.collection.name).bulkWrite(units.map(unit => ({
        updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(unit.id) },
            update: { $setOnInsert: { upa: unit.name, foto: unit.originalURL,
                tempo_minutos: 20, tempo_espera: "20 min", status: "normal", data: new Date() } },
            upsert: true
        }
    })))
    await User.updateOne({ email: "admin@piloto.example" }, { $set: {
        nome: "Administrador do piloto",
        senha: await bcrypt.hash(password, 10),
        cpf: "00000000000",
        tipo: "admin",
        status: "ativo"
    } }, { upsert: true })
    app.listen(port, "127.0.0.1", () => {
        console.log(`Piloto disponível em http://127.0.0.1:${port}. Login: admin@piloto.example`)
    }).on("error", () => {
        console.error(`Não foi possível abrir a porta ${port}.`)
        process.exit(1)
    })
}

main().catch(error => {
    console.error(error.message.startsWith("Asaas Sandbox") || error.message.includes("chave do Asaas") || error.message === "Nao foi possivel acessar o Asaas Sandbox."
        ? error.message
        : "Não foi possível iniciar o piloto. Confira o MongoDB local na porta 27319.")
    process.exit(1)
})
