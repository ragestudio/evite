/*
**  Aggregation -- Aggregation of Base Class and Mixin Classes
**  Copyright (c) 2015-2021 Dr. Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

export default (base, ...mixins) => {
    let aggregate = class __Aggregate extends base {
        constructor(...args) {
            super(...args)

            mixins.forEach((mixin) => {
                if (typeof mixin.prototype.initializer === "function") {
                    mixin.prototype.initializer.apply(this, args)
                }
            })

            if (typeof base.initialize === "function") {
                base.initialize.apply(this, args)
            }

            if (typeof base.windowContext === "function") {
                const returnedValues = base.windowContext.apply(this)
                
                if (typeof returnedValues === "object") {
                    const keys = Object.keys(returnedValues)

                    keys.forEach((key) => {
                        this.contexts.window[key] = returnedValues[key]
                    })
                }
            }

            if (typeof base.appContext === "function") {
                const returnedValues = base.appContext.apply(this)

                if (typeof returnedValues === "object") {
                    const keys = Object.keys(returnedValues)

                    keys.forEach((key) => {
                        this.contexts.app[key] = returnedValues[key]
                    })
                }
            }
        }
    }

    let copyProps = (target, source) => {
        Object.getOwnPropertyNames(source)
            .concat(Object.getOwnPropertySymbols(source))
            .forEach((prop) => {
                if (prop.match(/^(?:initializer|constructor|prototype|arguments|caller|name|bind|call|apply|toString|length)$/)) {
                    return
                }
                Object.defineProperty(target, prop, Object.getOwnPropertyDescriptor(source, prop))
            })
    }

    mixins.forEach((mixin) => {
        copyProps(aggregate.prototype, mixin.prototype)
        copyProps(aggregate, mixin)
    })

    return aggregate
}