import React from 'react';
import "./Card.css";

// Provides labels - spell checks and data validation

interface Props 
{
  companyName: string;
  ticker: string;
  price: number;
}

const Card = (props: Props) => {
  return (
    <div className="card">
        <img src="https://media.istockphoto.com/id/185262648/photo/red-apple-with-leaf-isolated-on-white-background.jpg?s=612x612&w=is&k=20&c=yunprkRxHgH8YuA8hIhLeKtY6juSYa2rG2zYWeIY34I="
        />
        <div className="details">   
            <h2>APPL</h2>
            <p>$110</p>
        </div>
        <p className="info">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
    </div>
  );
}

export default Card