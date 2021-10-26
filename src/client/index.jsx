import React from "react"
import { createBrowserHistory } from "history"

import EventBus from "./eventBus"
import ClassAggregation from "./classAggregation"
import BindPropsProvider from "./bindPropsProvider"
import AppendToWindowContext from "./appendToWindowContext"
import { Provider, Subscribe, createStateContainer } from "./statement"

class IsolatedContext {
	constructor(context = {}) {
		this.isolatedKeys = Object.keys(context)
		this.listeners = {
			set: [],
			get: [],
		}

		this.proxy = new Proxy(context, this.handler)
		return this
	}

	subscribe = (event, listener) => {
		this.listeners[event].push(listener)
	}

	getProxy = () => {
		return this.proxy
	}

	handler = {
		get: (target, name) => {
			this.listeners["get"].forEach(listener => {
				if (typeof listener === "function") {
					listener(target, name)
				}
			})

			return target[name]
		},
		set: (target, name, value) => {
			if (this.isolatedKeys.includes(name)) {
				console.error("Cannot assign an value to an isolated property", name, value)
				return false
			}
			const assignation = Object.assign(target, { [name]: value })

			this.listeners["set"].forEach(listener => {
				if (typeof listener === "function") {
					listener(target, name, value)
				}
			})

			return assignation
		},
	}
}

class EviteApp extends React.Component {
	constructor(props) {
		super(props)

		// base state
		this.state = {
			initialized: false,
		}

		// render
		this.__render = null

		// set window app controllers
		this.windowContext = window.app = Object()

		// initializations
		this.initializationTasks = []
		this.initialized = new Proxy({}, {
			get: () => {
				return this.state.initialized
			},
			set: () => {
				console.error("Cannot update initialized state by assignment")
				return false
			}
		})

		// controllers
		this.history = window.app.history = createBrowserHistory()
		this.eventBus = window.app.eventBus = new EventBus()

		// extensions
		this.extensionsKeys = []

		// contexts
		this.mainContext = new IsolatedContext(this)
		this.appContext = new IsolatedContext({})
		this.globalContext = React.createContext(this.mainContext.getProxy())

		// append app methods
		this.appendToWindowContext("connectToGlobalContext", this.connectToGlobalContext)
	}

	initialization = async () => {
		this.eventBus.emit("initialization")

		// create new state container
		this.globalStateContainer = createStateContainer({ ...this.constructorParams?.globalState })

		// check if can register children as render
		if (!this.__render && this.props.children) {
			this.registerRender(this.props.children)
		}

		// handle constructorParams
		if (typeof this.constructorParams !== "undefined" && typeof this.constructorParams === "object") {
			// attach extensions
			if (Array.isArray(this.constructorParams.extensions)) {
				this.constructorParams.extensions.forEach(extension => {
					this.attachExtension(extension)
				})
			}
		}

		// perform tasks
		if (Array.isArray(this.initializationTasks)) {
			for await (let task of this.initializationTasks) {
				if (typeof task === "function") {
					await task(this.appContext.getProxy(), this.mainContext.getProxy())
				}
			}
		}

		this.eventBus.emit("initialization_done")
	}

	componentDidMount = async () => {
		await this.initialization()

		this.toogleInitializationState(true)
	}

	toogleInitializationState = (to) => {
		this.setState({
			initialized: to ?? !this.state.initialized
		})
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
					this.mutateContext(this.appContext.getProxy(), expose.mutateContext)
				}
				if (typeof expose.initialization !== "undefined") {
					this.appendToInitializer(expose.initialization)
				}
			})
		}

		this.extensionsKeys.push(extension.key)
	}

	connectToGlobalContext = component => {
		return React.createElement(this.globalContext.Consumer, null, context => {
			return React.createElement(component, {
				...context,
			})
		})
	}

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

	appendToAppContext = (key, method) => {
		this.appContext.getProxy()[key] = method.bind(this.mainContext.getProxy())
	}

	appendToWindowContext = (key, method) => {
		this.windowContext[key] = method
	}

	registerRender = component => {
		const _this = this

		const ContextedClass = class {
			initializer() {
				this.app = _this.appContext.getProxy()
				this.mainContext = _this.mainContext.getProxy()

				_this.appContext.subscribe("set", () => {
					this.forceUpdate()
				})

				_this.mainContext.subscribe("set", () => {
					this.forceUpdate()
				})
			}
		}

		this.__render = props => React.createElement(ClassAggregation(component, ContextedClass, React.Component), props)
	}

	getAppRenders = (key) => {
		const context = this.appContext.getProxy()
		const renders = context?.renders ?? {}

		if (typeof renders === "object") {
			if (key in renders) {
				return renders[key]
			}
		}
	}

	render() {
		if (!this.__render) {
			console.error("EviteApp has not an render method, auto render must have a children or an mainFragment")
			return null
		}

		if (!this.state.initialized) {
			const CustomRender = this.getAppRenders("initialization")

			if (React.isValidElement(CustomRender)) {
				return <CustomRender />
			}

			return null
		}

		const App = this.__render
		const GlobalContext = this.globalContext

		return (
			<Provider>
				<Subscribe to={[this.globalStateContainer]}>
					{globalStateInstance => {
						const globalState = globalStateInstance.state
						const setGlobalState = (...args) => globalStateInstance.setState(...args)

						return (
							<GlobalContext.Provider value={this.appContext.getProxy()}>
								<App globalState={globalState} setGlobalState={setGlobalState} />
							</GlobalContext.Provider>
						)
					}}
				</Subscribe>
			</Provider>
		)
	}
}

function CreateEviteApp(component, params) {
	return class extends EviteApp {
		constructor(props) {
			super(props)

			this.constructorParams = { ...params, ...props }
			this.registerRender(component)
		}
	}
}

export { EviteApp, CreateEviteApp, EventBus, ClassAggregation, BindPropsProvider, AppendToWindowContext }
export default EviteApp
