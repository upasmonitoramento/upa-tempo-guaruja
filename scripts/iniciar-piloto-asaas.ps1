$ErrorActionPreference = 'Stop'
$chave = Read-Host 'Cole a chave do Asaas Sandbox e pressione Enter' -AsSecureString
try {
    $env:ASAAS_SANDBOX_API_KEY = [System.Net.NetworkCredential]::new('', $chave).Password.Trim()
    $env:PILOTO_ADMIN_SENHA = 'SomentePiloto3210'
    node (Join-Path $PSScriptRoot 'piloto-comercial.cjs') --asaas
} finally {
    Remove-Item Env:ASAAS_SANDBOX_API_KEY, Env:PILOTO_ADMIN_SENHA -ErrorAction SilentlyContinue
    $chave.Dispose()
}
