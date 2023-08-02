import React from "react"
import ReactDOM from "react-dom"
import { createRoot } from "react-dom/client"

import { createBrowserHistory } from "history"
import { Observable } from "object-observer"

import Extension from "./extension"

import { EventBus, InternalConsole } from "./internals"
import * as StaticRenders from "./staticRenders"

import isMobile from "./utils/isMobile"

import pkgJson from "../package.json"

import "./internals/style/index.css"

export default class EviteRuntime {
    Flags = window.flags = Observable.from({
        debug: false,
    })

    INTERNAL_CONSOLE = new InternalConsole({
        namespace: "Runtime",
        bgColor: "bgMagenta",
    })

    EXTENSIONS = Object()
    CORES = Object()

    PublicContext = window.app = Object()

    ExtensionsPublicContext = Object()
    CoresPublicContext = Object()

    STATES = Observable.from({
        LOAD_STATE: "early",

        INITIALIZER_TASKS: [],

        LOADED_CORES: [],

        ATTACHED_EXTENSIONS: [],
        REJECTED_EXTENSIONS: [],

        INITIALIZATION_START: null,
        INITIALIZATION_STOP: null,
        INITIALIZATION_TOOKS: null,
    })

    APP_RENDERER = null
    SPLASH_RENDERER = null

