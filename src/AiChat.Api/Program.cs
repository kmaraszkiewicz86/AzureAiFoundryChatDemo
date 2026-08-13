using AiChat.Api.BackgroundServices;
using AiChat.Api.Hubs;
using AIChat.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .WithHeaders("Content-Type")
            .WithMethods("POST");
    });
});
builder.Services.Configure<AzureOpenAIOptions>(builder.Configuration.GetSection("AzureOpenAI"));

// Register the SignalR transport and the singleton channel shared by the endpoint and hosted worker.
builder.Services.AddSignalR();
builder.Services.AddSingleton<StreamingChatQueue>();
builder.Services.AddSingleton<IAIChatService, AIChatService>();
builder.Services.AddHostedService<StreamingChatBackgroundService>();

var app = builder.Build();

app.UseCors("Frontend");
app.MapControllers();

// React connects here before posting a streaming request so early model chunks are not lost.
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
