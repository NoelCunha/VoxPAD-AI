import { execFile, spawn } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import path from 'path'
import { app } from 'electron'

function exec(command: string, args: string[], timeout = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 5,
      shell: true,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

function execWithStdin(command: string, args: string[], stdinData: string, timeout = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: true,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Timeout na execução do Claude CLI'))
    }, timeout)

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `Claude CLI exit code ${code}`))
      } else {
        resolve(stdout.trim())
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    // Send prompt via stdin and close
    child.stdin.write(stdinData)
    child.stdin.end()
  })
}

export interface ClaudeCliStatus {
  installed: boolean
  authenticated: boolean
  version: string
}

export async function getClaudeCliStatus(): Promise<ClaudeCliStatus> {
  try {
    const version = await exec('claude', ['--version'], 10000)
    return {
      installed: true,
      authenticated: true,
      version: version.split('\n')[0],
    }
  } catch {
    return { installed: false, authenticated: false, version: '' }
  }
}

export async function claudeCliTranslate(text: string, targetLanguage: string): Promise<string> {
  const prompt = [
    `TAREFA: Tradução de texto.`,
    `IDIOMA DE DESTINO: ${targetLanguage}.`,
    `REGRAS: Responda SOMENTE com o texto traduzido. Sem explicações, sem perguntas, sem comentários, sem formatação markdown. Apenas o texto traduzido em linguagem natural.`,
    ``,
    `TEXTO PARA TRADUZIR:`,
    `${text}`,
  ].join('\n')

  try {
    // Pass prompt via stdin pipe for reliability (no shell escaping issues)
    const result = await execWithStdin('claude', ['--print'], prompt, 120000)

    if (!result) {
      throw new Error('Claude CLI retornou resposta vazia')
    }

    return result
  } catch (error: any) {
    if (error.message.includes('not found') || error.message.includes('not recognized') || error.message.includes('ENOENT')) {
      throw new Error('Claude CLI não encontrado. Verifique se está instalado e no PATH do sistema.')
    }
    if (error.message.includes('auth') || error.message.includes('login')) {
      throw new Error('Claude CLI não autenticado. Execute "claude" no terminal para configurar.')
    }
    throw new Error(`Erro no Claude CLI: ${error.message}`)
  }
}

export async function claudeCliLogin(): Promise<ClaudeCliStatus> {
  const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', 'claude'], {
    stdio: 'ignore',
    shell: false,
    detached: true,
  })
  child.unref()

  await new Promise((r) => setTimeout(r, 2000))

  return getClaudeCliStatus()
}
