import React from "react"
import ReactDOM from "react-dom"

import { createBrowserHistory } from "history"
import { Observable } from "object-observer"

import IsolatedContext from "./isolatedContext"
import Extension from "./extension"

import { EventBus, StaticRenders } from "./internals"

import { DebugWindow } from "./internals/debug"

import pkgJson from "../package.json"

import "./internals/style/index.css"

export default class EviteRuntime {
    Flags = window.flags = Observable.from({
        debug: false,
    })
    PublicContext = window.app = Object()
    ExtensionsContext = new IsolatedContext(Object())

    EXTENSIONS = Object()
    CORES = Object()

    INITIALIZER_TASKS = Array()

    STATES = Observable.from({
        LOAD_STATE: "early",

        LOADED_CORES: [],

        ATTACHED_EXTENSIONS: [],
        REJECTED_EXTENSIONS: [],

        INITIALIZATION_START: null,
        INITIALIZATION_STOP: null,
        INITIALIZATION_TOOKS: null,
    })

    constructor(
        App,
        Params = {
            renderMount: "root",
            debug: false,
        }
    ) {
        this.AppComponent = App
        this.Params = Params

        // controllers
        this.history = this.registerPublicMethod({ key: "history", locked: true }, createBrowserHistory())
        this.eventBus = this.registerPublicMethod({ key: "eventBus", locked: true }, new EventBus())

        // append app methods
        this.registerPublicMethod({ key: "__eviteVersion", locked: true }, pkgJson.version)
        this.registerPublicMethod({ key: "toogleRuntimeDebugMode", locked: true }, this.toogleRuntimeDebugMode)

        // internal events
        this.eventBus.on("runtime.initialize.start", async () => {
            this.STATES.LOAD_STATE = "initializing"
            this.STATES.INITIALIZATION_START = performance.now()

            // render initialize
            this.render(this.AppComponent.staticRenders?.Initialization ?? StaticRenders.Initialization)
        })

        this.eventBus.on("runtime.initialize.finish", () => {
            const time = performance.now()

            this.STATES.INITIALIZATION_STOP = time

            if (this.STATES.INITIALIZATION_START) {
                this.STATES.INITIALIZATION_TOOKS = time - this.STATES.INITIALIZATION_START
            }

            this.STATES.LOAD_STATE = "initialized"
        })

        this.eventBus.on("runtime.initialize.crash", (error) => {
            this.STATES.LOAD_STATE = "crashed"

            // render crash
            this.render(this.AppComponent.staticRenders?.Crash ?? StaticRenders.Crash, {
                crash: {
                    message: "Runtime crashed on initialization",
                    details: error.toString(),
                }
            })
        })

        this.eventBus.on("runtime.crash", (crash) => {
            this.STATES.LOAD_STATE = "crashed"

            // render crash
            this.render(this.AppComponent.staticRenders?.Crash ?? StaticRenders.Crash, {
                crash
            })
        })

        // emit attached extensions change events
        Observable.observe(this.STATES.ATTACHED_EXTENSIONS, (changes) => {
            changes.forEach((change) => {
                console.log(changes)
                if (change.type === "insert") {
                    this.eventBus.emit(`runtime.extension.attached`, change)
                }
            })
        })

        // emit rejected extensions change events
        Observable.observe(this.STATES.REJECTED_EXTENSIONS, (changes) => {
            changes.forEach((change) => {
                if (change.type === "insert") {
                    this.eventBus.emit(`runtime.extension.rejected`, change)
                }
            })
        })

        // handle debug update
        Observable.observe(this.Flags, (changes) => {
            changes.forEach((change) => {
                if (change.type === "update") {
                    this.debugUpdateRender()
                }
            })
        })

        Observable.observe(this.STATES, () => {
            this.debugUpdateRender()
        })

        // handle params behaviors
        if (this.Params.debug === true) {
            this.Flags.debug = true
        }

        return this.initialize().catch((error) => {
            this.eventBus.emit("runtime.initialize.crash", error)
        })
    }

