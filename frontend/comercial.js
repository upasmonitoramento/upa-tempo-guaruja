(() => {
    const root = document.getElementById("commercialProposal")
    const origin = root ? location.origin : API
    const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
    const slots = { card: "Card da unidade", detalhe: "Detalhes da unidade", rodape: "Rodapé", banner: "Banner" }
    const icon = paths => `<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
    const paymentStatus = { PENDING: "Aguardando Pix", RECEIVED: "Recebida", OVERDUE: "Vencida", REFUNDED: "Estornada", REFUND_REQUESTED: "Estorno solicitado" }
    let sandbox = true
    let preparation = false
    const testLabel = () => sandbox ? " de teste" : ""

    async function request(path, { admin = false, method = "GET", body } = {}) {
        const headers = {}
        if (admin) headers.Authorization = sessionToken()
        if (body) headers["Content-Type"] = "application/json"
        const response = await fetch(origin + "/comercial" + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.erro || ({
            401: "Entre novamente para continuar.",
            403: "Esta área exige uma conta administradora ativa.",
            404: "Área indisponível neste ambiente ou link expirado.",
            409: "A operação já está em andamento. Atualize a lista."
        })[response.status] || "Não foi possível concluir. Tente novamente.")
        const mode = response.headers.get("X-Portal-Commercial-Mode")
        sandbox = mode === "sandbox"
        preparation = mode === "preparation"
        return data
    }

    function sessionToken() {
        return localStorage.getItem("token") || ""
    }

    function escape(value) {
        const span = document.createElement("span")
        span.textContent = String(value ?? "")
        return span.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    }

    function summary(item) {
        return `<h2>${escape(item.company)}</h2><p>${escape(item.packageName)} · ${money(item.cents)}</p>
            <p>${escape(item.cities.join(", "))} · ${escape(item.positions.map(slot => slots[slot]).join(", "))}</p>
            <p>Campanha de ${escape(item.start)} até ${escape(item.end)}. Pix vence em ${escape(item.due)}.</p>`
    }

    function handleForm(form, status, action) {
        form.addEventListener("submit", async event => {
            event.preventDefault()
            const button = form.querySelector("button[type=submit]")
            button.disabled = true
            status.textContent = "Salvando…"
            try { await action(new FormData(form)) }
            catch (error) { status.textContent = error.message }
            finally { button.disabled = false }
        })
    }

    async function showProposal() {
        const token = location.hash.slice(1)
        const status = root.querySelector("[role=status]")
        if (!/^[a-f\d]{64}$/.test(token)) { status.textContent = "Link inválido."; return }
        try {
            const item = await request("/aceite/" + token)
            root.insertAdjacentHTML("beforeend", `<article class="commercial-card">${summary(item)}<p>${escape(item.terms)}</p></article>`)
            if (item.accepted) { status.textContent = "Proposta aceita."; return }
            status.textContent = sandbox ? "Ambiente de teste. Use dados fictícios." : ""
            root.insertAdjacentHTML("beforeend", `<form class="commercial-form">
                <label>Nome do representante<input name="representative" required maxlength="160" autocomplete="off"></label>
                <label>E-mail da proposta<input name="email" type="email" required autocomplete="off"></label>
                <label>CPF ou CNPJ${testLabel()}<input name="document" required maxlength="25" autocomplete="off"></label>
                <label class="commercial-check commercial-wide"><input type="checkbox" name="accepted" required> Li e aceito os termos e as condições desta proposta.</label>
                <button type="submit">Aceitar proposta</button>
            </form>`)
            const form = root.querySelector("form")
            handleForm(form, status, async fields => {
                await request("/aceite/" + token, { method: "POST", body: { ...Object.fromEntries(fields), accepted: fields.has("accepted") } })
                form.remove()
                status.textContent = "Aceite registrado. A equipe pode emitir a cobrança" + testLabel() + "."
            })
        } catch (error) { status.textContent = error.message }
    }

    async function showPanel() {
        fecharMenuUsuario()
        const dialog = document.createElement("dialog")
        dialog.className = "commercial-dialog"
        dialog.setAttribute("aria-label", "Gestão de publicidade")
        dialog.innerHTML = `<div class="commercial"><header class="commercial-top"><div><p class="commercial-eyebrow">CONECTA SAÚDE · GESTÃO</p><h1>Publicidade</h1></div><button type="button" data-close aria-label="Voltar ao Portal">Voltar ao Portal</button></header>
            <p class="commercial-status" role="status">Carregando painel…</p>
            <div class="commercial-layout"><nav aria-label="Painel comercial">
            <button data-tab="resumo">${icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="18" width="7" height="3" rx="1"/>')}Resumo</button><button data-tab="parcerias">${icon('<path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-4h6v4M8 7h1m6 0h1M8 11h1m6 0h1"/>')}Parcerias</button><button data-tab="campanhas">${icon('<path d="M4 10h4l12-5v14L8 14H4zM8 14l2 7h4l-2-6M4 10v4"/>')}Campanhas</button>
            </nav><section></section></div></div>`
        document.body.append(dialog)
        dialog.addEventListener("close", () => dialog.remove())
        dialog.querySelector("[data-close]").onclick = () => dialog.close()
        const refreshButton = document.createElement("button")
        refreshButton.textContent = "↻"
        refreshButton.setAttribute("aria-label", "Atualizar dados")
        refreshButton.title = "Atualizar dados"
        refreshButton.type = "button"
        dialog.querySelector(".commercial-top").append(refreshButton)
        dialog.showModal()
        const status = dialog.querySelector("[role=status]")
        const section = dialog.querySelector("section")
        let items = []
        let selected = "resumo"
        let filter = "todas"
        let search = ""
        let companyKey = null
        let showForm = false
        const currentDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date())
        const keyFor = item => JSON.stringify([item.company, item.email])
        const recent = item => Date.now() - new Date(item.createdAt).getTime() < 7 * 86400000
        const settled = item => item.paymentStatus === "RECEIVED"
        const inPeriod = item => settled(item) && item.start <= currentDate() && item.end >= currentDate()
        const matchesFilter = item => ({
            todas: true, recentes: recent(item), recebidas: settled(item), vigentes: inPeriod(item),
            pendentes: !settled(item) && !["REFUNDED", "DELETED"].includes(item.paymentStatus),
            encerradas: item.end < currentDate()
        })[filter]
        const badge = item => `<span class="commercial-badge ${settled(item) ? "is-paid" : ""}">${escape(paymentStatus[item.paymentStatus] || item.paymentStatus || "Sem cobrança")}</span>`
        const openCompany = item => { companyKey = keyFor(item); showForm = false; render("parcerias"); section.focus() }
        const bindCompanies = () => section.querySelectorAll("[data-company]").forEach(button => {
            button.onclick = () => openCompany(items.find(item => item._id === button.dataset.company))
        })
        function companyCards(rows) {
            const groups = new Map()
            rows.forEach(item => {
                const key = keyFor(item)
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key).push(item)
            })
            return [...groups.values()].map(contracts => {
                const item = contracts[0]
                const all = items.filter(row => keyFor(row) === keyFor(item))
                const received = all.filter(settled).length
                return `<article class="commercial-card commercial-company">
                    <div class="commercial-company-heading"><span class="commercial-avatar" aria-hidden="true">${escape(item.company.slice(0, 2).toUpperCase())}</span>
                    <div><h3>${escape(item.company)}</h3><p>${escape(item.email)}</p></div></div>
                    <div class="commercial-card-meta">${badge(item)}${recent(item) ? '<span class="commercial-badge">Recente</span>' : ""}</div>
                    <p>${all.length} proposta(s) · ${received} Pix recebido(s)</p>
                    <p class="commercial-muted">Pacote recente · ${escape(item.packageName)}</p>
                    <button data-company="${escape(item._id)}" aria-label="Abrir ficha de ${escape(item.company)}">Abrir ficha <span aria-hidden="true">↗</span></button></article>`
            }).join("") || '<div class="commercial-empty"><h3>Nenhuma parceria encontrada</h3><p>Altere a busca ou o filtro para ver outras propostas.</p></div>'
        }
        const load = async () => {
            items = await request("/painel", { admin: true })
            status.textContent = preparation ? "Painel em preparação. Consulta liberada; criação de propostas e cobranças desativadas." : sandbox ? "Ambiente de teste. Use dados fictícios." : ""
        }
        async function render(tab) {
            // Each screen inherits the current billing permissions, including its newly rendered buttons.
            queueMicrotask(() => {
                if (preparation) section.querySelectorAll("[data-new],[data-pix]").forEach(button => { button.disabled = true; button.title = "Disponível após a ativação comercial" })
            })
            selected = tab
            section.tabIndex = -1
            dialog.querySelectorAll("[data-tab]").forEach(btn => {
                btn.removeAttribute("aria-current")
                if (btn.dataset.tab === tab) btn.setAttribute("aria-current", "page")
            })
            if (tab === "resumo") {
                section.innerHTML = `<div class="commercial-section-title"><div><p class="commercial-eyebrow">ACOMPANHAMENTO</p><h2>Visão geral</h2><p>Parcerias e pagamentos em um só lugar.</p></div><button data-new>Nova proposta</button></div>
                    <div class="commercial-metrics">
                    ${[["recentes","Novas nos últimos 7 dias",items.filter(recent).length],["recebidas","Pix recebidos",items.filter(settled).length],["pendentes","Pendentes",items.filter(item => !settled(item) && !["REFUNDED","DELETED"].includes(item.paymentStatus)).length],["vigentes","Pagas no período",items.filter(inPeriod).length]].map(([key,label,count])=>`<button data-filter-link="${key}"><span>${label}</span><strong>${count}</strong><span class="commercial-metric-arrow" aria-hidden="true">↗</span></button>`).join("")}</div>
                    <div class="commercial-section-title"><h2>Chegaram recentemente</h2><button data-all>Ver todas</button></div>
                    <div class="commercial-companies">${companyCards(items.filter(recent).slice(0, 6))}</div>
                    <p class="commercial-muted">Exibindo até 100 propostas recentes. Pagamento recebido e período vigente são etapas anteriores à aprovação da arte e à publicação.</p>`
                section.querySelector("[data-new]").onclick = () => { showForm = true; companyKey = null; render("parcerias") }
                section.querySelector("[data-all]").onclick = () => { filter = "todas"; companyKey = null; showForm = false; render("parcerias") }
                section.querySelectorAll("[data-filter-link]").forEach(button => button.onclick = () => { filter = button.dataset.filterLink; companyKey = null; showForm = false; render("parcerias") })
                bindCompanies()
                return
            }
            if (tab === "campanhas") {
                section.innerHTML = `<div class="commercial-card"><h2>Prévia de campanhas</h2><p>Confira o que foi combinado em cada proposta.</p><button data-legacy>Gerenciar anúncios e artes</button></div>
                    ${items.map(item => `<article class="commercial-card">${summary(item)}<p>${item.accepted && item.paymentStatus === "RECEIVED" ? "Aceite e Pix confirmados. Confira a arte e a publicação no painel de anúncios." : "Aguardando aceite ou recebimento."}</p></article>`).join("")}`
                section.querySelector("[data-legacy]").onclick = () => { dialog.close(); abrirPainelAdmin() }
                return
            }
            if (companyKey && !showForm) {
                const contracts = items.filter(item => keyFor(item) === companyKey)
                const company = contracts[0]
                if (!company) { companyKey = null; return render("parcerias") }
                section.innerHTML = `<button data-back>← Todas as parcerias</button>
                    <div class="commercial-card commercial-company-profile"><p class="commercial-eyebrow">FICHA DA PARCERIA</p><h2>${escape(company.company)}</h2>
                    <p>${escape(company.email)}</p><p>${contracts.length} proposta(s) · ${contracts.filter(settled).length} Pix recebido(s)</p>
                    <button data-new>Nova proposta para esta empresa</button></div>
                    <h2>Histórico de propostas</h2><div class="commercial-contracts">${contracts.map(item => `<article class="commercial-card">${summary(item)}<div class="commercial-card-meta">${badge(item)}<span>${item.accepted ? "Aceite registrado" : "Aguardando aceite"}</span></div>
                    <p class="commercial-muted">Responsável · ${escape(item.representative || "Não informado")}</p>
                    <div class="commercial-actions">${item.paymentUrl && !window.Capacitor?.isNativePlatform() ? `<a class="commercial-button" href="${escape(item.paymentUrl)}" target="_blank" rel="noopener">Abrir Pix${testLabel()}</a>` : ""}
                    ${item.accepted && (item.paymentId || !window.Capacitor?.isNativePlatform()) ? `<button data-pix="${escape(item._id)}">${item.paymentId ? "Conferir pagamento" : "Gerar Pix" + testLabel()}</button>` : ""}</div></article>`).join("")}</div>`
                section.querySelector("[data-back]").onclick = () => { companyKey = null; render("parcerias") }
                section.querySelector("[data-new]").onclick = () => {
                    showForm = true
                    render("parcerias")
                    section.querySelector('[name="company"]').value = company.company
                    section.querySelector('[name="email"]').value = company.email
                }
                bindPayments()
                return
            }
            if (!showForm) {
                section.innerHTML = `<div class="commercial-section-title"><div><p class="commercial-eyebrow">EMPRESAS E PESSOAS</p><h2>Parcerias</h2><p>Acompanhe as propostas e abra a ficha de cada parceiro.</p></div><button data-new>Nova proposta</button></div>
                    <label class="commercial-search">Buscar parceria<input type="search" placeholder="Empresa, e-mail ou pacote" value="${escape(search)}"></label>
                    <div class="commercial-filters" role="group" aria-label="Filtrar parcerias">${[["todas","Todas"],["recentes","Recentes"],["recebidas","Pix recebidos"],["vigentes","Pagas no período"],["pendentes","Pendentes"],["encerradas","Encerradas"]].map(([key,label])=>`<button data-filter="${key}" aria-pressed="${filter===key}">${label}</button>`).join("")}</div>
                    <div class="commercial-companies" data-companies></div><p class="commercial-muted">Busca nas 100 propostas mais recentes.</p>`
                const updateList = () => {
                    const query = search.toLocaleLowerCase("pt-BR")
                    section.querySelector("[data-companies]").innerHTML = companyCards(items.filter(item => matchesFilter(item) && [item.company,item.email,item.packageName].join(" ").toLocaleLowerCase("pt-BR").includes(query)))
                    bindCompanies()
                }
                section.querySelector('input[type="search"]').oninput = event => { search = event.target.value; updateList() }
                section.querySelectorAll("[data-filter]").forEach(button => button.onclick = () => {
                    filter = button.dataset.filter
                    section.querySelectorAll("[data-filter]").forEach(option => option.setAttribute("aria-pressed", String(option === button)))
                    updateList()
                })
                section.querySelector("[data-new]").onclick = () => { showForm = true; render("parcerias") }
                updateList()
                return
            }
            section.innerHTML = `<button data-back>← Todas as parcerias</button><div class="commercial-card"><p class="commercial-eyebrow">NOVA PARCERIA</p><h2>Nova proposta</h2><form class="commercial-form">
                <label>Empresa ou pessoa<input name="company" required maxlength="160"></label>
                <label>E-mail para aceite<input name="email" required type="email"></label>
                <label>Nome do pacote<input name="packageName" required maxlength="80"></label>
                <label>Valor da cobrança (R$)<input name="value" type="number" required min="5" step="0.01"></label>
                <label>Cidades (até 3, separadas por vírgula)<input name="cities" value="Guarujá" required></label>
                <label>Início da campanha<input name="start" required type="date"></label>
                <label>Fim da campanha<input name="end" required type="date"></label>
                <label>Vencimento do Pix<input name="due" required type="date"></label>
                <fieldset class="commercial-wide"><legend>Posições</legend>${Object.entries(slots).map(([key, value]) => `<label><input type="checkbox" name="positions" value="${key}">${value}</label>`).join("")}</fieldset>
                <button type="submit">Criar proposta</button></form><div data-result></div></div>
                `
            section.querySelector("[data-back]").onclick = () => { showForm = false; companyKey = null; render("parcerias") }
            const form = section.querySelector("form")
            handleForm(form, status, async fields => {
                const data = await request("/propostas", { admin: true, method: "POST", body: {
                    ...Object.fromEntries(fields),
                    cents: Math.round(Number(fields.get("value")) * 100),
                    positions: fields.getAll("positions"),
                    cities: fields.get("cities").split(",")
                } })
                await load()
                showForm = true
                await render("parcerias")
                const result = section.querySelector("[data-result]")
                const link = document.createElement("a")
                link.href = origin + data.path
                link.target = "_blank"
                link.rel = "noopener"
                link.textContent = "Abrir link de aceite"
                const input = document.createElement("input")
                input.readOnly = true
                input.setAttribute("aria-label", "Link privado da proposta")
                input.value = link.href
                result.append(link, document.createElement("br"), input)
                status.textContent = "Proposta criada. Guarde o link privado para o aceite."
            })
        }
        function bindPayments() {
            section.querySelectorAll("[data-pix]").forEach(button => {
                button.onclick = async () => {
                    button.disabled = true
                    status.textContent = "Consultando Asaas…"
                    try {
                        await request("/propostas/" + button.dataset.pix + "/pix", { admin: true, method: "POST" })
                        await load()
                        await render("parcerias")
                    } catch (error) { status.textContent = error.message }
                    finally { button.disabled = false }
                }
            })
        }
        dialog.querySelectorAll("[data-tab]").forEach(btn => {
            btn.onclick = async () => {
                try { companyKey = null; showForm = false; await render(btn.dataset.tab) }
                catch (error) { status.textContent = error.message }
            }
        })
        refreshButton.onclick = async () => {
            refreshButton.disabled = true
            status.textContent = "Atualizando…"
            try { await load(); await render(selected) }
            catch (error) { status.textContent = error.message }
            finally { refreshButton.disabled = false }
        }
        try { await load(); await render(selected) }
        catch (error) { status.textContent = error.message }
    }

    if (root) showProposal()
    else window.abrirComercial = showPanel
})()
