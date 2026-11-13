/* Entry, city choice and optional announcements. No media or animation libraries. */
var conectaCidade = null
var conectaStarted = false
var conectaNoticeTimer = null
var conectaNoticeGeneration = 0

function conectaSelecionarCidade() {
    clearTimeout(conectaNoticeTimer)
    document.getElementById('conectaNotice')?.remove()
    conectaNoticeGeneration++
    limparTimersAds()
    fecharMenuUsuario()
    portalSetView('cities')
    document.getElementById('conectaCities').hidden = false
    document.getElementById('conectaCitiesTitle').focus({ preventScroll:true })
    portalScrollTop()
}

async function conectaEntrarCidade(id) {
    if (id !== 'guaruja') return
    conectaCidade = id
    document.getElementById('conectaCities').hidden = true
    document.getElementById('citySwitch').textContent = 'Guarujá ⌄'
    mostrarLista()
    if (!unidades.length) {
        document.getElementById('lista').innerHTML = '<div class="page-shell empty-state" role="status"><p>Carregando as unidades de Guarujá…</p></div>'
        await carregarDados()
    }
    conectaCarregarAviso()
}

function conectaStart() {
    if (conectaStarted) return
    conectaStarted = true
    const city = document.createElement('main')
    city.id = 'conectaCities'
    city.inert = true
    city.innerHTML = `<header class="city-brand"><img src="/app-icon-192-v3.png?v=4" width="40" height="40" alt=""><strong>Conecta Saúde</strong></header><section class="city-content"><p class="city-eyebrow">PERTO DE VOCÊ</p><h1 id="conectaCitiesTitle" tabindex="-1">Qual cidade você<br>quer consultar?</h1><p>Escolha para ver as unidades e os serviços disponíveis.</p><div class="city-grid"><button class="city-tile" data-city="guaruja" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 21V7h7V3h11v18M1 21h22M6 11h1m-1 4h1m7-8h3m-3 4h3m-3 4h3M11 21v-4h3v4"/></svg><strong>Guarujá</strong><span>São Paulo</span></button></div><p class="city-footnote">Novas cidades aparecerão aqui quando estiverem disponíveis.</p></section>`
    document.body.append(city)
    city.querySelector('[data-city]').onclick = event => {
        const button = event.currentTarget
        button.classList.add('is-selected')
        setTimeout(() => conectaEntrarCidade('guaruja'), portalReducedMotion.matches ? 0 : 140)
    }
    const switcher = document.createElement('button')
    switcher.id = 'citySwitch'
    switcher.type = 'button'
    switcher.setAttribute('aria-label','Trocar cidade selecionada')
    switcher.onclick = event => { event.preventDefault(); event.stopPropagation(); conectaSelecionarCidade() }
    const brand = document.querySelector('.topbar .logo-area')
    const brandGroup = document.createElement('div')
    brandGroup.className = 'conecta-brand-header'
    brand.before(brandGroup)
    brandGroup.append(brand,switcher)
    const splash = document.createElement('div')
    splash.id = 'conectaSplash'
    splash.setAttribute('aria-label','Conecta Saúde')
    splash.innerHTML = '<div class="splash-brand"><img src="/brand-mark.svg" alt="" width="76" height="76"><span>Conecta Saúde</span></div>'
    document.body.append(splash)
    conectaSelecionarCidade()
    setInterval(() => {
        if (!document.hidden && conectaCidade && document.body.dataset.portalView !== 'cities') conectaCarregarAviso()
    }, 60000)
    const finish = () => { splash.remove(); city.inert = false; document.getElementById('conectaCitiesTitle').focus({ preventScroll:true }) }
    setTimeout(finish, portalReducedMotion.matches ? 0 : 1900)
    const openAdmin = abrirPainelAdmin
    abrirPainelAdmin = async () => {
        await openAdmin()
        const tabs = document.querySelector('#adminPanel .admin-tabs')
        if (tabs && !document.getElementById('btnAvisos')) {
            const button = document.createElement('button')
            button.id = 'btnAvisos'; button.className = 'admin-tab-btn'; button.type = 'button'
            button.innerHTML = `${portalIcon('campaign')}<span>Avisos</span>`
            button.onclick = conectaEditarAviso
            tabs.append(button)
        }
    }
}

