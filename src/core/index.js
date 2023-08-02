import { InternalConsole } from "../internals"

export default class Core {
    constructor(ctx, params) {
        this.ctx = ctx
        this.params = params

        this.console = new InternalConsole({
            namespace: this.constructor.namespace ?? this.constructor.name,
            bgColor: this.constructor.bgColor,
            textColor: this.constructor.textColor,
        })
    }

    _init = async () => {
        const namespace = this.constructor.namespace ?? this.constructor.name

        let init_result = {
            namespace,
        }

        if (typeof this.onInitialize === "function") {
            await this.onInitialize()
        }

        if (this.public) {
            init_result.public_context = new Proxy(this.public, {
                get: (target, prop) => {
                    if (typeof target[prop] === "function") {
                        return target[prop].bind(this)
                    }

                    return target[prop]
                },
                set: () => {
                    throw new Error(`Cannot set value to public core method`)
                }
            })
        }

        if (typeof this.onEvents === "object") {
            Object.entries(this.onEvents).forEach(([event, handler]) => {
                this.ctx.eventBus.on(event, handler)
            })
        }

        if (typeof this.registerToApp === "object") {
            Object.entries(this.registerToApp).forEach(([method, handler]) => {
                this.ctx.registerPublicMethod(method, handler)
            })
        }

        if (typeof this.initializeAfterCoresInit === "function") {
            this.ctx.appendToInitializer(this.initializeAfterCoresInit.bind(this))
        }

        if (typeof this.constructor.awaitEvents === "object") {
            let awaitEvents = []

            if (typeof this.constructor.awaitEvents === "string") {
                awaitEvents = [this.constructor.awaitEvents]
            } else if (Array.isArray(this.constructor.awaitEvents)) {
                awaitEvents = this.constructor.awaitEvents
            }

            // await to events before initialize
            await Promise.all(awaitEvents.map(([event, handler]) => {
                return new Promise((resolve) => {
                    this.ctx.eventBus.once(event, (data) => {
                        handler(data)
                        resolve()
                    })
                })
            }))
        }

        return init_result
    }
}