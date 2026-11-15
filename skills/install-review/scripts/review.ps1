param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$audit = Join-Path $here 'audit.mjs'

$node = $env:DSH_DESKTOP_NODE_EXECUTABLE
if (-not $node -or -not (Test-Path -LiteralPath $node)) {
  $candidates = @(
    'E:\installed app\DSH\resources\runtime\primary-runtime\dependencies\node\bin\node.exe',
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe')
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { $node = $c; break }
  }
}
if (-not $node) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $node = $cmd.Source }
}
if (-not $node) {
  Write-Error '找不到 node.exe：设置 DSH_DESKTOP_NODE_EXECUTABLE 或把 node 加入 PATH'
  exit 70
}

# 透传所有参数给 audit.mjs（不再支持 --keep/--out）
& $node $audit @Rest
exit $LASTEXITCODE
