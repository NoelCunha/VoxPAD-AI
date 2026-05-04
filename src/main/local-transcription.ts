import { execFile, spawn } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import path from 'path'
import { app } from 'electron'

let ffmpegPath: string
try {
  ffmpegPath = require('ffmpeg-static')
} catch {
  ffmpegPath = 'ffmpeg'
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // shell: false so paths with spaces work correctly
    execFile(ffmpegPath, args, {
      timeout: 15000,
      windowsHide: true,
    }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message))
      else resolve()
    })
  })
}

function runPythonFile(scriptPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use execFile without shell, pass script file path directly
    execFile('python', [scriptPath], {
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
      shell: true,
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message))
      else resolve(stdout.trim())
    })
  })
}

export async function transcribeWithWindowsSpeech(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const tempDir = app.getPath('temp')
  const timestamp = Date.now()
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'webm'
  const inputFile = path.join(tempDir, `voxpad_${timestamp}.${ext}`)
  const wavFile = path.join(tempDir, `voxpad_${timestamp}.wav`)

  try {
    writeFileSync(inputFile, audioBuffer)

    // Convert to WAV using ffmpeg-static (shell: false, handles spaces in paths)
    await runFfmpeg([
      '-i', inputFile,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-y', wavFile,
    ])

    if (!existsSync(wavFile)) {
      throw new Error('Falha na conversão do áudio.')
    }

    // Use faster-whisper (Python, local, supports Portuguese)
    const pyFile = path.join(tempDir, `voxpad_transcribe_${timestamp}.py`)
    const wavPathForPython = wavFile.replace(/\\/g, '/')
    const pythonScript = [
      'import json',
      'from faster_whisper import WhisperModel',
      'model = WhisperModel("base", device="cpu", compute_type="int8")',
      `segments, info = model.transcribe("${wavPathForPython}", language="pt")`,
      'text = " ".join([s.text for s in segments]).strip()',
      'print(json.dumps({"text": text, "lang": info.language}))',
    ].join('\n')
    writeFileSync(pyFile, pythonScript, 'utf-8')

    const result = await runPythonFile(pyFile)
    try { unlinkSync(pyFile) } catch {}

    if (!result) {
      throw new Error('Transcrição retornou vazio.')
    }

    const parsed = JSON.parse(result)
    if (!parsed.text) {
      throw new Error('Nenhuma fala detectada no áudio.')
    }

    return parsed.text
  } finally {
    try { if (existsSync(inputFile)) unlinkSync(inputFile) } catch {}
    try { if (existsSync(wavFile)) unlinkSync(wavFile) } catch {}
  }
}
