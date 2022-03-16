import { CreateEviteApp, Extension } from "../../../packages/lib/src"

import React from "react"

import "./index.less"

class GoodExtensionTest extends Extension {
	initializers = [
		async () => {
			await new Promise(resolve => setTimeout(resolve, 2000))
		}
	]

	expose = {
		testMethod: function () {
			console.log(this)
			window.alert("this works")
		}
	}
}

class ExampleApp extends React.Component {
	constructor(props) {
		super(props)

		this.state = {
			count: 0,
			quickSum: false,
		}
		this.quickSumInterval = null
	}

	static debugMode = true

	static baseExtensions = [GoodExtensionTest,]

	static staticRenders = {
		initialization: () => {
			return <div>
				Starting in 2 seconds
			</div>
		}
	}

	static initialize() {
		console.log(this)
	}

	componentDidMount = () => {
		console.log(this)
	}

	toogleQuickSum = (to) => {
		this.setState({
			quickSum: to ?? !this.state.quickSum
		}, () => {
			if (this.state.quickSum === true) {
				this.quickSumInterval = setInterval(() => {
					this.sumOne()
				}, 1)
			} else {
				console.log("clearing interval")
				clearInterval(this.quickSumInterval)
				this.quickSumInterval = null
			}
		})
	}

	sumOne = () => {
		this.setState({ count: this.state.count + 1 })
	}

	render() {
		return (
			<div className="exampleApp">
				<div className="display">
					<h1>{this.state.count}</h1>
				</div>
				<button
					onClick={this.sumOne}>
					+
				</button>
				<div className="actions">
					<div>
						<button onClick={() => this.toogleQuickSum()}>
							{this.state.quickSum ? "Stop" : "Start"} quick sum
						</button>
					</div>
					<div>
						<button onClick={() => window.location.reload()}>
							reload
						</button>
					</div>
				</div>
			</div>
		)
	}
}

export default CreateEviteApp(ExampleApp)