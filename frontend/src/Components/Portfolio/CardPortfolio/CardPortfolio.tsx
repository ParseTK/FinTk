import React from 'react'
import DeletePortfolio from '../DeletePortfolio/DeletePortfolio';

interface Props {
    getPortfolioValue: string;
    onPortfolioDelete: (e: React.SyntheticEvent) => void;
}

const CardPortfolio = ({ getPortfolioValue, onPortfolioDelete }: Props) => {
  return <>
        <h4>    
            {getPortfolioValue}
        </h4>
        <DeletePortfolio 
            onPortfolioDelete={onPortfolioDelete}
            getPortfolioValue={getPortfolioValue}
        />
        
    </>;
};

export default CardPortfolio;
