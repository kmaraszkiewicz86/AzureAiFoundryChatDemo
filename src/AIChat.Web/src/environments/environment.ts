export class Environment {
  public static readonly apiUrl: string = 'http://localhost:5000'

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