    async initialize() {
        this.eventBus.emit("runtime.initialize.start")

        let initializersQueue = []

        // fetch all internal cores
        try {
            let cores = await import("~/src/cores").catch((err) => {
                console.warn(`Cannot load @src/cores.`, err)
                return false
            })

            if (cores) {
                this.eventBus.emit(`runtime.initialize.cores.start`)

                cores = cores.default

                if (!Array.isArray(cores)) {
                    console.error(`Cannot initialize cores, cause it is not an array. Core dependency is not supported yet. You must use an array to define your core load queue.`)
                    return
                }

                for await (let core of cores) {
                    if (!core.constructor) {
                        console.error(`Core [${core.name}] is not a class`)
                        continue
                    }

                    this.eventBus.emit(`runtime.initialize.core.${core.name}.start`)

                    // construct class
                    core = new core(this)

                    const coreName = core.constructor.name ?? core.refName

                    // set core to context
                    this.CORES[coreName] = core

                    // handle events
                    if (typeof core.events === "object") {
                        Object.entries(core.events).forEach(([event, handler]) => {
                            this.eventBus.on(event, handler)
                        })
                    }

                    // handle public methods
                    if (typeof core.publicMethods === "object") {
                        Object.entries(core.publicMethods).forEach(([method, handler]) => {
                            this.registerPublicMethod(method, handler)
                        })
                    }

                    if (typeof core.initialize === "function") {
                        // by now, we gonna initialize from here instead push to queue
                        await core.initialize()
                    }

                    // emit event
                    this.eventBus.emit(`runtime.initialize.core.${coreName}.finish`)

                    // register internal core
                    this.STATES.LOADED_CORES.push(coreName)
                }

                // emit event
                this.eventBus.emit(`runtime.initialize.cores.finish`)
            }


        } catch (error) {
            this.eventBus.emit(`runtime.initialize.cores.failed`, error)

            // make sure to throw that, app must crash if core fails to load
            throw error
        }

        // try to load from @internal_extensions
        try {
            // TODO: Support external extensions
            const externalExtensions = window.localStorage.getItem("external_extensions")

            // should be a object with a the extension manifest schema, e.g.
            // {
            //	"publisher/extensionName": {
            //		url: "https://extensions_storage.ragestudio.net/pkg/publisher/extensionName.extension.js@0.0.0",
            //		version: "0.0.0",
            // 	}
            // }

            const internalExtensions = import.meta.glob("/src/internal_extensions/**/*.extension.js*")

            for await (let [uri, extension] of Object.entries(internalExtensions)) {
                extension = await extension()
                extension = extension.default || extension

                const initializationPromise = new Promise(async (resolve, reject) => {
                    await this.initializeExtension(extension)
                        .then(() => {
                            return resolve()
                        })
                        .catch((rejection) => {
                            if (rejection.id) {
                                this.eventBus.emit(`runtime.extension.${rejection.id}.rejected`, rejection)
                            }

                            this.eventBus.emit(`runtime.extension.rejected`, rejection)

                            return resolve()
                        })
                })

                initializersQueue.push(initializationPromise)
            }
        } catch (error) {
            this.eventBus.emit(`runtime.initialize.internalExtensions.failed`, error)
            console.error(error)
        }

        // perform all initializers
        await Promise.all(initializersQueue)

        // perform registered tasks
        if (this.STATES.INITIALIZER_TASKS) {
            for await (let task of this.STATES.INITIALIZER_TASKS) {
                if (typeof task === "function") {
                    await task(this)
                }
            }
        }

        // call early app initializer 
        if (typeof this.AppComponent.initialize === "function") {
            await this.AppComponent.initialize.apply(this)
        }

        // handle app events handlers registration
        if (typeof this.AppComponent.publicEvents === "object") {
            for await (let [event, handler] of Object.entries(this.AppComponent.publicEvents)) {
                this.eventBus.on(event, handler.bind(this))
            }
        }

        // handle app public methods registration
        if (typeof this.AppComponent.publicMethods === "object") {
            Object.keys(this.AppComponent.publicMethods).forEach((methodName) => {
                this.registerPublicMethod(methodName, this.AppComponent.publicMethods[methodName].bind(this))
            })
        }

        // emit initialize finish event
        this.eventBus.emit("runtime.initialize.finish")

        // call render
        this.render()
    }

