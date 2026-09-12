# Azure AI Foundry Chat Demo

A learning project that compares responses from multiple Azure AI Foundry model deployments using a React UI, an ASP.NET Core API, and SignalR streaming.

## Technology stack

- React 19 and TypeScript
- Axios
- SignalR
- ASP.NET Core on .NET 10
- Azure AI Foundry through `Azure.AI.OpenAI`

## Project structure

- [AIChat.Web](src/AIChat.Web) — React application that sends questions and displays streaming model responses.
- [AiChat.Api](src/AiChat.Api) — ASP.NET Core API that queues questions, calls the configured model deployments, and publishes response events.
- [results](results) — benchmark questions, complete model responses, costs, and comparisons.
- [docs/README.md](docs/README.md) — the full technical article.

## Prerequisites

- .NET 10 SDK
- Node.js 22.12 or later with npm
- An Azure AI Foundry resource with compatible Azure OpenAI model deployments
- The Azure OpenAI endpoint, API key, and deployment names

The default deployment names are configured in [appsettings.json](src/AiChat.Api/appsettings.json):

- `gpt-5.4-mini-low`
- `gpt-5.6-terra-medium`
- `gpt-5.6-sol-high`

Change this list if your deployment names are different.

## Configure and run

Run the API and UI in two separate terminals from the repository root.

### 1. Start the API

Store the Azure OpenAI endpoint and API key in .NET User Secrets:

```powershell
cd src/AiChat.Api
dotnet user-secrets set "AzureOpenAI:Endpoint" "https://<resource-name>.openai.azure.com/"
dotnet user-secrets set "AzureOpenAI:ApiKey" "<your-api-key>"
dotnet run --launch-profile AiChat.Api
```

The API starts at `http://localhost:5000`.

### 2. Start the UI

```powershell
cd src/AIChat.Web
npm ci
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173` in a browser. Port `5173` must be used because it is the origin allowed by the API's local CORS policy.

## How the application works

1. The user enters a question in [StreamingChat.tsx](src/AIChat.Web/src/components/StreamingChat.tsx).
2. [StreamingChatService](src/AIChat.Web/src/services/streamingChatService.ts) creates a unique `requestId` and registers handlers for model response events.
3. [ChatConnectionService](src/AIChat.Web/src/services/chatConnectionService.ts) opens a SignalR connection and joins the group assigned to that request.
4. After the connection is ready, [chatService.ts](src/AIChat.Web/src/services/chatService.ts) sends `requestId` and the question to `POST /api/chat/stream`.
5. [AIChatController](src/AiChat.Api/Controllers/ChatController.cs) adds the request to the in-memory [StreamingChatQueue](src/AiChat.Api/Services/StreamingChatQueue.cs) and returns `202 Accepted`.
6. [StreamingChatBackgroundService](src/AiChat.Api/BackgroundServices/StreamingChatBackgroundService.cs) reads the queued request and calls [AIChatService](src/AiChat.Api/Services/AIChatService.cs).
7. `AIChatService` starts all configured model deployments concurrently. Each model streams its text chunks to the request's SignalR group.
8. The UI appends every chunk to the matching model response. When a model finishes, the UI displays its execution time and token usage.

Queued questions are processed one at a time by the background service, while the configured models run concurrently for the current question.

## SignalR events

| Event | Purpose |
| --- | --- |
| `ResponseStarted` | Creates a streaming response entry for a model. |
| `ResponseChunk` | Sends the next generated text fragment. |
| `ResponseCompleted` | Sends the execution time and input, output, and total token counts. |
| `ResponseFailed` | Ends one model response with an error and execution time. |

The model output is returned as an HTML fragment. Before rendering it, the UI passes it through [htmlSanitizer.ts](src/AIChat.Web/src/services/htmlSanitizer.ts), which limits allowed elements, attributes, classes, and links.

## Local endpoints

| Endpoint | Description |
| --- | --- |
| `POST /api/chat/stream` | Queues a streaming question and returns `202 Accepted`. |
| `/hubs/chat` | SignalR hub used to receive model response events. |

The API also contains `POST /api/chat`, which waits for complete model responses. The React streaming flow described above uses `POST /api/chat/stream`.
