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
   
        this.imports = []
        this.constables = []
        this.functions = []
        this.calls = []
        this.lines = []
    }

    appendConstable = (key, value) => {
        this.constables.push({ key, value })
    }

    appendImport = (key, from) => {
        this.imports.push({ key, from })
    }

    appendFunction = (key, args, fn, options) => {
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

        this.functions.push({ key, arguments: getArguments(), fn, options })
    }

    appendCall = (call, args) => {
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

        this.calls.push({ call, arguments: getArguments() })
    }

    appendLine = (line) => {
        this.lines.push(line)
    }

    generateImports = () => {
        return this.imports.map((entry) => {
            return `import ${entry.key} from '${entry.from}';`
        })
    }

    generateConstables = () => {
        return this.constables.map((entry) => {
            return `const ${entry.key} = ${entry.value};`
        })
    }

    generateFunctions = () => {
        return this.functions.map((entry) => {
            if (entry.options?.arrow) {
                return `function ${entry.key}(...context){\n\tlet _ = ${entry.fn};\n\t_ = _.bind(this);\n\t_(...context)\n};`
            }
            return `function ${entry.key}(${entry.arguments ?? ""}){\n\t${entry.fn}\n};`
        })
    }

    generateCalls = () => {
        return this.calls.map((entry) => {
            return `${entry.call.toString()}(${entry.arguments ?? ""});`
        })
    }

    generateLines = () => {
        return this.lines.map((line) => {
            return line.toString()
        })
    }

    construct = () => {
        let buf = []

        const content = {
            imports: this.generateImports().join("\n"),
            constables: this.generateConstables().join("\n"),
            functions: this.generateFunctions().join("\n"),
            calls: this.generateCalls().join("\n"),
            lines: this.generateLines().join("\n")
        }
        
        Object.keys(this.order).forEach((key) => {
            const index = this.order[key]
            buf[index] = content[key]
        })

        return buf.join(`\n\n`)
    }
}