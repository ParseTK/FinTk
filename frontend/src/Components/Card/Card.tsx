import React, { JSX } from 'react';
import "./Card.css";
import { CompanySearch } from '../../company';
import AddPortfolio from '../Portfolio/AddPortfolio/AddPortfolio';

// Provides labels - spell checks and data validation

interface Props 
{
id: string;
getSearchResult: CompanySearch;
onPortfolioCreate: (e: React.SyntheticEvent) => void;
}

const Card : React.FC<Props> = ({ id, getSearchResult, onPortfolioCreate }: 
  Props): JSX.Element => {
  return (
    <div className="card">
        <img alt="Company Logo"
        />
        <div className="details">   
            <h2>{getSearchResult.name} ({getSearchResult.symbol})</h2>
            <p>{getSearchResult.currency}</p>
        </div>
        <p className="info">
            {getSearchResult.exchangeShortName} - {getSearchResult.stockExchange}
        </p>
        <AddPortfolio onPortfolioCreate={onPortfolioCreate} symbol={getSearchResult.symbol}/>
    </div>
  );
}

export default Card