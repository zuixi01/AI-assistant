param(
  [int]$DurationHours = 72,
  [int]$IntervalSeconds = 30,
  [string]$ApiUrl = "http://127.0.0.1:4000/api/health/ready",
  [string]$OutputPath = ".dbg/runtime-monitor-server-connection-refused.ndjson"
)

$deadline = (Get-Date).AddHours($DurationHours)

function Get-PortSnapshot {
  $ports = @(3100, 4000, 5433, 6380, 8001, 9002, 9003)
  $listening = @()
  foreach ($port in $ports) {
    $lines = netstat -ano | Select-String -Pattern (":{0}\s" -f $port)
    $listening += [pscustomobject]@{
      port = $port
      listening = [bool]($lines | Where-Object { $_.Line -match "LISTENING" })
      raw = ($lines | Select-Object -First 3 | ForEach-Object { $_.Line.Trim() }) -join " | "
    }
  }
  return $listening
}

function Get-ProjectProcesses {
  $processes = Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*D:\智能客服助手*" } |
    Select-Object Name, ProcessId, CommandLine

  $snapshots = @()
  foreach ($process in $processes) {
    $runtime = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $runtime) {
      continue
    }

    $snapshots += [pscustomobject]@{
      name = $process.Name
      pid = $process.ProcessId
      cpu = $runtime.CPU
      workingSet = $runtime.WorkingSet64
      privateMemory = $runtime.PrivateMemorySize64
      commandLine = $process.CommandLine
    }
  }

  return $snapshots
}

function Get-SystemSnapshot {
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk |
    Where-Object { $_.Name -eq "_Total" } |
    Select-Object -First 1

  [pscustomobject]@{
    cpuLoadPercent = $cpu.LoadPercentage
    totalMemoryBytes = [int64]$os.TotalVisibleMemorySize * 1024
    freeMemoryBytes = [int64]$os.FreePhysicalMemory * 1024
    diskTransfersPerSec = $disk.DiskTransfersPersec
    diskReadBytesPerSec = $disk.DiskReadBytesPersec
    diskWriteBytesPerSec = $disk.DiskWriteBytesPersec
  }
}

function Get-HealthSnapshot {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $ApiUrl -TimeoutSec 5
    return [pscustomobject]@{
      ok = $true
      statusCode = $response.StatusCode
      body = ($response.Content | ConvertFrom-Json)
    }
  } catch {
    return [pscustomobject]@{
      ok = $false
      statusCode = $null
      error = $_.Exception.Message
    }
  }
}

while ((Get-Date) -lt $deadline) {
  $record = [pscustomobject]@{
    timestamp = (Get-Date).ToString("o")
    apiHealth = Get-HealthSnapshot
    system = Get-SystemSnapshot
    ports = Get-PortSnapshot
    processes = Get-ProjectProcesses
  }

  $record | ConvertTo-Json -Depth 8 -Compress | Out-File -FilePath $OutputPath -Append -Encoding utf8
  Start-Sleep -Seconds $IntervalSeconds
}
