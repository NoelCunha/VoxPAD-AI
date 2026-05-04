/// <reference types="vite/client" />

interface VoxPadAPI {
  getSettings: () => Promise<import('../shared/types').AppSettings>
  saveSettings: (settings: Partial<import('../shared/types').AppSettings>) => Promise<import('../shared/types').AppSettings>
  fetchModels: (provider: string, apiKey: string) => Promise<import('../shared/types').ApiResponse<import('../shared/types').ModelInfo[]>>
  transcribeAudio: (audioBuffer: ArrayBuffer, mimeType: string) => Promise<import('../shared/types').ApiResponse<string>>
  translateText: (text: string, targetLanguage: string) => Promise<import('../shared/types').ApiResponse<string>>
  getGCloudStatus: () => Promise<import('../shared/types').ApiResponse<{ authenticated: boolean; account: string; project: string }>>
  getClaudeCliStatus: () => Promise<import('../shared/types').ApiResponse<{ installed: boolean; authenticated: boolean; version: string }>>
  gcloudLogin: () => Promise<import('../shared/types').ApiResponse<{ authenticated: boolean; account: string; project: string }>>
  claudeCliLogin: () => Promise<import('../shared/types').ApiResponse<{ installed: boolean; authenticated: boolean; version: string }>>
}

interface Window {
  voxpad: VoxPadAPI
}