    toogleRuntimeDebugMode = (to) => {
        this.Flags.debug = to ?? !this.Flags.debug
    }

    debugUpdateRender = () => {
        let elementContainer = document.getElementById("debug-window")

        if (this.Flags.debug) {
            if (!elementContainer) {
                elementContainer = document.createElement("div")

                elementContainer.id = "debug-window"
                elementContainer.className = "__debugWindow"

                document.body.appendChild(elementContainer)
            }

            ReactDOM.render(<DebugWindow ctx={this} />, document.getElementById("debug-window"))
        } else if (elementContainer) {
            // remove element
            elementContainer.remove()
        }
    }

    appendToInitializer = (task) => {
        let tasks = []

        if (Array.isArray(task)) {
            tasks = task
        } else {
            tasks.push(task)
        }

        tasks.forEach((_task) => {
            if (typeof _task === "function") {
                this.setState({ INITIALIZER_TASKS: [...this.state.INITIALIZER_TASKS, _task] })
            }
        })
    }

    // CONTEXT CONTROL
    mutateContext = (context, mutation) => {
        if (typeof context !== "object") {
            console.error("Context must be an object or an valid Context")
            return false
        }
        if (typeof mutation !== "object") {
            console.error("Mutation must be an object")
            return false
        }

        Object.keys(mutation).forEach(key => {
            if (typeof mutation[key] === "function") {
                context[key] = mutation[key].bind(context)
            }

            context[key] = mutation[key]
        })

        return context
    }

    registerPublicMethod = (params = {}, value, ...args) => {
        let opts = {
            key: params.key,
            locked: params.locked ?? false,
            enumerable: params.enumerable ?? true,
        }

        if (typeof params === "string") {
            opts.key = params
        }

        if (typeof opts.key === "undefined") {
            throw new Error("key is required")
        }

        if (args.length > 0) {
            value = value(...args)
        }

        try {
            Object.defineProperty(this.PublicContext, opts.key, {
                value,
                enumerable: opts.enumerable,
                configurable: opts.locked
            })
        } catch (error) {
            console.error(error)
        }

        return this.PublicContext[opts.key]
    }

    // EXTENSIONS CONTROL
    initializeExtension = (extension) => {
        return new Promise(async (resolve, reject) => {
            if (typeof extension !== "function") {
                return reject({
                    reason: "EXTENSION_NOT_VALID_CLASS",
                })
            }

            extension = new extension(this.ExtensionsContext.getProxy(), this)

            const extensionName = extension.refName ?? extension.constructor.name

            if (extension instanceof Extension) {
                // good for u
            } else {
                this.STATES.REJECTED_EXTENSIONS = [extensionName, ...this.STATES.REJECTED_EXTENSIONS]

                return reject({
                    name: extensionName,
                    reason: "EXTENSION_NOT_VALID_INSTANCE",
                })
            }

            // await to extension initializer
            await extension.__initializer()

            // // expose context to app context
            // if (typeof extension.expose === "object") {
            // 	this.mutateContext(this.IsolatedMainContext.getProxy(), extension.expose)
            // }

            // appends initializers
            if (typeof extension.initializers !== "undefined") {
                for await (let initializer of extension.initializers) {
                    await initializer.apply(this.ExtensionsContext.getProxy(), initializer)
                }
            }

            // set window context
            if (typeof extension.publicMethods === "object") {
                Object.keys(extension.publicMethods).forEach((key) => {
                    if (typeof extension.publicMethods[key] === "function") {
                        extension.publicMethods[key].bind(this.ExtensionsContext.getProxy())
                    }

                    this.registerPublicMethod({ key }, extension.publicMethods[key])
                })
            }

            // update attached extensions
            this.STATES.ATTACHED_EXTENSIONS.push(extensionName)

            // set extension context
            this.EXTENSIONS[extensionName] = extension

            return resolve()
        })
    }

    // RENDER METHOD
    render(component = this.AppComponent, props = {}) {
        return ReactDOM.render(React.createElement(
            component,
            {
                runtime: this,
                cores: this.CORES,
                ExtensionsContext: this.ExtensionsContext.getProxy(),
                ...props,
            }
        ), document.getElementById(this.Params.renderMount ?? "root"))
    }
}