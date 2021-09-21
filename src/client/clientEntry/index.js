import React, { createContext as reactCreateContext, useContext as reactUseContext } from "react"
import ReactDOM from "react-dom"
import { BrowserRouter, useHistory } from "react-router-dom"
import { HelmetProvider } from "react-helmet-async"

import { withoutSuffix } from '../url'
import { useClientRedirect, createRouter } from '../router'

export const SSR_CONTEXT = reactCreateContext(null)

export function provideContext(app, context) {
    return React.createElement(SSR_CONTEXT.Provider, { value: context }, app)
}

export function useContext() {
    return reactUseContext(SSR_CONTEXT)
}

export const createClientEntry = async function (
    App,
    {
        routes,
        base,
        suspenseFallback,
        PropsProvider,
        pageProps,
        debug = {},
        styleCollector,
    },
    hook,
) {
    const url = window.location
    const routeBase = base && withoutSuffix(base({ url }), "/")

    const { redirect, writeResponse } = useClientRedirect(location => {
        const { push } = useHistory()
        React.useEffect(() => push(location), [push])
    })

    const context = {
        url,
        isClient: true,
        redirect,
        writeResponse,
        router: createRouter({
            routes,
            base,
            pagePropsOptions: pageProps,
            PropsProvider,
        }),
    }

    if (hook) {
        await hook(context)
    }

    let app = React.createElement(
        HelmetProvider,
        {},
        React.createElement(
            BrowserRouter,
            { basename: routeBase },
            React.createElement(
                React.Suspense,
                { fallback: suspenseFallback || "" },
                provideContext(React.createElement(App, context), context),
            ),
        ),
    )

    const styles = styleCollector && (await styleCollector(context))
    if (styles && styles.provide) {
        app = styles.provide(app)
    }

    if (debug.mount !== false) {
        const el = document.getElementById("root")

        styles && styles.cleanup && styles.cleanup()

        process.env.NODE_ENV === "production" ? ReactDOM.hydrate(app, el) : ReactDOM.render(app, el)
    }
}