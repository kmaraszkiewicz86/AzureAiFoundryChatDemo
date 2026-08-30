import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { StreamingChatState } from '../models/streamingChatState'
import { StreamingChatService } from '../services/streamingChatService'
import { sanitizeAnswerHtml } from '../services/htmlSanitizer'

/** Controls the form and displays results prepared by the streaming service. */
function StreamingChat() {
  const service = useRef(new StreamingChatService())
  const [state, setState] = useState<StreamingChatState>({
    submittedQuestion: '',
    responses: [],
    error: '',
    isLoading: false,
  })
  const { submittedQuestion, responses, error, isLoading } = state

  useEffect(() => {
    const chatService = service.current
    return () => {
      void chatService.stop().catch(console.error)
    }
  }, [])

  /** Passes the question to the service and displays its progress without processing model events. */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isLoading) return

    const form = event.currentTarget
    const question = String(new FormData(form).get('question') ?? '').trim()
    if (!question) return

    const queued = await service.current.ask(question, (progress) => {
      setState({ submittedQuestion: question, ...progress })
    })
    if (queued) form.reset()
  }

  return (
    <section>
      <form onSubmit={handleSubmit}>
        <textarea
          name="question"
          disabled={isLoading}
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

      {responses.length > 0 && (
        <div className="streaming-responses">
          {responses.map((response) => (
            <article className="streaming-response" key={response.LLModelName}>
              <strong>Model:</strong> <u>{response.LLModelName}</u>
              {response.status !== 'streaming' && (
                <p><strong>Execution time:</strong> {response.elapsedMilliseconds} ms</p>
              )}
              {response.status === 'completed' && (
                <>
                  <p><strong>Input tokens:</strong> {response.inputTokens ?? 'N/A'}</p>
                  <p><strong>Output tokens:</strong> {response.outputTokens ?? 'N/A'}</p>
                  <p><strong>Total tokens:</strong> {response.totalTokens ?? 'N/A'}</p>
                </>
              )}
              <p><strong>Question:</strong> {submittedQuestion}</p>
              <div>
                <p><strong>Answer:</strong></p>
                <div dangerouslySetInnerHTML={{ __html: sanitizeAnswerHtml(response.answer) }} />
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
