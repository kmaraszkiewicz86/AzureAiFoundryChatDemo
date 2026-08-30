import type { AskQuestionResponse } from './askQuestionResponse'
import type { ResponseStatus } from '../constants/chatConstants'

/** A model answer assembled from SignalR chunks, including backend execution time. */
export interface StreamingResponse extends AskQuestionResponse {
  status: typeof ResponseStatus[keyof typeof ResponseStatus]
  error?: string
}

/** Responses and request progress prepared by the service. */
export interface StreamingProgress {
  responses: StreamingResponse[]
  error: string
  isLoading: boolean
}

/** Local display state owned by the streaming chat component. */
export interface StreamingChatState extends StreamingProgress {
  submittedQuestion: string
}
