import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Layout from "./Layout";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));

describe("owner quick actions", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderAt = async (path) => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Layout user={{ role: "owner", name: "Owner", features: {} }}>
            <div>Page content</div>
          </Layout>
        </MemoryRouter>,
      );
    });
  };

  it("hides industrial quick-entry actions in site booking routes", async () => {
    await renderAt("/sites");

    expect(container.querySelector('[data-testid="global-search"]')).toBeNull();
    expect(container.querySelector('[data-testid="quick-action-btn"]')).toBeNull();
    expect(container.querySelector('[data-testid="mobile-quick-btn"]')).toBeNull();
    expect(container.querySelector('time[aria-label="Current India Standard Time"]')?.textContent).toContain("IST");
  });

  it("keeps quick-entry actions on industrial routes", async () => {
    await renderAt("/trips?tab=trips");

    expect(container.querySelector('[data-testid="global-search"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="quick-action-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mobile-quick-btn"]')).not.toBeNull();
  });

  it("shows owner-only Finance and Audit alongside the primary booking navigation", async () => {
    await renderAt("/booking/dashboard");
    for (const label of ["dashboard", "receipts", "ledger"]) {
      expect(container.querySelector(`[data-testid="nav-${label}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="nav-booking-finance"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-booking-audit"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="nav-booking-reports"]')).toBeNull();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/booking/dashboard"]}>
          <Layout user={{ role: "site_manager", name: "Manager", features: {} }}>
            <div>Site page</div>
          </Layout>
        </MemoryRouter>,
      );
    });
    for (const label of ["dashboard", "receipts", "ledger"]) {
      expect(container.querySelector(`[data-testid="nav-${label}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="nav-booking-finance"]')).toBeNull();
    expect(container.querySelector('[data-testid="nav-booking-audit"]')).toBeNull();
    expect(container.querySelector('[data-testid="nav-booking-reports"]')).toBeNull();
  });

  it("does not show industrial search or Quick Add on booking finance routes", async () => {
    await renderAt("/booking/ledger");

    expect(container.querySelector('[data-testid="global-search"]')).toBeNull();
    expect(container.querySelector('[data-testid="quick-action-btn"]')).toBeNull();
    expect(container.querySelector('[data-testid="mobile-quick-btn"]')).toBeNull();
  });

  it("keeps setup outside the three primary booking navigation options", async () => {
    await renderAt("/booking-setup");
    expect(container.querySelector('[data-testid="nav-booking-setup---access"]')).toBeNull();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/booking/dashboard"]}>
          <Layout user={{ role: "site_manager", name: "Manager", features: {} }}>
            <div>Site page</div>
          </Layout>
        </MemoryRouter>,
      );
    });
    expect(container.querySelector('[data-testid="nav-booking-setup---access"]')).toBeNull();
  });
});
