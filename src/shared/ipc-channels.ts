export const IPC = {
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',
  FETCH_MODELS: 'api:fetch-models',
  TRANSCRIBE_AUDIO: 'api:transcribe',
  TRANSLATE_TEXT: 'api:translate',
  VALIDATE_KEY: 'api:validate-key',
  GCLOUD_STATUS: 'gcloud:status',
  GCLOUD_TRANSLATE: 'gcloud:translate',
  CLAUDE_CLI_STATUS: 'claude-cli:status',
  GCLOUD_LOGIN: 'gcloud:login',
  CLAUDE_CLI_LOGIN: 'claude-cli:login',
} as const
