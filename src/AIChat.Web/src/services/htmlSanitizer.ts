import { Environment } from '../environments/environment'

export function sanitizeAnswerHtml(html: string): string {
  const parsedDocument = new DOMParser().parseFromString(html, 'text/html')

  parsedDocument.body
    .querySelectorAll(Environment.blockedHtmlElementsSelector)
    .forEach((element) => element.remove())

  Array.from(parsedDocument.body.querySelectorAll('*')).forEach((element) => {
    if (!Environment.allowedHtmlElements.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name !== 'class' && attribute.name !== 'href') {
        element.removeAttribute(attribute.name)
      }
    })

    const allowedClassNames = Array.from(element.classList)
      .filter((className) => Environment.allowedHtmlClassNamePattern.test(className))

    if (allowedClassNames.length > 0) {
      element.className = allowedClassNames.join(' ')
    } else {
      element.removeAttribute('class')
    }

    if (element.tagName === 'A') {
      const href = element.getAttribute('href')

      if (href && !Environment.allowedHrefPattern.test(href)) {
        element.removeAttribute('href')
      }
    } else {
      element.removeAttribute('href')
    }
  })

  return parsedDocument.body.innerHTML
}
