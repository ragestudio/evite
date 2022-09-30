import kleur from "kluer"

export class InternalConsole {
    constructor(params = {}) {
        this.namespace = params.namespace
        this.headColor = params.headColor
    }

    applyHeadColor(data) {
        if (!kleur[this.headColor]) {
            return data
        }

        return kleur[this.headColor](data)
    }

    log(arg1, ...args) {
        console.log(`[${applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    warn(arg1, ...args) {
        console.warn(`[${applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    error(arg1, ...args) {
        console.error(`[${applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    debug(arg1, ...args) {
        console.debug(`[${applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    info(arg1, ...args) {
        console.info(`[${applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }

    trace(arg1, ...args) {
        console.trace(`[${applyHeadColor(String(this.namespace))}] ${arg1}`, ...args)
    }
}