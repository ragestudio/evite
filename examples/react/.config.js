module.exports = (config) => {
    config.css = {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
                // modifyVars: lessToJS(
                //     fs.readFileSync(path.resolve(__dirname, "./config/variables.less"), "utf8")
                // ),
            }
        }
    }

    return config
}