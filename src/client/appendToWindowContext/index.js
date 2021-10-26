export default (key, fn, ...args) => {
    if (typeof window[key] !== "undefined") {
        throw new Error(`${key} already exists`)
    }

    if (typeof fn !== "function") {
        throw new Error(`${key} must be a function`)
    }

    return (window.app[key] = () => {
        return fn(...args)
    })
}