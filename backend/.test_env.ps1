
# Source the .env file values
. (\C:\Users\iddyc\AppData\Local\Programs\Python\Python314\Scripts\activate.ps1 2>/dev/null || echo skip)
Get-Content 'C:\Engineer\Vulnix\backend\.env' | ForEach-Object { if (\ -match '^([^=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable(\[1], \[2], 'User') } }

