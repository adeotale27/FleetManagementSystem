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
  reconciled: false, payment_status: "unpaid", containers: [],
};

describe("SiteTrip LR charge sheet", () => {
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
      ...lr, rent: body.rent || lr.rent,
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
    const save = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save row");
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
});
