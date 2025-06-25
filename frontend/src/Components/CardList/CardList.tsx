import React, { JSX } from 'react'
import Card from '../Card/Card';
import { CompanySearch } from '../../company';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  getSearchResults: CompanySearch[];
}

const CardList: React.FC<Props> = ({ getSearchResults }) => {
  return (
    <>
      {getSearchResults.length > 0 ? (
        getSearchResults.map((result) => (
          <Card id={result.symbol} key={result.symbol} getSearchResult={result} />
        ))
      ) : (
        <h1>No results found</h1>
      )}
    </>
  );
};

export default CardList;