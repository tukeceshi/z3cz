# Register logon and shutdown tasks for a WSL install.
# Logon starts Docker Desktop, then waits inside WSL until mounts exist.
# Shutdown is best-effort: Windows may stop WSL before the 70s checkpoint finishes.
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._ -]{0,80}$')]
  [string] $Distro
)

$ErrorActionPreference = 'Stop'

$wslStart = "-d `"$Distro`" -u root -- bash /usr/local/lib/z3cz/reconcile.sh"
$wslStop = "-d `"$Distro`" -u root -- bash /usr/local/lib/z3cz/reconcile-stop.sh"

$actions = @()
$dockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (Test-Path -LiteralPath $dockerExe) {
  $actions += New-ScheduledTaskAction -Execute $dockerExe
}
$actions += New-ScheduledTaskAction -Execute 'wsl.exe' -Argument $wslStart
$startSettings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$startTrigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask `
  -TaskName 'z3cz-compose' `
  -Action $actions `
  -Trigger $startTrigger `
  -Settings $startSettings `
  -Force | Out-Null

$stopXml = @'
<?xml version="1.0"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Stop z3cz before Windows shuts down</Description>
  </RegistrationInfo>
  <Triggers>
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="System"&gt;&lt;Select Path="System"&gt;*[System[Provider[@Name='User32'] and (EventID=1074)]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>
    </EventTrigger>
  </Triggers>
  <Principals>
    <Principal>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT3M</ExecutionTimeLimit>
  </Settings>
  <Actions>
    <Exec>
      <Command>wsl.exe</Command>
      <Arguments>WSL_STOP</Arguments>
    </Exec>
  </Actions>
</Task>
'@
$escapedStop = [System.Security.SecurityElement]::Escape($wslStop)
Register-ScheduledTask -TaskName 'z3cz-compose-stop' -Xml ($stopXml.Replace('WSL_STOP', $escapedStop)) -Force | Out-Null
Write-Output "registered z3cz-compose for $Distro"
