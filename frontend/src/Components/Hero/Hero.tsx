import React from "react";
import hero from "./stonks.png";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section id="hero" className="bg-white">
      <div className="flex flex-col-reverse items-center gap-10 px-6 py-20 md:flex-row lg:gap-20 lg:px-24">
        {/* Text Content */}
        <div className="flex-1 text-center md:text-left space-y-8">
          <h1 className="text-4xl font-bold leading-tight lg:text-6xl">
            Financial data with no news.
          </h1>
          <p className="text-xl text-gray-500 lg:max-w-md">
            Search relevant financial documents without fear mongering and fake
            news.
          </p>
          <div>
            <Link
              to="/Search"
              className="inline-block rounded bg-light-green px-8 py-4 text-lg font-semibold text-white transition-opacity duration-300 hover:opacity-80"
            >
              Get Started
            </Link>
          </div>
        </div>

        {/* Hero Image */}
        <div className="flex-1 max-w-lg md:max-w-md lg:max-w-xl">
          <img
            className="w-full h-auto object-contain"
            src={hero}
            alt="Stonks Chart"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;