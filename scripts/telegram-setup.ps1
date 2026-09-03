<#
.SYNOPSIS
    Configura il bot Telegram di Casa Nostra dall'inizio alla fine.

.DESCRIPTION
    Guida l'intera configurazione nell'ordine giusto:
      1. verifica il token e mostra l'username del bot
      2. scopre l'id del gruppo (va fatto PRIMA di registrare il webhook)
      3. genera il secret condiviso
      4. stampa le variabili d'ambiente da incollare su Vercel
      5. controlla che il deploy risponda come deve, prima di registrare
      6. registra il webhook e ne verifica lo stato

    Se qualcosa non torna, dice quale delle quattro cause e' e cosa fare.

.PARAMETER BotToken
    Token del bot da @BotFather. Se omesso viene chiesto.

.PARAMETER AppUrl
    Url pubblico dell'app (es. https://casanostra.andreamontanaro.it).
    Il percorso /api/telegram/webhook viene aggiunto in automatico.

.PARAMETER ChatId
    Id del gruppo, se lo conosci gia'. Altrimenti lo scopre lo script.

.PARAMETER Secret
    Secret condiviso con Telegram. Se omesso ne genera uno nuovo.
    Passa quello che hai gia' su Vercel se lo hai gia' impostato.

.PARAMETER Info
    Mostra solo lo stato attuale del webhook ed esce.

.PARAMETER RemoveWebhook
    Rimuove il webhook ed esce.

.EXAMPLE
    .\telegram-setup.ps1 -AppUrl https://casanostra.andreamontanaro.it

.EXAMPLE
    .\telegram-setup.ps1 -Info

.NOTES
    Se Windows blocca l'esecuzione degli script:
        powershell -ExecutionPolicy Bypass -File .\scripts\telegram-setup.ps1
#>

[CmdletBinding()]
param(
    [string] $BotToken,
    [string] $AppUrl,
    [string] $ChatId,
    [string] $Secret,
    [switch] $Info,
    [switch] $RemoveWebhook
)

$ErrorActionPreference = 'Stop'
$script:WebhookRemoved = $false
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

function Write-Step { param([string] $Text) Write-Host ''; Write-Host $Text -ForegroundColor Cyan }
function Write-Good { param([string] $Text) Write-Host "  [ok] $Text" -ForegroundColor Green }
function Write-Note { param([string] $Text) Write-Host "  [!]  $Text" -ForegroundColor Yellow }
function Write-Bad  { param([string] $Text) Write-Host "  [x]  $Text" -ForegroundColor Red }
function Write-Info2 { param([string] $Text) Write-Host "       $Text" -ForegroundColor DarkGray }

