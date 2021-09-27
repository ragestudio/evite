// TODO: Override config initialization

function getDefaultPlugins() {
    return [
        require("@vitejs/plugin-react-refresh")(),
        require('@rollup/plugin-node-resolve').default({
            browser: true
        }),
    ]
}

module.exports = {
    getDefaultPlugins
}