import {createEviteApp} from "evite"
import React from "react"

import "./index.less"

const testExtension = {
	key: "test",
	expose: [
		{
			initialization: [
				(self, main) => {
					main.appendToAppContext("setTest", () => {
						self.test = Math.random()
					})

					main.appendToWindowContext("setTest", self.setTest)

					console.log("Test extension initialized")
				}
			],
		},
	],
}

class ExampleApp extends React.Component {
	render() {
		return (
			<div>
				<div>
					<h2>Extensions</h2>
					<div>
						{this.mainContext.extensionsKeys.map(key => {
							return <div>{key}</div>
						})}
					</div>
					<hr />
				</div>
				
				{this.app.test}
			
				<div>GLOBAL STATE {this.props.globalState.count}</div>

				<button
					onClick={() => {
						this.props.setGlobalState({count: this.props.globalState.count + 1})
					}}>
					add count
				</button>
			</div>
		)
	}
}

export default createEviteApp(ExampleApp, {extensions: [testExtension], globalState: {count: 0}})