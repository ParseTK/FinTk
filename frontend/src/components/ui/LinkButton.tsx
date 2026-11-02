import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonStyles, type ButtonStyleOptions } from "./button-styles";

export interface LinkButtonProps
  extends ComponentProps<typeof Link>, Omit<ButtonStyleOptions, "className"> {}

/** A navigation link styled as a button. Use Button for actions, LinkButton for going somewhere. */
export function LinkButton({ variant, size, fullWidth, className, ...rest }: LinkButtonProps) {
  return <Link className={buttonStyles({ variant, size, fullWidth, className })} {...rest} />;
}
