using AIChat.Api.Services;

namespace AiChat.Api.BackgroundServices;

/// <summary>
/// Consumes queued streaming requests and delegates them to the AI chat service.
/// </summary>
/// <param name="streamingChatQueue">The channel-backed request queue.</param>
/// <param name="aiChatService">The service that streams each request through all configured models.</param>
/// <param name="logger">The logger used to record request-level failures.</param>
public sealed class StreamingChatBackgroundService(
    StreamingChatQueue streamingChatQueue,
    IAIChatService aiChatService,
    ILogger<StreamingChatBackgroundService> logger) : BackgroundService
{
    /// <summary>
    /// Continuously processes queued requests until application shutdown.
    /// </summary>
    /// <param name="stoppingToken">A token triggered when the application is stopping.</param>
    /// <returns>A task representing the lifetime of the queue-processing loop.</returns>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // A single channel reader keeps request processing ordered while each request can stream several models.
        await foreach (StreamingChatRequest request in streamingChatQueue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await aiChatService.AskQuestionsStreamingAsync(
                    request.RequestId,
                    request.Question,
                    stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Isolate failures so one request cannot terminate the long-running background worker.
                logger.LogError(
                    ex,
                    "Streaming chat request {RequestId} failed.",
                    request.RequestId);
            }
        }
    }
}
