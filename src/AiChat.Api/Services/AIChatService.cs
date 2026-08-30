using AiChat.Api.Hubs;
using Azure.AI.OpenAI;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using System.ClientModel;
using System.Diagnostics;
using System.Text;

namespace AIChat.Api.Services;

/// <summary>
/// Sends synchronous and streaming requests to Azure AI Foundry deployments.
/// </summary>
public sealed class AIChatService : IAIChatService
{
    private readonly AzureOpenAIClient _client;
    private readonly IHubContext<ChatHub> _chatHubContext;
    private readonly AzureOpenAIOptions _options;

    /// <summary>
    /// Initializes the Azure AI Foundry client and SignalR event publisher.
    /// </summary>
    /// <param name="azureOpenAIOptions">The endpoint, API key, and deployment configuration.</param>
    /// <param name="chatHubContext">The hub context used to publish streaming model events.</param>
    public AIChatService(
        IOptions<AzureOpenAIOptions> azureOpenAIOptions,
        IHubContext<ChatHub> chatHubContext)
    {
        _options = azureOpenAIOptions.Value;
        _chatHubContext = chatHubContext;

        AzureOpenAIClientOptions clientOptions = new()
        {
            NetworkTimeout = TimeSpan.FromMinutes(5)
        };

        _client = new AzureOpenAIClient(
            new Uri(_options.Endpoint),
            new ApiKeyCredential(_options.ApiKey),
            clientOptions);
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

        foreach (string deploymentName in _options.DeploymentNames)
        {
            askQuestionTasks.Add(AskAsync(question, deploymentName, cancellationToken));
        }

        return await Task.WhenAll(askQuestionTasks);
    }

