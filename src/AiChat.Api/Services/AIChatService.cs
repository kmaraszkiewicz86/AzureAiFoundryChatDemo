using Microsoft.Extensions.Options;
using OpenAI.Responses;
using System.ClientModel;
using System.Text;

namespace AIChat.Api.Services;

#pragma warning disable OPENAI001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
public sealed class AIChatService : IAIChatService
{
    private readonly ResponsesClient _client;
    private readonly AzureOpenAIOptions _options;

    public AIChatService(IOptions<AzureOpenAIOptions> azureOpenAIOptions)
    {
        _options = azureOpenAIOptions.Value;

        _client = new ResponsesClient(
            new ApiKeyCredential(_options.ApiKey),
            new ResponsesClientOptions
            {
                Endpoint = new Uri(_options.Endpoint.Replace("/responses", "/"))
            });
    }

    public async Task<AskQuestionResponse> AskAsync(string question, CancellationToken cancellationToken = default)
    {
        try
        {
            CreateResponseOptions request = new()
            {
                Model = _options.DeploymentName,
                InputItems =
                {
                    ResponseItem.CreateUserMessageItem(question)
                }
            };

            ResponseResult response = await _client.CreateResponseAsync(
                request,
                cancellationToken);

            return new AskQuestionResponse
            {
                Answer = response.GetOutputText()
            };
        }
        catch (Exception ex)
        {
            StringBuilder errorMessageStringBuilder = new();

            errorMessageStringBuilder.AppendLine(ex.Message);

            if (ex.InnerException != null)
                errorMessageStringBuilder.AppendLine(ex.InnerException.Message);

            return new AskQuestionResponse
            {
                Answer = errorMessageStringBuilder.ToString()
            };
        }

    }
}

#pragma warning disable OPENAI001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.