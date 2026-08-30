import axios from 'axios'
import { Environment } from '../environments/environment'
import type { AskQuestionRequest } from '../models/askQuestionRequest'
import type { AskQuestionResponse } from '../models/askQuestionResponse'
import type { AskStreamingQuestionRequest } from '../models/askStreamingQuestionRequest'

interface AskQuestionApiResponse {
  answer: string
  llModelName?: string
  LLModelName?: string
  elapsedMilliseconds: number
}

export async function askQuestion(question: string): Promise<AskQuestionResponse[]> {
  const requestBody: AskQuestionRequest = { question: question.trim() }

  const response = await axios.post<AskQuestionApiResponse[]>(Environment.chatUrl, requestBody)

  return response.data.map((item) => ({
    answer: item.answer,
    LLModelName: item.LLModelName ?? item.llModelName ?? 'Unknown model',
    elapsedMilliseconds: item.elapsedMilliseconds
  }))
}

/**
 * Queues a streaming question after the caller has joined its SignalR request group.
 * The 202 response confirms queueing only; model output arrives through SignalR.
 */
export async function startStreamingQuestion(requestId: string, question: string): Promise<void> {
  const requestBody: AskStreamingQuestionRequest = {
    requestId,
    question: question.trim()
  }

  await axios.post(Environment.streamingChatUrl, requestBody)
}
