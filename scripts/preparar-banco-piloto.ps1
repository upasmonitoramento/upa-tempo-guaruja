$uri = Read-Host 'Cole a URL MONGO_URI do banco piloto' -AsSecureString
$senha = Read-Host 'Crie uma senha de administrador do piloto com pelo menos 16 caracteres' -AsSecureString
try {
    $env:PILOTO_MONGO_URI = [System.Net.NetworkCredential]::new('', $uri).Password.Trim()
    $env:PILOTO_ADMIN_SENHA = [System.Net.NetworkCredential]::new('', $senha).Password
    node (Join-Path $PSScriptRoot 'preparar-banco-piloto.cjs')
} finally {
    Remove-Item Env:PILOTO_MONGO_URI, Env:PILOTO_ADMIN_SENHA -ErrorAction SilentlyContinue
    $uri.Dispose()
    $senha.Dispose()
}
