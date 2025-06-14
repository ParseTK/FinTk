import React from 'react'
import Card from '../Card/Card';

interface Props {}

const CardList = (props: Props) => {
  return (
    <div>
        <Card companyName="Apple" ticker="AAPL" price={150} />
        <Card companyName="Microsoft" ticker="MSFT" price={300} />
        <Card companyName="Google" ticker="GOOGL" price={2800} />
        <Card companyName="Amazon" ticker="AMZN" price={3400} />
        <Card companyName="Tesla" ticker="TSLA" price={700} />
    </div>
  )
}

export default CardList;