param([string]$AssetRoot = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$assetRoot = (Resolve-Path -LiteralPath $AssetRoot).Path
$secret = [Environment]::GetEnvironmentVariable('PIXELLAB_API_KEY', 'Process')
if (-not $secret) { $secret = [Environment]::GetEnvironmentVariable('PIXELLAB_API_KEY', 'User') }
if (-not $secret) { throw 'PIXELLAB_API_KEY is not configured locally.' }
New-Item -ItemType Directory -Force (Join-Path $assetRoot 'raw') | Out-Null
$entries = Get-Content -LiteralPath (Join-Path $assetRoot 'jobs.json') -Raw | ConvertFrom-Json
$entries | ForEach-Object -Parallel {
    $entry = $_
    $root = $using:assetRoot
    $missing = @($entry.poses | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $root ('raw/' + $_ + '.png')))
    })
    if ($missing.Count -eq 0) { Write-Output ('row ' + $entry.row + ': cached'); return }
    try {
        $uri = 'https://api.pixellab.ai/v2/background-jobs/' + $entry.job_id
        $response = Invoke-RestMethod -Uri $uri -Headers @{Authorization = 'Bearer ' + $using:secret} -TimeoutSec 55
        if ($response.status -ne 'completed') {
            Write-Output ('row ' + $entry.row + ': ' + $response.status)
            return
        }
        $images = @($response.last_response.images)
        $expected = if ($entry.output_count) { $entry.output_count } else { $entry.poses.Count }
        if ($images.Count -ne $expected) { throw 'Unexpected returned frame count.' }
        for ($index = 0; $index -lt $entry.poses.Count; $index++) {
            $path = Join-Path $root ('raw/' + $entry.poses[$index] + '.png')
            $encoded = ($images[$index].base64 -split ',')[-1]
            [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($encoded))
        }
        Write-Output ('row ' + $entry.row + ': downloaded ' + $entry.poses.Count)
    } catch {
        Write-Output ('row ' + $entry.row + ': collection error: ' + $_.Exception.Message)
    }
} -ThrottleLimit 4
