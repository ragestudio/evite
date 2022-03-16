export default (_this, self, contexts) => class {
    initializer() {
        this.contexts = {
            ...contexts,
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