/* Mobile additions to the packaged Portal Saúde. No patient data is stored. */
(() => {
    'use strict'
    const byId = id => document.getElementById(id)
    const config = globalThis.SAUDE_CONFIG
    const favoritesKey = 'saude:favorite-unit-ids:v1'
    const favorites = new Set()
    let onlyFavorites = false
    let offline = false
    let openedUnit = null
    try {
        const ids = JSON.parse(localStorage.getItem(favoritesKey) || '[]')
        if (Array.isArray(ids)) ids.filter(id => typeof id === 'string').forEach(id => favorites.add(id))
    } catch { /* Favorites are optional if storage is unavailable. */ }

    const login = byId('loginBox')
    login.addEventListener('submit', async event => {
        event.preventDefault()
        const submit = login.querySelector('button[type=submit]')
        const status = byId('nativeLoginStatus')
        if (submit.disabled) return
        submit.disabled = true
        status.textContent = 'Verificando sua conta…'
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12000)
        try {
            const response = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: byId('email').value.trim(), senha: byId('senha').value }),
                signal: controller.signal
            })
            const data = await response.json()
            if (!response.ok || typeof data.token !== 'string' || !data.user) {
                status.textContent = response.status === 429 ? 'Muitas tentativas. Aguarde e tente novamente.'
                    : response.status >= 500 ? 'Não foi possível entrar agora. Tente novamente.'
                    : 'Não foi possível entrar. Confira os dados ou peça ajuda ao responsável pelo projeto.'
                return
            }
            portalSession.set('token', data.token)
            portalSession.set('user', JSON.stringify(data.user))
            atualizarInterfaceUsuario()
            status.textContent = ''
            if (byId('login').style.display !== 'none') mostrarLista()
        } catch {
            status.textContent = 'Não foi possível conectar. Verifique sua internet e tente novamente.'
        } finally {
            clearTimeout(timeout)
            byId('senha').value = ''
            submit.disabled = false
        }
    })

    const info = {
        about: ['Sobre o projeto', 'O Portal Saúde reúne endereços, telefones, rotas e informações de demonstração das UPAs e prontos-socorros de Guarujá. É um projeto independente, sem vínculo oficial com as unidades.'],
        privacy: ['Política de Privacidade', 'A consulta das unidades não exige conta. Os favoritos ficam neste aparelho. A área da equipe usa as informações da conta cadastrada para autenticação e gestão do portal.' + (config.privacyUrl ? '' : ' A política completa precisa ser validada antes da publicação nas lojas.'), config.privacyUrl, 'Ler a política completa'],
        terms: ['Termos de Uso', 'Tempos e equipes são exemplos e não representam a situação atual. Confirme os dados com a unidade. Este portal é informativo e não substitui atendimento nem canais oficiais de emergência.'],
        sponsors: ['Patrocinadores', 'Os espaços comerciais aparecem com a identificação Publicidade. Anúncios com link abrem o endereço do patrocinador fora do aplicativo.'],
        support: ['Ajuda e contato', 'Para confirmar informações de atendimento, use o telefone da unidade nos detalhes. Para recuperar o acesso à sua conta, procure o responsável pelo projeto.', config.whatsappUrl || config.supportUrl, config.whatsappUrl ? 'Abrir WhatsApp' : 'Abrir suporte']
    }
    const infoDialog = byId('nativeInfo')
    byId('nativeInfoClose').addEventListener('click', () => infoDialog.close())
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-portal-info]')
        if (!button) return
        const [title, copy, url, label] = info[button.dataset.portalInfo]
        byId('nativeInfoTitle').textContent = title
        byId('nativeInfoText').textContent = copy
        const link = byId('nativeInfoLink')
        link.hidden = !url
        link.textContent = label || ''
        if (url) link.href = url
        else link.removeAttribute('href')
        infoDialog.showModal()
    })

    // Use the native WebView's normal external navigation for HTTPS and calls.
    // Keep third-party pages out of the bridge and leave the current view intact.
    function openExternal(value) {
        try {
            const url = new URL(value, location.href)
            if (!['https:', 'tel:'].includes(url.protocol) || url.username || url.password) return
            if (window.Capacitor?.isNativePlatform()) location.assign(url.href)
            else window.open(url.href, '_blank', 'noopener,noreferrer')
        } catch { /* Invalid destination. */ }
    }
    document.addEventListener('click', event => {
        const link = event.target.closest('a[href]')
        if (!link) return
        if (link.classList.contains('logo-area')) {
            event.preventDefault()
            mostrarLista()
        } else if (link.origin !== location.origin || link.protocol === 'tel:') {
            event.preventDefault()
            openExternal(link.href)
        }
    })
    abrirRota = (lat, lng) => {
        const unit = unidades.find(u => String(u._id) === openedUnit)
        const destination = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)
            ? `${lat},${lng}` : unit && enderecoDaUnidade(unit)
        if (destination) openExternal(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`)
    }

    function favoriteButton(unit) {
        const id = String(unit._id)
        const button = document.createElement('button')
        button.className = 'button-secondary native-favorite'
        button.type = 'button'
        const update = () => {
            button.textContent = favorites.has(id) ? '★ Unidade favorita' : '☆ Favoritar unidade'
            button.setAttribute('aria-pressed', String(favorites.has(id)))
        }
        update()
        button.addEventListener('click', () => {
            if (favorites.has(id)) favorites.delete(id)
            else favorites.add(id)
            try { localStorage.setItem(favoritesKey, JSON.stringify([...favorites])) } catch { /* Session only. */ }
            update()
        })
        return button
    }

    function retryNotice() {
        const notice = document.createElement('p')
        notice.className = 'data-note native-offline'
        notice.append('Sem conexão com o portal. Consulte o diretório salvo; tempos e equipes estão indisponíveis. ')
        const retry = document.createElement('button')
        retry.className = 'button-secondary'
        retry.textContent = 'Tentar novamente'
        retry.addEventListener('click', async () => {
            retry.disabled = true
            await carregarDados()
            retry.disabled = false
        })
        notice.append(retry)
        return notice
    }

    const renderList = carregarLista
    carregarLista = () => {
        openedUnit = null
        renderList()
        const shell = byId('lista').querySelector('.page-shell')
        const cards = byId('cardsContainer')
        if (!cards) return
        const toolbar = document.createElement('div')
        toolbar.className = 'native-favorite-toolbar'
        const filter = document.createElement('button')
        filter.type = 'button'
        filter.className = 'button-secondary'
        filter.textContent = onlyFavorites ? '★ Favoritas · mostrar todas' : '☆ Ver favoritas'
        filter.setAttribute('aria-pressed', String(onlyFavorites))
        filter.addEventListener('click', () => {
            onlyFavorites = !onlyFavorites
            filtroAtendimentoAtual = 'todos'
            carregarLista()
            document.querySelector('.native-favorite-toolbar button')?.focus({ preventScroll: true })
        })
        toolbar.append(filter)
        if (offline) toolbar.prepend(retryNotice())
        cards.before(toolbar)
        if (offline) {
            shell.querySelector('.classic-wait-filters')?.remove()
            shell.querySelector('.classic-hero-eyebrow').textContent = 'Diretório salvo no aplicativo'
            shell.querySelector('#unidadesTitulo').textContent = 'Unidades de saúde de Guarujá'
            shell.querySelector('.classic-hero-copy').textContent = 'Consulte os contatos e endereços das unidades.'
        }
        for (const card of cards.querySelectorAll('.unit-card')) {
            if (offline) {
                for (const el of card.querySelectorAll('.unit-card-metrics, .unit-card-status, .unit-card-updated')) el.remove()
            }
            if (onlyFavorites && !favorites.has(card.id.slice('card-upa-'.length))) card.hidden = true
        }
        if (onlyFavorites && !cards.querySelector('.unit-card:not([hidden])')) {
            const empty = document.createElement('p')
            empty.className = 'empty-state'
            empty.textContent = 'Nenhuma unidade favorita nesta lista. Abra os detalhes de uma unidade para salvá-la.'
            cards.replaceChildren(empty)
        }
    }
    const renderDetails = verDetalhes
    verDetalhes = unit => {
        renderDetails(unit)
        openedUnit = String(unit._id)
        const detail = byId('lista').querySelector('.unit-detail')
        detail.querySelector('.detail-actions').append(favoriteButton(unit))
        if (offline) {
            for (const el of detail.querySelectorAll('.detail-info-grid, .detail-staff, .data-note, .detail-example-label')) el.remove()
            detail.prepend(retryNotice())
        }
    }

    const showList = mostrarLista
    mostrarLista = () => { onlyFavorites = false; showList() }
    const showForm = mostrarForm
    mostrarForm = () => {
        const type = getUser()?.tipo
        if (type !== 'admin' && type !== 'funcionario') return
        if (offline || !unidades.length) return alert('As unidades ainda não estão disponíveis para atualização. Verifique a conexão e tente novamente.')
        showForm()
        carregarFormularioUnidadeSelecionada()
        portalScrollTop()
    }

    window.portalNativeOnline = () => { offline = false }
    window.portalNativeOffline = async () => {
        try {
            const response = await fetch('/images/units.json')
            if (!response.ok) return
            portalPhotoAssets = await response.json()
            unidades = portalPhotoAssets.map(({ id, name, originalURL }) => ({ _id: id, upa: name, foto: originalURL }))
            offline = true
            filtroAtendimentoAtual = 'todos'
            carregarLista()
        } catch { /* The portal's connection error remains visible. */ }
    }
    atualizarInterfaceUsuario()
    carregarDados()
})()
