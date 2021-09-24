import EventEmitter from "@foxify/events"

export default class EventBus extends EventEmitter {
    constructor() {
        super({ captureRejections: true })
    }
    on = (event, listener, context) => {
        const _listener = (...args) => {
            console.debug(`Event [${event}] resolved`)
            listener(...args)
        }
        return this._addListener(event, _listener, context, true, false)
    }
}