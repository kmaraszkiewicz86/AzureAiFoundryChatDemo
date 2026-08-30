export class Environment {
  public static readonly apiUrl: string = 'http://localhost:5000'

  /** HTTP endpoints used by the chat services. */
  public static readonly chatUrl: string = `${Environment.apiUrl}/api/chat`
  public static readonly streamingChatUrl: string = `${Environment.chatUrl}/stream`

  /** Hub URL; the current development setup forwards this path through the Vite proxy. */
  public static readonly chatHubUrl: string = '/hubs/chat'

  public static readonly allowedHtmlElements: ReadonlySet<string> = new Set([
    'A',
    'BLOCKQUOTE',
    'CODE',
    'DETAILS',
    'DIV',
    'EM',
    'H2',
    'H3',
    'H4',
    'LI',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'STRONG',
    'SUMMARY',
    'TABLE',
    'TBODY',
    'TD',
    'TH',
    'THEAD',
    'TR',
    'UL',
  ])

  public static readonly allowedHtmlClassNamePattern =
    /^(language-[a-z0-9-]+|vertical-stack|vertical-stack-item)$/

  public static readonly allowedHrefPattern = /^(https?:|mailto:)/i

  public static readonly blockedHtmlElementsSelector =
    'script, style, iframe, object, embed, form, input, button'
}
