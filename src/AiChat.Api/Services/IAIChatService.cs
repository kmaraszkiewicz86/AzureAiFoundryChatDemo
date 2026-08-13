namespace AIChat.Api.Services
{
    /// <summary>
    /// Defines synchronous and SignalR-based streaming operations for configured AI deployments.
    /// </summary>
    public interface IAIChatService
    {
        /// <summary>
        /// Asks a question to every configured deployment and returns the complete responses.
        /// </summary>
        /// <param name="question">The question to ask.</param>
        /// <param name="cancellationToken">A token to cancel the operation.</param>
        /// <returns>The complete responses from all configured deployments.</returns>
        Task<AskQuestionResponse[]> AskQuestionsAsync(string question, CancellationToken cancellationToken = default);

        /// <summary>
        /// Streams responses from every configured deployment to the SignalR group for a request.
        /// </summary>
        /// <param name="requestId">The identifier used to select the receiving SignalR group.</param>
        /// <param name="question">The question to ask.</param>
        /// <param name="cancellationToken">A token to cancel all model streams.</param>
        /// <returns>A task that completes after every configured model finishes or fails.</returns>
        Task AskQuestionsStreamingAsync(
            Guid requestId,
            string question,
            CancellationToken cancellationToken = default);
    }
}
