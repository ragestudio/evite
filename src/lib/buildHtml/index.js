export const defaultHtmlParts = [
    'headTags',
    'body',
    'bodyAttrs',
    'htmlAttrs',
    'initialState',
].reduce(
    (acc, item) => ({ ...acc, [item]: `\${${item}}` }),
    {}
)

export default function buildHtmlDocument(template, parts = defaultHtmlParts) {
    return template
        .replace('<html', `<html ${parts.htmlAttrs} `)
        .replace('<body', `<body ${parts.bodyAttrs} `)
        .replace('</head>', `${parts.headTags}\n</head>`)
        .replace(
            /<div id="root"([\s\w\-"'=[\]]*)><\/div>/,
            `<div id="root" data-server-rendered="true"$1>${parts.body}</div>\n\n  <script>window.__INITIAL_STATE__=${parts.initialState}</script>`
        )
}
