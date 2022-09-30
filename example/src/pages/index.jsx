import React from "react"

export default (props) => {
    const [count, setCount] = React.useState(0)
    const [quickSum, setQuickSum] = React.useState(false)

    let quickSumInterval = null

    const toogleQuickSum = (to = !quickSum) => {
        setQuickSum(to)

        if (to === true) {
            quickSumInterval = setInterval(() => {
                sumOne()
            }, 1)
        } else {
            console.log("clearing interval")
            clearInterval(quickSumInterval)
            quickSumInterval = null
        }
    }

    const sumOne = () => {
        setCount(count + 1)
    }

    return <div>
        <div className="display">
            <h1>{count}</h1>
        </div>
        <button
            onClick={sumOne}>
            +
        </button>
        <div className="actions">
            <div>
                <button onClick={() => toogleQuickSum()}>
                    {quickSum ? "Stop" : "Start"} quick sum
                </button>
            </div>
            <div>
                <button onClick={() => window.location.reload()}>
                    reload
                </button>
            </div>
        </div>
    </div>
}