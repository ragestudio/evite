import React from "react"

export default (props) => {
    const context = {}

    Object.keys(props).forEach((key) => {
        if (key === "children") {
            return false
        }

        if (typeof props[key] === "function") {
            props[key] = props[key]()
        }

        context[key] = props[key]
    })

    if (Array.isArray(props.children)) {
        return props.children.map((children) => {
            return React.cloneElement(children, { ...context })
        })
    }

    return React.cloneElement(props.children, { ...context })
}