    constructor(
        App,
        Params = {
            renderMount: "root",
        }
    ) {
        this.INTERNAL_CONSOLE.log(`Using React ${React.version}`)

        this.AppComponent = App
        this.Params = Params

        // toogle splash
        this.attachSplashScreen()

        // controllers
        this.root = createRoot(document.getElementById(this.Params.renderMount ?? "root"))
        this.history = this.registerPublicMethod({ key: "history", locked: true }, createBrowserHistory())
        this.eventBus = this.registerPublicMethod({ key: "eventBus", locked: true }, new EventBus())

        window.app.cores = new Proxy(this.CoresPublicContext, {
            get: (target, key) => {
                if (this.CoresPublicContext[key]) {
                    return this.CoresPublicContext[key]
                }

                return null
            },
            set: (target, key, value) => {
                throw new Error("You can't set a core value")
            }
        })

        window.app.extensions = new Proxy(this.ExtensionsPublicContext, {
            get: (target, key) => {
                if (this.ExtensionsPublicContext[key]) {
                    return this.ExtensionsPublicContext[key]
                }

                return null
            },
            set: (target, key, value) => {
                throw new Error("You can't set a extension value")
            }
        })

        this.registerPublicMethod({ key: "isMobile", locked: true }, isMobile())
        this.registerPublicMethod({ key: "__eviteVersion", locked: true }, pkgJson.version)


        if (typeof this.AppComponent.splashAwaitEvent === "string") {
            this.eventBus.on(this.AppComponent.splashAwaitEvent, () => {
                this.detachSplashScreen()
            })
        }

        for (const [key, fn] of Object.entries(this.internalEvents)) {
            this.eventBus.on(key, fn)
        }

        // emit attached extensions change events
        Observable.observe(this.STATES.ATTACHED_EXTENSIONS, (changes) => {
            changes.forEach((change) => {
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

        return this.initialize().catch((error) => {
            this.eventBus.emit("runtime.initialize.crash", error)
        })
    }

    internalEvents = {
        "runtime.initialize.start": () => {
            this.STATES.LOAD_STATE = "initializing"
            this.STATES.INITIALIZATION_START = performance.now()
        },
        "runtime.initialize.finish": () => {
            const time = performance.now()

            this.STATES.INITIALIZATION_STOP = time

            if (this.STATES.INITIALIZATION_START) {
                this.STATES.INITIALIZATION_TOOKS = time - this.STATES.INITIALIZATION_START
            }

            this.STATES.LOAD_STATE = "initialized"
        },
        "runtime.initialize.crash": (error) => {
            this.STATES.LOAD_STATE = "crashed"

            if (this.SPLASH_RENDERER) {
                this.detachSplashScreen()
            }

            this.INTERNAL_CONSOLE.error("Runtime crashed on initialization \n", error)

            // render crash
            this.render(this.AppComponent.staticRenders?.Crash ?? StaticRenders.Crash, {
                crash: {
                    message: "Runtime crashed on initialization",
                    details: error.toString(),
                }
            })
        },
        "runtime.crash": (crash) => {
            this.STATES.LOAD_STATE = "crashed"

            if (this.SPLASH_RENDERER) {
                this.detachSplashScreen()
            }

            // render crash
            this.render(this.AppComponent.staticRenders?.Crash ?? StaticRenders.Crash, {
                crash
            })
        },
    }

    bindObjects = async (bind, events, parent) => {
        let boundEvents = {}

        for await (let [event, handler] of Object.entries(events)) {
            if (typeof handler === "object") {
                boundEvents[event] = await this.bindObjects(bind, handler, parent)
            }

            if (typeof handler === "function") {
                boundEvents[event] = handler.bind(bind)
            }
        }

        return boundEvents
    }

    async initialize() {
        this.eventBus.emit("runtime.initialize.start")

        await this.initializeCores()

        await this.performInitializerTasks()

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
            await this.registerPublicMethods(this.AppComponent.publicMethods)
        }

        // emit initialize finish event
        this.eventBus.emit("runtime.initialize.finish")

        this.render()

        if (!this.AppComponent.splashAwaitEvent) {
            this.detachSplashScreen()
        }
    }

    initializeCore = async (core) => {
        if (!core.constructor) {
            this.INTERNAL_CONSOLE.error(`Core [${core.name}] is not a class`)

            return false
        }

        const namespace = core.namespace ?? core.name

        this.eventBus.emit(`runtime.initialize.core.${namespace}.start`)

        // construct class
        let coreInstance = new core(this)

        // set core to context
        this.CORES[namespace] = coreInstance

        const initializationResult = await coreInstance._init()

        if (!initializationResult) {
            this.INTERNAL_CONSOLE.warn(`[${namespace}] initializes without returning a result.`)
        }

        if (initializationResult.public_context) {
            this.CoresPublicContext[initializationResult.namespace] = initializationResult.public_context
        }

        // emit event
        this.eventBus.emit(`runtime.initialize.core.${namespace}.finish`)

        // register internal core
        this.STATES.LOADED_CORES.push(namespace)

        return true
    }

    initializeCores = async () => {
        try {
            const coresPaths = {
                ...import.meta.glob("/src/cores/*/*.core.jsx"),
                ...import.meta.glob("/src/cores/*/*.core.js"),
                ...import.meta.glob("/src/cores/*/*.core.ts"),
                ...import.meta.glob("/src/cores/*/*.core.tsx"),
            }

            const coresKeys = Object.keys(coresPaths)

            if (coresKeys.length === 0) {
                this.INTERNAL_CONSOLE.warn(`Skipping cores initialization. No cores found.`)

                return true
            }

            // import all cores
            let cores = await Promise.all(coresKeys.map(async (key) => {
                const core = await coresPaths[key]().catch((err) => {
                    this.INTERNAL_CONSOLE.warn(`Cannot load core from ${key}.`, err)
                    return false
                })

                return core.default ?? core
            }))

            cores = cores.filter((core) => {
                return core.constructor
            })

            if (!cores) {
                this.INTERNAL_CONSOLE.warn(`Skipping cores initialization. No valid cores found.`)

                return true
            }

            this.eventBus.emit(`runtime.initialize.cores.start`)

            if (!Array.isArray(cores)) {
                this.INTERNAL_CONSOLE.error(`Cannot initialize cores, cause it is not an array. Core dependency is not supported yet. You must use an array to define your core load queue.`)
                return
            }

            // sort cores by dependencies
            cores.forEach((core) => {
                if (core.dependencies) {
                    core.dependencies.forEach((dependency) => {
                        // find dependency
                        const dependencyIndex = cores.findIndex((_core) => {
                            return (_core.namespace ?? _core.name) === dependency
                        })

                        if (dependencyIndex === -1) {
                            this.INTERNAL_CONSOLE.error(`Cannot find dependency [${dependency}] for core [${core.name}]`)
                            return
                        }

                        // move dependency to top
                        cores.splice(0, 0, cores.splice(dependencyIndex, 1)[0])
                    })
                }
            })

            for await (let coreClass of cores) {
                await this.initializeCore(coreClass)
            }

            // emit event
            this.eventBus.emit(`runtime.initialize.cores.finish`)
        } catch (error) {
            this.eventBus.emit(`runtime.initialize.cores.failed`, error)

            // make sure to throw that, app must crash if core fails to load
            throw error
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
                this.STATES.INITIALIZER_TASKS.push(_task)
            }
        })
    }

    performInitializerTasks = async () => {
        if (this.STATES.INITIALIZER_TASKS.length === 0) {
            this.INTERNAL_CONSOLE.warn("No initializer tasks found, skipping...")
            return true
        }

        for await (let task of this.STATES.INITIALIZER_TASKS) {
            if (typeof task === "function") {
                try {
                    await task(this)
                } catch (error) {
                    this.INTERNAL_CONSOLE.error(`Failed to perform initializer task >`, error)
                }
            }
        }
    }

    // CONTEXT CONTROL
    registerPublicMethods = async (methods) => {
        if (typeof methods !== "object") {
            this.INTERNAL_CONSOLE.error("Methods must be an object")
            return false
        }

        const boundedPublicMethods = await this.bindObjects(this, methods)

        for await (let [methodName, fn] of Object.entries(boundedPublicMethods)) {
            this.registerPublicMethod({
                key: methodName,
                locked: true,
            }, fn)
        }
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
            this.INTERNAL_CONSOLE.error(error)
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

    attachSplashScreen = () => {
        // create a new div inside the container
        let elementContainer = document.getElementById("splash-screen")

        if (!elementContainer) {
            elementContainer = document.createElement("div")

            // set the id of the new div
            elementContainer.id = "splash-screen"

            document.body.appendChild(elementContainer)
        }

        if (this.AppComponent.staticRenders?.Initialization) {
            this.SPLASH_RENDERER = ReactDOM.render(React.createElement((this.AppComponent.staticRenders?.Initialization), {
                states: this.STATES,
            }), elementContainer)
        }
    }

    detachSplashScreen = async () => {
        const container = document.getElementById("splash-screen")

        if (container) {
            if (this.SPLASH_RENDERER && typeof this.SPLASH_RENDERER.onUnmount) {
                await this.SPLASH_RENDERER.onUnmount()
            }

            ReactDOM.unmountComponentAtNode(container)
            container.remove()

            this.SPLASH_RENDERER = null
        }
    }

    // RENDER METHOD
    render(component = this.AppComponent, props = {}) {
        this.APP_RENDERER = React.createElement(
            component,
            {
                runtime: new Proxy(this, {
                    get: (target, prop) => {
                        return target[prop]
                    },
                    set: (target, prop, value) => {
                        throw new Error("Cannot set property of runtime")
                    }
                }),
                cores: this.CORES,
                ...props,
            }
        )

        this.root.render(this.APP_RENDERER)
    }
}