    /// <summary>
    /// Streams responses from every configured deployment to the request's SignalR group.
    /// </summary>
    /// <param name="requestId">The client-generated request identifier.</param>
    /// <param name="question">The question to ask.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A task that completes after all configured model streams reach a terminal state.</returns>
    public async Task AskQuestionsStreamingAsync(
        Guid requestId,
        string question,
        CancellationToken cancellationToken = default)
    {
        // Publish all start events first so React knows every active model before any model can complete.
        foreach (string deploymentName in _options.DeploymentNames)
        {
            await _chatHubContext.Clients
                .Group(ChatHub.GetRequestGroupName(requestId))
                .SendAsync(
                    "ResponseStarted",
                    new
                    {
                        RequestId = requestId,
                        LLModelName = deploymentName
                    },
                    cancellationToken);
        }

        List<Task> askQuestionTasks = [];

        // Stream all configured deployments concurrently, matching the synchronous fan-out behavior.
        foreach (string deploymentName in _options.DeploymentNames)
        {
            askQuestionTasks.Add(
                AskStreamingAsync(
                    requestId,
                    question,
                    deploymentName,
                    cancellationToken));
        }

        await Task.WhenAll(askQuestionTasks);
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
            string chatPrompt = GenerateChatPrompt(question);
            ChatClient chatClient = _client.GetChatClient(deploymentName);

            ChatCompletion response = await chatClient.CompleteChatAsync(
                [new UserChatMessage(chatPrompt)],
                cancellationToken: cancellationToken);

            return new AskQuestionResponse
            {
                Answer = string.Concat(response.Content.Select(contentPart => contentPart.Text)),
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

    /// <summary>
    /// Streams a response from the specified deployment to the request's SignalR group.
    /// </summary>
    /// <param name="requestId">The client-generated request identifier.</param>
    /// <param name="question">The question to ask.</param>
    /// <param name="deploymentName">The name of the deployment to use.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A task that completes after the model reports completion or failure.</returns>
    private async Task AskStreamingAsync(
        Guid requestId,
        string question,
        string deploymentName,
        CancellationToken cancellationToken = default)
    {
        Stopwatch stopwatch = Stopwatch.StartNew();

        try
        {
            string chatPrompt = GenerateChatPrompt(question);
            ChatClient chatClient = _client.GetChatClient(deploymentName);
            ChatMessage[] messages = [new UserChatMessage(chatPrompt)];
            ChatTokenUsage? tokenUsage = null;

            AsyncCollectionResult<StreamingChatCompletionUpdate> chatResponseStreaming = chatClient.CompleteChatStreamingAsync(
                messages,
                cancellationToken: cancellationToken);

            await foreach (StreamingChatCompletionUpdate update in chatResponseStreaming)
            {
                // Usage contains request totals and may arrive in a final update without any text.
                tokenUsage = update.Usage ?? tokenUsage;

                foreach (ChatMessageContentPart contentPart in update.ContentUpdate)
                {
                    if (string.IsNullOrEmpty(contentPart.Text))
                    {
                        continue;
                    }

                    // Forward each text delta immediately and retain the originating deployment name.
                    await _chatHubContext.Clients
                        .Group(ChatHub.GetRequestGroupName(requestId))
                        .SendAsync(
                            "ResponseChunk",
                            new
                            {
                                RequestId = requestId,
                                LLModelName = deploymentName,
                                Chunk = contentPart.Text
                            },
                            cancellationToken);
                }
            }

            stopwatch.Stop();

            // Mark only this deployment as complete; other deployment streams may still be running.
            await _chatHubContext.Clients
                .Group(ChatHub.GetRequestGroupName(requestId))
                .SendAsync(
                    "ResponseCompleted",
                    new
                    {
                        RequestId = requestId,
                        LLModelName = deploymentName,
                        stopwatch.ElapsedMilliseconds,
                        InputTokens = tokenUsage?.InputTokenCount,
                        OutputTokens = tokenUsage?.OutputTokenCount,
                        TotalTokens = tokenUsage?.TotalTokenCount
                    },
                    cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            stopwatch.Stop();
            // Preserve host shutdown cancellation so the background worker can stop promptly.
            throw;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            // Convert an individual model failure into a terminal SignalR event without failing sibling models.
            StringBuilder errorMessageStringBuilder = new();

            errorMessageStringBuilder.AppendLine(ex.Message);

            if (ex.InnerException != null)
                errorMessageStringBuilder.AppendLine(ex.InnerException.Message);

            await _chatHubContext.Clients
                .Group(ChatHub.GetRequestGroupName(requestId))
                .SendAsync(
                    "ResponseFailed",
                    new
                    {
                        RequestId = requestId,
                        LLModelName = deploymentName,
                        Error = errorMessageStringBuilder.ToString(),
                        stopwatch.ElapsedMilliseconds
                    },
                    cancellationToken);
        }
    }

    private string GenerateChatPrompt(string question)
    {
        return $$"""
            You are an expert .NET software architect and developer.

            Create a complete technical solution for the following question:

            {{question}}

            Return only an HTML fragment that can be inserted directly into an
            existing React answer container.

            OUTPUT RULES

            1. Return only the HTML fragment. Do not include text before or after it.
            2. Do not use Markdown or Markdown code fences.
            3. Do not include <!DOCTYPE>, html, head, body, main, article, script,
               style, iframe, form, input, button or event-handler attributes.
            4. Use only these HTML elements:
               div, section, h2, h3, h4, p, ul, ol, li, strong, em, pre, code,
               table, thead, tbody, tr, th, td, blockquote, details, summary and a.
            5. Use only class and href attributes when required.
            6. Ensure that the HTML is valid, correctly nested and fully closed.
            7. Render the complete answer as a vertical stack layout.
            8. Wrap the complete HTML fragment in exactly one root element:

               <div class="vertical-stack">
                 Place all answer sections here.
               </div>

            9. Every direct child of the vertical-stack container must be a section
               with the vertical-stack-item class.
            10. Keep the sections in a logical top-to-bottom reading order.

            Organize the answer into applicable sections such as:

            <div class="vertical-stack">
            <section class="vertical-stack-item">
              <h2>Solution overview</h2>
              <p>Explain the purpose and design of the solution.</p>
            </section>

            <section class="vertical-stack-item">
              <h2>Prerequisites</h2>
              <ul>
                <li>List the required SDKs, tools and packages.</li>
              </ul>
            </section>

            <section class="vertical-stack-item">
              <h2>Project structure</h2>
              <pre><code class="language-text">Show the complete project tree.</code></pre>
            </section>

            <section class="vertical-stack-item">
              <h2>Implementation</h2>
              <h3>FileName.cs</h3>
              <p>Explain the responsibility of the file.</p>
              <pre><code class="language-csharp">Place the complete file content here.</code></pre>
            </section>

            <section class="vertical-stack-item">
              <h2>Configuration</h2>
              <p>Explain the required configuration.</p>
              <pre><code class="language-json">Place the complete configuration here.</code></pre>
            </section>

            <section class="vertical-stack-item">
              <h2>Build and run</h2>
              <pre><code class="language-bash">Place the required commands here.</code></pre>
            </section>

            <section class="vertical-stack-item">
              <h2>How it works</h2>
              <p>Explain the execution flow and important implementation decisions.</p>
            </section>

            <section class="vertical-stack-item">
              <h2>Testing</h2>
              <p>Explain how to verify the solution.</p>
              <pre><code class="language-bash">Place the test commands here.</code></pre>
            </section>
            </div>

            CODE REQUIREMENTS

            1. Generate complete, compilable and internally consistent code.
            2. Use the latest stable .NET version unless another version is requested.
            3. Follow current .NET and ASP.NET Core conventions.
            4. Include all required using directives, namespaces, package references,
               configuration files and dependency registrations.
            5. Place every required project file in a separate pre and code block.
            6. Display each file name in an h3 or h4 heading before its code block.
            7. Assign an appropriate language class to every code block, for example:
               language-csharp, language-json, language-xml, language-bash,
               language-text, language-dockerfile or language-yaml.
            8. Do not omit implementation and do not use placeholders such as
               "remaining code", "implementation omitted", "add your logic here"
               or ellipses instead of required code.
            9. Keep names, namespaces, routes and configuration values consistent
               across all generated files.
            10. Explain important architectural, validation and security decisions.

            HTML ENCODING REQUIREMENTS

            Safely HTML-encode all source code inside code elements:

            - Encode & as &amp;
            - Encode < as &lt;
            - Encode > as &gt;

            Example:

            <pre><code class="language-csharp">if (value &lt; 10)
            {
                Console.WriteLine("Hello");
            }</code></pre>

            Never place source code inside a code element in a form that could be
            interpreted as HTML markup.

            Adapt the detail and length of the solution to the complexity of the
            question. Verify the consistency of the complete solution before returning it.
            Return only the final HTML fragment.
            """;
    }
}
