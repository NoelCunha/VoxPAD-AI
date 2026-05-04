# VoxPad AI

Bloco de Notas avançado para Windows com transcrição de voz e tradução por inteligência artificial.

## O que é

VoxPad AI é um editor de texto desktop que combina a simplicidade de um bloco de notas com recursos de IA. Você pode ditar textos usando o microfone e traduzir para qualquer idioma com um clique — tudo integrado em uma interface limpa inspirada no Windows 11.

## O que o sistema faz

### Transcrição de Voz (Speech-to-Text)
- Grave áudio diretamente pelo microfone clicando em **Gravar**
- O áudio é capturado, convertido e transcrito automaticamente
- O texto reconhecido é inserido no editor na posição do cursor
- Suporte a gravação com **pausar** e **continuar**
- Transcrição local usando Whisper (faster-whisper) — funciona offline, sem enviar dados para servidores externos

### Tradução de Texto
- Selecione o idioma de destino no dropdown e clique em **Traduzir**
- Traduz o texto inteiro ou apenas o trecho selecionado
- 11 idiomas suportados: Inglês, Espanhol, Francês, Alemão, Italiano, Português, Japonês, Coreano, Chinês, Russo e Árabe
- Opção de substituir o texto original ou anexar a tradução abaixo

### Múltiplos Provedores de IA
O sistema permite conectar diferentes provedores para tradução, sem depender de um único serviço:

| Provedor | Tipo | Requer API Key |
|----------|------|----------------|
| OpenAI (GPT) | API | Sim |
| Google Gemini | API | Sim |
| Anthropic | API | Sim |
| Google Cloud CLI | CLI local | Não (usa `gcloud auth`) |
| Claude Code CLI | CLI local | Não (usa autenticação local) |

### Segurança
- Chaves de API ficam no processo principal (Main Process) do Electron
- Comunicação via IPC (Inter-Process Communication) — chaves nunca são expostas no frontend
- Configurações salvas localmente com criptografia via electron-store

## Stack Tecnológica

- **Desktop:** Electron
- **Frontend:** React + TypeScript + Vite
- **Estilização:** Tailwind CSS
- **Ícones:** Lucide React
- **Áudio:** MediaRecorder API + ffmpeg-static
- **Transcrição local:** faster-whisper (Python)
- **Persistência:** electron-store
- **Build:** electron-builder (instalador NSIS para Windows)

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.10+ (para transcrição local)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (`pip install faster-whisper`)

## Instalação

```bash
git clone https://github.com/NoelCunha/VoxPAD-AI.git
cd VoxPAD-AI
npm install
pip install faster-whisper
```

## Uso

### Modo desenvolvimento

```bash
npm run dev
```

### Gerar instalador Windows (.exe)

```bash
npm run build
```

O instalador será gerado na pasta `release/`.

## Estrutura do Projeto

```
src/
├── main/                        # Electron Main Process
│   ├── index.ts                 # Janela principal e permissões
│   ├── preload.ts               # Bridge IPC segura
│   ├── ipc-handlers.ts          # Roteamento de chamadas
│   ├── api-service.ts           # OpenAI / Gemini / Anthropic via API
│   ├── claude-cli-service.ts    # Tradução via CLI local
│   ├── gcloud-service.ts        # Google Cloud CLI (tradução + transcrição)
│   ├── local-transcription.ts   # Whisper local (ffmpeg + faster-whisper)
│   └── store.ts                 # Persistência de configurações
├── renderer/                    # Frontend React
│   ├── App.tsx                  # Componente principal
│   ├── main.tsx                 # Entry point
│   ├── components/
│   │   ├── Toolbar.tsx          # Barra: Gravar / Traduzir / Configurações
│   │   ├── Editor.tsx           # Área de texto
│   │   ├── StatusBar.tsx        # Barra de status
│   │   └── SettingsModal.tsx    # Modal de configurações
│   ├── hooks/
│   │   └── useAudioRecorder.ts  # Hook de captura de áudio
│   └── styles/
│       └── index.css            # Tailwind CSS
└── shared/                      # Código compartilhado
    ├── types.ts                 # Tipos e constantes
    └── ipc-channels.ts          # Canais IPC
```

## Como funciona

1. **Gravar** → O microfone captura áudio via MediaRecorder API
2. **Parar** → O áudio (webm) é convertido para WAV pelo ffmpeg e transcrito pelo faster-whisper localmente
3. **Traduzir** → O texto é enviado ao provedor de IA ativo, que retorna a tradução em linguagem natural
4. **Configurações** → Detecta automaticamente CLIs instalados (Google Cloud, Claude Code) e permite configurar API keys

## Configuração dos Provedores

### Sem API Key (via CLI)
Nas configurações, o app detecta automaticamente se você tem o Google Cloud CLI ou Claude Code CLI instalados e autenticados. Basta clicar em **Conectar** para ativar.

### Com API Key
Insira a chave de API do provedor desejado (OpenAI, Google Gemini ou Anthropic) nas configurações e clique em **Buscar Modelos** para selecionar o modelo.

## Licença

MIT

## Autor

**Pressa Digital**
