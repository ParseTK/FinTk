import React, { SyntheticEvent } from 'react'

interface Props{
onPortfolioCreate: (e: SyntheticEvent) => void;
symbol: string;
}

const AddPortfolio = ({onPortfolioCreate, symbol}: Props) => {
  return (
    <div className="flex flex-col items-center justify-end flex-1 space-x-4 space-y-2 md:flex-row md:space-y-0">
      <form onSubmit={onPortfolioCreate}>
        <input type="hidden" value={symbol} readOnly />
        <button
          type="submit"
          className="p-2 px-8 text-black bg-dark-blue rounded-lg hover:opacity-70 focus:outline-hidden transition-opacity"
        >
          Add to Portfolio
        </button>
      </form>
    </div>
  );
};

export default AddPortfolio;