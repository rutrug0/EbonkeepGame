import { render, screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";

vi.mock("../src/app/AppShell", () => ({
  AppShell: () => <div data-testid="app-shell" />
}));

import { App } from "../src/App";

describe("App entrypoint", () => {
  it("delegates rendering to AppShell", () => {
    render(<App />);
    expect(screen.getByTestId("app-shell")).not.toBeNull();
  });
});
