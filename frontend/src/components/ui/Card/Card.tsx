import clsx from "clsx";
import type { ElementType, HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Pick the element that fits the context: `li` inside a list, `article` for standalone content. */
  as?: "div" | "section" | "article" | "li" | "aside";
}

export function Card({ as = "div", className, ...rest }: CardProps) {
  const Tag: ElementType = as;
  return (
    <Tag
      className={clsx("border-border bg-surface-raised rounded-xl border p-6", className)}
      {...rest}
    />
  );
}
