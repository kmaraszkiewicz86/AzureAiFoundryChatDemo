import axios from 'axios'
import { Environment } from '../environments/environment'
import type { AskQuestionRequest } from '../models/askQuestionRequest'
import type { AskQuestionResponse } from '../models/askQuestionResponse'

interface AskQuestionApiResponse {
  answer: string
  llModelName?: string
  LLModelName?: string
}

export async function askQuestion(question: string): Promise<AskQuestionResponse[]> {
  const baseUrl = Environment.apiUrl

  const requestBody: AskQuestionRequest = { question: question.trim() }

  const response = await axios.post<AskQuestionApiResponse[]>(`${baseUrl}/api/chat`, requestBody)

  return response.data.map((item) => ({
    answer: item.answer,
    LLModelName: item.LLModelName ?? item.llModelName ?? 'Unknown model',
  }))
}
