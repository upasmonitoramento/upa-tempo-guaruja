require("dotenv").config()
require("./db")

const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const path = require("path")

const app = express()

// ==========================================
// SEGURANÇA BÁSICA
// ==========================================
app.use(cors())

app.use(helmet({
    crossOriginResourcePolicy: {
        policy: "cross-origin"
    }
}))

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: {
        erro: "Muitas requisições. Tente novamente em alguns minutos."
    }
})

app.use(limiter)

// ==========================================
// CONFIGURAÇÕES
// ==========================================
app.use(express.json())

// liberar acesso às imagens/vídeos da pasta uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// ==========================================
// ROTAS
// ==========================================
const authRoutes = require("./routes/auth")
app.use("/auth", authRoutes)

const atendimentoRoutes = require("./routes/atendimento")
app.use("/atendimento", atendimentoRoutes)

const adminRoutes = require("./routes/admin")
app.use("/admin", adminRoutes)

const patrocinadoresRoutes = require("./routes/patrocinadores")
app.use("/patrocinadores", patrocinadoresRoutes)

const anunciosRoutes = require("./routes/anuncios")
app.use("/anuncios", anunciosRoutes)

const areasAdsRoutes = require("./routes/areasAds")
app.use("/areas-ads", areasAdsRoutes)

// ==========================================
// ROTA TESTE
// ==========================================
app.get("/", (req, res) => {
    res.send("API rodando 🚀")
})

// ==========================================
// SUBIR SERVIDOR
// ==========================================
app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000")
})