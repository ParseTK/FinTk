import React from 'react'
import DeletePortfolio from '../DeletePortfolio/DeletePortfolio';
import { Link } from 'react-router-dom';

interface Props {
    getPortfolioValue: string;
    onPortfolioDelete: (e: React.SyntheticEvent) => void;
}

const CardPortfolio = ({ getPortfolioValue, onPortfolioDelete }: Props) => {
  return (
    <div className="flex flex-col w-full p-8 space-y-4 text-center rounded-lg shadow-lg md:w-1/3">
      <Link to={`/company/${getPortfolioValue}`} className="pt-6 text-xl font-bold">{getPortfolioValue}</Link>
      <DeletePortfolio
        getPortfolioValue={getPortfolioValue}
        onPortfolioDelete={onPortfolioDelete}
      />
    </div>
  );
};

export default CardPortfolio;
