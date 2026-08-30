import { ChatErrors, ChatEvents, ResponseStatus } from '../constants/chatConstants'
import type { StreamingEvent } from '../models/streamingEvent'
import type { StreamingProgress, StreamingResponse } from '../models/streamingChatState'
import { ChatConnectionService } from './chatConnectionService'
import { startStreamingQuestion } from './chatService'

/** Assembles model responses and reports streaming progress without depending on React or SignalR. */
export class StreamingChatService {
  private connection: ChatConnectionService | null = null
  private progress: StreamingProgress = { responses: [], isLoading: false, error: '' }
  private onProgress?: (progress: StreamingProgress) => void

  /** Connects, subscribes, and queues a question; model events are handled separately. */
  async ask(question: string, onProgress: (progress: StreamingProgress) => void): Promise<boolean> {
    const previousConnectionStopped = this.stop()
    const requestId = crypto.randomUUID()
    const connection = new ChatConnectionService()
    this.connection = connection
    this.onProgress = onProgress
    this.progress = { responses: [], isLoading: true, error: '' }
    this.subscribeToResponses(connection, requestId)
    onProgress(this.progress)

    try {
      await previousConnectionStopped
      if (this.connection !== connection) return false
      if (!await connection.start(requestId)) return false
      if (this.connection !== connection || !connection.isConnected) return false

      // The connection has joined its group, so the first model chunk already has a listener.
      await startStreamingQuestion(requestId, question)
      return this.connection === connection && connection.isConnected
    } catch {
      if (this.connection === connection) {
        this.failRequest(ChatErrors.StartFailed)
        await this.stop().catch(console.error)
      }
      return false
    }
  }

  /** Wires backend events to response processing and ignores events from previous submissions. */
  private subscribeToResponses(connection: ChatConnectionService, requestId: string): void {
    const handle = (event: StreamingEvent, status: StreamingResponse['status']) => {
      if (this.connection !== connection || event.requestId.toLowerCase() !== requestId.toLowerCase()) return
      this.updateResponse(event, status)
    }

    connection.on(ChatEvents.Started, (event) => handle(event, ResponseStatus.Streaming))
    connection.on(ChatEvents.Chunk, (event) => handle(event, ResponseStatus.Streaming))
    connection.on(ChatEvents.Completed, (event) => handle(event, ResponseStatus.Completed))
    connection.on(ChatEvents.Failed, (event) => handle(event, ResponseStatus.Failed))
    connection.onClose(() => {
      if (this.connection === connection && this.progress.isLoading) {
        this.failRequest(ChatErrors.ConnectionLost)
      }
    })
  }

  /** Appends a model's text and applies its status, backend execution time, and token usage. */
  private updateResponse(event: StreamingEvent, status: StreamingResponse['status']): void {
    const previous = this.progress.responses.find((response) => response.LLModelName === event.llModelName)
    const response: StreamingResponse = {
      LLModelName: event.llModelName,
      answer: (previous?.answer ?? '') + (event.chunk ?? ''),
      status,
      elapsedMilliseconds: event.elapsedMilliseconds ?? previous?.elapsedMilliseconds ?? 0,
      inputTokens: event.inputTokens ?? previous?.inputTokens,
      outputTokens: event.outputTokens ?? previous?.outputTokens,
      totalTokens: event.totalTokens ?? previous?.totalTokens,
      error: status === ResponseStatus.Failed ? event.error ?? ChatErrors.ModelFailed : undefined,
    }
    const responses = previous
      ? this.progress.responses.map((item) => item.LLModelName === event.llModelName ? response : item)
      : [...this.progress.responses, response]

    // The API announces all models before streaming, so loading ends after the last terminal event.
    this.progress = {
      responses,
      isLoading: responses.some((item) => item.status === ResponseStatus.Streaming),
      error: '',
    }
    this.onProgress?.(this.progress)
  }

  /** Preserves completed answers and marks interrupted model streams as failed. */
  private failRequest(error: string): void {
    this.progress = {
      responses: this.progress.responses.map((response) => response.status === ResponseStatus.Streaming
        ? { ...response, status: ResponseStatus.Failed, error }
        : response),
      isLoading: false,
      error,
    }
    this.onProgress?.(this.progress)
  }

  /** Stops the current request's connection and prevents late events from updating the UI. */
  async stop(): Promise<void> {
    const connection = this.connection
    this.connection = null
    await connection?.stop()
  }
}
