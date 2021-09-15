import { initializeEvite } from "evite"

// fixme: where tf is the window context?
global.window = {}

class App extends EviteApp() {
	render() {
		return <div> Evite APP! </div>
	}
}

export default initializeEvite(App)