<#
.SYNOPSIS
    Yuwri Safe Temp Cleaner: shows (and, only if you agree, removes) old
    temporary files on Windows.

.DESCRIPTION
    WHAT IT DOES
      1. Looks in your own temporary folder (%TEMP%) for files that have not
         been changed in the last 24 hours.
      2. If you run it as administrator, it also looks in C:\Windows\Temp.
         Without administrator rights that folder is skipped, with a note.
      3. Only if you run it as administrator AND add -IncludeUpdateCache, it
         also looks at the Windows Update download cache
         (C:\Windows\SoftwareDistribution\Download). To clean that folder it
         stops the Windows Update and BITS services first, and starts them
         again afterwards, even if something goes wrong.

    By default it only PREVIEWS: it lists what it would remove and the total
    size, and deletes nothing. It then asks you to type Y to go ahead.
    Anything else (or just pressing Enter) quits without deleting anything.
    Use -Clean to skip the question.

    Files that are in use by another program are skipped and counted.

    WHAT IT NEVER TOUCHES
      The Recycle Bin, your Downloads, Documents, Desktop or any other personal
      folder, browser profiles or caches, the registry, and anything outside
      the folders listed above. It makes no network connections, sends no
      data anywhere, and never tries to give itself administrator rights.

    HOW TO RUN IT
      Option 1: right-click the file and choose "Run with PowerShell".
      Option 2: open PowerShell (as administrator if you also want
      C:\Windows\Temp cleaned), go to the folder you saved it in, and run:

          powershell -ExecutionPolicy Bypass -File .\yuwri-safe-temp-cleaner.ps1

      "-ExecutionPolicy Bypass" only applies to that one run; it does not
      change any setting on your computer.

    PROVIDED AS-IS
      This script is provided free and as-is, without any warranty. Read it
      before running it (it is plain text) and use it at your own risk. If you
      would rather someone else did it, get in touch: https://yuwri.pt/

.PARAMETER Clean
    Delete the previewed files without asking for confirmation.

.PARAMETER IncludeUpdateCache
    Also clean the Windows Update download cache. Requires administrator
    rights; ignored (with a note) otherwise.

.PARAMETER ShowAll
    List every file in the preview instead of only the largest ones.

.PARAMETER NoPause
    Do not wait for Enter before closing at the end.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\yuwri-safe-temp-cleaner.ps1
    Preview only, then asks whether to delete.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\yuwri-safe-temp-cleaner.ps1 -IncludeUpdateCache
    Run from an administrator PowerShell to include the Windows Update cache.

.NOTES
    Version 1.0 (October 2026). Yuwri, Seixal, Portugal. https://yuwri.pt/
#>

[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$IncludeUpdateCache,
    [switch]$ShowAll,
    [switch]$NoPause
)

Set-StrictMode -Version 2.0

$MinAgeHours = 24
$TopCount = 20
$cutoff = (Get-Date).AddHours(-$MinAgeHours)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Format-Size {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return ('{0:N2} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N0} KB' -f ($Bytes / 1KB)) }
    return ('{0:N0} bytes' -f $Bytes)
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Wait-BeforeClose {
    if (-not $NoPause) {
        try { [void](Read-Host 'Press Enter to close') } catch { }
    }
}

# Walks a folder without following junctions or symbolic links, and returns
# the files last changed before the cutoff. Folders it cannot read are skipped.
function Get-OldFiles {
    param(
        [string]$Root,
        [datetime]$Before,
        [switch]$IgnoreAge
    )
    $found = New-Object System.Collections.Generic.List[System.IO.FileInfo]
    $pending = New-Object System.Collections.Generic.Stack[string]
    $pending.Push($Root)
    $reparse = [System.IO.FileAttributes]::ReparsePoint
    while ($pending.Count -gt 0) {
        $dir = $pending.Pop()
        $items = @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)
        foreach ($item in $items) {
            if ($item.Attributes -band $reparse) { continue }
            if ($item.PSIsContainer) {
                $pending.Push($item.FullName)
            }
            elseif ($IgnoreAge -or $item.LastWriteTime -lt $Before) {
                $found.Add($item)
            }
        }
    }
    return ,$found
}

