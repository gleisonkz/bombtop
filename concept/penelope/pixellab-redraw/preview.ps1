param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = $PSScriptRoot
$map = Get-Content -LiteralPath (Join-Path $assetRoot 'pose-map.json') -Raw | ConvertFrom-Json
function Write-Contact([string]$Name, [string[]]$Poses, [int]$Columns) {
    if (@($Poses | Where-Object { -not (Test-Path -LiteralPath (Join-Path $assetRoot ('raw/' + $_ + '.png'))) }).Count) { return }
    $canvas = [Drawing.Bitmap]::new(($Columns * 192), ([int][Math]::Ceiling($Poses.Count / $Columns) * 192))
    $g = [Drawing.Graphics]::FromImage($canvas)
    $font = [Drawing.Font]::new('Segoe UI', 9)
    $g.Clear([Drawing.Color]::FromArgb(255, 30, 34, 40))
    try {
        for ($i = 0; $i -lt $Poses.Count; $i++) {
            $x = ($i % $Columns) * 192
            $y = [int][Math]::Floor($i / $Columns) * 192
            $image = [Drawing.Bitmap]::FromFile((Join-Path $assetRoot ('raw/' + $Poses[$i] + '.png')))
            try { $g.DrawImageUnscaled($image, $x, $y) } finally { $image.Dispose() }
            $g.DrawString($Poses[$i], $font, [Drawing.Brushes]::LightGray, [single]($x + 4), [single]($y + 3))
        }
        $canvas.Save((Join-Path $assetRoot $Name), [Drawing.Imaging.ImageFormat]::Png)
    } finally { $font.Dispose(); $g.Dispose(); $canvas.Dispose() }
}
$north = @($map.unique_poses | Where-Object { $meta = $map.poses.$_; $meta.sheet -eq 'gameplay' -and $meta.row -in @(2,5,10,13,16) })
Write-Contact 'north-review.png' $north 6
$faces = @('g-r00-c00','g-r03-c00','g-r03-c03','g-r04-c03','g-r08-c00','g-r08-c04','g-r08-c07','g-r11-c00','g-r14-c01','g-r14-c05','g-r06-c00','g-r07-c04')
Write-Contact 'face-review.png' $faces 4
$cast = @($map.unique_poses | Where-Object { $meta = $map.poses.$_; $meta.sheet -eq 'gameplay' -and $meta.row -in @(8,9,10) })
Write-Contact 'kiss-review.png' $cast 6
$extras = @($map.unique_poses | Where-Object { $map.poses.$_.sheet -ne 'gameplay' })
Write-Contact 'extras-review.png' $extras 8
& ffmpeg -hide_banner -loglevel error -y -framerate 8 -i "$assetRoot/raw/g-r03-c%02d.png" -framerate 8 -i "$assetRoot/raw/g-r04-c%02d.png" -framerate 8 -i "$assetRoot/raw/g-r05-c%02d.png" -filter_complex '[0:v][1:v][2:v]hstack=inputs=3,scale=1152:384:flags=neighbor,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=none' -loop 0 "$assetRoot/walk-preview.gif"
foreach ($entry in @(@{name='lobby';prefix='l'}, @{name='victory';prefix='v'})) {
    if (Test-Path -LiteralPath "$assetRoot/raw/$($entry.prefix)-c15.png") {
        & ffmpeg -hide_banner -loglevel error -y -framerate 8 -i "$assetRoot/raw/$($entry.prefix)-c%02d.png" -vf 'scale=384:384:flags=neighbor,split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=none' -loop 0 "$assetRoot/$($entry.name)-preview.gif"
    }
}
