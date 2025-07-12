import React from 'react'
import DeletePortfolio from '../DeletePortfolio/DeletePortfolio';

interface Props {
    getPortfolioValue: string;
    onPortfolioDelete: (e: React.SyntheticEvent) => void;
}

const CardPortfolio = ({ getPortfolioValue, onPortfolioDelete }: Props) => {
  return (
    <div className="flex flex-col w-full p-8 space-y-4 text-center rounded-lg shadow-lg md:w-1/3">
      <p className="pt-6 text-xl font-bold">{getPortfolioValue}</p>
      <DeletePortfolio
        getPortfolioValue={getPortfolioValue}
        onPortfolioDelete={onPortfolioDelete}
      />
    </div>
  )
};

export default CardPortfolio;
