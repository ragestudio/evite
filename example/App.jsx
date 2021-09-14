// fixme: where tf is the window context?
global.window = {}

const {EviteSSRApp} = require("evite")

class App extends EviteSSRApp {
	testFile = require(fs).readFileSync(require("path").resolve(__dirname, "test.txt"), "utf8")

	initialization = () => {
		console.log(this.testFile)
	}

	render() {
		return <div>This render from server side</div>
	}
}

module.exports = App
