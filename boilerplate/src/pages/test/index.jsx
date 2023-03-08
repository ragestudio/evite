import React from "react"

// create a calculator component, using 2 input fields and a button
// when the button is clicked, the sum of the 2 input fields is displayed
export default (props) => {
    const [firstNumber, setFirstNumber] = React.useState(0)
    const [secondNumber, setSecondNumber] = React.useState(0)

    const [result, setResult] = React.useState(null)

    const calculate = () => {
        const result = app.cores.exampleCore.sum(Number(firstNumber), Number(secondNumber))

        setResult(result)
    }

    return <div>
        <h1>Calculator (Using Core)</h1>

        {
            result && <div>
                <h2>Result: {result}</h2>
            </div>
        }

        <div>
            <input type="number" value={firstNumber} onChange={(e) => setFirstNumber(e.target.value)} />
            <input type="number" value={secondNumber} onChange={(e) => setSecondNumber(e.target.value)} />
            <button onClick={calculate}>Calculate</button>
        </div>
    </div>
}