import React from "react"

import "./index.less"

export class DebugWindow extends React.Component {
    renderObj = (obj) => {
        return Object.entries(obj).map(([key, value]) => {
            return <div className="entry" key={key}>
                <div className="key">
                    <span>{key}</span>
                </div>
                <div className="value">
                    <span>{JSON.stringify(value)}</span>
                </div>
            </div>
        })
    }

    render() {
        return <>
            <div className="section" key="state" >
                <div className="label">
                    <h4>State</h4>
                </div>
                <div className="content">
                    {
                        this.renderObj(this.props.cntx.state)
                    }
                </div>
            </div>
        </>
    }
}