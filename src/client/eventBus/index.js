import EventEmitter from "@foxify/events"
import { verbosity } from "@corenode/utils"

export default class EventBus extends EventEmitter {
    constructor() {
        super({ captureRejections: true })
        this.eventLog = verbosity.colors({ decorator: { text: "magenta" } }).options({ method: "[EVENTS]" })
    }
    on = (event, listener, context) => {
        const _listener = (...args) => {
            this.eventLog.log(`Event [${event}] resolved`)
            listener(...args)
        }
        return this._addListener(event, _listener, context, true, false)
    }
}