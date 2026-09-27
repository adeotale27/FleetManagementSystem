import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import SiteConsole from "./SiteConsole";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn() },
  errMsg: () => "Request failed",
}));

const sites = [
  { id: "site-a", name: "Site A", code: "A", location: "", timezone: "Asia/Kolkata" },
  { id: "site-b", name: "Site B", code: "B", location: "", timezone: "Asia/Kolkata" },
];

describe("SiteConsole fetch cycles", () => {
  let container;
  let root;

  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: sites });
      if (path.endsWith("/trips")) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path.endsWith("/trip-resources")) {
        return Promise.resolve({ data: { vehicles: [], drivers: [] } });
      }
      return Promise.resolve({ data: {} });
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("does not refetch sites after initial selection or a site change", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SiteConsole user={{ role: "site_manager", site_permissions: {} }} />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.get.mock.calls.filter(([path]) => path === "/sites")).toHaveLength(1);

    const siteSelect = Array.from(container.querySelectorAll("select")).find((select) =>
      Array.from(select.options).some((option) => option.value === "site-b"),
    );
    await act(async () => {
      siteSelect.value = "site-b";
      siteSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.get.mock.calls.filter(([path]) => path === "/sites")).toHaveLength(1);
    expect(api.get.mock.calls.filter(([path]) => path === "/sites/site-b/trips")).toHaveLength(1);
    expect(api.get.mock.calls.filter(([path]) => path === "/sites/site-b/trip-resources")).toHaveLength(1);
  });
});
