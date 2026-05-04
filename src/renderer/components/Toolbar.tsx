import { Mic, MicOff, Square, Languages, Settings, Pause } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../../shared/types'

interface ToolbarProps {
  isRecording: boolean
  isPaused: boolean
  isTranslating: boolean
  selectedLanguage: string
  onRecord: () => void
  onStop: () => void
  onTranslate: () => void
  onLanguageChange: (lang: string) => void
  onOpenSettings: () => void
}

export default function Toolbar({
  isRecording,
  isPaused,
  isTranslating,
  selectedLanguage,
  onRecord,
  onStop,
  onTranslate,
  onLanguageChange,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-surface select-none">
      <span className="text-sm font-semibold text-gray-700 mr-3">VoxPad AI</span>

      <div className="h-5 w-px bg-gray-300 mx-1" />

      {/* Audio Controls */}
      <button
        onClick={onRecord}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isRecording && !isPaused
            ? 'bg-red-500 text-white hover:bg-red-600'
            : isRecording && isPaused
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
        }`}
        title={isRecording ? (isPaused ? 'Continuar gravação' : 'Pausar gravação') : 'Iniciar gravação'}
      >
        {isRecording && !isPaused ? (
          <>
            <Pause size={14} /> Pausar
          </>
        ) : isRecording && isPaused ? (
          <>
            <Mic size={14} /> Continuar
          </>
        ) : (
          <>
            <Mic size={14} /> Gravar
          </>
        )}
      </button>

      {isRecording && (
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 transition-colors"
          title="Parar gravação"
        >
          <Square size={14} /> Parar
        </button>
      )}

      {isRecording && !isPaused && (
        <span className="flex items-center gap-1 text-xs text-red-500 ml-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Gravando...
        </span>
      )}

      <div className="h-5 w-px bg-gray-300 mx-1" />

      {/* Translation Controls */}
      <select
        value={selectedLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.name}>
            {lang.name}
          </option>
        ))}
      </select>

      <button
        onClick={onTranslate}
        disabled={isTranslating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Traduzir texto"
      >
        <Languages size={14} />
        {isTranslating ? 'Traduzindo...' : 'Traduzir'}
      </button>

      <div className="flex-1" />

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
        title="Configurações"
      >
        <Settings size={18} />
      </button>
    </div>
  )
}
