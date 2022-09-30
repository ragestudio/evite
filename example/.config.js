module.exports = (config = {}) => {
    config.css = {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
            }
        }
    }

    config.resolve = {}

    config.resolve.alias = {
        "~": __dirname
    }

    return config
}