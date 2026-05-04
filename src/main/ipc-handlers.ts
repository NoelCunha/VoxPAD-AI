import { ipcMain } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { getSettings, saveSettings } from './store'
import { fetchModels, transcribeAudio, translateText } from './api-service'
import { getGCloudStatus, gcloudTranslateBasic, gcloudLogin, gcloudTranscribeAudio } from './gcloud-service'
import { getClaudeCliStatus, claudeCliTranslate, claudeCliLogin } from './claude-cli-service'
import { transcribeWithWindowsSpeech } from './local-transcription'

export function setupIpcHandlers() {
  ipcMain.handle(IPC.GET_SETTINGS, () => {
    return getSettings()
  })

  ipcMain.handle(IPC.SAVE_SETTINGS, (_event, settings) => {
    return saveSettings(settings)
  })

  ipcMain.handle(IPC.FETCH_MODELS, async (_event, provider: string, apiKey: string) => {
    try {
      const models = await fetchModels(provider, apiKey)
      return { success: true, data: models }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.TRANSCRIBE_AUDIO, async (_event, audioArray: number[], mimeType: string) => {
    try {
      const audioBuffer = Buffer.from(audioArray)
      const settings = getSettings()

      // Route transcription to available service
      // 1. OpenAI Whisper (if key configured)
      if (settings.openaiKey) {
        const text = await transcribeAudio(audioBuffer, mimeType)
        return { success: true, data: text }
      }

      // 2. Google Cloud Speech-to-Text (if gcloud connected)
      if (settings.activeProvider === 'gcloud' || settings.gcloudProject) {
        try {
          const text = await gcloudTranscribeAudio(audioBuffer, mimeType)
          return { success: true, data: text }
        } catch (gcloudErr: any) {
          // If gcloud fails, try other methods
          console.error('gcloud transcription failed:', gcloudErr.message)
        }
      }

      // 3. Try gcloud even without explicit config (user might be authenticated)
      try {
        const gcloudStatus = await getGCloudStatus()
        if (gcloudStatus.authenticated) {
          const text = await gcloudTranscribeAudio(audioBuffer, mimeType)
          return { success: true, data: text }
        }
      } catch {}

      // 4. Windows Speech Recognition (offline, requires ffmpeg for audio conversion)
      try {
        const text = await transcribeWithWindowsSpeech(audioBuffer, mimeType)
        return { success: true, data: text }
      } catch (localErr: any) {
        console.error('Local transcription failed:', localErr.message)
      }

      return {
        success: false,
        error: 'Nenhum serviço de transcrição disponível. Instale o ffmpeg (transcrição offline) ou configure uma API key da OpenAI nas Configurações.',
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.TRANSLATE_TEXT, async (_event, text: string, targetLanguage: string) => {
    try {
      const settings = getSettings()

      if (settings.activeProvider === 'gcloud') {
        const translated = await gcloudTranslateBasic(text, targetLanguage)
        return { success: true, data: translated }
      }

      if (settings.activeProvider === 'claude-cli') {
        const translated = await claudeCliTranslate(text, targetLanguage)
        return { success: true, data: translated }
      }

      const translated = await translateText(text, targetLanguage)
      return { success: true, data: translated }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.GCLOUD_STATUS, async () => {
    try {
      const status = await getGCloudStatus()
      return { success: true, data: status }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.CLAUDE_CLI_STATUS, async () => {
    try {
      const status = await getClaudeCliStatus()
      return { success: true, data: status }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.GCLOUD_LOGIN, async () => {
    try {
      const status = await gcloudLogin()
      return { success: true, data: status }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.CLAUDE_CLI_LOGIN, async () => {
    try {
      const status = await claudeCliLogin()
      return { success: true, data: status }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
