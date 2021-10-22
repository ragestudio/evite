import React from "react"
import createReactContext from "create-react-context"

const StateContext = createReactContext(null)
const DUMMY_STATE = {}

export class Container {
	state = {}
	_listeners = []

	setState(updater, callback) {
		return Promise.resolve().then(() => {
			let nextState

			if (typeof updater === "function") {
				nextState = updater(this.state)
			} else {
				nextState = updater
			}

			if (nextState == null) {
				if (callback) callback()
				return
			}

			this.state = Object.assign({}, this.state, nextState)

			let promises = this._listeners.map(listener => listener())

			return Promise.all(promises).then(() => {
				if (callback) {
					return callback()
				}
			})
		})
	}

	subscribe(fn) {
		this._listeners.push(fn)
	}

	unsubscribe(fn) {
		this._listeners = this._listeners.filter(f => f !== fn)
	}
}

export class Subscribe extends React.Component {
	state = {}
	instances = []
	unmounted = false

	componentWillUnmount() {
		this.unmounted = true
		this._unsubscribe()
	}

	_unsubscribe() {
		this.instances.forEach(container => {
			container.unsubscribe(this.onUpdate)
		})
	}

	onUpdate = () => {
		return new Promise(resolve => {
			if (!this.unmounted) {
				this.setState(DUMMY_STATE, resolve)
			} else {
				resolve()
			}
		})
	}

	_createInstances(map, containers) {
		if (!Array.isArray(containers)) {
			throw new Error("Subscribe: to must be an array of containers")
		}
		this._unsubscribe()

		if (map === null) {
			throw new Error("You must wrap your <Subscribe> components with a <Provider>")
		}

		let safeMap = map
		let instances = containers.map(ContainerItem => {
			let instance

			if (typeof ContainerItem === "object" && ContainerItem instanceof Container) {
				instance = ContainerItem
			} else {
				instance = safeMap.get(ContainerItem)

				if (!instance) {
					instance = new ContainerItem()
					safeMap.set(ContainerItem, instance)
				}
			}

			instance.unsubscribe(this.onUpdate)
			instance.subscribe(this.onUpdate)

			return instance
		})

		this.instances = instances
		return instances
	}

	render() {
		return (
			<StateContext.Consumer>
				{map => {
					return this.props.children.apply(null, this._createInstances(map, this.props.to))
				}}
			</StateContext.Consumer>
		)
	}
}

export function Provider(props) {
	return (
		<StateContext.Consumer>
			{parentMap => {
				let childMap = new Map(parentMap)

				if (props.inject) {
					props.inject.forEach(instance => {
						childMap.set(instance.constructor, instance)
					})
				}

				return <StateContext.Provider value={childMap}>{props.children}</StateContext.Provider>
			}}
		</StateContext.Consumer>
	)
}

export function createStateContainer(initialState) {
	return class extends Container {
		state = initialState ?? {}
	}
}