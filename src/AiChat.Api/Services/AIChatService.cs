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
    private readonly AzureOpenAIOptions _azureOpenAIOptions;

    public AIChatService(IOptions<AzureOpenAIOptions> azureOpenAIOptions)
    {
        _options = azureOpenAIOptions.Value;
        _azureOpenAIOptions = azureOpenAIOptions.Value;

        _client = new ResponsesClient(
            new ApiKeyCredential(_options.ApiKey),
            new ResponsesClientOptions
            {
                Endpoint = new Uri(_options.Endpoint.Replace("/responses", "/"))
            });
    }

    /// <summary>
    /// Asks a question to the OpenAI API using all configured deployment names and returns the responses.
    /// </summary>
    /// <param name="question">The question to ask.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The responses from the OpenAI API.</returns>
    public async Task<AskQuestionResponse[]> AskQuestionsAsync(string question, CancellationToken cancellationToken = default)
    {
        List<Task<AskQuestionResponse>> askQuestionTasks = [];

        foreach (string deploymentName in _azureOpenAIOptions.DeploymentNames)
        {
            askQuestionTasks.Add(AskAsync(question, deploymentName, cancellationToken));
        }

        return await Task.WhenAll(askQuestionTasks);
    }

    /// <summary>
    /// Asks a question to the OpenAI API using the specified deployment name and returns the response.
    /// </summary>
    /// <param name="question">The question to ask.</param>
    /// <param name="deploymentName">The name of the deployment to use.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>The response from the OpenAI API.</returns>
    private async Task<AskQuestionResponse> AskAsync(string question, string deploymentName, CancellationToken cancellationToken = default)
    {
        try
        {
            CreateResponseOptions request = new()
            {
                Model = deploymentName,
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
                Answer = response.GetOutputText(),
                LLModelName = deploymentName
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
                Answer = errorMessageStringBuilder.ToString(),
                LLModelName = deploymentName
            };
        }
    }
}

#pragma warning disable OPENAI001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.