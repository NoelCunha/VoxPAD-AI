const { contextBridge, ipcRenderer } = require('electron')

const api = {
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: any) =>
    ipcRenderer.invoke('settings:save', settings),

  fetchModels: (provider: string, apiKey: string) =>
    ipcRenderer.invoke('api:fetch-models', provider, apiKey),

  transcribeAudio: (audioBuffer: ArrayBuffer, mimeType: string) =>
    ipcRenderer.invoke('api:transcribe', Array.from(new Uint8Array(audioBuffer)), mimeType),

  translateText: (text: string, targetLanguage: string) =>
    ipcRenderer.invoke('api:translate', text, targetLanguage),

  getGCloudStatus: () =>
    ipcRenderer.invoke('gcloud:status'),

  getClaudeCliStatus: () =>
    ipcRenderer.invoke('claude-cli:status'),

  gcloudLogin: () =>
    ipcRenderer.invoke('gcloud:login'),

  claudeCliLogin: () =>
    ipcRenderer.invoke('claude-cli:login'),
}

contextBridge.exposeInMainWorld('voxpad', api)
