import { EviteRuntime } from "evite"

import React from "react"

import "./index.less"

class ExampleApp extends React.Component {
	static staticRenders = {
		Initialization: () => {
			return <div>
				Starting...
			</div>
		}
	}

	static initialize() {
		console.log(this)
	}

	componentDidMount = () => {
		console.log(this)
	}

	render() {
		return <div className="exampleApp">
			
		</div>
	}
}

export default new EviteRuntime(ExampleApp)