import clsx from "clsx";
import type { ComponentProps } from "react";

const SIZES = { narrow: "max-w-3xl", default: "max-w-6xl", wide: "max-w-7xl" } as const;

export interface ContainerProps extends ComponentProps<"div"> {
  size?: keyof typeof SIZES;
}

/** Centers page content with consistent side padding. The header and footer are full width. */
export function Container({ size = "default", className, ...rest }: ContainerProps) {
  return (
    <div
      className={clsx("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className)}
      {...rest}
    />
  );
}
