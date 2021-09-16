"use strict";const _jsxFileName = "example/App.jsx";Object.defineProperty(exports, "__esModule", {value: true});// fixme: where tf is the window context?
global.window = {}

const {EviteSSRApp} = require("evite")

 class App extends EviteSSRApp {constructor(...args) { super(...args); App.prototype.__init.call(this); }

	__init() {this.initialization = async () => {
		this.testFile = require("fs").readFileSync(require("path").resolve(__dirname, "file.txt"), "utf8")

		console.log("testing initialization")
		console.log(this.testFile)
	}}

	render() {
		return React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}, "This render from server side"    )
	}
} exports.default = App;
