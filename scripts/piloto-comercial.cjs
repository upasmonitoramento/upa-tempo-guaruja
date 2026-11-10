const { randomBytes } = require("node:crypto")
const bcrypt = require("bcrypt")

const password = process.env.PILOTO_ADMIN_SENHA
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
const app = require("../backend/server")

async function main() {
    await connect()
    await User.updateOne({ email: "admin@piloto.example" }, { $set: {
        nome: "Administrador do piloto",
        senha: await bcrypt.hash(password, 10),
        cpf: "00000000000",
        tipo: "admin",
        status: "ativo"
    } }, { upsert: true })
    app.listen(3210, "127.0.0.1", () => {
        console.log("Piloto disponível em http://127.0.0.1:3210. Login: admin@piloto.example")
    }).on("error", () => {
        console.error("Não foi possível abrir a porta 3210.")
        process.exit(1)
    })
}

main().catch(() => {
    console.error("Não foi possível iniciar o piloto. Confira o MongoDB local na porta 27319.")
    process.exit(1)
})
