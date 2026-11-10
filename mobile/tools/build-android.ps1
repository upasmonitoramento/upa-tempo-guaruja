param([switch]$Release)
$ErrorActionPreference = 'Stop'
$mobileDir = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'release') -PathType Leaf)) {
    throw 'Defina JAVA_HOME para a instalação do JDK 21 ou posterior indicada pelo Capacitor.'
}
$jdk = Get-Content -LiteralPath (Join-Path $env:JAVA_HOME 'release') -Raw
if ($jdk -notmatch '(?m)^JAVA_VERSION="([0-9]+)') { throw 'Versão do JDK não encontrada.' }
if ([int]$Matches[1] -lt 21) { throw 'O projeto requer JDK 21 ou posterior.' }
$androidSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
if (-not $androidSdk -or -not (Test-Path -LiteralPath (Join-Path $androidSdk 'platforms/android-36/android.jar') -PathType Leaf)) {
    throw 'Configure ANDROID_HOME com o SDK Android API 36 instalado.'
}
if ($Release) {
    foreach ($name in 'SAUDE_UPLOAD_KEYSTORE','SAUDE_UPLOAD_STORE_PASSWORD','SAUDE_UPLOAD_KEY_ALIAS','SAUDE_UPLOAD_KEY_PASSWORD','MOBILE_PRIVACY_URL','MOBILE_SUPPORT_URL') {
        if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Configuração obrigatória para AAB de envio: $name" }
    }
    if (-not [IO.Path]::IsPathRooted($env:SAUDE_UPLOAD_KEYSTORE) -or -not (Test-Path -LiteralPath $env:SAUDE_UPLOAD_KEYSTORE -PathType Leaf)) { throw 'Use o caminho absoluto de uma chave de upload existente.' }
}
Push-Location $mobileDir
$previousReleaseMode = $env:MOBILE_RELEASE
try {
    $env:MOBILE_RELEASE = if ($Release) { '1' } else { '0' }
    if ($Release) {
        npm run check:release
        if ($LASTEXITCODE -ne 0) { throw 'Validação da API ou dos links públicos falhou.' }
    }
    npm run sync -- android
    if ($LASTEXITCODE -ne 0) { throw 'A sincronização do Android falhou.' }
    Push-Location android
    try {
        $gradleTask = if ($Release) { ':app:bundleRelease' } else { ':app:assembleDebug' }
        & .\gradlew.bat $gradleTask
        if ($LASTEXITCODE -ne 0) { throw 'A compilação Android falhou.' }
        $artifact = if ($Release) { 'app/build/outputs/bundle/release/app-release.aab' } else { 'app/build/outputs/apk/debug/app-debug.apk' }
        if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) { throw 'O artefato esperado não foi gerado.' }
        $destination = if ($Release) { '../release/out/google-play' } else { '../release/out/testes' }
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Copy-Item -LiteralPath $artifact -Destination $destination
        Write-Output "Artefato em mobile/release/out: $artifact"
    } finally { Pop-Location }
} finally {
    $env:MOBILE_RELEASE = $previousReleaseMode
    Pop-Location
}
