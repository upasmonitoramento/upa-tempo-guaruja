const fs = require('node:fs')
const path = require('node:path')

const root = fs.realpathSync(__dirname)
const frontend = path.join(root, '../frontend')
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
const whatsappUrl = process.env.MOBILE_WHATSAPP_URL ? httpsURL(process.env.MOBILE_WHATSAPP_URL, 'MOBILE_WHATSAPP_URL') : null
if (whatsappUrl && !/^https:\/\/wa\.me\/[1-9]\d{7,14}(?:\?.*)?$/.test(whatsappUrl)) {
    throw new Error('MOBILE_WHATSAPP_URL deve apontar para um canal wa.me confirmado do projeto.')
}
const release = process.env.MOBILE_RELEASE === '1'
if (release && (!privacyUrl || !supportUrl)) {
    throw new Error('Build de publicação requer MOBILE_PRIVACY_URL e MOBILE_SUPPORT_URL finalizadas e públicas.')
}

// Remove only the generated Capacitor directory.
if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output) {
        throw new Error('Pasta de saída inesperada; não foi removida.')
    }
    fs.rmSync(output, { recursive: true })
}
fs.mkdirSync(path.join(output, 'images'), { recursive: true })
const units = JSON.parse(fs.readFileSync(path.join(frontend, 'images/units.json'), 'utf8'))
for (const unit of units) {
    for (const { file, url } of unit.variants) {
        if (!/^unit-[a-f\d]+-\d+\.webp$/i.test(file)) throw new Error('Arquivo de imagem inesperado.')
        if (url !== `/images/${file}`) throw new Error('Caminho de foto não empacotável.')
        fs.copyFileSync(path.join(frontend, 'images', file), path.join(output, 'images', file))
    }
}
for (const file of ['brand.css', 'experience.css', 'comercial.css', 'comercial.js', 'icon-192-v2.png', 'favicon.ico',
    'favicon-16.png', 'favicon-32.png', 'images/units.json', 'images/unit-placeholder.svg']) {
    fs.copyFileSync(path.join(frontend, file), path.join(output, file))
}
const publicUI = fs.readFileSync(path.join(frontend, 'public-ui.js'), 'utf8').replace(/\r\n/g, '\n')
const publicStartup = /\ncarregarDados\(\)\natualizarInterfaceUsuario\(\)\s*$/
if (!publicStartup.test(publicUI)) throw new Error('Inicialização do portal não encontrada.')
const nativeUI = publicUI.replace(publicStartup, '\n')
    .replace('        unidades = data', '        window.portalNativeOnline?.()\n        unidades = data')
    .replace('    } finally {clearTimeout(timeout)}', '        await window.portalNativeOffline?.()\n    } finally {clearTimeout(timeout)}')
if (!nativeUI.includes('await window.portalNativeOffline?.()') || !nativeUI.includes('window.portalNativeOnline?.()')) {
    throw new Error('Integração do diretório offline não encontrada.')
}
fs.writeFileSync(path.join(output, 'public-ui.js'), nativeUI)
fs.cpSync(path.join(frontend, 'vendor/leaflet'), path.join(output, 'vendor/leaflet'), { recursive: true })
for (const file of ['portal.css', 'portal-native.js']) {
    fs.copyFileSync(path.join(root, file), path.join(output, file))
}

// Reuse the approved portal instead of maintaining a second layout. Fail the build
// if the few integration points change, so the app cannot silently lose features.
let html = fs.readFileSync(path.join(frontend, 'index.html'), 'utf8').replace(/\r\n/g, '\n')
function replace(needle, value) {
    if (!(typeof needle === 'string' ? html.includes(needle) : html.search(needle) >= 0)) {
        throw new Error(`Integração do portal não encontrada: ${String(needle).slice(0, 90)}`)
    }
    html = html.replace(needle, value)
}
replace('<html lang="pt-BR">', '<html lang="pt-BR" class="portal-native">')
replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' +
    '    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; ' +
    `connect-src 'self' ${apiOrigin}; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' https: data: blob:; media-src 'self' https: blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">`)
