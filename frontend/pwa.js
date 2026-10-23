(() => {
    const botao = document.getElementById("instalarApp")
    const dialogo = document.getElementById("instrucoesApp")
    const texto = document.getElementById("instrucoesAppTexto")
    let convite = null
    const instalado = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true
    const atualizar = () => { botao.hidden = instalado() }

    window.addEventListener("beforeinstallprompt", evento => {
        evento.preventDefault()
        convite = evento
        atualizar()
    })
    window.addEventListener("appinstalled", () => {
        convite = null
        botao.hidden = true
        if (dialogo.open) dialogo.close()
    })
    window.matchMedia("(display-mode: standalone)").addEventListener("change", atualizar)

    botao.addEventListener("click", async () => {
        if (convite) {
            const evento = convite
            convite = null
            try {
                await evento.prompt()
                await evento.userChoice
                return
            } catch { /* Mostra instruções se o navegador não abrir o convite. */ }
        }

        const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        const android = /Android/.test(navigator.userAgent)
        texto.textContent = apple
            ? "No iPhone ou iPad, abra este site no Safari. Toque em Compartilhar e em Adicionar à Tela de Início. Se aparecer, ative Abrir como App Web e toque em Adicionar."
            : android
                ? "No Android, abra este site no Chrome. Toque no menu de três pontos e em Adicionar à tela inicial ou Instalar app. Confirme a instalação. Se a opção ainda não aparecer, recarregue o site e tente novamente."
                : "No Chrome ou Edge, procure o ícone de instalação na barra de endereço ou a opção Instalar no menu do navegador. No Safari do Mac, use Arquivo → Adicionar ao Dock, quando disponível."
        dialogo.showModal()
    })

    document.getElementById("fecharInstrucoesApp").addEventListener("click", () => dialogo.close())
    atualizar()
})()
