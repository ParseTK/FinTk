/** Plain GET form: works without JS, is shareable by URL, and the results render on the server. */
export function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form
      action="/search"
      role="search"
      className="bg-brand mx-auto flex max-w-4xl gap-3 rounded-lg p-6"
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
        className="bg-surface text-fg placeholder-fg-muted focus-visible:outline-on-accent flex-1 rounded-lg p-3"
      />
      <button
        type="submit"
        className="bg-surface text-fg focus-visible:outline-on-accent rounded-lg px-6 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Search
      </button>
    </form>
  );
}
