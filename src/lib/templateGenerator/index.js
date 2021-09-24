export default class TemplateGenerator {
    constructor(params) {
        this.params = { ...params }

        this.template = []
        this.order = {
            imports: 0,
            constables: 1,
            functions: 2,
            calls: 3,
            lines: 4
        }

        this.values = {
            imports: [],
            constables: [],
            functions: [],
            calls: [],
            lines: []
        }

        return this
    }

    append(value, type) {
        if (this.params.withOrder) {
            this.values[type] = value
        } else {
            this.template.push(value + `\n`)
        }
    }

    constable = (key, value) => {
        this.append(`const ${key} = ${value};`, "constables")
    }

    import = (key, from) => {
        this.append(`import ${key} from '${from}';`, "imports")
    }

    function = (key, args, fn, options = {}) => {
        function getArguments() {
            if (typeof args === "undefined") {
                return undefined
            }

            let _args = []

            if (Array.isArray(args)) {
                _args = args
            } else {
                _args.push(args)
            }

            return _args.join(', ')
        }

        if (options.arrow) {
            fn = `function ${key}(...context){\n\tlet _ = ${fn};\n\t_ = _.bind(this);\n\t_(...context)\n};`
        } else {
            fn = `function ${key}(${getArguments() ?? ""}){\n\t${fn}\n};`
        }

        this.append(fn, "functions")
    }

    call = (call, args) => {
        function getArguments() {
            if (typeof args === "undefined") {
                return undefined
            }

            let _args = []

            if (Array.isArray(args)) {
                _args = args
            } else {
                _args.push(args)
            }

            return _args.join(', ')
        }


        this.append(`${call.toString()}(${getArguments() ?? ""});`, "calls")
    }

    line = (line) => {
        this.append(line, "lines")
    }

    construct = () => {
        let buf = []

        if (this.params.withOrder) {
            Object.keys(this.values).forEach((key) => {
                const index = this.order[key]
                buf[index] = this.values[key]
            })
        } else {
            buf[0] = this.template.join(`\n`)
        }

        return buf.join(`\n\n`)
    }
}