import type { FormEvent } from 'react'
import { useStreamingChat } from '../hooks/useStreamingChat'
import { sanitizeAnswerHtml } from '../services/htmlSanitizer'

/**
 * Presents the streaming chat form and model results while useStreamingChat owns
 * SignalR connection management, request orchestration, and response state.
 */
function StreamingChat() {
  const {
    question,
    setQuestion,
    submittedQuestion,
    responses,
    error,
    isLoading,
    submitQuestion,
  } = useStreamingChat()

  /** Prevents native form submission and delegates the workflow to the streaming hook. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitQuestion()
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
            {isLoading ? 'Streaming...' : 'Send'}
          </button>
        </div>
      </form>

      {error && <p>{error}</p>}

      {/* Flex styling keeps all progressively rendered model articles side by side. */}
      {responses.length > 0 && (
        <div className="streaming-responses">
          {responses.map((response) => (
            <article className="streaming-response" key={response.LLModelName}>
              <strong>Model:</strong> <u>{response.LLModelName}</u>
              <p>
                <strong>Question:</strong> {submittedQuestion}
              </p>
              <div>
                <p>
                  <strong>Answer:</strong>
                </p>
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeAnswerHtml(response.answer),
                  }}
                />
                {response.status === 'failed' && <p>{response.error}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default StreamingChat
