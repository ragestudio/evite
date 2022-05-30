import React from "react"
import ReactDOM from "react-dom"

import store from "store"

import { createBrowserHistory } from "history"
import { Observable } from "object-observer"

import ClassAggregation from "./classAggregation"
import BindPropsProvider from "./bindPropsProvider"
import IsolatedContext from "./isolatedContext"
import Extension from "./extension"

import { EventBus, SetToWindowContext, ContextedClass } from "./internals"

import { DebugWindow } from "./internals/debug"

import pkgJson from "../package.json"

import "./internals/style/index.css"

class EviteRuntime {
	Flags = window.flags = Observable.from({
		debug: false,
	})
	PublicContext = window.app = Object()
	ExtensionsContext = new IsolatedContext(Object())

	INITIALIZER_TASKS = []

	STATES = Observable.from({
		LOAD_STATE: "early",

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
		})

		this.eventBus.on("runtime.initialize.finish", async () => {
			const time = performance.now()

			this.STATES.INITIALIZATION_STOP = time

			if (this.STATES.INITIALIZATION_START) {
				this.STATES.INITIALIZATION_TOOKS = time - this.STATES.INITIALIZATION_START
			}

			this.STATES.LOAD_STATE = "initialized"
		})

		this.eventBus.on("runtime.initialize.crash", async () => {
			this.STATES.LOAD_STATE = "crashed"
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

		return this.initialize()
	}

	async initialize() {
		this.eventBus.emit("runtime.initialize.start")

		let extensionsLoad = []
		let extensionsInitializators = []

		// try to load from @internal_extensions
		try {
			const extensions = import.meta.glob('/src/internal_extensions/**/*.extension.js*')

			for await (let [uri, extension] of Object.entries(extensions)) {
				extension = await extension()
				extension = extension.default || extension

				extensionsLoad.push(extension)
			}
		} catch (error) {
			console.log(error)
			this.eventBus.emit(`runtime.initialize.internalExtensions.failed`, error)
		}

		// TODO: resolve storaged extensions
		try {
			// get uris from storage
			const extensions = store.get(`extensions`)

			// should be a object with a the extension manifest schema, e.g.
			// {
			//	"publisher/extensionName": {
			//		url: "https://extensions_storage.ragestudio.net/pkg/publisher/extensionName.extension.js@0.0.0",
			//		version: "0.0.0",
			// 	}
			// }

			// resolve extension scripts

			// push to queue
		} catch (error) {
			console.log(error)
			this.eventBus.emit(`runtime.initialize.storagedExtensions.failed`, error)
		}

		// get and set extensions initializers
		for await (let extension of extensionsLoad) {
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

			// push to queue
			extensionsInitializators.push(initializationPromise)
		}

		// peform all initializers
		await Promise.all(extensionsInitializators)

		// perform tasks
		if (this.STATES.INITIALIZER_TASKS) {
			for await (let task of this.STATES.INITIALIZER_TASKS) {
				if (typeof task === "function") {
					await task(this)
				}
			}
		}

		// initialize app
		if (typeof this.AppComponent.initialize === "function") {
			await this.AppComponent.initialize.apply(this)
		}

		// handle app events handlers registration
		if (typeof this.AppComponent.eventsHandlers === "object") {
			for await (let [event, handler] of Object.entries(this.AppComponent.eventsHandlers)) {
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

		if (typeof opts.key === 'undefined') {
			throw new Error('key is required')
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

			return resolve()
		})
	}

	// RENDER METHOD
	render() {
		return ReactDOM.render(React.createElement(
			this.AppComponent,
			{
				contexts: {
					runtime: this,
					ExtensionsContext: this.ExtensionsContext.getProxy(),
				}
			}
		), document.getElementById(this.Params.renderMount ?? "root"))
	}
}

export * from "./components"

export {
	EviteRuntime,
	EventBus,
	Extension,
	ClassAggregation,
	BindPropsProvider,
	SetToWindowContext,
	IsolatedContext
}