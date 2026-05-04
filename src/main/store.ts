import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

const store = new Store<{ settings: AppSettings }>({
  defaults: {
    settings: DEFAULT_SETTINGS,
  },
  encryptionKey: 'voxpad-ai-secure-key',
})

export function getSettings(): AppSettings {
  return store.get('settings')
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  store.set('settings', updated)
  return updated
}
