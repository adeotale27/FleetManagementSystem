import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import SiteConsole from "./SiteConsole";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
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
    api.post.mockImplementation((path) => path === "/sites"
      ? Promise.resolve({ data: { id: "site-new", name: "New Site", code: "NEW" } })
      : Promise.resolve({ data: { ok: true } }));
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: sites });
      if (path === "/sites/managers") return Promise.resolve({ data: [] });
      if (path === "/masters/team") return Promise.resolve({ data: [
        { id: "team-manager", name: "Mina Manager", role: "Manager", status: "Active" },
        { id: "team-staff", name: "Sam Staff", role: "Accountant", status: "Active" },
      ] });
      if (path === "/sites/system-dashboard") return Promise.resolve({ data: { sites: [] } });
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
    expect(container.querySelector('[data-testid="booking-access-management"]')).toBeNull();
    expect(container.textContent).not.toContain("Booking access management");

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

  it("shows shared vehicle and driver choices to a manager creating a booking", async () => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [sites[0]] });
      if (path === "/sites/site-a/trips") return Promise.reject(new Error("No trip read access"));
      if (path === "/sites/site-a/dashboard") return Promise.reject(new Error("No dashboard read access"));
      if (path === "/sites/site-a/trip-resources") return Promise.resolve({ data: {
        vehicles: [{ id: "vehicle-1", vehicle_no: "MH31AB1234", vehicle_type: "Truck", status: "Active" }],
        drivers: [{ id: "driver-1", name: "Driver One" }],
      } });
      return Promise.resolve({ data: {} });
    });

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SiteConsole user={{
            role: "site_manager",
            site_permissions: { "site-a": ["trips:create"] },
          }} />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const selects = Array.from(container.querySelectorAll("#site-trip-create-form select"));
    expect(selects[0].textContent).toContain("MH31AB1234");
    expect(selects[1].textContent).toContain("Driver One");
    expect(container.textContent).toContain("Booking records: Request failed");
    expect(container.textContent).not.toContain("Vehicle and driver options: Request failed");
  });

  it("lets a site manager with daily-ledger permission download the selected site's ledger", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:daily-ledger");
    URL.revokeObjectURL = jest.fn();

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SiteConsole user={{
            role: "site_manager",
            site_permissions: { "site-a": ["ledger:export"] },
          }} />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const downloadButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent.includes("Download daily ledger"));
    expect(downloadButton).not.toBeUndefined();
    await act(async () => {
      downloadButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.get).toHaveBeenCalledWith("/sites/site-a/ledger/daily", expect.objectContaining({
      params: { operating_date: expect.any(String) },
      responseType: "blob",
    }));

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("shows the owner-only access register and reveals a reset password only once", async () => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: sites });
      if (path === "/sites/managers") return Promise.resolve({ data: [{
        username: "manager-one", name: "Manager One", active: true, site_ids: ["site-a"],
        team_member_id: "team-manager", site_permissions: { "site-a": ["trips:read"] },
      }] });
      if (path === "/masters/team") return Promise.resolve({ data: [
        { id: "team-manager", name: "Mina Manager", role: "Manager", status: "Active" },
        { id: "team-staff", name: "Sam Staff", role: "Accountant", status: "Active" },
      ] });
      if (path === "/sites/system-dashboard") return Promise.resolve({ data: { sites: [] } });
      if (path.endsWith("/trips")) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path.endsWith("/trip-resources")) {
        return Promise.resolve({ data: { vehicles: [], drivers: [] } });
      }
      return Promise.resolve({ data: {} });
    });
    const prompt = jest.spyOn(window, "prompt").mockReturnValue("Temp-password-123!");

    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SiteConsole user={{ role: "owner" }} adminOnly />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const managerDetails = container.querySelector('[data-testid="booking-access-management"]');
    expect(managerDetails).not.toBeNull();
    expect(managerDetails.textContent).toContain("Manager account register");
    expect(container.textContent).toContain("Booking categories");
    expect(container.querySelector('[aria-label="City"]').closest("label").textContent).toContain("City (optional)");
    await act(async () => { managerDetails.open = true; });
    expect(container.textContent).toContain("Manager ID: manager-one");
    expect(container.textContent).toContain("Assigned sites: Site A");

    const resetButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Reset password");
    await act(async () => {
      resetButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(api.post).toHaveBeenCalledWith(
      "/sites/managers/manager-one/reset-password",
      { password: "Temp-password-123!" },
    );
    expect(container.textContent).toContain("Temporary credential — copy it now");
    expect(container.textContent).toContain("Temporary password: Temp-password-123!");
    expect(prompt).toHaveBeenCalledTimes(1);
    prompt.mockRestore();
  });

  it("offers active Office Team managers when adding a site and creates a login for a selected profile", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SiteConsole user={{ role: "owner" }} adminOnly />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const managerSelect = Array.from(container.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "team-manager"));
    expect(Array.from(managerSelect.options).map((option) => option.value)).toContain("__new__");
    expect(Array.from(managerSelect.options).map((option) => option.value)).not.toContain("team-staff");

    await act(async () => {
      managerSelect.value = "team-manager";
      managerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector('input[aria-label="Manager login ID"]')).not.toBeNull();
    expect(container.querySelector('input[aria-label="City"]')).not.toBeNull();

    const setInput = async (selector, value) => {
      const input = container.querySelector(selector);
      if (!input) throw new Error(`Missing test input: ${selector}`);
      await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    await setInput('input[placeholder="Site name"]', "New Site");
    await setInput('input[placeholder="e.g. NGP"]', "NEW");
    await setInput('input[aria-label="Manager login ID"]', "mina.manager");
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    await setInput('input[aria-label="Manager password"]', "abc");

    const createForm = container.querySelector('input[placeholder="Site name"]').closest("form");
    await act(async () => {
      createForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.post).toHaveBeenCalledWith("/sites", expect.objectContaining({ name: "New Site", code: "NEW" }));
    expect(api.post).toHaveBeenCalledWith("/sites/site-new/manager", expect.objectContaining({
      name: "Mina Manager", username: "mina.manager", team_member_id: "team-manager",
      password: "abc",
    }));
    expect(container.textContent).toContain("Temporary password: abc");
  });

  it("explains manager permissions with grouped action labels", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SiteConsole user={{ role: "owner" }} adminOnly />
        </MemoryRouter>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Manager site access");
    expect(container.textContent).toContain("Lorry receipts (LRs)");
    expect(container.querySelector('[aria-label="Create trips"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Record payments"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Download daily ledger"]')).not.toBeNull();
    expect(container.textContent).toContain("Unticked actions are unavailable to this manager at this site.");
  });
});
