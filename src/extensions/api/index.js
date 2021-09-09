import config from 'config'
import cloudlinkClient from "@ragestudio/cloudlink/dist/client"

export default {
    key: "apiBridge",
    expose: [
        {
            attachToInitializer: [
                async (self) => {
                    const bridge = await self.createBridge()
                    self.apiBridge = bridge

                    self.appendToApp("apiBridge", Object.freeze(self.apiBridge))
                },
            ],
            self: {
                createBridge: async () => {
                    const getContext = async () => {
                        let context = Object()

                        if (typeof self.onGetContext === "function") {
                            const returnedContext = await self.onGetContext()

                            // this would need some override method
                            context = { ...context, ...returnedContext }
                        }

                        if (typeof self.onGetSessionContext === "function") {
                            const sessionContext = await self.onGetSessionContext()

                            if (typeof sessionContext.bearer === "string") {
                                context.headers = {
                                    Authorization: `Bearer ${sessionContext.bearer ?? null}`,
                                }
                            }
                        }

                        return context
                    }

                    return cloudlinkClient
                        .createInterface(config.api.address, getContext)
                        .catch((err) => {
                            self.eventBus("api_connection_error", err)
                            console.error(`CANNOT BRIDGE API > ${err}`)
                        })
                },
            },
        },
    ],
}