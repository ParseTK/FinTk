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
    console.log("Search button clicked with query:", getSearch);
    const result = await searchCompanies(getSearch);
    if (typeof result === 'string') {
      console.error("Error from API:", result);
      setServerError(result);
    } else if (Array.isArray(result.data)) {
      console.log("Search results:", result.data);
      setSearchResults(result.data);
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