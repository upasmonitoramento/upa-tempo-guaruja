// iOS static launch bridge. The animated wordmark itself lives in frontend/entry.css.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const root = path.resolve(__dirname, '../..')
async function main() {
    const mark = fs.readFileSync(path.join(root,'frontend/brand-mark.svg'),'utf8')
    const icon = await sharp(Buffer.from(mark)).resize(230,230).png().toBuffer()
    const image = await sharp({create:{width:2732,height:2732,channels:3,background:'#1554B5'}})
        .composite([{input:icon,gravity:'centre'}]).png({palette:true,colours:128,effort:10}).toBuffer()
    for (const name of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png']) {
        fs.writeFileSync(path.join(root,'mobile/ios/App/App/Assets.xcassets/Splash.imageset',name),image)
    }
    console.log('Launch assets generated. Launcher/home-screen icons unchanged.')
}
main().catch(error=>{console.error(error);process.exitCode=1})
