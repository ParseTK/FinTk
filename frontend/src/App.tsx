import './App.css';
import CardList from './Components/CardList/CardList';
import React, { SyntheticEvent, useState } from 'react';
import Search from './Components/Search/Search';
import { CompanySearch } from './company';
import { searchCompanies } from './api';

function App() {
  const [getSearch, setSearch] = useState<string>("");
  const [getSearchResults, setSearchResults] = useState<CompanySearch[]>([]);
  const [getServerError, setServerError] = useState<string>("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    console.log("Search input changed:", e.target.value);
  };

  const onPortfolioCreate = (e: React.SyntheticEvent) => {
    e.preventDefault();
    console.log("Portfolio creation triggered");
    // Handle portfolio creation logic here
  };
  
  const onSearchSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    console.log("Search button clicked with query:", getSearch);

    const result = await searchCompanies(getSearch); // Call the API
    if (typeof result === "string" && result.length === 0) {
      console.error("No results found or error occurred");
      setServerError("No results found or error occurred");
      setSearchResults([]); // Clear previous results
    } else {
      console.log("Search results:", result);
      setServerError(""); // Clear any previous error
      setSearchResults(Array.isArray(result) ? result : []); // Ensure result is an array or set empty array
    }
  };

  return (
    <div className="App">
      {getServerError && <div className="error">Error: {getServerError}</div>}
      <Search onSearchSubmit={onSearchSubmit} getSearch={getSearch} handleSearchChange={handleSearchChange} />
      <CardList getSearchResults={getSearchResults} onPortfolioCreate={onPortfolioCreate}/>
    </div>
  );
}

export default App;