replace(/    <link rel="manifest"[^\n]*\n/, '')
replace(/    <link rel="apple-touch-icon"[^\n]*\n/, '')
replace(/    <meta name="apple-mobile-web-app[^\n]*\n/g, '')
replace('    <script src="/pwa.js?v=1" defer></script>',
    '    <link rel="stylesheet" href="/portal.css">\n' +
    '    <script src="/config.js"></script>\n' +
    '    <script src="/portal-native.js" defer></script>')
replace('const API = window.location.origin',
    'const API = globalThis.SAUDE_CONFIG.apiOrigin\n        const portalSession = new Map()')
replace(/\blocalStorage\.(getItem|setItem|removeItem)\b/g, (_, method) =>
    `portalSession.${({ getItem: 'get', setItem: 'set', removeItem: 'delete' })[method]}`)
replace(/        if \("serviceWorker" in navigator\) \{[\s\S]*?\n        \}/, '')
replace(/    <dialog id="instrucoesApp"[\s\S]*?<\/dialog>\s*/, '    ')
replace(/                <button[^\n]*id="instalarApp"[^\n]*\n/, '')
replace(/    <div id="login"[\s\S]*?(?=    <div id="perfil")/, `    <div id="login" style="display:none;">
        <form id="loginBox" class="auth-box" aria-labelledby="nativeLoginTitle">
            <p class="section-kicker">ÁREA DA EQUIPE</p>
            <h2 id="nativeLoginTitle">Entrar no Portal Saúde</h2>
            <p>Use sua conta cadastrada. A consulta das unidades é livre e não exige login.</p>
            <label for="email">E-mail</label>
            <input id="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
            <label for="senha">Senha</label>
            <input id="senha" type="password" autocomplete="current-password" required>
            <p id="nativeLoginStatus" role="status"></p>
            <button type="submit">Entrar</button>
            <button type="button" class="native-login-help" data-portal-info="support">Preciso de ajuda para entrar</button>
        </form>
    </div>

`)
replace(/        async function fazerLogin\(\) \{[\s\S]*?(?=        function atualizarInterfaceUsuario\(\))/, '')
replace(/        document.getElementById\("cpfCadastro"\)[\s\S]*?(?=        document.getElementById\("fotoPerfil"\))/, '')
replace(/        async function registrar\(\) \{[\s\S]*?(?=        function mostrarLista\(\))/, '')
replace('            cadastroBox.style.display = "none"\n\n            if (document.getElementById("redefinirBox")) {\n                redefinirBox.style.display = "none"\n            }',
    '            document.getElementById("nativeLoginStatus").textContent = ""\n            portalScrollTop()')
replace(/                <div class="footer-links">[\s\S]*?                <\/div>/, `                <div class="footer-links">
                    <button type="button" data-portal-info="about">Sobre o projeto</button>
                    <button type="button" data-portal-info="privacy">Política de Privacidade</button>
                    <button type="button" data-portal-info="terms">Termos de Uso</button>
                    <button type="button" data-portal-info="sponsors">Patrocinadores</button>
                    <button type="button" data-portal-info="support">Ajuda e contato</button>
                </div>`)
const contactIcon = whatsappUrl ? html.match(/<a href="https:\/\/wa\.me\/5513999999999[\s\S]*?(<svg[\s\S]*?<\/svg>)/)?.[1]
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="native-help-icon" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .65-1.5 1.1-1.5 2.5m0 3h.01"/></svg>'
replace(/    <a href="https:\/\/wa\.me\/5513999999999[^>]*>[\s\S]*?    <\/a>/, `    <button type="button" class="whatsapp-float native-contact" data-portal-info="support" aria-label="Ajuda e contato do projeto">${contactIcon || 'Ajuda'}</button>
    <dialog id="nativeInfo" class="install-dialog native-info" aria-labelledby="nativeInfoTitle">
        <h2 id="nativeInfoTitle"></h2>
        <p id="nativeInfoText"></p>
        <a id="nativeInfoLink" hidden></a>
        <button type="button" id="nativeInfoClose">Fechar</button>
    </dialog>`)
fs.writeFileSync(path.join(output, 'index.html'), html)
fs.writeFileSync(path.join(output, 'config.js'), 'globalThis.SAUDE_CONFIG = Object.freeze(' +
    JSON.stringify({ apiOrigin, siteOrigin, privacyUrl, supportUrl, whatsappUrl, release }).replace(/</g, '\\u003c') + ')\n')
console.log(`Portal completo ${release ? 'com links de publicação' : 'para testes'} preparado em mobile/public.`)
