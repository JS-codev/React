import { calculateInvestmentResults, formatter } from '../util/investment.js'; //import the calcuated data and formatter to round off significant figures

export default function Results({ input }) { //takes in UserInput values from App.jsx
    const resultsData = calculateInvestmentResults(input); //place values into investment.js to calculates investment results
    const initialInvestment = resultsData[0].valueEndOfYear - resultsData[0].interest - resultsData[0].annualInvestment; //Calculates & find the user's first input for initial investment for later calculations

    //Table results 
    return (
        <table id='result'>
            <thead>
                <tr> 
                    <th>Year</th>
                    <th>Investment Value</th>
                    <th>Interest (Year)</th>
                    <th>Total Interest</th>
                    <th>Invested Capital</th>
                </tr>
            </thead>
            <tbody>
                {resultsData.map(yearData => {
                    const totalInterest = yearData.valueEndOfYear - yearData.annualInvestment * yearData.year - initialInvestment;
                    const totalAmountInvested = yearData.valueEndOfYear - totalInterest;

                    return (
                        <tr key={yearData.year}>
                            <td>{yearData.year}</td>
                            {/* Use formatter.format() to display the investment value to 2 decimal places */}
                            <td>{formatter.format(yearData.valueEndOfYear)}</td>
                            <td>{formatter.format(yearData.interest)}</td>
                            <td>{formatter.format(totalInterest)}</td>
                            <td>{formatter.format(totalAmountInvested)}</td> {/* Ensure only necessary columns */}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
