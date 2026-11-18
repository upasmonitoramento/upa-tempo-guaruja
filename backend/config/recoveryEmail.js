function configured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM)
}

async function sendRecovery(email, token) {
    if (!configured()) throw new Error('Recovery email is not configured')
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: process.env.AUTH_EMAIL_FROM,
            to: [email],
            subject: 'Conecta Saúde — recuperação de senha',
            text: `Use o código abaixo no Conecta Saúde para criar uma nova senha. Ele expira em 20 minutos e só funciona uma vez.\n\n${token}\n\nSe você não solicitou a alteração, ignore esta mensagem. Não compartilhe este código.`
        })
    })
    if (!response.ok) throw new Error('Recovery email delivery failed')
}

module.exports = { configured, sendRecovery }
