import React from "react";
import logo from "./logo.png";
import { Link } from "react-router";


interface Props {}

const Navbar = (props: Props) => {
  return (
    <nav className="relative container mx-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-20">
          <Link to="/">
          <img src={logo} alt="Logo" />
          </Link>
          <div className="font-bold lg:flex">
            <Link to="/Search" className="text-black hover:text-dark-blue">
              Search
            </Link>
          </div>
        </div>
        <div className=" md:flex items-center space-x-6 text-black">
  <div className="hover:text-dark-blue cursor-pointer">Login</div>
  <a
    href="#"
    className="px-8 py-3 font-bold rounded text-white bg-light-blue hover:opacity-70 transition-opacity"
  >
    Signup
  </a>
</div>
      </div>
    </nav>
  );
};

export default Navbar;