import './App.css';
import CardList from './Components/CardList/CardList';
import React, { SyntheticEvent, useState } from 'react';
import Search from './Components/Search/Search';
import { CompanySearch } from './company';
import { searchCompanies } from './api';
import ListPortfolio from './Components/Portfolio/ListPortfolio/ListPortfolio';
import Navbar from './Components/Navbar/Navbar';
import Hero from './Components/Hero/Hero';

function App() {
  const [getSearch, setSearch] = useState<string>("");
  const [getPortfolioValues, setPortfolioValues] = useState<string[]>([]);
  const [getSearchResults, setSearchResults] = useState<CompanySearch[]>([]);
  const [getServerError, setServerError] = useState<string>("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    console.log("Search input changed:", e.target.value);
  };

  const onPortfolioCreate = (e: any) => {
    e.preventDefault();
    const existingPortfolio = getPortfolioValues.find((value) => value === e.target[0].value);
    if (existingPortfolio) return; // Prevent adding duplicates
    const updatedPortfolio = [...getPortfolioValues, e.target[0].value];
    setPortfolioValues(updatedPortfolio);
    console.log("Portfolio values updated:", updatedPortfolio);
    

    console.log("Portfolio creation triggered");
    // Handle portfolio creation logic here
  };

  const onPortfolioDelete = (e: any) => {
    e.preventDefault();
    const removedPortfolio = getPortfolioValues.filter((value) => {
      return value !== e.target[0].value;
    });
    setPortfolioValues(removedPortfolio);
    console.log("Portfolio values after deletion:", removedPortfolio);
  }
  
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
      <Navbar />
      <Hero />
      {getServerError && <div className="error">Error: {getServerError}</div>}
      <Search 
        onSearchSubmit={onSearchSubmit}
        getSearch={getSearch} 
        handleSearchChange={handleSearchChange}   
      />
      <ListPortfolio 
        getPortfolioValues={getPortfolioValues} 
        onPortfolioDelete={onPortfolioDelete}/>
      <CardList 
        getSearchResults={getSearchResults} 
        onPortfolioCreate={onPortfolioCreate} />
    </div>
  );
}

export default App;