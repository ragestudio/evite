import path from "path"
import { defineConfig } from "vite"

import react from "@vitejs/plugin-react"

const aliases = {
    "~": __dirname,
    "~/": `${path.resolve(__dirname, "src")}/`,
    "@src": path.join(__dirname, "src"),
    cores: path.join(__dirname, "src/cores"),
    constants: path.join(__dirname, "constants"),
    config: path.join(__dirname, "config"),
    extensions: path.resolve(__dirname, "src/extensions"),
    pages: path.join(__dirname, "src/pages"),
    styles: path.join(__dirname, "src/styles"),
    components: path.join(__dirname, "src/components"),
    models: path.join(__dirname, "src/models"),
    utils: path.join(__dirname, "src/utils"),
    layouts: path.join(__dirname, "src/layouts"),
    hooks: path.join(__dirname, "src/hooks"),
}

export default defineConfig({
    plugins: [
        react(),
    ],
    resolve: {
        alias: aliases,
    },
    server: {
        fs: {
            allow: [".."]
        }
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
            }
        }
    },
    build: {
        target: "esnext",
    }
})