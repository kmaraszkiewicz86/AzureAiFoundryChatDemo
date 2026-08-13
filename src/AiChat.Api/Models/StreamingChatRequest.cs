/// <summary>
/// Represents a question waiting in the in-memory streaming queue.
/// </summary>
/// <param name="RequestId">The identifier used to route SignalR events.</param>
/// <param name="Question">The question to stream through all configured deployments.</param>
public sealed record StreamingChatRequest(Guid RequestId, string Question);
