using AIChat.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AiChat.Api.Controllers;

/// <summary>
/// Handles chat creation and SSE streaming for the demo.
/// </summary>
[ApiController]
[Route("api/chat")]
public sealed class AIChatController(IAIChatService aiChatService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<AskQuestionResponse[]>> AskAsync([FromBody] AskQuestionRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            return BadRequest("Question is required.");
        }

        var response = await aiChatService.AskQuestionsAsync(request.Question, cancellationToken);
        return Ok(response);
    }
}
