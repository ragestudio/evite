const { CacheObject } = require("../../lib")

class ObjectedVariable {
    constructor(type, key, value, address) {
        this.type = type;
        this.key = key;
        this.address = address;
        this.value = value;

        return this
    }

    update(value) {
        this.value = value;
    }

    get = () => {
        return `${this.type ?? "let"} ${this.key} = ${JSON.stringify(this.value)};`
    }

    toString() {
        return JSON.stringify(this.get())
    }
}

export default class Template {
    constructor(params) {
        this.params = { ...params }

        this.pointers = {}
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

        if (typeof this.params.file === "string") {
            this.file = new CacheObject(this.params.file, this.params.root)
        }

        return this
    }

    append(value, type) {
        if (this.params.withOrder) {
            this.values[type] = value
        } else {
            this.template.push(value)
        }

        if (this.params.writeOnAppend) {
            this.write()
        }

        return (this.template.length - 1)
    }

    getPointer = (key) => {
        return this.template[this.pointers[key]]
    }

    constable = (key, value, options = {}) => {
        if (options.objected) {
            const obj = new ObjectedVariable("let", key, value, this.template)
            const point = this.append(obj, 'constables')

            this.pointers[key] = point

            return obj
        } else {
            return this.append(`const ${key} = ${value};`, "constables")
        }
    }

    import = (key, from) => {
        return this.append(`import ${key} from '${from}';`, "imports")
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

        return this.append(fn, "functions")
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


        return this.append(`${call.toString()}(${getArguments() ?? ""});`, "calls")
    }

    line = (line) => {
        return this.append(line, "lines")
    }

    deleteLine = (index) => {
        this.template = this.template.filter((line, i) => i !== index)
    }

    construct = () => {
        let buf = []

        if (this.params.withOrder) {
            Object.keys(this.values).forEach((key) => {
                const index = this.order[key]

                buf[index] = this.values[key]
            })
        } else {
            const data = this.template.map((line) => {
                if (line instanceof ObjectedVariable) {
                    return line.get()
                }

                return line
            })

            buf[0] = data.join(`\n`)
        }

        return buf.join(`\n\n`)
    }

    write = async () => {
        if (typeof this.file !== "undefined") {
            await this.file.write(this.construct())
        }
        
        return this
    }
}