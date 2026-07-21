import axios from 'axios'
import type { AskQuestionRequest } from '../models/askQuestionRequest'
import type { AskQuestionResponse } from '../models/askQuestionResponse'

export async function askQuestion(question: string): Promise<AskQuestionResponse> {
  const requestBody: AskQuestionRequest = { question }

  const response = await axios.post<AskQuestionResponse>('/api/chat', requestBody)

  return response.data
}
