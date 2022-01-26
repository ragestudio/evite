export default (params = {}, value, ...args) => {
    let opts = {
        key: params.key,
        locked: params.locked ?? false,
        enumerable: params.enumerable ?? true,
    }

    if (typeof params === "string") {
        opts.key = params
    }

    if (typeof opts.key === 'undefined') {
        throw new Error('key is required')
    }

    if (args.length > 0) {
        value = value(...args)
    }

    return Object.defineProperty(window.app, opts.key, {
        value,
        enumerable: opts.enumerable,
        configurable: opts.locked
    })
}