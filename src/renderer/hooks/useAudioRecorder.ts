import { useState, useRef, useCallback } from 'react'

interface UseAudioRecorderOptions {
  onTranscription: (text: string) => void
  onError: (error: string) => void
  onStatusChange: (status: string) => void
}

declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

export function useAudioRecorder({ onTranscription, onError, onStatusChange }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const isActiveRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const speechWorkedRef = useRef(false)

  // MediaRecorder backup
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeRef = useRef('')

  const cleanup = useCallback(() => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    // Stop media recorder
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch {}
    }
    recorderRef.current = null
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    // Resume from pause
    if (isActiveRef.current && isPaused) {
      if (recorderRef.current?.state === 'paused') recorderRef.current.resume()
      if (recognitionRef.current) {
        try { recognitionRef.current.start() } catch {}
      }
      setIsPaused(false)
      onStatusChange('Gravando...')
      return
    }

    // Reset
    transcriptRef.current = ''
    speechWorkedRef.current = false
    chunksRef.current = []

    try {
      onStatusChange('Solicitando microfone...')

      // 1. Start microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      // 2. Start MediaRecorder (always, as backup for backend transcription)
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      let mime = ''
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { mime = mt; break }
      }
      if (mime) {
        mimeRef.current = mime
        const recorder = new MediaRecorder(stream, { mimeType: mime })
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start(500)
        recorderRef.current = recorder
      }

      // 3. Try Web Speech API in parallel (free, real-time)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'pt-BR'

        recognition.onresult = (event: any) => {
          speechWorkedRef.current = true
          let finalText = ''
          let interimText = ''
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalText += event.results[i][0].transcript + ' '
            } else {
              interimText += event.results[i][0].transcript
            }
          }
          if (finalText) transcriptRef.current = finalText.trim()
          if (interimText) {
            onStatusChange(`Ouvindo: "${interimText}"`)
          } else if (transcriptRef.current) {
            onStatusChange(`Gravando... (${transcriptRef.current.split(/\s+/).length} palavras)`)
          }
        }

        recognition.onerror = () => {
          // Speech API failed - will use MediaRecorder + backend
          speechWorkedRef.current = false
        }

        recognition.onend = () => {
          // Auto-restart if still recording
          if (isActiveRef.current && !isPaused) {
            try { recognition.start() } catch {}
          }
        }

        try {
          recognition.start()
          recognitionRef.current = recognition
        } catch {
          // Speech API not available in this environment
        }
      }

      isActiveRef.current = true
      setIsRecording(true)
      setIsPaused(false)
      onStatusChange('Gravando... Fale algo no microfone.')
    } catch (err: any) {
      cleanup()
      if (err.name === 'NotAllowedError') {
        onError('Permissão de microfone negada. Verifique Configurações do Windows > Privacidade > Microfone.')
      } else if (err.name === 'NotFoundError') {
        onError('Nenhum microfone encontrado.')
      } else {
        onError(`Erro ao iniciar gravação: ${err.message}`)
      }
    }
  }, [isPaused, onError, onStatusChange, cleanup])

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.pause()
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    setIsPaused(true)
    onStatusChange('Gravação pausada')
  }, [onStatusChange])

  const stopRecording = useCallback(async () => {
    isActiveRef.current = false
    setIsRecording(false)
    setIsPaused(false)

    // Stop speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }

    // If Web Speech API got results, use them directly (instant)
    if (speechWorkedRef.current && transcriptRef.current.trim()) {
      cleanup()
      const text = transcriptRef.current.trim()
      onTranscription(text)
      onStatusChange('Transcrição concluída')
      return
    }

    // Otherwise, stop MediaRecorder and send audio to backend
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      const mime = mimeRef.current

      // Wait for recorder to finish
      await new Promise<void>((resolve) => {
        recorderRef.current!.onstop = () => resolve()
        recorderRef.current!.stop()
      })

      // Stop stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      if (chunksRef.current.length === 0) {
        onError('Nenhum áudio capturado.')
        return
      }

      const blob = new Blob(chunksRef.current, { type: mime })
      const sizeKB = (blob.size / 1024).toFixed(0)
      onStatusChange(`Transcrevendo áudio (${sizeKB} KB)...`)

      try {
        const buffer = await blob.arrayBuffer()
        const result = await window.voxpad.transcribeAudio(buffer, mime)
        if (result.success && result.data) {
          onTranscription(result.data)
          onStatusChange('Transcrição concluída')
        } else {
          onError(result.error || 'Erro na transcrição')
        }
      } catch (err: any) {
        onError(`Erro: ${err.message}`)
      }
    } else {
      cleanup()
      onStatusChange('Nenhuma fala detectada')
    }
  }, [onTranscription, onError, onStatusChange, cleanup])

  return {
    isRecording,
    isPaused,
    startRecording,
    pauseRecording,
    stopRecording,
  }
}
