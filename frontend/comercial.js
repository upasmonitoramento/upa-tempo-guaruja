(() => {
    const root = document.getElementById("commercialProposal")
    const origin = root ? location.origin : API
    const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
    const slots = { card: "Card da unidade", detalhe: "Detalhes da unidade", rodape: "Rodapé", banner: "Banner" }
    const paymentStatus = { PENDING: "Aguardando Pix", RECEIVED: "Recebida", OVERDUE: "Vencida", REFUNDED: "Estornada", REFUND_REQUESTED: "Estorno solicitado" }

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
            status.textContent = "Ambiente de teste. Use dados fictícios."
            root.insertAdjacentHTML("beforeend", `<form class="commercial-form">
                <label>Nome do representante<input name="representative" required maxlength="160" autocomplete="off"></label>
                <label>E-mail da proposta<input name="email" type="email" required autocomplete="off"></label>
                <label>CPF ou CNPJ de teste<input name="document" required maxlength="25" autocomplete="off"></label>
                <label class="commercial-check commercial-wide"><input type="checkbox" name="accepted" required> Li e aceito os termos e as condições desta proposta.</label>
                <button type="submit">Aceitar proposta</button>
            </form>`)
            const form = root.querySelector("form")
            handleForm(form, status, async fields => {
                await request("/aceite/" + token, { method: "POST", body: { ...Object.fromEntries(fields), accepted: fields.has("accepted") } })
                form.remove()
                status.textContent = "Aceite registrado. A equipe pode emitir a cobrança de teste."
            })
        } catch (error) { status.textContent = error.message }
    }

    async function showPanel() {
        fecharMenuUsuario()
        const dialog = document.createElement("dialog")
        dialog.className = "commercial-dialog"
        dialog.innerHTML = `<div class="commercial"><div class="commercial-top"><h1>Publicidade</h1><button type="button" data-close>Fechar</button></div>
            <p class="commercial-status" role="status">Carregando painel…</p>
            <div class="commercial-layout"><nav aria-label="Painel comercial">
            <button data-tab="resumo">Resumo</button><button data-tab="parcerias">Parcerias</button><button data-tab="campanhas">Campanhas</button>
            </nav><section></section></div></div>`
        document.body.append(dialog)
        dialog.addEventListener("close", () => dialog.remove())
        dialog.querySelector("[data-close]").onclick = () => dialog.close()
        dialog.showModal()
        const status = dialog.querySelector("[role=status]")
        const section = dialog.querySelector("section")
        let items = []
        let selected = "resumo"
        const load = async () => {
            items = await request("/painel", { admin: true })
            status.textContent = "Ambiente de teste. Use dados fictícios."
        }
        async function render(tab) {
            selected = tab
            dialog.querySelectorAll("[data-tab]").forEach(btn => {
                btn.removeAttribute("aria-current")
                if (btn.dataset.tab === tab) btn.setAttribute("aria-current", "page")
            })
            if (tab === "resumo") {
                section.innerHTML = `<div class="commercial-card"><h2>Visão geral</h2><p>${items.length} propostas recentes</p>
                <p>${items.filter(item => item.accepted).length} aceitas · ${items.filter(item => item.paymentStatus === "RECEIVED").length} Pix recebidos</p></div>`
                return
            }
            if (tab === "campanhas") {
                section.innerHTML = `<div class="commercial-card"><h2>Prévia de campanhas</h2><p>Confira o que foi combinado em cada proposta.</p><button data-legacy>Gerenciar anúncios e artes</button></div>
                    ${items.map(item => `<article class="commercial-card">${summary(item)}<p>${item.accepted && item.paymentStatus === "RECEIVED" ? "Aceite e Pix confirmados. Confira a arte e a publicação no painel de anúncios." : "Aguardando aceite ou recebimento."}</p></article>`).join("")}`
                section.querySelector("[data-legacy]").onclick = () => { dialog.close(); abrirPainelAdmin() }
                return
            }
            section.innerHTML = `<div class="commercial-card"><h2>Nova proposta</h2><form class="commercial-form">
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
                ${items.map(item => `<article class="commercial-card">${summary(item)}<p>${item.accepted ? "Aceita" : "Aguardando aceite"} · ${escape(paymentStatus[item.paymentStatus] || item.paymentStatus || "Sem cobrança")}</p>
                  ${item.paymentUrl && !window.Capacitor?.isNativePlatform() ? `<p><a href="${escape(item.paymentUrl)}" target="_blank" rel="noopener">Abrir Pix de teste</a></p>` : ""}
                  ${item.accepted && (item.paymentId || !window.Capacitor?.isNativePlatform()) ? `<button data-pix="${escape(item._id)}">${item.paymentId ? "Conferir pagamento" : "Gerar Pix de teste"}</button>` : ""}</article>`).join("")}`
            const form = section.querySelector("form")
            handleForm(form, status, async fields => {
                const data = await request("/propostas", { admin: true, method: "POST", body: {
                    ...Object.fromEntries(fields),
                    cents: Math.round(Number(fields.get("value")) * 100),
                    positions: fields.getAll("positions"),
                    cities: fields.get("cities").split(",")
                } })
                await load()
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
                status.textContent = "Proposta criada. Guarde o link privado para testar o aceite."
            })
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
                try { await load(); await render(btn.dataset.tab) }
                catch (error) { status.textContent = error.message }
            }
        })
        try { await load(); await render(selected) }
        catch (error) { status.textContent = error.message }
    }

    if (root) showProposal()
    else window.abrirComercial = showPanel
})()
