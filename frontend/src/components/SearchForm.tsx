/** Plain GET form: works without JS, is shareable by URL, and the results render on the server. */
export function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/search"
      role="search"
      className="bg-brand-dark mx-auto flex max-w-4xl gap-3 rounded-lg p-6"
    >
      <label htmlFor="search-input" className="sr-only">
        Search companies
      </label>
      <input
        id="search-input"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search companies"
        maxLength={64}
        className="flex-1 rounded-lg bg-white p-3 text-black placeholder-gray-600"
      />
      <button
        type="submit"
        className="rounded-lg bg-white px-6 font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Search
      </button>
    </form>
  );
}
