import {createClientEntry} from "evite/lib/client/index.jsx"

// fixme: where tf is the window context?
global.window = {}

class App extends EviteSSRModule {
	testFile = require(fs).readFileSync(require("path").resolve(__dirname, "test.txt"), "utf8")

	initialization = () => {
		console.log(this.testFile)
	}

	render() {
		return <div></div>
	}
}

export default createClientEntry(App, {routes})
