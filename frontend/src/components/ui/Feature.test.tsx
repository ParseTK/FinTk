import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Feature } from "./Feature";

afterEach(() => vi.unstubAllEnvs());

describe("Feature", () => {
  it("renders children when the flag is on and the fallback when it is off", () => {
    vi.stubEnv("FEATURE_NEWS", "true");
    const { rerender } = render(
      <Feature flag="news" fallback={<p>fallback</p>}>
        <p>new thing</p>
      </Feature>,
    );
    expect(screen.getByText("new thing")).toBeInTheDocument();

    vi.stubEnv("FEATURE_NEWS", "false");
    rerender(
      <Feature flag="news" fallback={<p>fallback</p>}>
        <p>new thing</p>
      </Feature>,
    );
    expect(screen.getByText("fallback")).toBeInTheDocument();
    expect(screen.queryByText("new thing")).not.toBeInTheDocument();
  });

  it("renders nothing by default when off and no fallback is given", () => {
    const { container } = render(
      <Feature flag="news">
        <p>new thing</p>
      </Feature>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
