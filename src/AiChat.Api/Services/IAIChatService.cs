namespace AIChat.Api.Services
{
    public interface IAIChatService
    {
        Task<AskQuestionResponse> AskAsync(string question, CancellationToken cancellationToken = default);
    }
}