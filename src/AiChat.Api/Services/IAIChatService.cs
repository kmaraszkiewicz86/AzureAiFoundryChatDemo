namespace AIChat.Api.Services
{
    public interface IAIChatService
    {
        Task<AskQuestionResponse[]> AskQuestionsAsync(string question, CancellationToken cancellationToken = default);
    }
}