import React from "react"
import ReactDOM from "react-dom"
import { createBrowserHistory } from "history"
import { Observable } from "object-observer"

import ClassAggregation from "./classAggregation"
import BindPropsProvider from "./bindPropsProvider"
import IsolatedContext from "./isolatedContext"
import Extension from "./extension"

import { EventBus, SetToWindowContext } from "./internals"

import { DebugWindow } from "./internals/debug"

import pkgJson from "../package.json"

import "./internals/style/index.css"

class EviteApp extends React.Component {
	constructor(props) {
		super(props)

		// extesions statements
		this.ATTACHED_EXTENSIONS = Observable.from([])

		Observable.observe(this.ATTACHED_EXTENSIONS, (changes) => {
			changes.forEach((change) => {
				// update this.state.ATTACHED_EXTENSIONS with change.object value
				this.setState({
					ATTACHED_EXTENSIONS: Array.from(change.object)
				})
			})
		})

		// contexts
		this.windowContext = window.app = Object()
		this.IsolatedMainContext = new IsolatedContext(this)
		this.IsolatedAppContext = new IsolatedContext({})

		// controllers
		this.history = this.setToWindowContext({ key: "history", locked: true }, createBrowserHistory())
		this.eventBus = this.setToWindowContext({ key: "eventBus", locked: true }, new EventBus())

		// append app methods
		this.setToWindowContext({ key: "connectToGlobalContext", locked: true }, this.connectToGlobalContext)
		this.setToWindowContext({ key: "__eviteVersion", locked: true }, pkgJson.version)

		// internal events
		this.eventBus.on("APP_INITIALIZATION_START", async () => {
			await this.setState({ LOAD_STATE: "early" })

			await this.setState({ INITIALIZATION_START: performance.now() })
		})
		this.eventBus.on("APP_INITIALIZATION_DONE", async () => {
			const time = performance.now()

			await this.setState({ INITIALIZATION_STOP: time })

			if (this.state.INITIALIZATION_START) {
				await this.setState({ INITIALIZATION_TOOKS: time - this.state.INITIALIZATION_START })
			}

			await this.setState({ LOAD_STATE: "done" })
		})
		this.eventBus.on("APP_INITIALIZATION_CRASH", async () => {
			await this.setState({ LOAD_STATE: "crashed" })
		})
	}

	state = {
		LOAD_STATE: "early",
		CRASH: null,

		ATTACHED_EXTENSIONS: [], // do not update this state directly, use this.ATTACHED_EXTENSIONS observer instead
		REJECTED_EXTENSIONS: [],

		INITIALIER_TASKS: [],
	}

	componentDidMount = async () => {
		try {
			await this.__earlyInitializate()
		} catch (error) {
			// handle crash
			this.eventBus.emit("APP_INITIALIZATION_CRASH", error)

			console.error(`[EVITE APP] Crashed during initialization > \n\n`, error)

			await this.setState({ CRASH: error })
		}
	}

	componentDidUpdate = async () => {
		if (this.props.children.debugMode) {
			let elementContainer = document.getElementById("debug-window")

			if (!elementContainer) {
				elementContainer = document.createElement("div")

				elementContainer.id = "debug-window"
				elementContainer.className = "__debugWindow"

				document.body.appendChild(elementContainer)
			}

			ReactDOM.render(<DebugWindow cntx={this} />, document.getElementById("debug-window"))
		}
	}

