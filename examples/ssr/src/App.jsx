import React from "react"
import {createEviteApp} from "evite"

export default class ExampleApp extends createEviteApp() {
	state = {
		count: 0,
	}

	render() {
		return (
			<div>
				{this.state.count}
				<button
					onClick={() => {
						this.setState({count: (this.state.count += 1)})
					}}>
					add count
				</button>
			</div>
		)
	}
}