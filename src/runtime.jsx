import React from "react"
import ReactDOM from "react-dom"

import { createBrowserHistory } from "history"
import { Observable } from "object-observer"

import IsolatedContext from "./isolatedContext"
import Extension from "./extension"

import { EventBus, InternalConsole } from "./internals"
import { DebugWindow } from "./internals/debug"
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
        headColor: "bgMagenta",
    })

    PublicContext = window.app = Object()
    ExtensionsContext = new IsolatedContext(Object())

    CoresPublicContext = Object()

    EXTENSIONS = Object()
    CORES = Object()

    STATES = Observable.from({
        LOAD_STATE: "early",

        LOADED_CORES: [],
        INITIALIZER_TASKS: [],

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
            debug: false,
        }
    ) {
        this.AppComponent = App
        this.Params = Params

        // toogle splash
        this.attachSplashScreen()

        // controllers
        this.rootContainer = document.getElementById(this.Params.renderMount ?? "root")
        this.history = this.registerPublicMethod({ key: "history", locked: true }, createBrowserHistory())
        this.eventBus = this.registerPublicMethod({ key: "eventBus", locked: true }, new EventBus())

        // append app methods
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

        this.registerPublicMethod({ key: "isMobile", locked: true }, isMobile())
        this.registerPublicMethod({ key: "__eviteVersion", locked: true }, pkgJson.version)
        this.registerPublicMethod({ key: "toogleRuntimeDebugMode", locked: true }, this.toogleRuntimeDebugMode)

        // internal events
        this.eventBus.on("runtime.initialize.start", async () => {
            this.STATES.LOAD_STATE = "initializing"
            this.STATES.INITIALIZATION_START = performance.now()
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
        })

        this.eventBus.on("runtime.crash", (crash) => {
            this.STATES.LOAD_STATE = "crashed"

            if (this.SPLASH_RENDERER) {
                this.detachSplashScreen()
            }

            // render crash
            this.render(this.AppComponent.staticRenders?.Crash ?? StaticRenders.Crash, {
                crash
            })
        })

        if (typeof this.AppComponent.splashAwaitEvent === "string") {
            this.eventBus.on(this.AppComponent.splashAwaitEvent, () => {
                this.detachSplashScreen()
            })
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

        // handle debug update
        Observable.observe(this.Flags, (changes) => {
            changes.forEach((change) => {
                if (change.type === "update") {
                    this.debugUpdateRender()
                }
            })
        })

        Observable.observe(this.STATES, (changes) => {
            if (this.APP_RENDERER && typeof this.APP_RENDERER.onRuntimeStateUpdate === "function") {
                this.APP_RENDERER.onRuntimeStateUpdate(this.STATES, changes)
            }

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

        await this.registerInternalExtensionToInitializer()

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

    initializeCores = async () => {
        try {
            const coresPaths = {
                ...import.meta.glob("/src/cores/*/*.core.jsx"),
                ...import.meta.glob("/src/cores/*/*.core.js"),
                ...import.meta.glob("/src/cores/*/*.core.ts"),
                ...import.meta.glob("/src/cores/*/*.core.tsx"),
            }

            console.log(coresPaths)

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
                            return (_core.refName ?? _core.name) === dependency
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
                if (!coreClass.constructor) {
                    this.INTERNAL_CONSOLE.error(`Core [${core.name}] is not a class`)
                    continue
                }

                const refName = coreClass.refName ?? coreClass.name

                this.eventBus.emit(`runtime.initialize.core.${refName}.start`)

                // construct class
                let core = new coreClass(this)

                // set core to context
                this.CORES[refName] = core

                if (typeof core.onInitialize === "function") {
                    // by now, we gonna initialize from here instead push to queue
                    await core.onInitialize()
                }

                // register a app namespace
                if (coreClass.namespace && core.public) {
                    // freeze public methods using proxy
                    this.CoresPublicContext[coreClass.namespace] = new Proxy(core.public, {
                        get: (target, prop) => {
                            if (typeof target[prop] === "function") {
                                return target[prop]
                            }

                            return target[prop]
                        },
                        set: () => {
                            throw new Error(`Cannot set value to public core method`)
                        }
                    })
                }

                // register eventBus events
                if (typeof core.onEvents === "object") {
                    Object.entries(core.onEvents).forEach(([event, handler]) => {
                        this.eventBus.on(event, handler)
                    })
                }

                // handle global public methods
                if (typeof core.registerToApp === "object") {
                    Object.entries(core.registerToApp).forEach(([method, handler]) => {
                        this.registerPublicMethod(method, handler)
                    })
                }

                if (typeof core.initializeBeforeRuntimeInit === "function") {
                    this.appendToInitializer(core.initializeBeforeRuntimeInit.bind(core))
                }

                if (typeof coreClass.awaitEvents === "object") {
                    let awaitEvents = []

                    if (typeof coreClass.awaitEvents === "string") {
                        awaitEvents = [coreClass.awaitEvents]
                    } else if (Array.isArray(coreClass.awaitEvents)) {
                        awaitEvents = coreClass.awaitEvents
                    }

                    // await to events before initialize
                    await Promise.all(awaitEvents.map(([event, handler]) => {
                        return new Promise((resolve) => {
                            this.eventBus.once(event, (data) => {
                                handler(data)
                                resolve()
                            })
                        })
                    }))
                }

                // emit event
                this.eventBus.emit(`runtime.initialize.core.${refName}.finish`)

                // register internal core
                this.STATES.LOADED_CORES.push(refName)
            }

            // emit event
            this.eventBus.emit(`runtime.initialize.cores.finish`)
        } catch (error) {
            this.eventBus.emit(`runtime.initialize.cores.failed`, error)

            // make sure to throw that, app must crash if core fails to load
            throw error
        }
    }

    registerInternalExtensionToInitializer = async () => {
        try {
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

                this.appendToInitializer(initializationPromise)
            }
        } catch (error) {
            this.eventBus.emit(`runtime.initialize.internalExtensions.failed`, error)
            this.INTERNAL_CONSOLE.error(error)
        }
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

            ReactDOM.render(React.createElement(DebugWindow, { ctx: this }), document.getElementById("debug-window"))
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
    mutateContext = (context, mutation) => {
        if (typeof context !== "object") {
            this.INTERNAL_CONSOLE.error("Context must be an object or an valid Context")
            return false
        }
        if (typeof mutation !== "object") {
            this.INTERNAL_CONSOLE.error("Mutation must be an object")
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
        this.APP_RENDERER = ReactDOM.render(React.createElement(
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
                ExtensionsContext: this.ExtensionsContext.getProxy(),
                ...props,
            }
        ), this.rootContainer)
    }
}