import React from 'react'

interface Props {
 onPortfolioDelete: (e: React.SyntheticEvent) => void;
 getPortfolioValue: string;
}

const DeletePortfolio = ({onPortfolioDelete, getPortfolioValue}: Props) => {
  return (
    <div>
      <form onSubmit={onPortfolioDelete}>
        <input type="hidden" value={getPortfolioValue} readOnly />
        <button className="block w-full py-3 text-white duration-200 border-2 rounded-lg bg-red-500 hover:text-red-500 hover:bg-white border-red-500 transition-colors">
          X
        </button>
      </form>
    </div>
  );
}

export default DeletePortfolio;