# A last check that a folder really is a temp folder before touching it.
function Test-SafeTarget {
    param([string]$Path, [string[]]$AllowedLeafNames)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return $false }
    $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ($full.Length -lt 8) { return $false }  # never a drive root
    $blocked = @($env:USERPROFILE, $env:SystemRoot, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData, $env:LOCALAPPDATA, $env:APPDATA) |
        Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }
    if ($blocked -contains $full) { return $false }
    $leaf = Split-Path -Leaf $full
    $parentLeaf = Split-Path -Leaf (Split-Path -Parent $full)
    foreach ($name in $AllowedLeafNames) {
        if ($leaf -ieq $name) { return $true }
        # Remote Desktop sessions use numbered folders such as ...\Temp\2
        if ($parentLeaf -ieq $name -and $leaf -match '^\d+$') { return $true }
    }
    return $false
}

function Remove-Files {
    param([System.Collections.Generic.List[System.IO.FileInfo]]$Files, [string]$Root)
    $result = [pscustomobject]@{ Removed = 0; Freed = [double]0; InUse = 0 }
    $touchedDirs = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($f in $Files) {
        try {
            $size = $f.Length
            Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
            $result.Removed++
            $result.Freed += $size
            [void]$touchedDirs.Add($f.DirectoryName)
        }
        catch {
            # In use, locked or protected: leave it alone, just count it.
            $result.InUse++
        }
    }
    # Tidy up folders that are now empty because of this run, deepest first.
    # The temp folder itself is always kept.
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $dirs = @($touchedDirs | Sort-Object { $_.Length } -Descending)
    foreach ($d in $dirs) {
        if ($d.TrimEnd('\') -ieq $rootFull) { continue }
        try {
            $info = Get-Item -LiteralPath $d -Force -ErrorAction Stop
            if ($info.CreationTime -ge $cutoff) { continue }
            if (@(Get-ChildItem -LiteralPath $d -Force -ErrorAction Stop).Count -eq 0) {
                Remove-Item -LiteralPath $d -Force -ErrorAction Stop
            }
        }
        catch { }
    }
    return $result
}

function Show-Preview {
    param($Target)
    $files = $Target.Files
    $total = [double]0
    foreach ($f in $files) { $total += $f.Length }
    $Target.Size = $total
    Write-Host ''
    Write-Host ("[{0}] {1}" -f $Target.Name, $Target.Path) -ForegroundColor Cyan
    if ($files.Count -eq 0) {
        Write-Host '  Nothing to remove here.' -ForegroundColor Gray
        return
    }
    Write-Host ("  {0} files, {1}" -f $files.Count, (Format-Size $total)) -ForegroundColor White
    $list = $files | Sort-Object Length -Descending
    if (-not $ShowAll) { $list = $list | Select-Object -First $TopCount }
    foreach ($f in $list) {
        Write-Host ("    {0,10}  {1}" -f (Format-Size $f.Length), $f.FullName) -ForegroundColor Gray
    }
    if (-not $ShowAll -and $files.Count -gt $TopCount) {
        Write-Host ("    ...and {0} smaller files (run with -ShowAll to list them all)" -f ($files.Count - $TopCount)) -ForegroundColor DarkGray
    }
}

# ---------------------------------------------------------------------------
# Work out what to look at
# ---------------------------------------------------------------------------

$isAdmin = Test-IsAdmin

Write-Host ''
Write-Host 'Yuwri Safe Temp Cleaner' -ForegroundColor Green
Write-Host ("Looking for temporary files older than {0} hours. Nothing is deleted without your OK." -f $MinAgeHours)
if ($isAdmin) {
    Write-Host 'Running as administrator.' -ForegroundColor Gray
}
else {
    Write-Host 'Running without administrator rights: only your own temp folder will be checked.' -ForegroundColor Yellow
}

$targets = New-Object System.Collections.Generic.List[object]
$notes = New-Object System.Collections.Generic.List[string]

$userTemp = $env:TEMP
if (Test-SafeTarget -Path $userTemp -AllowedLeafNames @('Temp', 'Tmp')) {
    $targets.Add([pscustomobject]@{ Name = 'Your temp folder'; Path = $userTemp; Files = $null; Size = 0; IsUpdateCache = $false })
}
else {
    $notes.Add("Skipped your temp folder: '$userTemp' does not look like a normal temp folder.")
}

$winTemp = Join-Path $env:SystemRoot 'Temp'
if ($isAdmin) {
    if (Test-SafeTarget -Path $winTemp -AllowedLeafNames @('Temp')) {
        $targets.Add([pscustomobject]@{ Name = 'Windows temp folder'; Path = $winTemp; Files = $null; Size = 0; IsUpdateCache = $false })
    }
    else {
        $notes.Add("Skipped $winTemp (not found).")
    }
}
else {
    $notes.Add("Skipped $winTemp (needs administrator rights).")
}

$updateCache = Join-Path $env:SystemRoot 'SoftwareDistribution\Download'
if ($IncludeUpdateCache) {
    if (-not $isAdmin) {
        $notes.Add('Skipped the Windows Update cache: -IncludeUpdateCache needs administrator rights.')
    }
    elseif (Test-SafeTarget -Path $updateCache -AllowedLeafNames @('Download')) {
        $targets.Add([pscustomobject]@{ Name = 'Windows Update download cache'; Path = $updateCache; Files = $null; Size = 0; IsUpdateCache = $true })
    }
    else {
        $notes.Add("Skipped the Windows Update cache: $updateCache was not found.")
    }
}

# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------

foreach ($t in $targets) {
    # The update cache is emptied as a whole (with the services stopped);
    # the temp folders only lose files older than the cutoff.
    $t.Files = Get-OldFiles -Root $t.Path -Before $cutoff -IgnoreAge:($t.IsUpdateCache)
    Show-Preview -Target $t
}

foreach ($n in $notes) { Write-Host ("Note: {0}" -f $n) -ForegroundColor Yellow }

$grandCount = 0
$grandSize = [double]0
foreach ($t in $targets) { $grandCount += $t.Files.Count; $grandSize += $t.Size }

Write-Host ''
Write-Host ("Total that would be removed: {0} files, {1}" -f $grandCount, (Format-Size $grandSize)) -ForegroundColor Green

if ($grandCount -eq 0) {
    Write-Host 'Nothing to clean. All done.'
    Wait-BeforeClose
    return
}

# ---------------------------------------------------------------------------
# Confirm
# ---------------------------------------------------------------------------

$go = [bool]$Clean
if (-not $go) {
    Write-Host ''
    $answer = ''
    try { $answer = Read-Host 'Type Y and press Enter to delete these files now (anything else quits)' } catch { $answer = '' }
    $go = ($answer.Trim() -ieq 'Y')
}

if (-not $go) {
    Write-Host 'OK, nothing was deleted.' -ForegroundColor Yellow
    Wait-BeforeClose
    return
}

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

$totalRemoved = 0
$totalFreed = [double]0
$totalInUse = 0

foreach ($t in $targets) {
    if ($t.Files.Count -eq 0) { continue }
    Write-Host ''
    Write-Host ("Cleaning: {0}" -f $t.Name) -ForegroundColor Cyan

    if (-not $t.IsUpdateCache) {
        $r = Remove-Files -Files $t.Files -Root $t.Path
    }
    else {
        $services = @('wuauserv', 'bits')
        $wasRunning = @()
        $stopped = $true
        try {
            foreach ($s in $services) {
                $svc = Get-Service -Name $s -ErrorAction Stop
                if ($svc.Status -ne 'Stopped') {
                    $wasRunning += $s
                    Write-Host ("  Stopping service {0}..." -f $s) -ForegroundColor Gray
                    Stop-Service -Name $s -ErrorAction Stop
                    $svc.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
                }
            }
        }
        catch {
            $stopped = $false
            Write-Host ("  Could not stop the update services ({0}). The update cache was left alone." -f $_.Exception.Message) -ForegroundColor Yellow
        }
        try {
            if ($stopped) {
                $r = Remove-Files -Files $t.Files -Root $t.Path
            }
            else {
                $r = [pscustomobject]@{ Removed = 0; Freed = [double]0; InUse = $t.Files.Count }
            }
        }
        finally {
            foreach ($s in $wasRunning) {
                try {
                    Write-Host ("  Starting service {0} again..." -f $s) -ForegroundColor Gray
                    Start-Service -Name $s -ErrorAction Stop
                }
                catch {
                    Write-Host ("  Could not restart {0}. Restarting the computer will start it again." -f $s) -ForegroundColor Yellow
                }
            }
        }
    }

    Write-Host ("  Removed {0} files ({1}). Skipped {2} in use." -f $r.Removed, (Format-Size $r.Freed), $r.InUse) -ForegroundColor White
    $totalRemoved += $r.Removed
    $totalFreed += $r.Freed
    $totalInUse += $r.InUse
}

Write-Host ''
Write-Host ("Done. Removed {0} files and freed {1}." -f $totalRemoved, (Format-Size $totalFreed)) -ForegroundColor Green
if ($totalInUse -gt 0) {
    Write-Host ("{0} files were in use and were skipped. That is normal; a restart usually frees them." -f $totalInUse) -ForegroundColor Gray
}
Wait-BeforeClose
