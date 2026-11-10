const fs = require('node:fs')
const path = require('node:path')

const root = fs.realpathSync(__dirname)
const frontend = path.join(root, '../frontend')
const web = path.join(root, 'web')
const output = path.join(root, 'public')
const currentOrigin = 'https://upa-tempo-guaruja.vercel.app'

function httpsURL(value, key, originOnly = false) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password ||
        (originOnly && url.href !== url.origin + '/')) {
        throw new Error(`${key} deve ser ${originOnly ? 'uma origem HTTPS sem caminho' : 'uma URL HTTPS'} sem credenciais.`)
    }
    return originOnly ? url.origin : url.href
}

const apiOrigin = httpsURL(process.env.MOBILE_API_ORIGIN || currentOrigin, 'MOBILE_API_ORIGIN', true)
const siteOrigin = httpsURL(process.env.MOBILE_SITE_ORIGIN || currentOrigin, 'MOBILE_SITE_ORIGIN', true)
const privacyUrl = process.env.MOBILE_PRIVACY_URL ? httpsURL(process.env.MOBILE_PRIVACY_URL, 'MOBILE_PRIVACY_URL') : null
const supportUrl = process.env.MOBILE_SUPPORT_URL ? httpsURL(process.env.MOBILE_SUPPORT_URL, 'MOBILE_SUPPORT_URL') : null
const release = process.env.MOBILE_RELEASE === '1'
if (release && (!privacyUrl || !supportUrl)) {
    throw new Error('Build de publicação requer MOBILE_PRIVACY_URL e MOBILE_SUPPORT_URL finalizadas e públicas.')
}

// Remove only this generated directory; the previous build included the entire site.
if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output) {
        throw new Error('Pasta de saída inesperada; não foi removida.')
    }
    fs.rmSync(output, { recursive: true })
}
fs.mkdirSync(path.join(output, 'images'), { recursive: true })
const units = JSON.parse(fs.readFileSync(path.join(frontend, 'images/units.json'), 'utf8'))
const directory = units.map(unit => ({
    id: unit.id,
    name: unit.name,
    photos: unit.variants.map(({ file, width }) => {
        if (!/^unit-[a-f\d]+-\d+\.webp$/i.test(file)) throw new Error('Arquivo de imagem inesperado.')
        fs.copyFileSync(path.join(frontend, 'images', file), path.join(output, 'images', file))
        return { src: 'images/' + file, width }
    })
}))
for (const file of ['app.css', 'app.js', 'directory.js']) {
    fs.copyFileSync(path.join(web, file), path.join(output, file))
}
fs.copyFileSync(path.join(frontend, 'app-icon-192-v3.png'), path.join(output, 'app-icon.png'))
const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8').replace('__API_ORIGIN__', apiOrigin)
fs.writeFileSync(path.join(output, 'index.html'), html)
fs.writeFileSync(path.join(output, 'config.js'), 'globalThis.SAUDE_CONFIG = ' +
    JSON.stringify({ apiOrigin, siteOrigin, privacyUrl, supportUrl, release, directory }) + '\n')
console.log(`Interface pública ${release ? 'com links de publicação' : 'para testes'} preparada em mobile/public.`)
