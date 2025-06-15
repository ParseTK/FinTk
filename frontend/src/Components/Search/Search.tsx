import React, { JSX, useState, MouseEvent } from 'react';

interface Props {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  getSearch: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const Search: React.FC<Props> = ({onClick, getSearch, handleChange}: Props): JSX.Element => {
  return (
    <div>
        <input value={getSearch} onChange={(e) => handleChange(e)}> 
        </input>
        <button onClick={(e) => onClick(e)} />
    </div>
  )
}


export default Search;