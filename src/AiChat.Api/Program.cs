using AIChat.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
builder.Services.Configure<AzureOpenAIOptions>(builder.Configuration.GetSection("AzureOpenAIOptions"));
builder.Services.AddSingleton<IAIChatService, AIChatService>();

var app = builder.Build();

app.UseCors("Frontend");
app.MapControllers();

app.Run();
