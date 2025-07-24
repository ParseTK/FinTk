import React, { JSX, useState, MouseEvent } from 'react';

interface Props {
  onSearchSubmit: (e: React.FormEvent) => void;
  getSearch: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Search: React.FC<Props> = ({ onSearchSubmit, getSearch, handleSearchChange }) => {
  return (
    <section className="relative bg-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
      <form
           className="form relative flex flex-col w-full p-10 space-y-4 bg-blue-500 rounded-lg md:flex-row md:space-y-0 md:space-x-3"
           onSubmit={onSearchSubmit}
      >
      <input
           className="flex-1 p-3 border-2 rounded-lg bg-white text-black placeholder-gray-500 focus:outline-none"
           id="search-input"
           placeholder="Search companies"
           value={getSearch}
           onChange={handleSearchChange}
      />
      </form>
      </div>
    </section>
  );
};

export default Search;