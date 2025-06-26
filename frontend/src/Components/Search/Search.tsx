import React, { JSX, useState, MouseEvent } from 'react';

interface Props {
  onSearchSubmit: (e: React.FormEvent) => void;
  getSearch: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Search: React.FC<Props> = ({ onSearchSubmit, getSearch, handleSearchChange }) => {
  return (
    <>  
    <form onSubmit={onSearchSubmit}>
      <input value={getSearch} onChange={handleSearchChange}/>
    </form>
    </>
  );
};

export default Search;