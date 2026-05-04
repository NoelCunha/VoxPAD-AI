import { ModelInfo } from '../shared/types'
import { getSettings } from './store'
import { net } from 'electron'

function makeRequest(url: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: Buffer | string
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      method: options.method || 'GET',
    })

    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        request.setHeader(key, value)
      }
    }

    let responseBody = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseBody += chunk.toString()
      })
      response.on('end', () => {
        resolve({ status: response.statusCode, body: responseBody })
      })
    })

    request.on('error', (error) => {
      reject(error)
    })

    if (options.body) {
      request.write(options.body)
    }

    request.end()
  })
}

function makeMultipartRequest(url: string, headers: Record<string, string>, boundary: string, body: Buffer): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      url,
      method: 'POST',
    })

    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }
    request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`)

    let responseBody = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseBody += chunk.toString()
      })
      response.on('end', () => {
        resolve({ status: response.statusCode, body: responseBody })
      })
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.write(body)
    request.end()
  })
}

export async function fetchModels(provider: string, apiKey: string): Promise<ModelInfo[]> {
  try {
    if (provider === 'openai') {
      const res = await makeRequest('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (res.status !== 200) throw new Error('Chave inválida ou sem permissão')
      const data = JSON.parse(res.body)
      return data.data
        .filter((m: any) => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3') || m.id.includes('o4'))
        .map((m: any) => ({ id: m.id, name: m.id, provider: 'openai' as const }))
        .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name))
    }

    if (provider === 'gemini') {
      const res = await makeRequest(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        {}
      )
      if (res.status !== 200) throw new Error('Chave inválida ou sem permissão')
      const data = JSON.parse(res.body)
      return (data.models || [])
        .filter((m: any) => m.name.includes('gemini'))
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name.replace('models/', ''),
          provider: 'gemini' as const,
        }))
    }

    if (provider === 'anthropic') {
      const res = await makeRequest('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      })
      if (res.status !== 200) throw new Error('Chave inválida ou sem permissão')
      const data = JSON.parse(res.body)
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.display_name || m.id,
        provider: 'anthropic' as const,
      }))
    }

    return []
  } catch (error: any) {
    throw new Error(`Erro ao buscar modelos: ${error.message}`)
  }
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const settings = getSettings()
  const apiKey = settings.openaiKey

  if (!apiKey) throw new Error('Chave da API OpenAI não configurada')

  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'webm'
  const boundary = '----VoxPadBoundary' + Date.now()

  const parts: Buffer[] = []

  // File part
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ))
  parts.push(audioBuffer)
  parts.push(Buffer.from('\r\n'))

  // Model part
  const model = settings.transcriptionModel || 'whisper-1'
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`
  ))

  // Close boundary
  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const res = await makeMultipartRequest(
    'https://api.openai.com/v1/audio/transcriptions',
    { Authorization: `Bearer ${apiKey}` },
    boundary,
    body
  )

  if (res.status !== 200) {
    const error = JSON.parse(res.body)
    throw new Error(error.error?.message || 'Erro na transcrição')
  }

  const data = JSON.parse(res.body)
  return data.text
}

export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const settings = getSettings()
  const provider = settings.activeProvider
  const model = settings.defaultModel

  const prompt = `Traduza o seguinte texto para ${targetLanguage}. Retorne apenas a tradução, sem comentários adicionais:\n\n${text}`

  if (provider === 'openai') {
    if (!settings.openaiKey) throw new Error('Chave da API OpenAI não configurada')
    const res = await makeRequest('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    })
    if (res.status !== 200) {
      const error = JSON.parse(res.body)
      throw new Error(error.error?.message || 'Erro na tradução')
    }
    const data = JSON.parse(res.body)
    return data.choices[0].message.content.trim()
  }

  if (provider === 'gemini') {
    if (!settings.geminiKey) throw new Error('Chave da API Google Gemini não configurada')
    const modelId = model || 'gemini-1.5-flash'
    const res = await makeRequest(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${settings.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      }
    )
    if (res.status !== 200) {
      const error = JSON.parse(res.body)
      throw new Error(error.error?.message || 'Erro na tradução')
    }
    const data = JSON.parse(res.body)
    return data.candidates[0].content.parts[0].text.trim()
  }

  if (provider === 'anthropic') {
    if (!settings.anthropicKey) throw new Error('Chave da API Anthropic não configurada')
    const res = await makeRequest('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': settings.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (res.status !== 200) {
      const error = JSON.parse(res.body)
      throw new Error(error.error?.message || 'Erro na tradução')
    }
    const data = JSON.parse(res.body)
    return data.content[0].text.trim()
  }

  throw new Error('Provedor de IA não configurado')
}
