Add-Type -AssemblyName System.Drawing

$src = "C:\Users\km379\.gemini\antigravity-ide\brain\860e6d95-1940-4051-bdf2-86f50b14f8b2\xbox_steam_logo_1791802203725.jpg"
$buildDir = "c:\GitHub\SteamFix for Xbox\build"
$assetsDir = "c:\GitHub\SteamFix for Xbox\src\renderer\assets"

if (!(Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir -Force | Out-Null }
if (!(Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null }

$original = [System.Drawing.Image]::FromFile($src)

function Resize-Bitmap($srcImg, $width, $height) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $width, $height)
    $g.Dispose()
    return $bmp
}

# 1. Save PNGs
$png512 = Resize-Bitmap $original 512 512
$png512.Save("$buildDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png512.Save("$assetsDir\logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png512.Dispose()

$png64 = Resize-Bitmap $original 64 64
$png64.Save("$assetsDir\logo-64.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png64.Dispose()

# 2. Build multi-size Windows .ICO file
# Sizes: 256, 128, 64, 48, 32, 16
$sizes = @(256, 128, 64, 48, 32, 16)
$pngStreams = @()

foreach ($s in $sizes) {
    $resized = Resize-Bitmap $original $s $s
    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += @{
        Size = $s
        Bytes = $ms.ToArray()
    }
    $ms.Dispose()
    $resized.Dispose()
}

$original.Dispose()

# Write ICO binary
$fs = [System.IO.File]::Create("$buildDir\icon.ico")
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header (6 bytes)
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type 1 = ICO
$bw.Write([UInt16]$sizes.Count) # Image count

# Calculate initial image data offset (6 + 16 * count)
$offset = 6 + (16 * $sizes.Count)

# ICONDIRENTRY for each image (16 bytes each)
foreach ($item in $pngStreams) {
    $w = if ($item.Size -eq 256) { 0 } else { [byte]$item.Size }
    $h = if ($item.Size -eq 256) { 0 } else { [byte]$item.Size }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0) # Palette color count (0 for >= 8bpp)
    $bw.Write([byte]0) # Reserved
    $bw.Write([UInt16]1) # Color planes
    $bw.Write([UInt16]32) # Bits per pixel
    $bw.Write([UInt32]$item.Bytes.Length) # Image data size
    $bw.Write([UInt32]$offset) # Offset
    $offset += $item.Bytes.Length
}

# Image Data chunks
foreach ($item in $pngStreams) {
    $bw.Write($item.Bytes)
}

$bw.Flush()
$bw.Close()
$fs.Close()

Write-Output "Successfully created icon.ico, icon.png, and logo assets!"
