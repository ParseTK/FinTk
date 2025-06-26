import React, { SyntheticEvent } from 'react'
import CardPortfolio from '../CardPortfolio/CardPortfolio';

interface Props {
    getPortfolioValues: string[];
    onPortfolioDelete: (e: SyntheticEvent) => void;
}

const ListPortfolio = ({getPortfolioValues, onPortfolioDelete}: Props) => 
{
  return (
        <>
            <h3>My portfolio</h3>
            <ul>
                {getPortfolioValues.map((getPortfolioValue) => {
                        return <CardPortfolio getPortfolioValue={getPortfolioValue} onPortfolioDelete={onPortfolioDelete}/>

                    })} 
            </ul>
        </>
    );  
}

export default ListPortfolio;