# Legge una proprieta' senza esplodere se non esiste: le risposte di Telegram
# omettono i campi vuoti (es. last_error_message quando non ci sono errori).
function Get-Prop {
    param($Object, [string] $Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

# Estrae il messaggio d'errore di Telegram, che arriva nel corpo della risposta
# e non nell'eccezione (e in PS 5.1 e PS 7 sta in due posti diversi).
function Read-ErrorBody {
    param($ErrorRecord)

    $details = Get-Prop $ErrorRecord 'ErrorDetails'
    $message = Get-Prop $details 'Message'
    if ($message) {
        try {
            $parsed = ConvertFrom-Json $message
            $description = Get-Prop $parsed 'description'
            if ($description) { return $description }
        }
        catch { return $message }
    }

    $response = Get-Prop (Get-Prop $ErrorRecord 'Exception') 'Response'
    if ($response) {
        try {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $raw = $reader.ReadToEnd()
            $reader.Close()
            $parsed = ConvertFrom-Json $raw
            $description = Get-Prop $parsed 'description'
            if ($description) { return $description }
            return $raw
        }
        catch { }
    }

    return $ErrorRecord.Exception.Message
}

function Invoke-Telegram {
    param(
        [Parameter(Mandatory = $true)] [string] $Method,
        [hashtable] $Body = @{}
    )

    $uri = "https://api.telegram.org/bot$($script:Token)/$($Method)"
    $json = ConvertTo-Json -InputObject $Body -Depth 6 -Compress

    try {
        $response = Invoke-RestMethod -Uri $uri -Method Post -Body $json `
            -ContentType 'application/json; charset=utf-8' -TimeoutSec 30
    }
    catch {
        throw "$Method non riuscito: $(Read-ErrorBody $_)"
    }

    if (-not (Get-Prop $response 'ok')) {
        throw "$Method non riuscito: $(Get-Prop $response 'description')"
    }
    return (Get-Prop $response 'result')
}

function New-WebhookSecret {
    $bytes = New-Object 'System.Byte[]' 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

function Resolve-WebhookUrl {
    param([string] $BaseUrl)

    $trimmed = $BaseUrl.Trim().TrimEnd('/')
    if ($trimmed -notmatch '^https://') {
        throw 'L''url deve iniziare con https:// - Telegram non accetta http.'
    }
    if ($trimmed.EndsWith('/api/telegram/webhook')) { return $trimmed }
    return "$trimmed/api/telegram/webhook"
}

# Interroga l'endpoint dell'app senza secret: il codice di risposta dice
# esattamente a che punto e' il deploy. E' il controllo che evita di registrare
# un webhook verso un'app che non puo' rispondere.
function Get-EndpointStatus {
    param([string] $Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Post -Body '{}' `
            -ContentType 'application/json' -UseBasicParsing -TimeoutSec 30
        return [int] $response.StatusCode
    }
    catch {
        $response = Get-Prop (Get-Prop $_ 'Exception') 'Response'
        if ($response) {
            try { return [int] $response.StatusCode } catch { return 0 }
        }
        return 0
    }
}

function Show-WebhookInfo {
    param($WebhookInfo)

    $url = Get-Prop $WebhookInfo 'url'
    if ($url) { Write-Good "Webhook registrato su $url" }
    else { Write-Note 'Nessun webhook registrato.' }

    $pending = Get-Prop $WebhookInfo 'pending_update_count'
    if ($pending) { Write-Info2 "Update in coda: $pending" }

    $lastError = Get-Prop $WebhookInfo 'last_error_message'
    if ($lastError) {
        Write-Bad "Ultimo errore: $lastError"
        if ($lastError -match '404') {
            Write-Info2 'Il deploy a quell''url non contiene il codice del bot: la PR non e'' ancora mergiata, oppure l''url e'' sbagliato.'
        }
        elseif ($lastError -match '403') {
            Write-Info2 'TELEGRAM_WEBHOOK_SECRET su Vercel non coincide con il secret registrato qui.'
        }
        elseif ($lastError -match '500') {
            Write-Info2 'Manca TELEGRAM_WEBHOOK_SECRET o SUPABASE_SERVICE_ROLE_KEY nell''ambiente del deploy.'
        }
    }
    else {
        if ($url) { Write-Good 'Nessun errore recente.' }
    }
}

# ---------------------------------------------------------------------------
# Token
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'Casa Nostra - configurazione del bot Telegram' -ForegroundColor White

if (-not $BotToken) {
    $BotToken = Read-Host 'Token del bot (da @BotFather)'
}
$script:Token = $BotToken.Trim()
if (-not $script:Token) { throw 'Serve il token del bot.' }

Write-Step '1. Verifica del token'
$me = Invoke-Telegram -Method 'getMe'
$botUsername = Get-Prop $me 'username'
Write-Good "Bot @$botUsername ($(Get-Prop $me 'first_name'))"

# --- modalita' rapide -------------------------------------------------------

if ($Info) {
    Write-Step 'Stato del webhook'
    Show-WebhookInfo (Invoke-Telegram -Method 'getWebhookInfo')
    Write-Host ''
    return
}

if ($RemoveWebhook) {
    Write-Step 'Rimozione del webhook'
    Invoke-Telegram -Method 'deleteWebhook' -Body @{ drop_pending_updates = $true } | Out-Null
    Write-Good 'Webhook rimosso.'
    Write-Host ''
    return
}

# ---------------------------------------------------------------------------
# 2. Id del gruppo
# ---------------------------------------------------------------------------

Write-Step '2. Id del gruppo'

if ($ChatId) {
    Write-Good "Uso quello passato: $ChatId"
}
else {
    # getUpdates e webhook si escludono a vicenda: se ce n'e' uno attivo va tolto
    # per un attimo, e alla fine dello script viene comunque riregistrato.
    $existing = Invoke-Telegram -Method 'getWebhookInfo'
    if (Get-Prop $existing 'url') {
        Write-Note 'C''e'' gia'' un webhook attivo, e Telegram non consente di leggere gli update mentre lo e''.'
        $answer = Read-Host 'Lo rimuovo temporaneamente per leggere l''id del gruppo? (s/n)'
        if ($answer -eq 's') {
            Invoke-Telegram -Method 'deleteWebhook' -Body @{ drop_pending_updates = $false } | Out-Null
            $script:WebhookRemoved = $true
            Write-Good 'Webhook rimosso, verra'' registrato di nuovo alla fine.'
        }
        else {
            throw 'Senza id del gruppo non posso proseguire: rilancia con -ChatId <id>.'
        }
    }

    $chats = @{}
    while ($chats.Count -eq 0) {
        # allowed_updates viene omesso di proposito: e' un array di un solo
        # elemento, il caso in cui ConvertTo-Json non si comporta allo stesso
        # modo su PowerShell 5.1 e 7. Il default va benissimo.
        foreach ($update in (Invoke-Telegram -Method 'getUpdates' -Body @{ limit = 100 })) {
            $chat = Get-Prop (Get-Prop $update 'message') 'chat'
            if (-not $chat) { continue }
            $name = Get-Prop $chat 'title'
            if (-not $name) {
                $name = (@((Get-Prop $chat 'first_name'), (Get-Prop $chat 'last_name')) | Where-Object { $_ }) -join ' '
            }
            $chats[[string](Get-Prop $chat 'id')] = $name
        }

        if ($chats.Count -eq 0) {
            Write-Note 'Nessun messaggio in coda su Telegram.'
            Write-Info2 'Scrivi un messaggio qualsiasi nel gruppo (es. /id) e premi Invio qui.'
            Read-Host 'Premi Invio quando hai scritto nel gruppo' | Out-Null
        }
    }

    $groups = @($chats.Keys | Where-Object { [double] $_ -lt 0 })

    if ($groups.Count -eq 1) {
        $ChatId = $groups[0]
        Write-Good "Gruppo trovato: $ChatId ($($chats[$ChatId]))"
    }
    else {
        Write-Host '  Chat che hanno scritto al bot:'
        foreach ($key in $chats.Keys) {
            $kind = 'chat privata'
            if ([double] $key -lt 0) { $kind = 'gruppo' }
            Write-Host "    $key  $($chats[$key])  - $kind"
        }
        $ChatId = (Read-Host 'Id del gruppo (quello negativo)').Trim()
    }
}

if (-not $ChatId) { throw 'Serve l''id del gruppo.' }

# ---------------------------------------------------------------------------
# 3. Secret
# ---------------------------------------------------------------------------

Write-Step '3. Secret del webhook'

if ($Secret) {
    Write-Good 'Uso il secret passato.'
}
else {
    $Secret = New-WebhookSecret
    Write-Good 'Secret generato.'
    Write-Info2 'Se ne avevi gia'' uno su Vercel, interrompi e rilancia con -Secret <valore>.'
}

# ---------------------------------------------------------------------------
# 4. Variabili d'ambiente
# ---------------------------------------------------------------------------

if (-not $AppUrl) {
    $AppUrl = Read-Host 'Url pubblico dell''app (es. https://casanostra.andreamontanaro.it)'
}
$webhookUrl = Resolve-WebhookUrl $AppUrl
$siteUrl = $AppUrl.Trim().TrimEnd('/')

Write-Step '4. Variabili d''ambiente su Vercel'
Write-Host '  Project Settings > Environment Variables, ambiente Production:'
Write-Host ''
Write-Host "    TELEGRAM_BOT_TOKEN=$($script:Token)"
Write-Host "    TELEGRAM_CHAT_ID=$ChatId"
Write-Host "    TELEGRAM_WEBHOOK_SECRET=$Secret"
Write-Host "    TELEGRAM_BOT_USERNAME=$botUsername"
Write-Host "    NEXT_PUBLIC_SITE_URL=$siteUrl"
Write-Host '    SUPABASE_SERVICE_ROLE_KEY=<Supabase > Project Settings > API > service_role>'
Write-Host ''
Write-Note 'Dopo averle salvate serve un Redeploy: le variabili valgono dal deploy successivo.'

$envFile = Join-Path (Split-Path -Parent $PSCommandPath) '..\.env.telegram.txt'
try {
    $lines = @(
        "TELEGRAM_BOT_TOKEN=$($script:Token)",
        "TELEGRAM_CHAT_ID=$ChatId",
        "TELEGRAM_WEBHOOK_SECRET=$Secret",
        "TELEGRAM_BOT_USERNAME=$botUsername",
        "NEXT_PUBLIC_SITE_URL=$siteUrl"
    )
    Set-Content -Path $envFile -Value $lines -Encoding UTF8
    Write-Info2 "Copia salvata in $((Resolve-Path $envFile).Path) - contiene segreti, non committarla."
}
catch {
    Write-Info2 'Non sono riuscito a salvare la copia su file, copia i valori da qui sopra.'
}

Read-Host 'Premi Invio quando le variabili sono su Vercel e il redeploy e'' finito' | Out-Null

# ---------------------------------------------------------------------------
# 5. Controllo del deploy
# ---------------------------------------------------------------------------

Write-Step '5. Controllo del deploy'
Write-Info2 "Chiamo $webhookUrl senza secret: deve rispondere 403."

$continua = $false
while (-not $continua) {
    $status = Get-EndpointStatus $webhookUrl

    switch ($status) {
        403 {
            Write-Good 'Risponde 403: codice online, token e secret configurati. E'' quello che deve fare.'
            $continua = $true
        }
        500 {
            Write-Bad 'Risponde 500: manca TELEGRAM_WEBHOOK_SECRET nell''ambiente del deploy.'
        }
        200 {
            Write-Bad 'Risponde 200: il codice c''e'' ma manca TELEGRAM_BOT_TOKEN nell''ambiente del deploy.'
        }
        404 {
            Write-Bad 'Risponde 404: quel deploy non contiene il codice del bot.'
            Write-Info2 'La PR non e'' ancora mergiata nel branch che alimenta questo dominio, oppure l''url e'' sbagliato.'
        }
        0 {
            Write-Bad 'Nessuna risposta: url irraggiungibile o deploy non ancora pronto.'
        }
        default {
            Write-Bad "Risponde $status, inatteso."
        }
    }

    if (-not $continua) {
        $answer = Read-Host 'Riprovo? (s = riprova, n = registra comunque, q = esci)'
        if ($answer -eq 'n') { $continua = $true }
        elseif ($answer -eq 'q') {
            if ($script:WebhookRemoved) {
                Write-Note 'Esco senza registrare, e il webhook precedente resta rimosso: il bot e'' muto finche'' non rilanci lo script.'
            }
            Write-Host ''
            return
        }
    }
}

# ---------------------------------------------------------------------------
# 6. Registrazione
# ---------------------------------------------------------------------------

Write-Step '6. Registrazione del webhook'
# Niente allowed_updates (vedi sopra): il route handler scarta da se' gli update
# che non contengono un messaggio, quindi il default di Telegram va bene.
Invoke-Telegram -Method 'setWebhook' -Body @{
    url                  = $webhookUrl
    secret_token         = $Secret
    drop_pending_updates = $true
} | Out-Null
Write-Good "Webhook registrato su $webhookUrl"

Start-Sleep -Seconds 2
Write-Step 'Stato finale'
Show-WebhookInfo (Invoke-Telegram -Method 'getWebhookInfo')

Write-Step 'Ultimi due passi, a mano'
Write-Host "  1. Scrivi /aiuto nel gruppo: il bot deve rispondere."
Write-Host "  2. Ognuno dei due apra $siteUrl/impostazioni e colleghi il proprio id Telegram"
Write-Host "     (il bot lo dice con /id)."
Write-Host ''
