import { useState, useRef, useCallback } from 'react'
import Toolbar from './components/Toolbar'
import Editor from './components/Editor'
import SettingsModal from './components/SettingsModal'
import StatusBar from './components/StatusBar'
import { useAudioRecorder } from './hooks/useAudioRecorder'

export default function App() {
  const [text, setText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const { isRecording, isPaused, startRecording, pauseRecording, stopRecording } = useAudioRecorder({
    onTranscription: (transcribedText) => {
      const editor = editorRef.current
      if (editor) {
        const start = editor.selectionStart
        const before = text.slice(0, start)
        const after = text.slice(editor.selectionEnd)
        const newText = before + transcribedText + after
        setText(newText)
        setTimeout(() => {
          editor.selectionStart = editor.selectionEnd = start + transcribedText.length
          editor.focus()
        }, 0)
      } else {
        setText((prev) => prev + transcribedText)
      }
      setStatus('Transcrição concluída')
    },
    onError: (error) => {
      setStatus(`Erro: ${error}`)
    },
    onStatusChange: (msg) => {
      setStatus(msg)
    },
  })

  const handleTranslate = useCallback(async () => {
    const editor = editorRef.current
    const selectedText = editor
      ? text.slice(editor.selectionStart, editor.selectionEnd) || text
      : text

    if (!selectedText.trim()) {
      setStatus('Nenhum texto para traduzir')
      return
    }

    setIsTranslating(true)
    setStatus('Traduzindo...')

    try {
      const result = await window.voxpad.translateText(selectedText, selectedLanguage)
      if (!result.success) {
        setStatus(`Erro: ${result.error}`)
        return
      }

      const settings = await window.voxpad.getSettings()

      if (editor && editor.selectionStart !== editor.selectionEnd) {
        // Text was selected
        const start = editor.selectionStart
        const end = editor.selectionEnd
        if (settings.translationBehavior === 'replace') {
          setText(text.slice(0, start) + result.data + text.slice(end))
        } else {
          setText(text.slice(0, end) + '\n\n--- Tradução ---\n' + result.data + text.slice(end))
        }
      } else {
        // No selection - work on all text
        if (settings.translationBehavior === 'replace') {
          setText(result.data!)
        } else {
          setText(text + '\n\n--- Tradução ---\n' + result.data)
        }
      }

      setStatus('Tradução concluída')
    } catch (err: any) {
      setStatus(`Erro na tradução: ${err.message}`)
    } finally {
      setIsTranslating(false)
    }
  }, [text, selectedLanguage])

  const handleRecord = () => {
    if (isRecording && !isPaused) {
      pauseRecording()
    } else if (isRecording && isPaused) {
      startRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <Toolbar
        isRecording={isRecording}
        isPaused={isPaused}
        isTranslating={isTranslating}
        selectedLanguage={selectedLanguage}
        onRecord={handleRecord}
        onStop={stopRecording}
        onTranslate={handleTranslate}
        onLanguageChange={setSelectedLanguage}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Editor ref={editorRef} value={text} onChange={setText} />
      <StatusBar message={status} charCount={text.length} wordCount={text.trim() ? text.trim().split(/\s+/).length : 0} />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
