export default (_this, self) => class {
    initializer() {
        this.contexts = {
            app: _this.appContext.getProxy(),
            main: _this.mainContext.getProxy(),
            window: _this.windowContext,
        }

        this.self = self
        this.eventBus = this.contexts.main.eventBus

        if (typeof self.eventsHandlers === "object") {
            Object.keys(self.eventsHandlers).forEach((event) => {
                this.eventBus.on(event, self.eventsHandlers[event].bind(this))
            })
        }
    }
}