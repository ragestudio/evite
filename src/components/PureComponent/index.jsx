import React from "react"

// TODO
export default class EvitePureComponent extends React.Component {
    constructor(...args) {
        super(...args)
        this.eventBus = window.app.eventBus

        this._localEventsHandlers = {}
    }

    _loadBusEvents() {
        if (typeof this.handleBusEvents === "object") {
            Object.keys(this.handleBusEvents).forEach((event) => {
                this.eventBus.on(event, this.handleBusEvents[event])
            })
        }
    }

    _unloadBusEvents() {
        if (typeof this.handleBusEvents === "object") {
            Object.keys(this.handleBusEvents).forEach((event) => {
                this.eventBus.off(event, this.handleBusEvents[event])
            })
        }
    }
}