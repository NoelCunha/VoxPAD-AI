import { useState, useEffect, useCallback } from 'react'
import { X, Eye, EyeOff, Loader2, Check, Cloud, CloudOff, Terminal, CheckCircle2 } from 'lucide-react'
import { AppSettings, ModelInfo, DEFAULT_SETTINGS } from '../../shared/types'

interface SettingsModalProps {
  onClose: () => void
}

type Provider = 'openai' | 'gemini' | 'anthropic' | 'gcloud' | 'claude-cli'

const API_PROVIDERS: { id: 'openai' | 'gemini' | 'anthropic'; name: string; keyField: keyof AppSettings }[] = [
  { id: 'openai', name: 'OpenAI', keyField: 'openaiKey' },
  { id: 'gemini', name: 'Google Gemini', keyField: 'geminiKey' },
  { id: 'anthropic', name: 'Anthropic', keyField: 'anthropicKey' },
]

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [loadingModels, setLoadingModels] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Google Cloud CLI state
  const [gcloudStatus, setGcloudStatus] = useState<{
    authenticated: boolean
    account: string
    project: string
  } | null>(null)
  const [gcloudLoading, setGcloudLoading] = useState(false)
  const [gcloudConnecting, setGcloudConnecting] = useState(false)

  // Claude CLI state
  const [claudeCliStatus, setClaudeCliStatus] = useState<{
    installed: boolean
    authenticated: boolean
    version: string
  } | null>(null)
  const [claudeCliLoading, setClaudeCliLoading] = useState(false)
  const [claudeCliConnecting, setClaudeCliConnecting] = useState(false)

  useEffect(() => {
    window.voxpad.getSettings().then(setSettings)
    checkGCloudStatus()
    checkClaudeCliStatus()
  }, [])

  const saveAndClose = useCallback(async (newSettings: AppSettings) => {
    await window.voxpad.saveSettings(newSettings)
    onClose()
  }, [onClose])

  const checkGCloudStatus = async () => {
    setGcloudLoading(true)
    try {
      const result = await window.voxpad.getGCloudStatus()
      if (result.success && result.data) {
        setGcloudStatus(result.data)
        if (result.data.project && !settings.gcloudProject) {
          setSettings((prev) => ({ ...prev, gcloudProject: result.data!.project }))
        }
      } else {
        setGcloudStatus({ authenticated: false, account: '', project: '' })
      }
    } catch {
      setGcloudStatus({ authenticated: false, account: '', project: '' })
    } finally {
      setGcloudLoading(false)
    }
  }

  const checkClaudeCliStatus = async () => {
    setClaudeCliLoading(true)
    try {
      const result = await window.voxpad.getClaudeCliStatus()
      if (result.success && result.data) {
        setClaudeCliStatus(result.data)
      } else {
        setClaudeCliStatus({ installed: false, authenticated: false, version: '' })
      }
    } catch {
      setClaudeCliStatus({ installed: false, authenticated: false, version: '' })
    } finally {
      setClaudeCliLoading(false)
    }
  }

  // Google Cloud: Connect → open browser → wait for auth → poll → activate → save → close
  const handleGCloudConnect = async () => {
    setGcloudConnecting(true)
    setError('')
    try {
      const result = await window.voxpad.gcloudLogin()
      if (result.success && result.data && result.data.authenticated) {
        setGcloudStatus(result.data)
        const updated = {
          ...settings,
          activeProvider: 'gcloud' as const,
          gcloudProject: result.data.project || settings.gcloudProject,
        }
        setSettings(updated)
        // Auto save and close
        await saveAndClose(updated)
        return
      }
      // Login process started but maybe user hasn't finished yet - poll a few times
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const check = await window.voxpad.getGCloudStatus()
        if (check.success && check.data?.authenticated) {
          setGcloudStatus(check.data)
          const updated = {
            ...settings,
            activeProvider: 'gcloud' as const,
            gcloudProject: check.data.project || settings.gcloudProject,
          }
          setSettings(updated)
          await saveAndClose(updated)
          return
        }
      }
      setError('Tempo esgotado. Autentique no navegador e clique em "Verificar novamente".')
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google Cloud')
    } finally {
      setGcloudConnecting(false)
    }
  }

  // Claude CLI: Open terminal → poll for auth → activate → save → close
  const handleClaudeCliConnect = async () => {
    setClaudeCliConnecting(true)
    setError('')
    try {
      await window.voxpad.claudeCliLogin()
      // Poll for authentication (user authenticates in the terminal that opened)
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const check = await window.voxpad.getClaudeCliStatus()
        if (check.success && check.data?.installed && check.data?.authenticated) {
          setClaudeCliStatus(check.data)
          const updated = { ...settings, activeProvider: 'claude-cli' as const }
          setSettings(updated)
          await saveAndClose(updated)
          return
        }
      }
      setError('Tempo esgotado. Autentique no terminal e clique em "Verificar novamente".')
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Claude CLI')
    } finally {
      setClaudeCliConnecting(false)
    }
  }

  const handleKeyChange = (field: keyof AppSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleFetchModels = async (provider: 'openai' | 'gemini' | 'anthropic') => {
    const keyField = API_PROVIDERS.find((p) => p.id === provider)!.keyField
    const apiKey = settings[keyField] as string

    if (!apiKey) {
      setError('Insira a chave de API antes de buscar os modelos')
      return
    }

    setLoadingModels(provider)
    setError('')

    try {
      const result = await window.voxpad.fetchModels(provider, apiKey)
      if (result.success && result.data) {
        setModels(result.data)
        setSettings((prev) => ({ ...prev, activeProvider: provider }))
      } else {
        setError(result.error || 'Erro ao buscar modelos')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingModels(null)
    }
  }

  const handleSave = async () => {
    setError('')
    try {
      await window.voxpad.saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">Configurações</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* ===== CLI Integrations ===== */}
          <h3 className="text-sm font-semibold text-gray-700">Conexões via CLI (sem API key)</h3>

          {/* ===== Claude CLI Section ===== */}
          <div className={`p-4 rounded-lg border ${
            claudeCliStatus?.installed
              ? 'border-green-300 bg-green-50/50'
              : 'border-orange-200 bg-orange-50/50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={16} className={claudeCliStatus?.installed ? 'text-green-600' : 'text-orange-600'} />
              <h3 className="text-sm font-semibold text-gray-700">Claude CLI (Claude Code)</h3>
              {claudeCliLoading || claudeCliConnecting ? (
                <Loader2 size={14} className="animate-spin text-orange-500 ml-auto" />
              ) : claudeCliStatus?.installed ? (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                  <CheckCircle2 size={14} />
                  Conectado
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 font-medium">
                  <CloudOff size={12} />
                  Não detectado
                </span>
              )}
            </div>

            {claudeCliStatus?.installed ? (
              <div className="space-y-2">
                <p className="text-xs text-green-700 bg-green-100 rounded-md px-3 py-2 font-medium">
                  Claude CLI detectado e pronto para uso — versão {claudeCliStatus.version}
                </p>
                {settings.activeProvider === 'claude-cli' ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-xs font-medium">
                    <CheckCircle2 size={14} />
                    Provedor ativo — traduções usarão o Claude CLI
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const updated = { ...settings, activeProvider: 'claude-cli' as const }
                      setSettings(updated)
                      await saveAndClose(updated)
                    }}
                    className="w-full px-3 py-2 text-xs font-medium bg-white text-orange-600 border border-orange-300 hover:bg-orange-50 rounded-md transition-colors"
                  >
                    Usar Claude CLI para Tradução
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 bg-white rounded-md p-3 border border-gray-200">
                <p className="font-medium text-gray-700 mb-2">Como conectar:</p>
                <ol className="list-decimal list-inside space-y-1 mb-3">
                  <li>Instale: <code className="bg-gray-100 px-1 rounded">npm install -g @anthropic-ai/claude-code</code></li>
                  <li>Clique em <strong>Conectar</strong> (abre terminal para autenticar)</li>
                </ol>
                {claudeCliConnecting ? (
                  <div className="flex items-center gap-2 px-3 py-3 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
                    <Loader2 size={14} className="animate-spin" />
                    Aguardando autenticação no terminal... (autentique e esta tela fechará automaticamente)
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleClaudeCliConnect}
                      disabled={claudeCliLoading}
                      className="flex-1 px-3 py-2.5 text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 rounded-md disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Terminal size={13} />
                      Conectar
                    </button>
                    <button
                      onClick={async () => {
                        await checkClaudeCliStatus()
                        // If now connected, auto-activate and close
                        const result = await window.voxpad.getClaudeCliStatus()
                        if (result.success && result.data?.installed) {
                          setClaudeCliStatus(result.data)
                          const updated = { ...settings, activeProvider: 'claude-cli' as const }
                          setSettings(updated)
                          await saveAndClose(updated)
                        }
                      }}
                      disabled={claudeCliLoading}
                      className="px-3 py-2.5 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-md disabled:opacity-50"
                    >
                      Verificar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== Google Cloud CLI Section ===== */}
          <div className={`p-4 rounded-lg border ${
            gcloudStatus?.authenticated
              ? 'border-green-300 bg-green-50/50'
              : 'border-blue-200 bg-blue-50/50'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Cloud size={16} className={gcloudStatus?.authenticated ? 'text-green-600' : 'text-blue-600'} />
              <h3 className="text-sm font-semibold text-gray-700">Google Cloud CLI</h3>
              {gcloudLoading || gcloudConnecting ? (
                <Loader2 size={14} className="animate-spin text-blue-500 ml-auto" />
              ) : gcloudStatus?.authenticated ? (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                  <CheckCircle2 size={14} />
                  Conectado
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 font-medium">
                  <CloudOff size={12} />
                  Desconectado
                </span>
              )}
            </div>

            {gcloudStatus?.authenticated ? (
              <div className="space-y-2">
                <div className="text-xs bg-green-100 rounded-md px-3 py-2 text-green-700">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-medium w-14">Conta:</span>
                    <span className="font-semibold">{gcloudStatus.account}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-green-500 font-medium w-14">Projeto:</span>
                    <span className="font-semibold">{gcloudStatus.project || '(não definido)'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Project ID (para Translation API v3)
                  </label>
                  <input
                    type="text"
                    value={settings.gcloudProject}
                    onChange={(e) => setSettings((prev) => ({ ...prev, gcloudProject: e.target.value }))}
                    placeholder={gcloudStatus.project || 'meu-projeto-gcp'}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-white"
                  />
                </div>
                {settings.activeProvider === 'gcloud' ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md text-xs font-medium">
                    <CheckCircle2 size={14} />
                    Provedor ativo — traduções usarão o Google Cloud
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const updated = { ...settings, activeProvider: 'gcloud' as const }
                      setSettings(updated)
                      await saveAndClose(updated)
                    }}
                    className="w-full px-3 py-2 text-xs font-medium bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    Usar Google Cloud CLI para Tradução
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 bg-white rounded-md p-3 border border-gray-200">
                <p className="font-medium text-gray-700 mb-2">Como conectar:</p>
                <ol className="list-decimal list-inside space-y-1 mb-3">
                  <li>Instale o <code className="bg-gray-100 px-1 rounded">Google Cloud SDK</code></li>
                  <li>Clique em <strong>Conectar</strong> (abre o navegador para login)</li>
                </ol>
                {gcloudConnecting ? (
                  <div className="flex items-center gap-2 px-3 py-3 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                    <Loader2 size={14} className="animate-spin" />
                    Aguardando autenticação no navegador... (autentique e esta tela fechará automaticamente)
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleGCloudConnect}
                      disabled={gcloudLoading}
                      className="flex-1 px-3 py-2.5 text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 rounded-md disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Cloud size={13} />
                      Conectar
                    </button>
                    <button
                      onClick={async () => {
                        await checkGCloudStatus()
                        const result = await window.voxpad.getGCloudStatus()
                        if (result.success && result.data?.authenticated) {
                          setGcloudStatus(result.data)
                          const updated = {
                            ...settings,
                            activeProvider: 'gcloud' as const,
                            gcloudProject: result.data.project || settings.gcloudProject,
                          }
                          setSettings(updated)
                          await saveAndClose(updated)
                        }
                      }}
                      disabled={gcloudLoading}
                      className="px-3 py-2.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md disabled:opacity-50"
                    >
                      Verificar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== API Keys Section ===== */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Chaves de API</h3>
            {API_PROVIDERS.map((provider) => (
              <div key={provider.id} className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">{provider.name}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[provider.id] ? 'text' : 'password'}
                      value={(settings[provider.keyField] as string) || ''}
                      onChange={(e) => handleKeyChange(provider.keyField, e.target.value)}
                      placeholder={`Chave da API ${provider.name}`}
                      className="w-full px-3 py-2 pr-9 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys[provider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleFetchModels(provider.id)}
                    disabled={loadingModels === provider.id}
                    className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                  >
                    {loadingModels === provider.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : null}
                    Buscar Modelos
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Active Provider */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Provedor Ativo</label>
            <select
              value={settings.activeProvider}
              onChange={(e) => setSettings((prev) => ({ ...prev, activeProvider: e.target.value as Provider }))}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {API_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {claudeCliStatus?.installed && (
                <option value="claude-cli">Claude CLI (sem API key)</option>
              )}
              {gcloudStatus?.authenticated && (
                <option value="gcloud">Google Cloud CLI (sem API key)</option>
              )}
            </select>
          </div>

          {/* Model Selection */}
          {models.length > 0 && settings.activeProvider !== 'gcloud' && settings.activeProvider !== 'claude-cli' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Modelo de IA Padrão ({models.length} encontrados)
              </label>
              <select
                value={settings.defaultModel}
                onChange={(e) => setSettings((prev) => ({ ...prev, defaultModel: e.target.value }))}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Selecione um modelo</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Transcription Model */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Modelo de Transcrição</label>
            <input
              type="text"
              value={settings.transcriptionModel}
              onChange={(e) => setSettings((prev) => ({ ...prev, transcriptionModel: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="whisper-1"
            />
          </div>

          {/* Translation Behavior */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Comportamento da Tradução</label>
            <select
              value={settings.translationBehavior}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  translationBehavior: e.target.value as 'replace' | 'append',
                }))
              }
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="replace">Substituir texto original</option>
              <option value="append">Anexar tradução abaixo</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-md border border-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-md hover:bg-accent-hover"
          >
            {saved ? <><Check size={14} /> Salvo!</> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
