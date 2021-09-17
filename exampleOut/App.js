"use strict";const _jsxFileName = "/Users/srgooglo/repos/evite/example/App.jsx";const { initializeEvite } = require('evite')

// fixme: where tf is the window context?
global.window = {}

class App extends EviteApp() {
	render() {
		return React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8}}, " Evite APP! "   )
	}
}

module.exports = initializeEvite(App)