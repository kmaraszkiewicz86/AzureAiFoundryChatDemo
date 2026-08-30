/** SignalR event names shared with the ASP.NET Core backend. */
export const ChatEvents = {
  Started: 'ResponseStarted',
  Chunk: 'ResponseChunk',
  Completed: 'ResponseCompleted',
  Failed: 'ResponseFailed',
} as const

/** Hub methods invoked by the client. */
export const ChatHubMethods = {
  JoinRequest: 'JoinRequest',
} as const

/** Lifecycle states of a single model response. */
export const ResponseStatus = {
  Streaming: 'streaming',
  Completed: 'completed',
  Failed: 'failed',
} as const

/** Error messages used by the streaming service. */
export const ChatErrors = {
  ModelFailed: 'The model failed to generate a response.',
  ConnectionLost: 'The streaming connection closed before all responses completed.',
  StartFailed: 'Failed to start the streaming request.',
} as const
