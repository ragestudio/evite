import kleur from "kleur"

export default class InternalConsole {
    constructor(params = {}) {
        this.namespace = params.namespace
        this.headColor = params.headColor
    }

    applyHeadColor(data) {
        if (!this.headColor) {
            return data
        }

        if (!kleur[this.headColor]) {
            return data
        }

        return kleur[this.headColor](data)
    }

    log(arg1, ...args) {
        console.log(`[${this.applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    warn(arg1, ...args) {
        console.warn(`[${this.applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    error(arg1, ...args) {
        console.error(`[${this.applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    debug(arg1, ...args) {
        console.debug(`[${this.applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    info(arg1, ...args) {
        console.info(`[${this.applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    trace(arg1, ...args) {
        console.trace(`[${this.applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }
}