using AIChat.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AiChat.Api.Controllers;

/// <summary>
/// Handles synchronous chat requests and queues asynchronous streaming chat requests.
/// </summary>
/// <param name="aiChatService">The AI service used by the existing synchronous endpoint.</param>
/// <param name="streamingChatQueue">The in-memory queue used by the streaming endpoint.</param>
[ApiController]
[Route("api/chat")]
public sealed class AIChatController(
    IAIChatService aiChatService,
    StreamingChatQueue streamingChatQueue) : ControllerBase
{
    /// <summary>
    /// Sends a question to every configured model and waits for all complete responses.
    /// </summary>
    /// <param name="request">The question to send to the configured models.</param>
    /// <param name="cancellationToken">A token that cancels the HTTP request.</param>
    /// <returns>The complete model responses, or a bad request when the question is empty.</returns>
    [HttpPost]
    public async Task<ActionResult<AskQuestionResponse[]>> AskAsync(
        [FromBody] AskQuestionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            return BadRequest("Question is required.");
        }

        var response = await aiChatService.AskQuestionsAsync(request.Question, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Queues a question for background streaming and returns without waiting for any model.
    /// </summary>
    /// <param name="request">The client-generated request identifier and question to queue.</param>
    /// <param name="cancellationToken">A token that cancels enqueueing when the HTTP request ends.</param>
    /// <returns>A 202 Accepted response containing the request identifier.</returns>
    [HttpPost("stream")]
    public async Task<IActionResult> AskStreaming(
        [FromBody] AskStreamingQuestionRequest request,
        CancellationToken cancellationToken)
    {
        // The controller deliberately hands work to the channel; AI processing happens in the hosted service.
        await streamingChatQueue.EnqueueAsync(
            new StreamingChatRequest(request.RequestId, request.Question),
            cancellationToken);

        return Accepted(new
        {
            request.RequestId
        });
    }
}
