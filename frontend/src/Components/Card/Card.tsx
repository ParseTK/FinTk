import React, { JSX } from 'react';
import { CompanySearch } from '../../company';
import AddPortfolio from '../Portfolio/AddPortfolio/AddPortfolio';
import { Link } from 'react-router';



interface Props 
{
id: string;
getSearchResult: CompanySearch;
onPortfolioCreate: (e: React.SyntheticEvent) => void;
}

const Card : React.FC<Props> = ({ id, getSearchResult, onPortfolioCreate }: 
  Props): JSX.Element => {
  return (
    <div
      className="flex flex-col items-center justify-between w-full p-6 bg-slate-100 rounded-lg md:flex-row"
      key={id}
      id={id}
    >
      <Link to={`/company/${getSearchResult.symbol}`} className="font-bold text-center text-black md:text-left">
        {getSearchResult.name} ({getSearchResult.symbol})
      </Link> 
      <p className="text-black">{getSearchResult.currency}</p>
      <p className="font-bold text-black">
        {getSearchResult.exchangeShortName} - {getSearchResult.stockExchange}
      </p>
      <AddPortfolio
        onPortfolioCreate={onPortfolioCreate}
        symbol={getSearchResult.symbol}
      />
    </div>
  );
}

export default Card;