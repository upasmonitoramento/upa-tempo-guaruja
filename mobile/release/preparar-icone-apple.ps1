param(
    [string]$MasterIcon = (Join-Path $PSScriptRoot '../../../identidade-visual/app-icon-v3-master.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$icon = [Drawing.Image]::FromFile((Resolve-Path -LiteralPath $MasterIcon).Path)
$directory = Join-Path $PSScriptRoot 'app-store/artes'
$bitmap = [Drawing.Bitmap]::new(1024, 1024, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [Drawing.Graphics]::FromImage($bitmap)

try {
    if ($icon.Width -ne $icon.Height -or $icon.Width -lt 1024) {
        throw 'Use o original quadrado da marca, com pelo menos 1024 pixels.'
    }
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.Clear([Drawing.Color]::FromArgb(17, 74, 158))
    $graphics.DrawImage($icon, 0, 0, 1024, 1024)
    $bitmap.Save((Join-Path $directory 'icone-1024.png'), [Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $icon.Dispose()
}
