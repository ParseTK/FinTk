import React, { JSX, useState, MouseEvent } from 'react';

interface Props {}

const Search: React.FC<Props> = (props: Props): JSX.Element => {
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
}

export default Search;