import React from "react"
import {createBrowserHistory} from "history"
import EventBus from "./eventBus"
import classAggregation from "./classAggregation"
import GlobalBindingProvider from "./globalBindingProvider"
import appendMethodToApp from "./appendMethodToApp"
import {Provider, Subscribe, createStateContainer} from "evite/client/statement"

class IsolatedContext {
	constructor(context = {}) {
		this.isolatedKeys = Object.keys(context)
		return new Proxy(context, this.handler)
	}

	handler = {
		get: (target, name) => {
			return target[name]
		},
		set: (target, name, value) => {
			if (this.isolatedKeys.includes(name)) {
				console.error("Cannot assign an value to an isolated property", name, value)
				return false
			}

			return Object.assign(target, {[name]: value})
		},
	}
}

class EviteApp extends React.Component {
	constructor(props) {
		super(props)

		// set window app controllers
		this.mainFragment = this.props.children
		this.app = window.app = Object()
		this.controllers = this.app.controllers = {}

		// initializations
		this.initializationTasks = []
		this.initialized = Boolean(false)

		// controllers
		this.history = window.app.history = createBrowserHistory()
		this.eventBus = window.app.eventBus = new EventBus()

		// extensions
		this.extensionsKeys = []

		// declare events
		this.eventBus.on("initialization", async () => {
			this.initialized = false
		})

		this.eventBus.on("initialization_done", async () => {
			this.initialized = true
			this.forceUpdate()
		})

		// isolated context
		this.isolatedContext = new IsolatedContext(this)
	}

	componentDidMount = async () => {
		await this._init()
	}

	shouldComponentUpdate() {
		return this.initialized
	}

	attachExtension = extension => {
		if (typeof extension.key !== "string") {
			console.error("Extensions must contain an extension key")
			return false
		}

		if (typeof extension.expose !== "undefined") {
			let exposeArray = []

			if (Array.isArray(extension.expose)) {
				exposeArray = extension.expose
			} else {
				exposeArray.push(extension.expose)
			}

			exposeArray.forEach(expose => {
				if (typeof expose.mutateContext !== "undefined") {
					this.mutateContext(expose.mutateContext)
				}
				if (typeof expose.initialization !== "undefined") {
					this.appendToInitializer(expose.initialization)
				}
			})
		}

		this.extensionsKeys.push(extension.key)
	}

	mutateContext = self => {
		if (typeof self !== "object") {
			console.error("Mutation must be an object")
			return false
		}

		Object.keys(self).forEach(key => {
			if (typeof self[key] === "function") {
				this.isolatedContext[key] = self[key].bind(this.isolatedContext)
			}

			this.isolatedContext[key] = self[key]
		})

		return this.isolatedContext
	}

	appendToInitializer = task => {
		let tasks = []

		if (Array.isArray(task)) {
			tasks = task
		} else {
			tasks.push(task)
		}

		tasks.forEach(_task => {
			if (typeof _task === "function") {
				this.initializationTasks.push(_task)
			}
		})
	}

	appendToApp = (key, method) => {
		this.app[key] = method
	}

	_init = async () => {
		this.eventBus.emit("initialization")

		this.globalStateContainer = createStateContainer({...this.constructorContext?.globalState})

		if (typeof this.constructorContext !== "undefined" && typeof this.constructorContext === "object") {
			// attach extensions
			if (Array.isArray(this.constructorContext.extensions)) {
				this.constructorContext.extensions.forEach(extension => {
					this.attachExtension(extension)
				})
			}
		}

		// perform tasks
		if (Array.isArray(this.initializationTasks)) {
			for await (let task of this.initializationTasks) {
				if (typeof task === "function") {
					await task(this)
				}
			}
		}

		if (typeof this["initialization"] === "function") {
			try {
				await this.initialization()
			} catch (error) {
				console.error(error)
			}
		}

		this.eventBus.emit("initialization_done")
	}

	registerRender = component => {
		this.mainFragment = component
	}

	render() {
		if (!this.mainFragment) {
			console.error("EviteApp has not an render method, auto render must have a children or an mainFragment")
			return null
		}
		if (!this.initialized) {
			return null
		}

		const App = props => {
			if (React.isValidElement()) {
				return React.cloneElement(this.mainFragment, {context: this.isolatedContext, ...props})
			}
			return React.createElement(this.mainFragment, {context: this.isolatedContext, ...props})
		}

		return (
			<Provider>
				<Subscribe to={[this.globalStateContainer]}>
					{globalState => {
						return (
							<App
								globalState={globalState.state}
								setGlobalState={(...context) => {
									globalState.setState(...context)
								}}
							/>
						)
					}}
				</Subscribe>
			</Provider>
		)
	}
}

function createEviteApp(component, context) {
	return class extends classAggregation(EviteApp) {
		constructor(props) {
			super(props)
			this.constructorContext = {...context, ...props}
			this.registerRender(component)
		}
	}
}

export {EviteApp, createEviteApp, EventBus, classAggregation, GlobalBindingProvider, appendMethodToApp}
export default EviteApp
