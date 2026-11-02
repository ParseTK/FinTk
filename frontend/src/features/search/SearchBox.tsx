import { BasicSearchForm } from "./BasicSearchForm";
import { Feature } from "@/components/ui/Feature";
import { SearchForm } from "./SearchForm";

interface SearchBoxProps {
  defaultValue?: string;
  size?: "md" | "lg";
}

/** The one place pages get a search field from: the enhanced one, or the plain fallback. */
export function SearchBox({ defaultValue, size }: SearchBoxProps) {
  return (
    <Feature flag="rich_search" fallback={<BasicSearchForm defaultValue={defaultValue} />}>
      <SearchForm defaultValue={defaultValue} size={size} />
    </Feature>
  );
}
