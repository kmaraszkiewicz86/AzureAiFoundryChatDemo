/** A model event received from the API through SignalR. */
export interface StreamingEvent {
  requestId: string
  llModelName: string
  chunk?: string
  error?: string
  elapsedMilliseconds?: number
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
}
