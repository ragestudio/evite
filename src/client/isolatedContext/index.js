export default class IsolatedContext {
    constructor(context = {}) {
        this.isolatedKeys = Object.keys(context)
        this.listeners = {
            set: [],
            get: [],
        }

        this.proxy = new Proxy(context, this.handler)
        return this
    }

    subscribe = (event, listener) => {
        this.listeners[event].push(listener)
    }

    getProxy = () => {
        return this.proxy
    }

    handler = {
        get: (target, name) => {
            this.listeners["get"].forEach(listener => {
                if (typeof listener === "function") {
                    listener(target, name)
                }
            })

            return target[name]
        },
        set: (target, name, value) => {
            if (this.isolatedKeys.includes(name)) {
                console.error("Cannot assign an value to an isolated property", name, value)
                return false
            }
            const assignation = Object.assign(target, { [name]: value })

            this.listeners["set"].forEach(listener => {
                if (typeof listener === "function") {
                    listener(target, name, value)
                }
            })

            return assignation
        },
    }
}