[CmdletBinding()]
param([switch]$LibraryOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Shared pixel operations live here so pack.ps1 and verification use one decoder.
Add-Type -AssemblyName System.Drawing
if (-not ('PenelopeNativePixels' -as [type])) {
    $drawingRefs = @([System.Drawing.Bitmap].Assembly.Location, [System.Drawing.Rectangle].Assembly.Location) | Select-Object -Unique
    Add-Type -ReferencedAssemblies $drawingRefs -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class PenelopeNativePixels {
    public static Bitmap Open(string path, int width, int height) {
        var image = new Bitmap(path);
        if (image.RawFormat.Guid != ImageFormat.Png.Guid || image.Width != width || image.Height != height ||
            image.PixelFormat != PixelFormat.Format32bppArgb) {
            image.Dispose();
            throw new InvalidOperationException("Expected native RGBA PNG " + width + "x" + height + ": " + path);
        }
        return image;
    }
    public static Bitmap Canvas(int width, int height) {
        return new Bitmap(width, height, PixelFormat.Format32bppArgb);
    }
    public static void Copy(Bitmap source, Bitmap target, int col, int row) {
        for (int y = 0; y < 192; y++) for (int x = 0; x < 192; x++)
            target.SetPixel(col * 192 + x, row * 192 + y, source.GetPixel(x, y));
    }
    public static byte[] Pixels(Bitmap image, int col, int row, bool visibleOnly) {
        var bytes = new byte[192 * 192 * 4];
        for (int y = 0; y < 192; y++) for (int x = 0; x < 192; x++) {
            var c = image.GetPixel(col * 192 + x, row * 192 + y);
            int i = (y * 192 + x) * 4;
            if (!visibleOnly || c.A != 0) { bytes[i] = c.R; bytes[i+1] = c.G; bytes[i+2] = c.B; }
            bytes[i+3] = c.A;
        }
        return bytes;
    }
    // minX, minY, maxX, maxY, visible pixels, partial alpha, opaque, transparent.
    public static int[] Stats(Bitmap image, int col, int row) {
        int[] s = {192,192,-1,-1,0,0,0,0};
        for (int y = 0; y < 192; y++) for (int x = 0; x < 192; x++) {
            int a = image.GetPixel(col * 192 + x, row * 192 + y).A;
            if (a == 0) { s[7]++; continue; }
            s[0] = Math.Min(s[0],x); s[1] = Math.Min(s[1],y);
            s[2] = Math.Max(s[2],x); s[3] = Math.Max(s[3],y); s[4]++;
            if (a == 255) s[6]++; else s[5]++;
        }
        return s;
    }
    public static void Equal(Bitmap source, Bitmap sheet, int col, int row) {
        for (int y = 0; y < 192; y++) for (int x = 0; x < 192; x++) {
            var a = source.GetPixel(x,y); var b = sheet.GetPixel(col * 192 + x,row * 192 + y);
            if (a.A != b.A || (a.A != 0 && a.ToArgb() != b.ToArgb()))
                throw new InvalidOperationException("Native visible RGBA/alpha mismatch at cell " + row + "," + col + " pixel " + x + "," + y);
        }
    }
}
'@
}

function Get-PixelHash([byte[]]$Bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-PackContract {
    $map = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pose-map.json') -Raw | ConvertFrom-Json
    $ids = @($map.unique_poses)
    if ($map.counts.total -ne 130 -or $map.counts.unique_poses -ne 111 -or $map.cells.Count -ne 130 -or
        $ids.Count -ne 111 -or @($ids | Sort-Object -Unique).Count -ne 111) { throw 'Invalid 130-cell / 111-pose contract.' }
    $seen = @{}
    foreach ($cell in $map.cells) {
        $rows = if ($cell.sheet -eq 'gameplay') { 17 } else { 1 }
        $cols = if ($cell.sheet -eq 'gameplay') { 9 } else { 16 }
        $key = '{0}/{1}/{2}' -f $cell.sheet, $cell.row, $cell.col
        if ($cell.sheet -notin @('gameplay', 'lobby', 'victory') -or $cell.row -lt 0 -or $cell.row -ge $rows -or
            $cell.col -lt 0 -or $cell.col -ge $cols -or $seen.ContainsKey($key) -or $cell.pose -cnotin $ids) { throw "Invalid mapped cell: $key" }
        $seen[$key] = $true
    }
    if (@($map.cells.pose | Sort-Object -Unique).Count -ne 111) { throw 'Contract contains unused or missing canonical poses.' }
    foreach ($name in @('gameplay', 'lobby', 'victory')) {
        $expected = if ($name -eq 'gameplay') { 98 } else { 16 }
        $cells = @($map.cells | Where-Object sheet -EQ $name)
        if ($cells.Count -ne $expected) { throw "Wrong cell count for $name" }
        foreach ($row in $map.sheets.$name.rows) {
            $columns = @($cells | Where-Object row -EQ $row.row | Sort-Object col | ForEach-Object col)
            if (($columns -join ',') -ne ((0..($row.frames - 1)) -join ',')) { throw "Invalid row inventory: $name/$($row.row)" }
        }
    }
    foreach ($id in $ids) {
        if ($id -cnotmatch '^(g-r\d{2}-c\d{2}|[lv]-c\d{2})$') { throw "Unsafe pose ID: $id" }
    }
    return $map
}

function Get-SheetFile([string]$Name) {
    if ($Name -eq 'gameplay') { return 'penelope-candidate.png' }
    return "penelope-$Name-candidate.png"
}

function Invoke-PackVerification {
    $map = Get-PackContract
    $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'sources.json') -Raw | ConvertFrom-Json
    if (@($manifest.sources).Count -ne 111) { throw 'sources.json must record 111 sources.' }
    if ($manifest.pose_map_sha256 -ne (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'pose-map.json') -Algorithm SHA256).Hash.ToLowerInvariant()) { throw 'Pose contract hash changed.' }
    $sources = @{}
    $sourceHashes = @{}
    $sheets = [System.Collections.Generic.List[object]]::new()
    try {
        foreach ($id in $map.unique_poses) {
            $path = Join-Path $PSScriptRoot "raw/$id.png"
            $entry = @($manifest.sources | Where-Object pose -CEQ $id)
            if ($entry.Count -ne 1 -or $entry[0].png_sha256 -ne (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Source hash mismatch: $id" }
            $sources[$id] = [PenelopeNativePixels]::Open($path, 192, 192)
            if ([PenelopeNativePixels]::Stats($sources[$id], 0, 0)[4] -eq 0) { throw "Empty source: $id" }
            $sourceHashes[$id] = Get-PixelHash ([PenelopeNativePixels]::Pixels($sources[$id], 0, 0, $true))
            if ($entry[0].decoded_rgba_sha256 -ne (Get-PixelHash ([PenelopeNativePixels]::Pixels($sources[$id], 0, 0, $false)))) { throw "Decoded source hash mismatch: $id" }
        }
        foreach ($name in @('gameplay', 'lobby', 'victory')) {
            $cols = if ($name -eq 'gameplay') { 9 } else { 16 }
            $rows = if ($name -eq 'gameplay') { 17 } else { 1 }
            $path = Join-Path $PSScriptRoot (Get-SheetFile $name)
            $image = [PenelopeNativePixels]::Open($path, ($cols * 192), ($rows * 192))
            try {
                $frames = @($map.cells | Where-Object sheet -EQ $name)
                $rowReports = @(
                    for ($r = 0; $r -lt $rows; $r++) {
                        $frameReports = @(
                            for ($c = 0; $c -lt $cols; $c++) {
                                $cell = @($frames | Where-Object { $_.row -eq $r -and $_.col -eq $c })
                                $stats = [PenelopeNativePixels]::Stats($image, $c, $r)
                                if ($cell.Count -eq 0) {
                                    if ($stats[4] -ne 0) { throw "Nonblank tail: $name/$r/$c" }
                                    continue
                                }
                                [PenelopeNativePixels]::Equal($sources[$cell[0].pose], $image, $c, $r)
                                [pscustomobject]@{ col = $c; pose = $cell[0].pose; bounds = @($stats[0..3]); visible_pixels = $stats[4]; partial_alpha = $stats[5]; opaque_pixels = $stats[6]; transparent_pixels = $stats[7] }
                            }
                        )
                        $bounds = @(
                            ($frameReports | ForEach-Object { $_.bounds[0] } | Measure-Object -Minimum).Minimum
                            ($frameReports | ForEach-Object { $_.bounds[1] } | Measure-Object -Minimum).Minimum
                            ($frameReports | ForEach-Object { $_.bounds[2] } | Measure-Object -Maximum).Maximum
                            ($frameReports | ForEach-Object { $_.bounds[3] } | Measure-Object -Maximum).Maximum
                        )
                        [pscustomobject]@{
                            row = $r; frames = $frameReports.Count; blank_tail_cells = $cols - $frameReports.Count
                            bounds_in_cell_coordinates = $bounds
                            visible_pixels = ($frameReports | Measure-Object visible_pixels -Sum).Sum
                            partial_alpha = ($frameReports | Measure-Object partial_alpha -Sum).Sum
                            opaque_pixels = ($frameReports | Measure-Object opaque_pixels -Sum).Sum
                            cells = $frameReports
                        }
                    }
                )
                $sheets.Add([pscustomobject]@{ sheet = $name; file = Get-SheetFile $name; width = $image.Width; height = $image.Height; frames = $frames.Count; rows = $rowReports })
            } finally { $image.Dispose() }
        }
        $groups = @($sourceHashes.GetEnumerator() | Group-Object Value)
        return [pscustomobject]@{
            verified = $true; frame_size = 192; mapped_cells = 130; canonical_sources = 111; intentional_duplicate_cells = 19; blank_tail_cells = 55
            equality = 'Every mapped pixel: exact alpha, exact RGB wherever alpha > 0; no scaling or fitting.'
            unique_visible_rgba_hashes = $groups.Count
            identical_canonical_sources = @($groups | Where-Object Count -GT 1 | ForEach-Object { [pscustomobject]@{ hash = $_.Name; poses = @($_.Group.Name) } })
            diagnostic_note = 'Hash uniqueness is diagnostic only; repeated source images are not evidence of newly drawn animation. Visual animation acceptance belongs to coordinator.'
            sheets = @($sheets.ToArray())
        }
    } finally { foreach ($image in $sources.Values) { $image.Dispose() } }
}

if (-not $LibraryOnly) {
    Invoke-PackVerification | ConvertTo-Json -Depth 12
}
