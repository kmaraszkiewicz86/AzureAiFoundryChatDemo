/** A model event received from the API through SignalR. */
export interface StreamingEvent {
  requestId: string
  llModelName: string
  chunk?: string
  error?: string
  elapsedMilliseconds?: number
}
