[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'verify.ps1') -LibraryOnly
$map = Get-PackContract
$sources = @{}
$records = [System.Collections.Generic.List[object]]::new()
try {
    # Validate every input before replacing any candidate. Never modify raw files.
    foreach ($id in $map.unique_poses) {
        $path = Join-Path $PSScriptRoot "raw/$id.png"
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing native source: $path" }
        $image = [PenelopeNativePixels]::Open($path, 192, 192)
        $sources[$id] = $image
        if ([PenelopeNativePixels]::Stats($image, 0, 0)[4] -eq 0) { throw "Empty native source: $id" }
        $records.Add([pscustomobject]@{
            pose = $id; path = "raw/$id.png"; width = 192; height = 192
            png_sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
            decoded_rgba_sha256 = Get-PixelHash ([PenelopeNativePixels]::Pixels($image, 0, 0, $false))
        })
    }
    foreach ($name in @('gameplay', 'lobby', 'victory')) {
        $cols = if ($name -eq 'gameplay') { 9 } else { 16 }
        $rows = if ($name -eq 'gameplay') { 17 } else { 1 }
        $canvas = [PenelopeNativePixels]::Canvas(($cols * 192), ($rows * 192))
        try {
            foreach ($cell in @($map.cells | Where-Object sheet -EQ $name)) {
                [PenelopeNativePixels]::Copy($sources[$cell.pose], $canvas, $cell.col, $cell.row)
            }
            $canvas.Save((Join-Path $PSScriptRoot (Get-SheetFile $name)), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $canvas.Dispose() }
    }
    [pscustomobject]@{
        pose_map_sha256 = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'pose-map.json') -Algorithm SHA256).Hash.ToLowerInvariant()
        sources = @($records.ToArray())
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'sources.json') -Encoding utf8
} finally { foreach ($image in $sources.Values) { $image.Dispose() } }

$report = Invoke-PackVerification
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'report.json') -Encoding utf8
$report | Select-Object verified, mapped_cells, canonical_sources, unique_visible_rgba_hashes
