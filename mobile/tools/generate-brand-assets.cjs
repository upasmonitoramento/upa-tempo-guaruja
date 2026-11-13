// Deterministic vector-to-raster export. Requires sharp (available in the bundled runtime).
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const root = path.resolve(__dirname, '../..')
const source = fs.readFileSync(path.join(root, 'frontend/brand-symbol.svg'), 'utf8')
const blue = '#1554B5'
const marker = source.slice(source.indexOf('<path'), source.lastIndexOf('</svg>'))
const adaptiveSource = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${blue}"/><g transform="translate(256 256) scale(.88) translate(-256 -256)">${marker}</g></svg>`
const roundSource = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><clipPath id="circle"><circle cx="256" cy="256" r="256"/></clipPath></defs><g clip-path="url(#circle)"><rect width="512" height="512" fill="${blue}"/>${marker}</g></svg>`
async function png(relative, size, svg = source) {
    const destination = path.join(root, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    await sharp(Buffer.from(svg), { density: 300 }).resize(size, size, { kernel: 'lanczos3' }).png({ palette: true, colours: 128, effort: 10 }).toFile(destination)
}
async function main() {
    const web = {
        'app-icon-192-v3.png':192, 'app-icon-512-v3.png':512,
        'app-icon-maskable-512-v3.png':512, 'apple-touch-icon-v3.png':180,
        'favicon-16.png':16, 'favicon-32.png':32, 'apple-touch-icon.png':180,
        'icon-192.png':192, 'icon-192-v2.png':192, 'icon-512.png':512,
        'icon-512-v2.png':512, 'icon-maskable-512.png':512, 'logo-saude.png':512
    }
    for (const [name, size] of Object.entries(web)) await png('frontend/' + name, size)
    // PNG-compressed ICO supports modern Windows/browser consumers without an additional dependency.
    const iconBuffers = await Promise.all([16,32,48].map(size => sharp(Buffer.from(source)).resize(size,size).png().toBuffer()))
    const head = Buffer.alloc(6 + 16 * iconBuffers.length)
    head.writeUInt16LE(1,2); head.writeUInt16LE(iconBuffers.length,4)
    let offset = head.length
    iconBuffers.forEach((buffer, index) => {
        const base = 6 + 16 * index, size = [16,32,48][index]
        head[base] = size; head[base+1] = size
        head.writeUInt16LE(1,base+4); head.writeUInt16LE(32,base+6)
        head.writeUInt32LE(buffer.length,base+8); head.writeUInt32LE(offset,base+12)
        offset += buffer.length
    })
    fs.writeFileSync(path.join(root,'frontend/favicon.ico'),Buffer.concat([head,...iconBuffers]))
    for (const [density, size, adaptive] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]) {
        const dir = `mobile/android/app/src/main/res/mipmap-${density}`
        await png(`${dir}/ic_launcher.png`,size)
        await png(`${dir}/ic_launcher_round.png`,size,roundSource)
        // Full-bleed blue keeps the adaptive icon's mask corners consistent with its background.
        await png(`${dir}/ic_launcher_foreground.png`,adaptive,adaptiveSource)
    }
    const background = path.join(root,'mobile/android/app/src/main/res/values/ic_launcher_background.xml')
    fs.writeFileSync(background,`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${blue}</color>\n</resources>\n`)
    for (const file of ['mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png','mobile/release/app-store/artes/icone-1024.png']) await png(file,1024)
    await png('mobile/release/google-play/icone-512.png',512)
    console.log('Generated web, PWA, Android, iOS and store icon assets from brand-symbol.svg.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
