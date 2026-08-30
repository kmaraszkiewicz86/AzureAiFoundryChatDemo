/** Payload accepted by the background streaming API endpoint. */
export interface AskStreamingQuestionRequest {
  /** Client-generated identifier used to route SignalR events. */
  requestId: string;

  /** Question sent to every configured AI deployment. */
  question: string;
}