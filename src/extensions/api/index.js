import config from 'config'
import cloudlinkClient from "@ragestudio/cloudlink/dist/client"
import { notification } from "antd"
import * as session from "core/models/session"

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
                    const getSessionContext = () => {
                        const obj = {}
                        const thisSession = session.get()

                        if (typeof thisSession !== "undefined") {
                            obj.headers = {
                                Authorization: `Bearer ${thisSession ?? null}`,
                            }
                        }

                        return obj
                    }

                    return cloudlinkClient
                        .createInterface(config.api.address, getSessionContext)
                        .catch((err) => {
                            notification.error({
                                message: `Cannot connect with the API`,
                                description: err.toString(),
                            })
                            console.error(`CANNOT BRIDGE API > ${err}`)
                        })
                },
            },
        },
    ],
}