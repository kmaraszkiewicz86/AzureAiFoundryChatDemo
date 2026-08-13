import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import * as signalR from '@microsoft/signalr'
import type { AskQuestionResponse } from '../models/askQuestionResponse'
import { startStreamingQuestion } from '../services/chatService'

/** Terminal and in-progress states maintained independently for each model. */
type ResponseStatus = 'streaming' | 'completed' | 'failed'

/** A progressively assembled answer and its current model state. */
export interface StreamingResponse extends AskQuestionResponse {
  /** Current lifecycle state for this model stream. */
  status: ResponseStatus

  /** Model-specific failure details supplied by the backend, when available. */
  error?: string
}

/** State and actions exposed to the streaming chat presentation component. */
export interface StreamingChatState {
  /** Current textarea value. */
  question: string

  /** Updates the current textarea value. */
  setQuestion: Dispatch<SetStateAction<string>>

  /** Question associated with the response articles currently displayed. */
  submittedQuestion: string

  /** Progressively assembled responses, one per deployment. */
  responses: StreamingResponse[]

  /** Request-level connection or queueing failure shown by the UI. */
  error: string

  /** Indicates whether at least one model is still streaming. */
  isLoading: boolean

  /** Starts streaming the current question. */
  submitQuestion: () => Promise<void>
}

/** Fields included in every SignalR response event. */
interface ResponseEvent {
  /** Identifies the React submission that owns the event. */
  requestId: string

  /** Identifies the Azure AI Foundry deployment that produced the event. */
  llModelName: string
}

/** SignalR event containing an incremental text delta. */
interface ResponseChunkEvent extends ResponseEvent {
  /** Text to append to the model's current answer. */
  chunk: string
}

/** SignalR event containing an optional model failure description. */
interface ResponseFailedEvent extends ResponseEvent {
  /** Failure details generated while streaming this model. */
  error?: string
}

/**
 * Owns the complete streaming workflow and exposes presentation-ready state:
 * connect, join the request group, enqueue the question, and process model events.
 */
export function useStreamingChat(): StreamingChatState {
  const [question, setQuestion] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState('')
  const [responses, setResponses] = useState<StreamingResponse[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Refs let asynchronous SignalR callbacks reject stale events without causing rerenders.
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)

  // Stop the persistent hub connection when the consuming component leaves the page.
  useEffect(() => {
    return () => {
      currentRequestIdRef.current = null

      if (connectionRef.current) {
        void connectionRef.current.stop()
      }
    }
  }, [])

  /** Starts one streaming submission while preventing a second active submission. */
  const submitQuestion = async () => {
    const submittedValue = question.trim()

    if (!submittedValue) {
      return
    }

    // The browser-generated identifier links the hub group, POST request, and all response events.
    const requestId = crypto.randomUUID()
    const activeModels = new Set<string>()

    currentRequestIdRef.current = requestId
    setSubmittedQuestion(submittedValue)
    setResponses([])
    setError('')
    setIsLoading(true)

    // A completed connection may remain open from the previous submission; replace it cleanly.
    if (connectionRef.current) {
      await connectionRef.current.stop()
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/chat')
      .withAutomaticReconnect()
      .build()

    connectionRef.current = connection

    // Ignore late events from a previous request after a new submission becomes active.
    const isCurrentRequest = (message: ResponseEvent) =>
      currentRequestIdRef.current === requestId
      && message.requestId.toLowerCase() === requestId.toLowerCase()

    // Upsert by model name so interleaved model chunks always update the correct response.
    const updateResponse = (
      llModelName: string,
      update: (response: StreamingResponse) => StreamingResponse,
    ) => {
      setResponses((currentResponses) => {
        const existingResponse = currentResponses.find(
          (response) => response.LLModelName === llModelName,
        )

        if (!existingResponse) {
          return [
            ...currentResponses,
            update({
              answer: '',
              LLModelName: llModelName,
              status: 'streaming',
            }),
          ]
        }

        return currentResponses.map((response) =>
          response.LLModelName === llModelName ? update(response) : response,
        )
      })
    }

    // The backend publishes every start event before any model stream can complete.
    const completeModel = (llModelName: string) => {
      activeModels.delete(llModelName)

      if (activeModels.size === 0) {
        setIsLoading(false)
      }
    }

    // Create one response record as each configured model announces that it has started.
    connection.on('ResponseStarted', (message: ResponseEvent) => {
      if (!isCurrentRequest(message)) {
        return
      }

      activeModels.add(message.llModelName)
      updateResponse(message.llModelName, (response) => ({
        ...response,
        status: 'streaming',
      }))
    })

    // Append deltas immediately to provide progressive model output.
    connection.on('ResponseChunk', (message: ResponseChunkEvent) => {
      if (!isCurrentRequest(message)) {
        return
      }

      updateResponse(message.llModelName, (response) => ({
        ...response,
        answer: response.answer + message.chunk,
      }))
    })

    // Track successful terminal events independently for each model.
    connection.on('ResponseCompleted', (message: ResponseEvent) => {
      if (!isCurrentRequest(message)) {
        return
      }

      updateResponse(message.llModelName, (response) => ({
        ...response,
        status: 'completed',
      }))
      completeModel(message.llModelName)
    })

    // Preserve any partial answer and display the failure beside the affected model only.
    connection.on('ResponseFailed', (message: ResponseFailedEvent) => {
      if (!isCurrentRequest(message)) {
        return
      }

      updateResponse(message.llModelName, (response) => ({
        ...response,
        status: 'failed',
        error: message.error ?? 'The model failed to generate a response.',
      }))
      completeModel(message.llModelName)
    })

    // SignalR groups are connection-scoped, so a reconnected client must join again.
    connection.onreconnected(async () => {
      if (currentRequestIdRef.current !== requestId) {
        return
      }

      try {
        await connection.invoke('JoinRequest', requestId)
      } catch {
        setError('The connection was restored, but the request subscription failed.')
      }
    })

    // Surface an unexpected terminal disconnect instead of leaving the UI in a loading state.
    connection.onclose(() => {
      if (currentRequestIdRef.current === requestId && activeModels.size > 0) {
        setError('The streaming connection closed before all responses completed.')
        setIsLoading(false)
      }
    })

    try {
      await connection.start()

      // Joining before the POST guarantees the first Azure AI Foundry chunk has a subscriber.
      await connection.invoke('JoinRequest', requestId)
      await startStreamingQuestion(requestId, submittedValue)
      setQuestion('')
    } catch {
      if (connectionRef.current === connection) {
        await connection.stop()
      }

      setError('Failed to start the streaming request.')
      setResponses([])
      setIsLoading(false)
    }
  }

  return {
    question,
    setQuestion,
    submittedQuestion,
    responses,
    error,
    isLoading,
    submitQuestion,
  }
}
