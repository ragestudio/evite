import React from 'react'
import { objectToArrayMap } from "@corenode/utils"

export default (props) => {
    const context = {}

    objectToArrayMap(props).forEach((prop) => {
        if (prop.key === "children") {
            return false
        }

        if (typeof prop.value === "function") {
            prop.value = prop.value()
        }

        context[prop.key] = prop.value
    })

    if (Array.isArray(props.children)) {
        return props.children.map((children) => {
            return React.cloneElement(children, { ...context })
        })
    }

    return React.cloneElement(props.children, { ...context })
}