import { execFile, spawn } from 'child_process'
import { net } from 'electron'
import { getSettings } from './store'

function exec(command: string, args: string[], timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, windowsHide: true, shell: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

function makeRequest(url: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: string
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: options.method || 'GET' })
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        request.setHeader(key, value)
      }
    }
    let responseBody = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => { responseBody += chunk.toString() })
      response.on('end', () => resolve({ status: response.statusCode, body: responseBody }))
    })
    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

export interface GCloudStatus {
  authenticated: boolean
  account: string
  project: string
}

export async function getGCloudStatus(): Promise<GCloudStatus> {
  try {
    // Check if gcloud CLI is available and authenticated
    const account = await exec('gcloud', ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'])
    const project = await exec('gcloud', ['config', 'get-value', 'project'])

    return {
      authenticated: !!account,
      account: account || '',
      project: project || '',
    }
  } catch {
    return { authenticated: false, account: '', project: '' }
  }
}

async function getAccessToken(): Promise<string> {
  const token = await exec('gcloud', ['auth', 'print-access-token'])
  if (!token) throw new Error('Não foi possível obter token de acesso do gcloud CLI. Verifique se está autenticado.')
  return token
}

// Google Cloud Translation API v2 (Basic) via CLI auth
export async function gcloudTranslateBasic(text: string, targetLanguage: string): Promise<string> {
  const token = await getAccessToken()
  const settings = getSettings()
  const projectId = settings.gcloudProject

  // Map language names to ISO codes for the Translation API
  const langCodes: Record<string, string> = {
    'Inglês': 'en', 'Espanhol': 'es', 'Francês': 'fr', 'Alemão': 'de',
    'Italiano': 'it', 'Português': 'pt', 'Japonês': 'ja', 'Coreano': 'ko',
    'Chinês': 'zh', 'Russo': 'ru', 'Árabe': 'ar',
  }
  const targetCode = langCodes[targetLanguage] || targetLanguage

  // Use Translation API v3 (Cloud Translation - Advanced) if project is set
  if (projectId) {
    const url = `https://translation.googleapis.com/v3/projects/${projectId}/locations/global:translateText`
    const res = await makeRequest(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [text],
        targetLanguageCode: targetCode,
        mimeType: 'text/plain',
      }),
    })

    if (res.status !== 200) {
      const error = JSON.parse(res.body)
      throw new Error(error.error?.message || `Erro na tradução (HTTP ${res.status})`)
    }

    const data = JSON.parse(res.body)
    return data.translations[0].translatedText
  }

  // Fallback: Translation API v2 (Basic)
  const url = 'https://translation.googleapis.com/language/translate/v2'
  const res = await makeRequest(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      target: targetCode,
      format: 'text',
    }),
  })

  if (res.status !== 200) {
    const error = JSON.parse(res.body)
    throw new Error(error.error?.message || `Erro na tradução (HTTP ${res.status})`)
  }

  const data = JSON.parse(res.body)
  return data.data.translations[0].translatedText
}

export async function gcloudLogin(): Promise<GCloudStatus> {
  // Run gcloud auth login - opens the browser for OAuth
  // The process blocks until user completes auth in the browser
  await new Promise<void>((resolve, reject) => {
    const child = spawn('gcloud', ['auth', 'login', '--no-launch-browser=false'], {
      stdio: 'pipe',
      shell: true,
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`gcloud auth login falhou (código ${code}). Verifique se o Google Cloud SDK está instalado.`))
    })
    child.on('error', (err) => reject(err))
  })

  // After login completes, return updated status
  return getGCloudStatus()
}

export async function gcloudTranscribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const token = await getAccessToken()
  const settings = getSettings()
  const projectId = settings.gcloudProject

  // Convert audio to base64
  const audioBase64 = audioBuffer.toString('base64')

  // Detect encoding from mimeType
  let encoding = 'WEBM_OPUS'
  if (mimeType.includes('ogg')) encoding = 'OGG_OPUS'
  else if (mimeType.includes('mp4')) encoding = 'MP3'
  else if (mimeType.includes('wav')) encoding = 'LINEAR16'

  const url = projectId
    ? `https://speech.googleapis.com/v1/speech:recognize`
    : `https://speech.googleapis.com/v1/speech:recognize`

  const body = {
    config: {
      encoding,
      sampleRateHertz: 48000,
      languageCode: 'pt-BR',
      alternativeLanguageCodes: ['en-US', 'es-ES'],
      enableAutomaticPunctuation: true,
      model: 'latest_long',
    },
    audio: {
      content: audioBase64,
    },
  }

  const res = await makeRequest(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status !== 200) {
    const error = JSON.parse(res.body)
    throw new Error(error.error?.message || `Erro na transcrição (HTTP ${res.status})`)
  }

  const data = JSON.parse(res.body)
  if (!data.results || data.results.length === 0) {
    throw new Error('Nenhuma fala detectada no áudio')
  }

  return data.results
    .map((r: any) => r.alternatives[0]?.transcript || '')
    .join(' ')
    .trim()
}
