import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import SiteTrip from "./SiteTrip";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  errMsg: () => "Request failed",
}));

const trip = {
  id: "trip-1", trip_ref: "N-27092026-01", operating_date: "2026-09-27",
  truck_no: "TRUCK-1", driver_name: "Driver", status: "open",
};
const lr = {
  id: "lr-1", lr_ref: "N-LR-1", receiver_name: "Receiver", receiver_label: "Receiver",
  goods_type: "Grain", total_quantity: 2, rent: "100.00", hamali: "10.00",
  reconciled: false, payment_status: "unpaid", containers: [{ type: "Box", quantity: 2 }],
};

describe("SiteTrip ledger editor", () => {
  let container;
  let root;

  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path.endsWith("/lrs")) return Promise.resolve({ data: { rows: [lr], total: 1 } });
      if (path.endsWith("/categories")) return Promise.resolve({ data: { goods: [], containers: [] } });
      if (path.endsWith("/trip-resources")) return Promise.resolve({ data: { vehicles: [], drivers: [] } });
      if (path.endsWith("/expenses")) return Promise.resolve({ data: { expenses: [], total_amount: "0.00" } });
      return Promise.resolve({ data: trip });
    });
    api.patch.mockImplementation((_path, body) => Promise.resolve({ data: {
      ...lr, ...body, id: lr.id, rent: body.rent || lr.rent,
      total_quantity: body.containers?.reduce((total, line) => total + line.quantity, 0) ?? lr.total_quantity,
    } }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("saves changed LR charges through the canonical scoped update endpoint", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/sites/site-1/trips/trip-1"]}>
          <Routes>
            <Route path="/sites/:siteId/trips/:tripId" element={<SiteTrip user={{ role: "owner" }} />} />
          </Routes>
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const rent = container.querySelector('[aria-label="N-LR-1 bhada"]');
    const hamali = container.querySelector('[aria-label="N-LR-1 hamali"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(rent, "125.00");
      rent.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(hamali, "15.00");
      hamali.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new Event("fms:refresh"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[aria-label="N-LR-1 bhada"]').value).toBe("125.00");
    expect(container.textContent).toContain("Your unsaved edits were kept");

    const save = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save charges");
    await act(async () => {
      save.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/sites/site-1/trips/trip-1/lrs/lr-1",
      expect.objectContaining({
        rent: "125.00", hamali: "15.00", idempotency_key: expect.any(String),
      }),
    );
    expect(container.textContent).toContain("charges saved");
  });

  it("lets a manager with LR-update permission edit and save trip ledger details in-app", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/sites/site-1/trips/trip-1"]}>
          <Routes>
            <Route path="/sites/:siteId/trips/:tripId" element={
              <SiteTrip user={{
                role: "site_manager",
                site_permissions: { "site-1": ["lrs:read", "lrs:update"] },
              }} />
            } />
          </Routes>
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const edit = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Edit details");
    await act(async () => {
      edit.click();
    });

    const goods = container.querySelector('input[value="Grain"]');
    const containerType = container.querySelector('[aria-label="N-LR-1 container type 1"]');
    const quantity = container.querySelector('[aria-label="N-LR-1 container quantity 1"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(goods, "Rice");
      goods.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(containerType, "Bag");
      containerType.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(quantity, "5");
      quantity.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const save = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Save ledger row");
    await act(async () => {
      save.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/sites/site-1/trips/trip-1/lrs/lr-1",
      expect.objectContaining({
        goods_type: "Rice",
        containers: [{ type: "Bag", quantity: 5 }],
      }),
    );
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty("rent");
    expect(api.patch.mock.calls[0][1]).not.toHaveProperty("hamali");
    expect(container.querySelector('[aria-label="N-LR-1 bhada"]')).toBeNull();
    expect(container.textContent).toContain("ledger row saved");
  });

  it("does not show the trip ledger editor without LR-update permission", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/sites/site-1/trips/trip-1"]}>
          <Routes>
            <Route path="/sites/:siteId/trips/:tripId" element={
              <SiteTrip user={{ role: "site_manager", site_permissions: { "site-1": ["lrs:read"] } }} />
            } />
          </Routes>
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).not.toContain("Trip ledger");
    expect(container.querySelector('button')?.textContent).not.toBe("Edit details");
  });
});
