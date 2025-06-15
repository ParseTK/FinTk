
import logo from './logo.svg';
import './App.css';
import CardList from './Components/CardList/CardList';
import React, { JSX, useState, MouseEvent } from 'react';
import Search from './Components/Search/Search';
import { CompanySearch } from './company';

function App() {
  // Define the Props interface for the Search component
  interface Props {}
  
      const [getSearch, setSearch] = useState<string>("");

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          setSearch(e.target.value);
          console.log(e);
      };
  
    const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        console.log(e);
      }
    return (
      <div>
          <input value={getSearch} onChange={(e) => handleChange(e)}> 
          </input>
          <button onClick={(e) => onClick(e)} />
      </div>
    )
  return (
    <div className="App">
      <Search onClick={onClick} getSearch={getSearch} handleChange={handleChange}/>
      <CardList />
    </div>
  );
}

export default App;
