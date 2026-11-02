import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

/**
 * Plain search form with no client JavaScript. It is what visitors get when the `rich_search` flag
 * is off, so search keeps working while the enhanced field is being reworked.
 */
export function BasicSearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  const inputId = useId();
  return (
    <form action="/search" role="search" className="flex w-full max-w-2xl gap-2">
      <label htmlFor={inputId} className="sr-only">
        Search companies
      </label>
      <Input
        id={inputId}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search companies or tickers"
        maxLength={64}
        autoComplete="off"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
