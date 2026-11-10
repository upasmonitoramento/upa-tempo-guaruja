const fs = require('node:fs')
const path = require('node:path')
const configPath = process.argv[2]
if (!configPath) throw new Error('Uso: node prepare.cjs caminho-do-config-revisado.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const fields = Object.keys(require('./config.example.json')).filter(key => key !== 'revisaoConcluida')
const missing = fields.filter(key => typeof config[key] !== 'string' || !config[key].trim())
if (missing.length || config.revisaoConcluida !== true) throw new Error('Preencher e revisar antes de gerar páginas públicas. Campos pendentes: ' + missing.join(', '))
for (const key of ['contatoPrivacidade', 'contatoSuporte']) {
    if (!/^[a-z0-9.!#$%&'*+\-=_~^]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(config[key])) throw new Error('E-mail inválido: ' + key)
}
const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]))
const pages = ['privacidade-app', 'suporte-app'].map(name => ({
    name,
    html: fs.readFileSync(path.join(__dirname, name + '.template.html'), 'utf8')
        .replace(/\{\{(\w+)\}\}/g, (_, key) => {
            if (!fields.includes(key)) throw new Error('Campo inesperado: ' + key)
            return escape(config[key].trim())
        })
}))
const dest = path.resolve(__dirname, '../out/site')
fs.mkdirSync(dest, {recursive:true})
for (const page of pages) fs.writeFileSync(path.join(dest, page.name + '.html'), page.html)
console.log('Páginas geradas em ' + dest + '. Revise a saída antes de publicar.')
