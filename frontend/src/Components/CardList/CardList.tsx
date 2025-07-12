import React, { JSX } from 'react'
import Card from '../Card/Card';
import { CompanySearch } from '../../company';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  getSearchResults: CompanySearch[];
  onPortfolioCreate: (e: React.SyntheticEvent) => void;
}

const CardList: React.FC<Props> = ({ getSearchResults, onPortfolioCreate }) => {
  return (
    <>
      {getSearchResults.length > 0 ? (
        getSearchResults.map((result) => (
          <Card id={result.symbol} key={result.symbol} getSearchResult={result} onPortfolioCreate={onPortfolioCreate}/>
        ))
      ) : (
        <p className="mb-3 mt-3 text-x1 font-semibold text-center md:text-xl">No results found.</p>
      )}
    </>
  );
};

export default CardList;