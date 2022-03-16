import { Observable } from "object-observer"

export default class EviteExtension {
    constructor(appContext, mainContext) {
        this.appContext = appContext
        this.mainContext = mainContext

        this.promises = []

        return this
    }

    initializer() {
        return new Promise(async (resolve, reject) => {
            if (Array.isArray(this.depends)) {
                this.depends.forEach((dependency) => {
                    const dependencyPromise = new Promise((resolve, reject) => {
                        Observable.observe(this.mainContext.ATTACHED_EXTENSIONS, (changes) => {
                            changes.forEach((change) => {
                                Array.from(change.object).includes(dependency) && resolve()
                            })
                        })
                    })

                    this.promises.push(dependencyPromise)
                })
            }

            await Promise.all(this.promises)

            return resolve()
        })
    }
}