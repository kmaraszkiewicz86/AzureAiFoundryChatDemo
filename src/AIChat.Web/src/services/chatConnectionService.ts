import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr'
import { ChatEvents, ChatHubMethods } from '../constants/chatConstants'
import { Environment } from '../environments/environment'
import type { StreamingEvent } from '../models/streamingEvent'

/** Owns one SignalR connection; it does not process model answers. */
export class ChatConnectionService {
  private readonly connection = new HubConnectionBuilder().withUrl(Environment.chatHubUrl).build()
  private stopped = false

  /** Reports whether this connection can receive events. */
  get isConnected(): boolean {
    return !this.stopped && this.connection.state === HubConnectionState.Connected
  }

  /** Registers a callback for one backend event. */
  on(event: typeof ChatEvents[keyof typeof ChatEvents], handler: (event: StreamingEvent) => void): void {
    this.connection.on(event, handler)
  }

  /** Registers a callback for connection closure. */
  onClose(handler: () => void): void {
    this.connection.onclose(handler)
  }

  /** Connects and joins the request group before the HTTP request is sent. */
  async start(requestId: string): Promise<boolean> {
    if (this.stopped) return false
    await this.connection.start()
    if (this.stopped) return false
    await this.connection.invoke(ChatHubMethods.JoinRequest, requestId)
    return this.isConnected
  }

  /** Detaches event handlers and closes the connection. */
  async stop(): Promise<void> {
    this.stopped = true
    for (const event of Object.values(ChatEvents)) {
      this.connection.off(event)
    }
    await this.connection.stop()
  }
}
