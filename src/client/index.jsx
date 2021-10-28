import React from "react"
import { createBrowserHistory } from "history"

import EventBus from "./eventBus"
import ClassAggregation from "./classAggregation"
import BindPropsProvider from "./bindPropsProvider"
import SetToWindowContext from "./setToWindowContext"
import IsolatedContext from "./isolatedContext"
import { Provider } from "./statement"

class EviteApp extends React.Component {
	constructor(props) {
		super(props)

		// statement
		this.state = {
			initialized: false,
		}

		// render
		this.__render = null

		// extensions
		this.extensionsKeys = []

		// contexts
		this.windowContext = window.app = Object()
		this.mainContext = new IsolatedContext(this)
		this.appContext = new IsolatedContext({})

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
		this.history = this.setToWindowContext({ key: "history", locked: true }, createBrowserHistory())
		this.eventBus = this.setToWindowContext({ key: "eventBus", locked: true }, new EventBus())

		// append app methods
		this.setToWindowContext({ key: "connectToGlobalContext", locked: true }, this.connectToGlobalContext)
	}

	initialization = async () => {
		this.eventBus.emit("initialization")

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

		// if not render method, set children as mainFragment
		if (!this.__render && this.props.children) {
			this.__render = this.props.children
		}

		// create render
		const Render = this.extendWithContext(this.__render)
		this.__render = props => React.createElement(Render, props)

		// toogle initialized state for start rendering mainFragment
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

	extendWithContext = (base, ...aggregations) => {
		const ContextedClass = (_this) => class {
			initializer() {
				this.contexts = {
					app: _this.appContext.getProxy(),
					main: _this.mainContext.getProxy(),
					window: _this.windowContext,
				}
			}
		}

		return ClassAggregation(base, ContextedClass(this), React.Component, ...aggregations)
	}

	getStaticRenders = (key) => {
		const renders = this.__render?.staticRenders ?? {}

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
			const CustomRender = this.getStaticRenders("initialization")

			if (typeof CustomRender !== "undefined") {
				return <CustomRender />
			}

			return null
		}

		return (
			<Provider>
				{this.__render()}
			</Provider>
		)
	}
}

function CreateEviteApp(component, params) {
	return class extends EviteApp {
		constructor(props) {
			super(props)

			this.constructorParams = { ...params, ...props }
			this.__render = component
		}
	}
}

export { EviteApp, CreateEviteApp, EventBus, ClassAggregation, BindPropsProvider, SetToWindowContext, IsolatedContext }
export default EviteApp