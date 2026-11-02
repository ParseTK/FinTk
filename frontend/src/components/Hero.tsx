import Image from "next/image";
import { SearchForm } from "./SearchForm";

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="bg-surface">
      <div className="flex flex-col-reverse items-center gap-10 px-6 py-20 md:flex-row lg:gap-20 lg:px-24">
        <div className="flex-1 space-y-8 text-center md:text-left">
          <h1 id="hero-heading" className="text-4xl leading-tight font-bold lg:text-6xl">
            Financial data with no news.
          </h1>
          <p className="text-fg-muted text-xl lg:max-w-md">
            Search relevant financial documents without fear mongering and fake news.
          </p>
          <div className="flex justify-center md:justify-start">
            <SearchForm size="lg" />
          </div>
        </div>
        <div className="max-w-lg flex-1 md:max-w-md lg:max-w-xl">
          <Image
            src="/images/stonks.jpg"
            alt="Line chart trending upward"
            width={270}
            height={187}
            className="h-auto w-full object-contain"
            priority
          />
        </div>
      </div>
    </section>
  );
}
