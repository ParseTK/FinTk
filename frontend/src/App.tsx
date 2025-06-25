import './App.css';
import CardList from './Components/CardList/CardList';
import React, { useState } from 'react';
import Search from './Components/Search/Search';
import { CompanySearch } from './company';
import { searchCompanies } from './api';

function App() {
  const [getSearch, setSearch] = useState<string>("");
  const [getSearchResults, setSearchResults] = useState<CompanySearch[]>([]);
  const [getServerError, setServerError] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    console.log("Search input changed:", e.target.value);
  };

  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
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
      <Search onClick={onClick} getSearch={getSearch} handleChange={handleChange} />
      <CardList getSearchResults={getSearchResults} />
    </div>
  );
}

export default App;