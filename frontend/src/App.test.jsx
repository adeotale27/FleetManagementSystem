import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { api } from "./lib/api";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("./components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("./components/ui", () => ({
  Loader: () => <div>Loading</div>,
  ToastHost: () => null,
}));
jest.mock("./pages/SiteConsole", () => ({
  __esModule: true,
  default: ({ adminOnly }) => <div data-testid="site-console">{adminOnly ? "setup" : "dashboard"}</div>,
}));

describe("Booking setup route access", () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.setItem("fms_token", "test-token");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    localStorage.removeItem("fms_token");
    window.history.replaceState({}, "", "/");
    container.remove();
    jest.clearAllMocks();
  });

  const renderAs = async (role) => {
    api.get.mockResolvedValue({ data: { user: { role }, features: {}, tenant: {}, branding: {} } });
    window.history.replaceState({}, "", "/booking-setup");
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it("allows owners to open Booking Setup & Access directly", async () => {
    await renderAs("owner");
    expect(container.querySelector('[data-testid="site-console"]').textContent).toBe("setup");
  });

  it("redirects site managers away from Booking Setup & Access", async () => {
    await renderAs("site_manager");
    expect(container.querySelector('[data-testid="site-console"]').textContent).toBe("dashboard");
  });
});
