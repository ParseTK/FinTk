import React from 'react'

interface Props {
 onPortfolioDelete: (e: React.SyntheticEvent) => void;
 getPortfolioValue: string;
}

const DeletePortfolio = ({onPortfolioDelete, getPortfolioValue}: Props) => {
  return <div>
    <form onSubmit={onPortfolioDelete}>
        <input hidden={true} value={getPortfolioValue} />
        <button>X</button>
    </form>
  </div>
  
}

export default DeletePortfolio;