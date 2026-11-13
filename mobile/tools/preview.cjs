const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const root = path.resolve(__dirname, '../public')
const mime = {'.woff2':'font/woff2','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'}
const port = Number(process.env.MOBILE_PREVIEW_PORT || 3199)
http.createServer((req, res) => {
    const relative = new URL(req.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html'
    if (!/^(?:images\/|vendor\/leaflet\/(?:images\/)?)?[\w.-]+$/.test(relative) || relative.split('/').some(part => part === '..' || part === '.') || !mime[path.extname(relative)]) {
        res.writeHead(404).end(); return
    }
    fs.readFile(path.join(root, relative), (error, body) => {
        if (error) { res.writeHead(404).end(); return }
        res.writeHead(200, {'Content-Type':mime[path.extname(relative)],'Cache-Control':'no-store'}).end(body)
    })
}).listen(port, '127.0.0.1', () => console.log('Prévia local: http://127.0.0.1:' + port))
