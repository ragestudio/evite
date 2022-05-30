import React from "react"

export default (props) => {
    return <div className="__eviteCrash">
        <h1>Oops!</h1>
        <p>Something went wrong, the application has a fatal crash.</p>

        <pre>
            {props.crash.message}
        </pre>

        <div className="__eviteCrash, description">
            <code>
                {props.crash.details}
            </code>
        </div>
    </div>
}