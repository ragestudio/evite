import { CreateEviteApp } from "evite"
import React from "react"

import "./index.less"

const testExtension = {
	key: "test",
	expose: [
		{
			initialization: [
				(self, main) => {
					main.setToAppContext("setTest", () => {
						self.test = Math.random()
					})

					main.setToWindowContext("setTest", self.setTest)

					console.log("Test extension initialized")
				}
			],
		},
	],
}

const asyncExtension = {
	key: "asynchronousContextLoad",
	expose: [
		{
			initialization: [
				async (self, main) => {
					await new Promise(resolve => setTimeout(resolve, 2000))
				}
			],
		},
	],
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

	static initialize() {
		return async (app, main, self) => {
			console.log(app)
			console.log(main)
			console.log(self)
		}
	}

	static staticRenders = {
		initialization: () => {
			return <div>
				Starting in 2 seconds
			</div>
		}
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
				</div>
			</div>
		)
	}
}

export default CreateEviteApp(ExampleApp, { extensions: [testExtension, asyncExtension], })