async function conectaCarregarAviso() {
    if (document.getElementById('conectaNotice')) return
    const generation = ++conectaNoticeGeneration
    try {
        const res = await fetch(`${API}/admin/avisos/publico?cidade=${conectaCidade}`, { cache:'no-store' })
        if (!res.ok) return
        const item = await res.json()
        if (!item?.revision || generation !== conectaNoticeGeneration) return
        const key = 'conecta:aviso:' + item.revision
        try { if (sessionStorage.getItem('conecta:last-notice') === key) return } catch { /* Optional preference. */ }
        document.getElementById('conectaNotice')?.remove()
        const notice = document.createElement('aside')
        notice.id = 'conectaNotice'; notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite')
        const content = document.createElement('div'), title = document.createElement('strong'), text = document.createElement('p')
        title.textContent = item.titulo; text.textContent = item.mensagem; content.append(title,text)
        const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label','Fechar aviso')
        const dismiss = () => { clearTimeout(conectaNoticeTimer); notice.remove(); try { sessionStorage.setItem('conecta:last-notice',key) } catch {} }
        close.onclick = dismiss; notice.append(content,close); document.body.append(notice)
        const startTimer = () => { clearTimeout(conectaNoticeTimer); conectaNoticeTimer = setTimeout(dismiss,7000) }
        notice.onmouseenter = () => clearTimeout(conectaNoticeTimer)
        notice.onmouseleave = startTimer
        notice.onfocusin = () => clearTimeout(conectaNoticeTimer)
        notice.onfocusout = startTimer
        startTimer()
    } catch { /* Notices never block the city portal. */ }
}

async function conectaEditarAviso() {
    const dialog = document.createElement('dialog')
    dialog.className = 'conecta-notice-editor'
    dialog.setAttribute('aria-labelledby','noticeEditorTitle')
    dialog.innerHTML = `<header><h2 id="noticeEditorTitle">Aviso do portal</h2><button type="button" data-close aria-label="Fechar editor de aviso">×</button></header><p>Opcional. Só aparece quando ativado. Não bloqueia o site nem inicia manutenção.</p><form><label class="notice-check"><input type="checkbox" name="enabled"> Exibir aviso</label><label>Título<input name="titulo" maxlength="80" required></label><label>Mensagem<textarea name="mensagem" maxlength="500" rows="3" required></textarea></label><label>Exibir em<select name="cidade"><option value="todas">Todas as cidades disponíveis</option><option value="guaruja">Guarujá</option></select></label><div class="notice-dates"><label>Publicar a partir de<input type="datetime-local" name="inicio"></label><label>Retirar em (opcional)<input type="datetime-local" name="fim"></label></div><small>Horários no fuso deste aparelho. O aviso fecha em 7 segundos ou no X.</small><p role="status"></p><button type="submit">Salvar aviso</button><button type="button" data-disable>Desativar aviso</button></form>`
    document.body.append(dialog); dialog.showModal()
    dialog.querySelector('[data-close]').onclick = () => dialog.close()
    dialog.onclose = () => dialog.remove()
    const form = dialog.querySelector('form'), status = dialog.querySelector('[role=status]')
    const headers = { Authorization:localStorage.getItem('token') || '' }
    const buttons = form.querySelectorAll('button')
    buttons.forEach(button => button.disabled = true)
    let loaded = false
    try {
        const res = await fetch(`${API}/admin/avisos`,{headers,cache:'no-store'})
        const data = await res.json()
        if (!res.ok) throw new Error(data.erro || 'Não foi possível carregar o aviso.')
        for (const key of ['titulo','mensagem','cidade']) form.elements[key].value = data[key] || (key === 'cidade' ? 'todas' : '')
        form.elements.enabled.checked = Boolean(data.enabled)
        for (const key of ['inicio','fim']) if (data[key]) { const d=new Date(data[key]); form.elements[key].value=new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16) }
        loaded = true
    } catch(error) { status.textContent = error.message }
    if (!loaded) return
    buttons.forEach(button => button.disabled = false)
    const save = async enabled => {
        buttons.forEach(button => button.disabled = true); status.textContent = 'Salvando…'
        try {
            const body = { enabled, titulo:form.elements.titulo.value, mensagem:form.elements.mensagem.value, cidade:form.elements.cidade.value }
            for (const key of ['inicio','fim']) body[key] = form.elements[key].value ? new Date(form.elements[key].value).toISOString() : null
            const res = await fetch(`${API}/admin/avisos`,{ method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.erro || 'Não foi possível salvar.')
            form.elements.enabled.checked = enabled
            status.textContent = enabled ? 'Aviso salvo. Será exibido no período definido.' : 'Aviso desativado.'
        } catch(error) { status.textContent = error.message }
        finally { buttons.forEach(button => button.disabled = false) }
    }
    form.onsubmit = event => { event.preventDefault(); save(form.elements.enabled.checked) }
    form.querySelector('[data-disable]').onclick = () => save(false)
}
