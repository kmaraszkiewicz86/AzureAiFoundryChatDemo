/// <summary>
/// Represents the HTTP request used to start background response streaming.
/// </summary>
public sealed class AskStreamingQuestionRequest
{
    /// <summary>
    /// Gets the client-generated identifier used for SignalR event routing.
    /// </summary>
    public Guid RequestId { get; init; }

    /// <summary>
    /// Gets the question that will be sent to every configured AI deployment.
    /// </summary>
    public string Question { get; init; } = string.Empty;
}
