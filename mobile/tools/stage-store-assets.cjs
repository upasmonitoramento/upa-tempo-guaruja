const fs = require('node:fs')
const path = require('node:path')
const mobile = path.resolve(__dirname, '..')
const files = [
    ['release/google-play/icone-512.png', 'google-play/icone-512.png', 512, 512],
    ['release/google-play/arte-destaque-1024x500.png', 'google-play/arte-destaque-1024x500.png', 1024, 500],
    ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'app-store/icone-1024.png', 1024, 1024]
]
for (const [source, target, width, height] of files) {
    const data = fs.readFileSync(path.join(mobile, source))
    if (data.subarray(12,16).toString() !== 'IHDR' || data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== height) throw new Error('PNG com tamanho inesperado: ' + source)
    const output = path.join(mobile, 'release/out', target)
    fs.mkdirSync(path.dirname(output), {recursive:true})
    fs.writeFileSync(output, data)
}
console.log('Artes separadas em mobile/release/out/google-play e app-store.')
