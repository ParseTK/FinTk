import React, { JSX, useState, MouseEvent } from 'react';

interface Props {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  getSearch: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Search: React.FC<Props> = ({ onClick, getSearch, handleChange }) => {
  return (
    <div>
      <input
        type="text"
        value={getSearch}
        onChange={handleChange}
        placeholder="Search for a company..."
      />
      <button onClick={onClick}>Search</button>
    </div>
  );
};

export default Search;