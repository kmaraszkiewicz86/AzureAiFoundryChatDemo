using System.Threading.Channels;

namespace AIChat.Api.Services;

/// <summary>
/// Provides in-memory communication between the streaming controller endpoint and background worker.
/// </summary>
public sealed class StreamingChatQueue
{
    // The application has one background reader while any number of controller requests may enqueue work.
    private readonly Channel<StreamingChatRequest> _channel =
        Channel.CreateUnbounded<StreamingChatRequest>(new UnboundedChannelOptions
        {
            SingleReader = true
        });

    /// <summary>
    /// Adds a streaming request to the channel.
    /// </summary>
    /// <param name="request">The request to process in the background.</param>
    /// <param name="cancellationToken">A token that cancels the channel write.</param>
    /// <returns>A value task that completes after the request is accepted by the channel.</returns>
    public ValueTask EnqueueAsync(
        StreamingChatRequest request,
        CancellationToken cancellationToken = default)
    {
        return _channel.Writer.WriteAsync(request, cancellationToken);
    }

    /// <summary>
    /// Reads queued streaming requests as they become available.
    /// </summary>
    /// <param name="cancellationToken">A token that stops waiting for additional requests.</param>
    /// <returns>An asynchronous sequence of queued requests.</returns>
    public IAsyncEnumerable<StreamingChatRequest> ReadAllAsync(
        CancellationToken cancellationToken = default)
    {
        return _channel.Reader.ReadAllAsync(cancellationToken);
    }
}
