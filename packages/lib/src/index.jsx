import React from "react"
import { createBrowserHistory } from "history"
import pkgJson from "../package.json"

import EventBus from "./eventBus"
import ClassAggregation from "./classAggregation"
import BindPropsProvider from "./bindPropsProvider"
import SetToWindowContext from "./setToWindowContext"
import IsolatedContext from "./isolatedContext"
import { Provider } from "./statement"

const ContextedClass = (_this, self) => class {
	initializer() {
		this.contexts = {
			app: _this.appContext.getProxy(),
			main: _this.mainContext.getProxy(),
			window: _this.windowContext,
		}

		this.self = self
		this.eventBus = this.contexts.main.eventBus

		if (typeof self.eventsHandlers === "object") {
			Object.keys(self.eventsHandlers).forEach((event) => {
				this.eventBus.on(event, self.eventsHandlers[event].bind(this))
			})
		}
	}
}

class EviteApp extends React.PureComponent {
	constructor(props) {
		super(props)

		window.__eviteVersion = pkgJson.version

		this.constructorParams = {}

		// statement
		this.state = {
			APP_INITIALIZATION: false,
			APP_INITIALIZATION_TASKS: [],
			EXTENSIONS_KEYS: [],
			RENDER_COMPONENT: null,
		}

		// contexts
		this.windowContext = window.app = Object()
		this.mainContext = new IsolatedContext(this)
		this.appContext = new IsolatedContext({})

		// controllers
		this.history = this.setToWindowContext({ key: "history", locked: true }, createBrowserHistory())
		this.eventBus = this.setToWindowContext({ key: "eventBus", locked: true }, new EventBus())

		// append app methods
		this.setToWindowContext({ key: "connectToGlobalContext", locked: true }, this.connectToGlobalContext)
	}

	// INITIALIZATION & LIFECYCLE CONTROL
	componentDidMount = () => this.initialize()

	initialize = async () => {
		this.eventBus.emit("APP_INITIALIZATION_START")
		this.toogleInitializationState(true)

		// handle constructorParams
		if (typeof this.constructorParams !== "undefined" && typeof this.constructorParams === "object") {
			// attach extensions
			if (Array.isArray(this.constructorParams.extensions)) {
				for await (let extension of this.constructorParams.extensions) {
					await this.attachExtension(extension)
				}
			}
		}

		// perform tasks
		if (this.state.APP_INITIALIZATION_TASKS) {
			for await (let task of this.state.APP_INITIALIZATION_TASKS) {
				if (typeof task === "function") {
					await task(this.appContext.getProxy(), this.mainContext.getProxy())
				}
			}
		}

		// if not render method, set children as mainFragment
		if (!this.constructorParams.render && this.props.children) {
			this.constructorParams.render = this.props.children
		}

		let RENDER_COMPONENT = ClassAggregation(
			this.constructorParams.render,
			React.PureComponent,
			ContextedClass(this, this.constructorParams.render),
		)

		// update render component
		await this.setState({ RENDER_COMPONENT: RENDER_COMPONENT })

		this.eventBus.emit("APP_INITIALIZATION_DONE")
		this.toogleInitializationState(false)
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
				this.setState({ APP_INITIALIZATION_TASKS: [...this.state.APP_INITIALIZATION_TASKS, _task] })
			}
		})
	}

	toogleInitializationState = (to) => {
		this.setState({
			APP_INITIALIZATION: to ?? !this.state.APP_INITIALIZATION
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

	connectToGlobalContext = (component) => {
		return React.createElement(this.globalContext.Consumer, null, context => {
			return React.createElement(component, {
				...context,
			})
		})
	}

	setToAppContext = (key, method) => {
		this.appContext.getProxy()[key] = method.bind(this.mainContext.getProxy())
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
	attachExtension = (extension) => {
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

			exposeArray.forEach((expose) => {
				if (typeof expose.mutateContext !== "undefined") {
					this.mutateContext(this.appContext.getProxy(), expose.mutateContext)
				}
				if (typeof expose.initialization !== "undefined") {
					this.appendToInitializer(expose.initialization)
				}
			})
		}

		this.setState({
			EXTENSIONS_KEYS: [...this.state.EXTENSIONS_KEYS, extension.key]
		})
	}

	// STATICS
	getStaticRenders = (key) => {
		const renders = this.RENDER_COMPONENT?.staticRenders ?? {}

		if (typeof renders === "object") {
			if (key in renders) {
				return renders[key]
			}
		}
	}

	getStaticEventsHandlers = (key) => {
		const events = this.RENDER_COMPONENT?.eventsHandler ?? {}

		if (typeof events === "object") {
			if (key in events) {
				return events[key]
			}
		}
	}

	// RENDER METHOD
	render() {
		const RENDER_COMPONENT = this.state.RENDER_COMPONENT

		if (this.state.APP_INITIALIZATION) {
			const CustomRender = this.getStaticRenders("initialization")

			if (typeof CustomRender !== "undefined") {
				return <CustomRender />
			}

			return null
		}

		if (!RENDER_COMPONENT) {
			return null
		}

		console.debug(`[APP] Rendering main`)

		return (
			<Provider>
				<RENDER_COMPONENT />
			</Provider>
		)
	}
}

function CreateEviteApp(component, params) {
	return class extends EviteApp {
		constructor(props) {
			super(props)

			this.constructorParams = { ...params, ...props, render: component }
		}
	}
}

export * from "./components"

export {
	EviteApp,
	CreateEviteApp,
	EventBus,
	ClassAggregation,
	BindPropsProvider,
	SetToWindowContext,
	IsolatedContext
}
export default EviteApp