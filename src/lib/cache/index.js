import path from 'path'
import fs from 'fs'

class CacheObject {
    constructor(key) {
        this.root = global.cachePath ?? path.join(__dirname, ".cache")
        this.output = path.join(this.root, key)

        if (!fs.existsSync(this.root)) {
            fs.mkdirSync(this.root)
        }

        if (!fs.lstatSync(this.root).isDirectory()) {
            throw new Error(`Cache path is not an valid root directory`)
        }

        return this
    }

    createWriteStream = () => {
        return fs.createWriteStream(this.output)
    }

    createReadStream = () => {
        return fs.createReadStream(this.output)
    }

    write = (content) => {
        fs.writeFileSync(this.output, content, { encoding: "utf-8" })
        return this
    }
}

export default CacheObject