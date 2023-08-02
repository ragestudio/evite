import EventEmitter from "../EventEmitter"

export default class EventBus extends EventEmitter {
    constructor(params = {}) {
        super({ ...params, captureRejections: true })

        this.id = params?.id
    }

    _emit = this.emit

    emit = (event, ...args) => {
        return this._emit(event, ...args)
    }

    on = (event, listener, context) => {
        const _listener = (...args) => {
            listener(...args)
        }

        return this._addListener(event, _listener, context, true, false)
    }
}