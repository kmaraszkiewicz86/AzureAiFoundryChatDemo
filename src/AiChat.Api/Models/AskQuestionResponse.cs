public sealed class AskQuestionResponse
{
    public string Answer { get; init; } = string.Empty;
    public string LLModelName { get; init; } = string.Empty;

    public long ElapsedMilliseconds { get; init; } = 0;
}