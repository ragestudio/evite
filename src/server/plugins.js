// TODO: Override config initialization

function getDefaultPlugins() {
    return [
        //require( "vite-plugin-require").default(),
        require("@vitejs/plugin-react-refresh"),
        require('@rollup/plugin-node-resolve').default({
            extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
        }),
    ]
}

module.exports = {
    getDefaultPlugins
}