module.exports = (config) => {
    config.css = {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
            }
        }
    }

    return config
}