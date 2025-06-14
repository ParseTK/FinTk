import React, { JSX, useState } from 'react';

interface Props {}

const Search: React.FC<Props> = (props: Props): JSX.Element => {
    const [getSearch, setSearch] = useState<string>("");
    const onClick = (e: any) => {
        setSearch(e.target.value);
        console.log(e);
    }
  return (
    <div>
        <input value={getSearch} onChange={(e) => onClick(e)}> 

        </input>
    </div>
  )
}

export default Search;