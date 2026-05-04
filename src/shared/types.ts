export interface AppSettings {
  openaiKey: string
  geminiKey: string
  anthropicKey: string
  defaultModel: string
  transcriptionModel: string
  translationBehavior: 'replace' | 'append'
  activeProvider: 'openai' | 'gemini' | 'anthropic' | 'gcloud' | 'claude-cli'
  gcloudProject: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: 'openai' | 'gemini' | 'anthropic' | 'gcloud' | 'claude-cli'
}

export interface TranscriptionRequest {
  audioBuffer: ArrayBuffer
  mimeType: string
}

export interface TranslationRequest {
  text: string
  targetLanguage: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  openaiKey: '',
  geminiKey: '',
  anthropicKey: '',
  defaultModel: '',
  transcriptionModel: 'whisper-1',
  translationBehavior: 'replace',
  activeProvider: 'openai',
  gcloudProject: '',
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'Inglês' },
  { code: 'es', name: 'Espanhol' },
  { code: 'fr', name: 'Francês' },
  { code: 'de', name: 'Alemão' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: 'Japonês' },
  { code: 'ko', name: 'Coreano' },
  { code: 'zh', name: 'Chinês' },
  { code: 'ru', name: 'Russo' },
  { code: 'ar', name: 'Árabe' },
]
