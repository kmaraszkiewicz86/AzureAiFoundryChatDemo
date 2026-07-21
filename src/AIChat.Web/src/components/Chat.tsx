import { useState } from 'react'
import type { FormEvent } from 'react'
import { askQuestion } from '../services/chatService'
import type { AskQuestionResponse } from '../models/askQuestionResponse'

function Chat() {
  const [question, setQuestion] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState('')
  const [response, setResponse] = useState<AskQuestionResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!question.trim()) {
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await askQuestion(question)
      setSubmittedQuestion(question)
      setResponse(result)
      setQuestion('')
    } catch {
      setError('Failed to get an answer.')
      setResponse(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          cols={60}
          placeholder="Type your question here..."
        />
        <div>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {error && <p>{error}</p>}

      {response && (
        <article>
          <p>
            <strong>Question:</strong> {submittedQuestion}
          </p>
          <p>
            <strong>Answer:</strong> {response.answer}
          </p>
          <p>
            <strong>Source file:</strong> {response.source.fileName}
          </p>
          <p>
            <strong>Page number:</strong> {response.source.page}
          </p>
        </article>
      )}
    </section>
  )
}

export default Chat
