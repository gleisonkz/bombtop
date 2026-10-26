$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = (git rev-parse --show-toplevel)
$path = Join-Path $root 'apps/client/public/sprites/patronus-pixel.png'
$source = [System.Drawing.Bitmap]::new($path)
if ($source.Width -ne 512 -or $source.Height -ne 192) { throw 'Incorrect atlas size' }
$hashes = @()
$masks = @()
$bounds = @()
$palette = [System.Collections.Generic.HashSet[int]]::new()
$strip = [System.Drawing.Bitmap]::new(1536,576)
for ($r = 0; $r -lt 3; $r++) {
 for ($f = 0; $f -lt 8; $f++) {
  $bytes = [System.Collections.Generic.List[byte]]::new()
  $mask = [System.Collections.Generic.List[byte]]::new()
  $minX=64; $minY=64; $maxX=-1; $maxY=-1
  for ($y=0; $y -lt 64; $y++) {
   for ($x=0; $x -lt 64; $x++) {
    $c=$source.GetPixel($f*64+$x,$r*64+$y)
    if ($c.A -ne 0 -and $c.A -ne 255) { throw 'Nonbinary alpha' }
    $bytes.AddRange([byte[]]@($c.R,$c.G,$c.B,$c.A))
    $mask.Add($c.A)
    if ($c.A -eq 255) {
     [void]$palette.Add($c.ToArgb())
     $minX=[Math]::Min($minX,$x); $maxX=[Math]::Max($maxX,$x)
     $minY=[Math]::Min($minY,$y); $maxY=[Math]::Max($maxY,$y)
    }
    for ($dy=0; $dy -lt 3; $dy++) { for ($dx=0; $dx -lt 3; $dx++) {
     $bg = [System.Drawing.Color]::FromArgb(255,35,48,66)
     $strip.SetPixel(($f*64+$x)*3+$dx,($r*64+$y)*3+$dy,$(if($c.A){$c}else{$bg}))
    }}
   }
  }
  if ($minX -lt 1 -or $minY -lt 1 -or $maxX -gt 62 -or $maxY -gt 62) { throw "Unsafe margin frame $r/$f : $minX,$minY $maxX,$maxY" }
  $hashes += [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($bytes.ToArray()))
  $masks += [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($mask.ToArray()))
  $bounds += @{row=$r;frame=$f;bounds=@($minX,$minY,$maxX,$maxY)}
 }
}
if (($hashes | Select-Object -Unique).Count -ne 24) { throw 'Duplicate frames' }
if (($masks | Select-Object -Unique).Count -ne 24) { throw 'Duplicate silhouette masks' }
$strip.Save((Join-Path $root 'concept/character-effects/patronus-pixel-strip.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$report=@{size=@(512,192);cell=@(64,64);uniqueFrames=24;uniqueSilhouettes=24;alpha=@(0,255);colors=$palette.Count;anchor=@(32,56);runtimeScale=0.45;bounds=$bounds}
$report | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'concept/character-effects/patronus-pixel-qa.json')
$report | ConvertTo-Json -Depth 2
$source.Dispose()
$strip.Dispose()
