const fs = require("node:fs")
const path = require("node:path")

const raiz = path.join(__dirname, "..")
fs.cpSync(path.join(raiz, "frontend"), path.join(raiz, "public"), { recursive: true })
console.log("Frontend preparado em public/")
