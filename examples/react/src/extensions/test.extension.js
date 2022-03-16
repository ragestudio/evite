import { Extension } from "evite"

export default class TestExtension extends Extension {
    initializers = [
        async () => {
            console.log("Testing extensions v2")
        }
    ]
}
