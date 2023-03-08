import Core from "evite/src/core"

export default class ExampleCore extends Core {
    static refName = "ExampleCore"
    static namespace = "exampleCore"

    public = {
        test: () => {
            console.log("hello world, im a core!")
        },
        sum: this.sum
    }

    sum(a, b) {
        return a + b
    }
}