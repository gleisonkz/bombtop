param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = $PSScriptRoot
$map = Get-Content -LiteralPath (Join-Path $assetRoot '../redraw/pose-map.json') -Raw | ConvertFrom-Json
$missing = @($map.unique_poses | Where-Object {
    -not (Test-Path -LiteralPath (Join-Path $assetRoot ('raw/' + $_ + '.png')))
})
if ($missing.Count) { throw ('Missing native PixelLab outputs: ' + ($missing -join ', ')) }
$sheet = [Drawing.Bitmap]::new(1188, 2952, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [Drawing.Graphics]::FromImage($sheet)
$graphics.CompositingMode = [Drawing.Drawing2D.CompositingMode]::SourceCopy
$graphics.Clear([Drawing.Color]::Transparent)
$manifest = [ordered]@{}
try {
    foreach ($pose in $map.unique_poses) {
        $source = Join-Path $assetRoot ('raw/' + $pose + '.png')
        $image = [Drawing.Bitmap]::FromFile($source)
        try {
            if ($image.Width -ne 128 -or $image.Height -ne 160) {
                throw ($pose + ': expected native 128x160 PNG')
            }
            foreach ($cell in @($map.cells | Where-Object { $_.pose -eq $pose })) {
                # Whole native frame, 2px transparent border. No resampling,
                # feature compositing, palette changes, or pose correction.
                $graphics.DrawImageUnscaled($image, [int]($cell.col * 132 + 2), [int]($cell.row * 164 + 2))
            }
        } finally { $image.Dispose() }
        $manifest[$pose] = @{ source = 'raw/' + $pose + '.png'; sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash }
    }
    $sheet.Save((Join-Path $assetRoot 'candidate.png'), [Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $sheet.Dispose() }
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $assetRoot 'sources.json')
@{
    width = 1188; height = 2952; frameW = 132; frameH = 164
    nativeFrame = @(128,160); padding = @(2,2); occupied = $map.cells.Count
    uniquePoses = $map.unique_poses.Count; counts = $map.counts
    character = 'e209a97e-98a4-4f0d-9152-37abfc8587cb'
    appearance = 'approved A1 only'; poseInput = 'COCO-18 coordinates only'
    productionReplaced = ((Test-Path -LiteralPath (Join-Path $assetRoot '../../../apps/client/public/sprites/lantern.png')) -and
        (Get-FileHash -LiteralPath (Join-Path $assetRoot 'candidate.png')).Hash -eq
        (Get-FileHash -LiteralPath (Join-Path $assetRoot '../../../apps/client/public/sprites/lantern.png')).Hash)
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $assetRoot 'report.json')
Write-Output 'Packed 108 cells from 84 new native PixelLab poses, without resampling.'