	async __earlyInitializate() {
		this.eventBus.emit("APP_INITIALIZATION_START")

		// initialize attach base extensions
		let extensionsInitializators = []

		if (Array.isArray(this.props.children.baseExtensions)) {
			for await (let extension of this.props.children.baseExtensions) {
				const initializationPromise = new Promise(async (resolve, reject) => {
					await this.initializeExtension(extension)
						.then(() => {
							this.eventBus.emit(`EXTENSION_ATTACHED`, extension.name)

							return resolve()
						})
						.catch((rejection) => {
							console.error(`[EVITE APP] Failed to attach base extension > \n\n`, rejection)

							if (rejection.id) {
								this.eventBus.emit(`EXTENSION_${rejection.id}_REJECTED`, rejection)
							}

							this.eventBus.emit(`EXTENSION_REJECTED`, rejection)

							return resolve()
						})
				})

				extensionsInitializators.push(initializationPromise)
			}
		}

		await Promise.all(extensionsInitializators)

		// perform tasks
		if (this.state.INITIALIER_TASKS) {
			for await (let task of this.state.INITIALIER_TASKS) {
				if (typeof task === "function") {
					await task(this.IsolatedAppContext.getProxy(), this.IsolatedMainContext.getProxy())
				}
			}
		}

		// initialize children
		if (typeof this.props.children.initialize !== "undefined") {
			await this.props.children.initialize.apply(this.IsolatedAppContext.getProxy())
		}

		this.eventBus.emit("APP_INITIALIZATION_DONE")
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
				this.setState({ INITIALIER_TASKS: [...this.state.INITIALIER_TASKS, _task] })
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

	setToAppContext = (key, method) => {
		this.IsolatedAppContext.getProxy()[key] = method.bind(this)
	}

	setToWindowContext = (params = {}, value, ...args) => {
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

		Object.defineProperty(this.windowContext, opts.key, {
			value,
			enumerable: opts.enumerable,
			configurable: opts.locked
		})

		return this.windowContext[opts.key]
	}

	// EXTENSIONS CONTROL
	initializeExtension = (extension) => {
		return new Promise(async (resolve, reject) => {
			if (typeof extension !== "function") {
				return reject({
					reason: "EXTENSION_NOT_VALID_CLASS",
				})
			}

			extension = new extension(this.IsolatedAppContext.getProxy(), this.IsolatedMainContext.getProxy())

			if (extension instanceof Extension) {
				// good for u
			} else {
				await this.setState({ REJECTED_EXTENSIONS: [extension.constructor.name, ...this.state.REJECTED_EXTENSIONS] })
				return reject({
					name: extension.constructor.name,
					reason: "EXTENSION_NOT_VALID_INSTANCE",
				})
			}

			// await to extension initializer
			await extension.initializer()

			// expose context to app context
			if (typeof extension.expose === "object") {
				this.mutateContext(this.IsolatedMainContext.getProxy(), extension.expose)
			}

			// appends initializers
			if (typeof extension.initializers !== "undefined") {
				for await (let initializer of extension.initializers) {
					await initializer.apply(this.IsolatedMainContext.getProxy(), initializer)
				}
			}

			// set window context
			if (typeof extension.window === "object") {
				Object.keys(extension.window).forEach((key) => {
					this.setToWindowContext({ key }, extension.window[key].bind(this.IsolatedMainContext.getProxy()))
				})
			}


			// attach
			this.ATTACHED_EXTENSIONS.push(extension.constructor.name)

			return resolve()
		})
	}

	// RENDER METHOD
	render() {
		if (this.state.CRASH) {
			return <div className="__eviteCrash">
				<h1>Oops!</h1>
				<p>Something went wrong, the application has a fatal crash.</p>

				<div className="__eviteCrash, description">
					<code>
						{this.state.CRASH.message}
					</code>
				</div>
			</div>
		}

		if (this.state.LOAD_STATE !== "done") {
			if (this.props.children.staticRenders["initialization"]) {
				return React.createElement(this.props.children.staticRenders["initialization"])
			}

			return null
		}

		if (!this.props.children) {
			console.error("No children provided")
			return null
		}

		console.debug(`[APP] Rendering main`)

		return React.createElement(this.props.children, {
			contexts: {
				main: this.IsolatedMainContext.getProxy(),
				app: this.IsolatedAppContext.getProxy(),
			}
		})
	}
}

function CreateEviteApp(App, props) {
	return ReactDOM.render(React.createElement(EviteApp, props, App), document.getElementById("root"))
}


export * from "./components"

export {
	EviteApp,
	EventBus,
	Extension,
	CreateEviteApp,
	ClassAggregation,
	BindPropsProvider,
	SetToWindowContext,
	IsolatedContext
}
export default EviteApp