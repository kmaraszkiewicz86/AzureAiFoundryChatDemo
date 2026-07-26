import axios from 'axios'
import { Environment } from '../environments/environment'
import type { AskQuestionRequest } from '../models/askQuestionRequest'
import type { AskQuestionResponse } from '../models/askQuestionResponse'

export async function askQuestion(question: string): Promise<AskQuestionResponse[]> {

  const baseUrl = Environment.apiUrl

  const requestBody: AskQuestionRequest = { question }

  const response = await axios.post<AskQuestionResponse[]>(`${baseUrl}/api/chat`, requestBody)

  return response.data
}
