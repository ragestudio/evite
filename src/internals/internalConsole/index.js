class Echo {
    constructor(params = {}) {
        this.bgColor = params.bgColor ?? "dimgray"
        this.color = params.color ?? "azure"
    }

    queue = []
    ECHO_TOKEN = {}
    RESET_INPUT = "%c "
    RESET_CSS = ""

    tagFormatting(value) {
        this.queue.push({
            value: value,
            css: `
            display: inline-block; 
            background-color: ${this.bgColor}; 
            color: ${this.color}; 
            font-weight: bold; 
            padding: 3px 7px; 
            border-radius: 8px;
            `
        })

        return this.ECHO_TOKEN
    }

    using = (consoleFunction) => {
        function consoleFunctionProxy() {
            var inputs = []
            var modifiers = []

            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] === this.ECHO_TOKEN) {
                    var item = this.queue.shift()

                    inputs.push(("%c" + item.value), this.RESET_INPUT)
                    modifiers.push(item.css, this.RESET_CSS)
                } else {
                    var arg = arguments[i]

                    if (typeof (arg) === "object" || typeof (arg) === "function") {
                        inputs.push("%o", this.RESET_INPUT)
                        modifiers.push(arg, this.RESET_CSS)
                    } else {
                        inputs.push(("%c" + arg), this.RESET_INPUT)
                        modifiers.push(this.RESET_CSS, this.RESET_CSS)
                    }
                }
            }

            consoleFunction(inputs.join(""), ...modifiers)

            this.queue = []
        }

        return consoleFunctionProxy.bind(this)
    }

    out = (method, ...args) => {
        return this.using(console[method])(...args)
    }
}

export default class InternalConsole {
    constructor(params = {}) {
        this.namespace = String(params.namespace)
        this.params = params
        this.echo = new Echo({
            bgColor: this.params.bgColor,
            color: this.params.textColor,
        })
    }

    _output(method, ...args) {
        this.echo.out(
            method,
            this.echo.tagFormatting(`[${this.namespace}]`),
            ...args
        )
    }

    log = (...args) => {
        this._output("log", ...args)
    }

    warn = (...args) => {
        this._output("warn", ...args)
    }

    error = (...args) => {
        this._output("error", ...args)
    }

    debug = (...args) => {
        this._output("debug", ...args)
    }

    info = (...args) => {
        this._output("info", ...args)
    }

    trace = (...args) => {
        this._output("trace", ...args)
    }

    time = (...args) => {
        this._output("time", ...args)
    }

    timeEnd = (...args) => {
        this._output("timeEnd", ...args)
    }
}