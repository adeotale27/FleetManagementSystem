import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { api } from "./lib/api";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("./lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("./lib/realtime", () => ({ startDataSync: jest.fn() }));
jest.mock("./components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("./components/ui", () => ({
  Loader: () => <div>Loading</div>,
  ToastHost: () => null,
  toast: jest.fn(),
}));
jest.mock("./pages/SiteConsole", () => ({
  __esModule: true,
  default: ({ adminOnly }) => <div data-testid="site-console">{adminOnly ? "setup" : "dashboard"}</div>,
}));
jest.mock("./pages/BookingFinance", () => ({
  __esModule: true,
  default: () => <div data-testid="booking-finance">booking finance</div>,
}));
jest.mock("./pages/BookingReports", () => ({
  __esModule: true,
  default: () => <div data-testid="booking-reports">booking reports</div>,
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

  const renderAs = async (role, path = "/booking-setup") => {
    api.get.mockResolvedValue({ data: { user: { role }, features: {}, tenant: {}, branding: {} } });
    window.history.replaceState({}, "", path);
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

  it.each([
    ["/booking-finance", "booking-finance"],
    ["/booking-reports", "booking-reports"],
  ])("lets business owners open %s directly", async (path, testId) => {
    await renderAs("owner", path);
    expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
  });

  it.each([
    ["/booking-finance", "site_manager"],
    ["/booking-reports", "site_manager"],
  ])("redirects site managers away from %s", async (path, role) => {
    await renderAs(role, path);
    expect(container.querySelector('[data-testid="site-console"]').textContent).toBe("dashboard");
  });
});
