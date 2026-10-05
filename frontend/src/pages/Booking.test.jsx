import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import Booking, { romanHindi } from "./Booking";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  errMsg: (error) => error?.response?.data?.detail || "Request failed",
}));

describe("simple booking workflow", () => {
  let container;
  let root;
  const site = { id: "site-1", name: "Mama Garage", code: "NGP" };
  const trip = {
    id: "trip-1", site_id: site.id, trip_ref: "NGP29092026-01",
    operating_date: "2026-09-29", truck_no: "", driver_name: "", status: "open",
  };

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    api.post.mockResolvedValue({ data: trip });
    api.delete.mockResolvedValue({ data: { deleted: true, id: trip.id } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const renderBooking = async (section = "dashboard", role = "site_manager") => {
    await act(async () => {
      root.render(<MemoryRouter initialEntries={[`/booking/${section}`]}>
        <Routes><Route path="/booking/:section" element={<Booking user={{
          role, name: role === "owner" ? "Owner Name" : "Manager Name",
          site_permissions: { [site.id]: ["trips:read", "trips:create", "trips:update", "lrs:read", "lrs:create", "lrs:update"] },
        }} />} /></Routes>
      </MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const setInput = (selector, value, occurrence = 0) => {
    const input = container.querySelectorAll(selector)[occurrence];
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("transliterates common names and goods offline and preserves Hindi input", () => {
    expect(romanHindi("Ramesh")).toBe("रमेश");
    expect(romanHindi("Suresh")).toBe("सुरेश");
    expect(romanHindi("car")).toBe("कार");
    expect(romanHindi("HARDWARE")).toBe("हार्डवेयर");
    expect(romanHindi("Cement")).toBe("सीमेंट");
    expect(romanHindi("Food Grains")).toBe("अनाज");
    expect(romanHindi("AUTO")).toBe("ऑटो");
    expect(romanHindi("gadi bhada")).toBe("गाड़ी भाड़ा");
    expect(romanHindi("gaadi bhaada")).toBe("गाड़ी भाड़ा");
    expect(romanHindi("गाड़ी bhada")).toBe("गाड़ी भाड़ा");
    expect(romanHindi("vehicle rent")).toBe("गाड़ी भाड़ा");
    expect(romanHindi("hamali")).toBe("हमाली");
    expect(romanHindi("कपड़ा")).toBe("कपड़ा");
  });

  it("uses the server's latest row version for queued ledger edits", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Old sender", receiver_name: "Old receiver",
      sender_name_hindi: "पुराना भेजने वाला", receiver_name_hindi: "पुराना प्राप्तकर्ता", sender_address: "",
      receiver_address: "", rent: "100.00", hamali: "0.00", total_rent: "100.00",
      entry_by: "Admin - Owner Name",
      charge_editor_marker: "M",
      goods_rows: [
        { type: "Cement", type_hindi: "सीमेंट", description: "", quantity: 1, rent: "100.00", hamali: "0.00" },
        { type: "Grain", type_hindi: "अनाज", description: "", quantity: 3, rent: "0.00", hamali: "0.00" },
      ],
      updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [row], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      return Promise.resolve({ data: trip });
    });
    let resolveFirst;
    const patches = [];
    api.patch.mockImplementation((path, body) => {
      patches.push(body);
      if (patches.length === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve({ data: { ...row, ...body, updated_at: "version-3" } });
    });

    await renderBooking("ledger");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    const ledgerTable = container.querySelector("table");
    expect(ledgerTable).not.toBeNull();
    expect(container.querySelector('[aria-label="NGP-LR-01 sender address"]')).toBeNull();
    expect(container.querySelector('[aria-label="NGP-LR-01 receiver address"]')).toBeNull();
    const ledgerBhada = container.querySelector('[aria-label="NGP-LR-01 Bhada"]');
    expect(ledgerBhada.disabled).toBe(false);
    expect(ledgerBhada.value).toBe("100");
    expect(container.querySelector('[aria-label="NGP-LR-01 Bhada row 1"]')).toBeNull();
    expect(Array.from(ledgerTable.querySelectorAll("th")).map((header) => header.textContent))
      .toContain("Bhada");
    expect(Array.from(ledgerTable.querySelectorAll("th")).map((header) => header.textContent))
      .toContain("Hamali");
    expect(ledgerTable.querySelectorAll("input")).toHaveLength(2);
    expect(container.querySelector('[aria-label="NGP-LR-01 sender"]')).toBeNull();
    expect(container.textContent).toContain("पुराना भेजने वाला");
    expect(container.textContent).not.toContain("Old sender");
    expect(ledgerTable.querySelector("tbody tr td:nth-child(5)").textContent).toBe("१ - सीमेंट, ३ - अनाज");
    expect(ledgerTable.textContent).toContain("Admin - Owner Name");
    expect(ledgerTable.querySelector("tbody tr td:nth-child(8)").textContent).toContain("₹2");
    expect(container.querySelector('select option[value=""]')?.textContent).toBe("Select trip");
    expect(container.textContent).toContain(`Selected trip${trip.trip_ref}`);
    expect(api.get).toHaveBeenCalledWith(
      `/sites/${site.id}/ledger/entries`,
      expect.objectContaining({ params: expect.objectContaining({ trip_id: trip.id }) }),
    );
    await act(async () => {
      setInput('[aria-label="NGP-LR-01 Bhada"]', "125");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(patches).toHaveLength(1);
    expect(patches[0].expected_updated_at).toBe("version-1");

    await act(async () => {
      setInput('[aria-label="NGP-LR-01 Hamali"]', "10");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(patches).toHaveLength(1);

    await act(async () => {
      resolveFirst({ data: { ...row, rent: "125", updated_at: "version-2" } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(patches).toHaveLength(2);
    expect(patches[1]).toMatchObject({
      hamali: "10",
      expected_updated_at: "version-2",
    });
  });

  it("keeps ledger edits pending offline and saves them after reconnection", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", rent: "100.00", hamali: "0.00",
      total_rent: "100.00", updated_at: "version-1", goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "", quantity: 1,
      }],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/ledger/entries`) return Promise.resolve({ data: { rows: [row], total: 1 } });
      return Promise.resolve({ data: trip });
    });
    api.patch.mockResolvedValue({ data: { ...row, rent: "125.00", updated_at: "version-2" } });
    await renderBooking("ledger");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });

    await act(async () => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
      setInput('[aria-label="NGP-LR-01 Bhada"]', "125");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(container.textContent).toContain("Waiting to sync · keep this page open");
    expect(api.patch).not.toHaveBeenCalled();

    await act(async () => {
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Saved");
  });

  it("lets site managers edit only ledger charges and shows receipt creator attribution", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", sender_name_hindi: "",
      receiver_name_hindi: "", rent: "100.00", hamali: "10.00", total_rent: "110.00",
      charge_editor_marker: "A", entry_by: "Manager - Saoji", goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "", quantity: 1,
        rent: "100.00", hamali: "10.00",
      }], updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [row], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      return Promise.resolve({ data: trip });
    });
    api.patch.mockResolvedValue({
      data: { ...row, rent: "125.00", total_rent: "135.00", charge_editor_marker: "M", updated_at: "version-2" },
    });

    await renderBooking("ledger");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    const rentField = container.querySelector('[aria-label="NGP-LR-01 Bhada"]');
    expect(rentField.disabled).toBe(false);
    expect(container.querySelector('table [aria-label="NGP-LR-01 quantity 1"]')).toBeNull();
    expect(container.querySelector('table [aria-label="NGP-LR-01 goods description 1"]')).toBeNull();
    expect(container.querySelector("table").textContent).toContain("सीमेंट");
    expect(container.querySelector("table").textContent).toContain("Manager - Saoji");
    expect(container.querySelector("table td:nth-child(2)").textContent).toContain("NGP-LR-01");
    expect(container.querySelector("table td:nth-child(2)").querySelector("input")).toBeNull();
    expect(container.querySelector('[aria-label="NGP-LR-01 Amount paid"]')).toBeNull();
    expect(Array.from(container.querySelectorAll("button")).some((button) =>
      button.textContent.includes("ट्रिप बही पूरी करें"))).toBe(false);

    await act(async () => {
      setInput('[aria-label="NGP-LR-01 Bhada"]', "125.00");
      rentField.dispatchEvent(new Event("blur", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 700));
    });

    expect(api.patch).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/lr-1`,
      expect.objectContaining({ rent: "125.00", expected_updated_at: "version-1" }),
    );
    expect(container.querySelector("table").textContent).toContain("Manager - Saoji");

    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it("closes only the selected trip and leaves other trips open", async () => {
    let firstTrip = { ...trip, id: "trip-1", trip_ref: "NGP-TRIP-01", lr_count: 4 };
    const secondTrip = { ...trip, id: "trip-2", trip_ref: "NGP-TRIP-02" };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [firstTrip, secondTrip], total: 2 } });
      }
      if (path === `/sites/${site.id}/trips/${firstTrip.id}/lrs`) {
        return Promise.resolve({ data: { rows: [], total: 0 } });
      }
      return Promise.resolve({ data: firstTrip });
    });
    api.post.mockImplementation((path) => {
      firstTrip = { ...firstTrip, status: "closed" };
      return Promise.resolve({ data: firstTrip });
    });

    await renderBooking("dashboard", "owner");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes(firstTrip.trip_ref)).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Close Trip")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => { root.render(null); });
    await renderBooking("dashboard", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(api.post).toHaveBeenCalledWith(`/sites/${site.id}/trips/${firstTrip.id}/close`, {});
    const firstCard = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes(firstTrip.trip_ref));
    const secondCard = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes(secondTrip.trip_ref));
    expect(firstCard.textContent).toContain("Closed");
    expect(firstCard.textContent).toContain("4 receipts");
    expect(secondCard.textContent).toContain("Open");
  });

  it("lets a manager add vehicle and driver details to a closed trip", async () => {
    const closedTrip = { ...trip, status: "closed" };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [closedTrip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: closedTrip });
    });
    api.patch.mockResolvedValue({ data: {
      ...closedTrip, truck_no: "MH 31 AB 1234", driver_name: "Ramesh",
    } });
    await renderBooking("dashboard");
    await act(async () => {
      container.querySelector("button.card").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Edit trip details")).click();
    });

    expect(container.textContent).not.toContain("Delete trip");
    expect(container.querySelector('[aria-label="Edit trip vehicle number"]')).not.toBeNull();
    await act(async () => {
      setInput('[aria-label="Edit trip vehicle number"]', "MH 31 AB 1234");
      setInput('[aria-label="Edit trip driver name"]', "Ramesh");
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Save trip details")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(api.patch).toHaveBeenCalledWith(`/sites/${site.id}/trips/${trip.id}`, {
      truck_no: "MH 31 AB 1234", driver_name: "Ramesh",
    });
    expect(container.textContent).toContain("MH 31 AB 1234");
    expect(container.textContent).toContain("Ramesh");
    expect(container.textContent).not.toContain("Delete trip");
  });

  it("lets only the owner delete or archive a trip from trip editing", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.delete.mockResolvedValue({ data: { deleted: true, archived: true, id: trip.id } });
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });

    await renderBooking("dashboard", "owner");
    await act(async () => {
      container.querySelector("button.card").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Edit trip details")).click();
    });
    expect(container.textContent).toContain("Delete trip");
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Delete trip")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(confirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith(`/sites/${site.id}/trips/${trip.id}`);
    expect(localStorage.getItem("booking_trip_id")).toBeNull();
    expect(container.textContent).toContain("Its void receipts and financial history were preserved.");
    confirm.mockRestore();
  });

  it("shows the server reason when trip deletion is blocked", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    api.delete.mockRejectedValue({
      response: { status: 409, data: { detail: "Void every receipt first." } },
    });

    await renderBooking("dashboard", "owner");
    await act(async () => {
      container.querySelector("button.card").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Edit trip details")).click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Delete trip")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]').textContent).toContain("Void every receipt first.");
    expect(localStorage.getItem("booking_trip_id")).toBe(trip.id);
    confirm.mockRestore();
  });

  it("creates a trip without vehicle or driver, then starts with one goods row", async () => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [{
        ...site, config: { goods_suggestions: ["स्थानीय अनाज", "सीमेंट"] },
      }] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    await renderBooking();
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Create Trip")).click();
    });
    expect(container.querySelector("form .sticky.bottom-0")).not.toBeNull();
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.post).toHaveBeenCalledWith(`/sites/${site.id}/trips`, {
      operating_date: expect.any(String), truck_no: "", driver_name: "",
    });
    expect(container.textContent).toContain("New receipt");
    expect(container.querySelectorAll('[aria-label^="Goods and description row "]')).toHaveLength(3);
    expect(container.querySelectorAll('[aria-label^="Quantity row "]')).toHaveLength(3);
    expect(container.querySelector('[aria-label="Goods and description row 1"]').parentElement.parentElement.parentElement.className)
      .toContain("grid-cols-[minmax(0,1fr)_2.75rem]");
    expect(container.querySelector('[aria-label="Goods and description row 1"]').placeholder)
      .toBe("Goods and description");
    expect(container.querySelector('[aria-label="Goods and description row 1"]').parentElement.className)
      .toContain("relative block");
    expect(container.querySelector('[aria-label="Quantity row 1"]').parentElement.querySelector("svg").className.baseVal)
      .toContain("top-1/2");
    expect(container.querySelector("#receipt-entry-form .sticky.bottom-0")).not.toBeNull();
    expect(container.querySelector('[aria-label="Receipt Bhada"]').value).toBe("0");
    expect(container.querySelector('[aria-label="Receipt Hamali"]').value).toBe("0");
    expect(container.textContent).toContain("Bhada (₹)");
    expect(container.textContent).toContain("Hamali (₹)");
    const receiverAddress = container.querySelector('[aria-label="Receiver address (optional)"]');
    const receiverPhone = container.querySelector('[aria-label="Receiver phone (10 digits, optional)"]');
    expect(receiverAddress.parentElement.parentElement)
      .toBe(receiverPhone.parentElement.parentElement);
    expect(receiverAddress.parentElement.parentElement.className).toContain("md:grid-cols-2");
    expect(Array.from(container.querySelectorAll("#booking-goods-suggestions option"))
      .map((option) => option.value)).toEqual(["स्थानीय अनाज", "सीमेंट"]);
  });

  it("removes goods rows with the X button and restores three blank rows", async () => {
    await renderBooking();
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Create Trip")).click();
    });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelectorAll('[aria-label^="Goods and description row "]')).toHaveLength(3);
    await act(async () => {
      container.querySelector('[aria-label="Remove goods row 2"]').click();
    });
    expect(container.querySelectorAll('[aria-label^="Goods and description row "]')).toHaveLength(2);
    await act(async () => {
      container.querySelector('[aria-label="Remove goods row 1"]').click();
    });
    expect(container.querySelectorAll('[aria-label^="Goods and description row "]')).toHaveLength(1);
    await act(async () => {
      container.querySelector('[aria-label="Remove goods row 1"]').click();
    });
    expect(container.querySelectorAll('[aria-label^="Goods and description row "]')).toHaveLength(3);
  });

  it("saves English receipt data and resets the form after a successful save", async () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
    const requestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => callback();
    const pendingReceiptRefreshes = [];
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [{
        ...site,
        config: { receipt_controls: {
          sender_address_enabled: false, receiver_address_enabled: false,
        } },
      }] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path.endsWith("/lrs")) {
        return new Promise((resolve) => pendingReceiptRefreshes.push(resolve));
      }
      return Promise.resolve({ data: trip });
    });
    const createdAt = "2026-09-29T07:04:05+00:00";
    api.post.mockImplementation((path, body) => Promise.resolve({
      data: path.endsWith("/lrs")
        ? {
          ...body, id: "lr-1", lr_ref: "NGP-LR-01", receipt_fee: "2.00",
          total_rent: "37.00", receipt_created_at: createdAt,
          sender_address: "Old Sender Road", sender_address_hindi: "पुराना प्रेषक पता",
          receiver_address: "Old Receiver Road", receiver_address_hindi: "पुराना प्राप्तकर्ता पता",
        }
        : trip,
    }));
    await renderBooking();
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Create Trip")).click();
    });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[aria-label="Sender address (optional)"]')).toBeNull();
    expect(container.querySelector('[aria-label="Receiver address (optional)"]')).toBeNull();
    await act(async () => {
      setInput('[aria-label="Receiver name in English"]', "Suresh");
      setInput('[aria-label="Goods and description row 1"]', "Cement");
      setInput('[aria-label="Quantity row 1"]', "3");
      setInput('[aria-label="Receipt Bhada"]', "30.00");
      setInput('[aria-label="Receipt Hamali"]', "5.00");
      setInput('[aria-label="Receiver phone (10 digits, optional)"]', "98765432109");
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Save & print")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const receiptRequest = api.post.mock.calls.find(([path]) => path.endsWith("/lrs"));
    expect(receiptRequest[1]).toMatchObject({
      sender_name: "",
      receiver_name: "Suresh",
      receiver_name_hindi: "सुरेश",
      receiver_phone: "9876543210",
      city: "Hinganghat",
      goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "",
        description_hindi: "", quantity: 3,
      }],
      rent: "30.00",
      hamali: "5.00",
    });
    expect(receiptRequest[1]).not.toHaveProperty("sender_phone");
    expect(receiptRequest[1]).not.toHaveProperty("sender_address");
    expect(receiptRequest[1]).not.toHaveProperty("receiver_address");
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("12:34:05 IST");
    expect(receiptRequest[1]).not.toHaveProperty("receipt_created_at");
    expect(document.querySelector(".receipt-print-goods").textContent).not.toContain("Roof repair bags");
    expect(document.querySelector(".receipt-print-goods").textContent).toContain("३ - सीमेंट");
    expect(document.querySelector(".receipt-print-parties").textContent).toContain("9876543210");
    expect(document.querySelector(".receipt-print-parties").textContent)
      .not.toContain("Old Sender Road");
    expect(document.querySelector(".receipt-print-parties").textContent)
      .not.toContain("Old Receiver Road");
    expect(document.querySelector(".receipt-print-company").textContent).toContain("नायडू गुड्स ट्रांसपोर्ट");
    const printHeader = document.querySelector(".receipt-print-header");
    expect(printHeader.querySelector(".receipt-print-company")).not.toBeNull();
    expect(document.querySelector("style").textContent).toContain(
      ".receipt-print-logo { position:absolute; top:50%; left:0; width:270px; height:190px;",
    );
    expect(document.querySelector("style").textContent).toContain(
      ".receipt-print-company { width:100%; text-align:center; }",
    );
    expect(container.querySelector('[aria-label="Receiver name in English"]').value).toBe("");
    expect(container.querySelector('[aria-label="Goods and description row 1"]').value).toBe("");
    expect(document.querySelector(".receipt-print-charges").textContent).toContain("₹30");
    expect(document.querySelector(".receipt-print-charges").textContent).toContain("₹5");
    expect(document.querySelector(".receipt-print-charges").textContent).toContain("₹37");
    await act(async () => {
      pendingReceiptRefreshes.forEach((resolve) => resolve({ data: { rows: [], total: 0 } }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });
    printSpy.mockRestore();
    window.requestAnimationFrame = requestAnimationFrame;
  });

  it("lets the user cancel receipt edits without submitting them", async () => {
    const existingReceipt = {
      id: "lr-1", lr_ref: "NGPLR29092026-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", receiver_phone: "9876543210",
      rent: "100", hamali: "0", updated_at: "version-1",
      goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "Sacks",
        description_hindi: "बोरियाँ", quantity: 4,
      }],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) {
        return Promise.resolve({ data: { rows: [existingReceipt], total: 1 } });
      }
      return Promise.resolve({ data: trip });
    });
    localStorage.setItem("booking_trip_id", trip.id);
    await renderBooking("receipts");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Edit").click();
    });
    expect(container.querySelector('[aria-label="Goods and description row 1"]').value).toBe("Cement Sacks");
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Cancel editing")).click();
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Edit receipt");
    expect(container.textContent).toContain("New receipt");
  });

  it("sends one update when saving an existing receipt, even if save is clicked again while pending", async () => {
    const existingReceipt = {
      id: "lr-1", lr_ref: "NGPLR29092026-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", receiver_phone: "9876543210",
      rent: "100", hamali: "0", receipt_fee: "2", updated_at: "version-1",
      goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "Bags",
        description_hindi: "बोरियाँ", quantity: 4,
      }],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) {
        return Promise.resolve({ data: { rows: [existingReceipt], total: 1 } });
      }
      return Promise.resolve({ data: trip });
    });
    let finishPatch;
    api.patch.mockImplementation((_path, body) => new Promise((resolve) => {
      finishPatch = () => resolve({
        data: { ...existingReceipt, ...body, updated_at: "version-2" },
      });
    }));
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    await renderBooking("receipts");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent === "Edit").click();
    });
    await act(async () => {
      setInput('[aria-label="Goods and description row 1"]', "Cement rolls");
      const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Save changes"));
      saveButton.click();
      saveButton.click();
    });

    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(api.patch).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/${existingReceipt.id}`,
      expect.objectContaining({
        goods_rows: [expect.objectContaining({ type: "Cement rolls", quantity: 4 })],
        expected_updated_at: "version-1",
      }),
    );
    await act(async () => {
      finishPatch();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Saved NGPLR29092026-01 successfully.");
    expect(api.patch).toHaveBeenCalledTimes(1);
  });

  it("lets an owner edit a receipt for a closed trip without a correction reason", async () => {
    const closedTrip = { ...trip, status: "closed" };
    const receipt = {
      id: "lr-1", lr_ref: "NGPLR29092026-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", rent: "100", hamali: "0",
      updated_at: "version-1",
      goods_rows: [{ type: "Cement", type_hindi: "सीमेंट", quantity: 4 }],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [closedTrip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) {
        return Promise.resolve({ data: { rows: [receipt], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips/${trip.id}`) return Promise.resolve({ data: closedTrip });
      return Promise.resolve({ data: trip });
    });
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    api.patch.mockResolvedValue({ data: receipt });
    await renderBooking("receipts", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent === "Edit").click();
    });

    expect(container.textContent).toContain("Edit receipt");
    expect(container.textContent).not.toContain("Owner correction reason");
    await act(async () => {
      setInput('[aria-label="Goods and description row 1"]', "Cement");
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Save changes")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(api.patch).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/lr-1`,
      expect.objectContaining({ expected_updated_at: "version-1" }),
    );
  });

  it("saves an edited good and description in one combined field", async () => {
    const existingReceipt = {
      id: "lr-1", lr_ref: "NGPLR29092026-01", receipt_date: trip.operating_date,
      sender_name: "", receiver_name: "Receiver", receiver_phone: "9876543210",
      rent: "100", hamali: "0", updated_at: "version-1",
      goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "Bags",
        description_hindi: "बोरियाँ", quantity: 4,
      }],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) {
        return Promise.resolve({ data: { rows: [existingReceipt], total: 1 } });
      }
      return Promise.resolve({ data: trip });
    });
    api.patch.mockResolvedValue({ data: existingReceipt });
    localStorage.setItem("booking_trip_id", trip.id);
    await renderBooking("receipts");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Edit").click();
    });
    await act(async () => {
      setInput('[aria-label="Goods and description row 1"]', "Cement");
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Save changes")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.patch).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/lr-1`,
      expect.objectContaining({
        receiver_phone: "9876543210",
        goods_rows: [expect.objectContaining({
          type: "Cement", type_hindi: "सीमेंट", description: "", description_hindi: "", quantity: 4,
        })],
        expected_updated_at: "version-1",
        idempotency_key: expect.any(String),
      }),
    );
  });

  it("explains a possible duplicate receiver and retries with the selected identity", async () => {
    let receiptAttempts = 0;
    api.post.mockImplementation((path) => {
      if (!path.endsWith("/lrs")) return Promise.resolve({ data: trip });
      receiptAttempts += 1;
      if (receiptAttempts === 1) {
        return Promise.reject({ response: { status: 409, data: { detail: {
          code: "receiver_match_confirmation_required",
          message: "A similar receiver was used at this site on this operating date.",
          matches: [{ id: "receiver-1", name: "Suresh", label: "Suresh" }],
        } } } });
      }
      return Promise.resolve({ data: { id: "lr-1", lr_ref: "NGP-LR-01" } });
    });
    await renderBooking();
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Create Trip")).click();
    });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelectorAll('[aria-label^="Goods and description row "]')).toHaveLength(3);
    expect(container.querySelector('[aria-label="Quantity row 1"]').parentElement.parentElement.parentElement.className)
      .toContain("grid-cols-[2rem_minmax(0,1fr)_10rem_2.25rem]");
    await act(async () => {
      setInput('[aria-label="Receiver name in English"]', "Suresh");
      setInput('[aria-label="Goods and description row 1"]', "Cement");
      setInput('[aria-label="Quantity row 1"]', "3");
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Save receipt")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Check the receiver before saving");
    expect(container.textContent).toContain("Same receiver: Suresh");
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Same receiver: Suresh")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const receiptRequests = api.post.mock.calls.filter(([path]) => path.endsWith("/lrs"));
    expect(receiptAttempts).toBe(2);
    expect(receiptRequests[1][1]).toMatchObject({
      receiver_match_action: "same",
      receiver_identity_id: "receiver-1",
    });
  });

  it("keeps receipt data read-only in the ledger except for Bhada and Hamali", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", rent: "100.00", hamali: "10.00",
      total_rent: "110.00", receipt_fee: "2.00", paid_total: "20.00", outstanding: "80.00",
      payment_status: "partial", amount_paid: true, ledger_settlement_created: false,
      goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "Bags",
        description_hindi: "बोरे", quantity: 1, rent: "100.00", hamali: "10.00",
      }],
      updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) return Promise.resolve({ data: { rows: [row], total: 1 } });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      return Promise.resolve({ data: trip });
    });
    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(container.querySelector('[aria-label="NGP-LR-01 Bhada"]').disabled).toBe(true);
    expect(container.querySelector('[aria-label="NGP-LR-01 Hamali"]').disabled).toBe(true);
    const table = container.querySelector("table");
    expect(table.querySelectorAll("input")).toHaveLength(3);
    expect(table.querySelector('[aria-label="NGP-LR-01 Amount paid"]')).not.toBeNull();
    expect(table.querySelector("tbody tr td:nth-child(5)").textContent).toBe("१ - सीमेंट/बोरे");
    const totals = container.querySelector('[aria-label="Selected ledger totals"]');
    const totalCells = totals.querySelectorAll("tfoot td");
    expect(totalCells).toHaveLength(6);
    expect(totalCells[0].colSpan).toBe(5);
    expect(totalCells[1].textContent).toContain("Bhada total: ₹100");
    expect(totalCells[2].textContent).toContain("Hamali total: ₹10");
    expect(totalCells[3].textContent).toContain("Receipt fee total: ₹2");
    expect(totalCells[4].textContent).toContain("Grand total: ₹112");
    const mobileRow = container.querySelector('article[aria-label="NGP-LR-01 mobile ledger receipt"]');
    expect(mobileRow).not.toBeNull();
    expect(mobileRow.textContent).toContain("१ - सीमेंट/बोरे");
    expect(mobileRow.querySelector('[aria-label="NGP-LR-01 mobile Bhada"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Mobile selected ledger totals"]').textContent)
      .toContain("Grand total");
    expect(Array.from(container.querySelectorAll("button")).some((button) =>
      button.textContent.includes("Complete trip ledger"))).toBe(true);
    expect(table.querySelector('[aria-label="NGP-LR-01 date"]')).toBeNull();
    expect(table.querySelector('[aria-label="NGP-LR-01 sender"]')).toBeNull();
    expect(table.querySelector('[aria-label="NGP-LR-01 receiver"]')).toBeNull();
    expect(table.querySelector('[aria-label="NGP-LR-01 payment received"]')).toBeNull();
  });

  it("saves paid ticks immediately and restores them with an error if the save fails", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", rent: "100.00", hamali: "0.00",
      total_rent: "100.00", paid_total: "100.00", outstanding: "0.00",
      amount_paid: true, goods_rows: [], updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) return Promise.resolve({ data: { rows: [row], total: 1 } });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      return Promise.resolve({ data: trip });
    });
    api.post.mockResolvedValueOnce({
      data: { received: false, paid_total: "0.00", outstanding: "102.00" },
    }).mockRejectedValueOnce({
      response: { status: 409, data: { detail: "The trip ledger is locked" } },
    });
    const prompt = jest.spyOn(window, "prompt").mockImplementation(() => null);
    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });

    await act(async () => {
      container.querySelector('[aria-label="NGP-LR-01 Amount paid"]').click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(prompt).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/lr-1/settlement`,
      expect.objectContaining({ received: false, idempotency_key: expect.any(String) }),
    );
    expect(container.querySelector('[aria-label="NGP-LR-01 Amount paid"]').checked).toBe(false);
    await act(async () => {
      container.querySelector('[aria-label="NGP-LR-01 Amount paid"]').click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[aria-label="NGP-LR-01 Amount paid"]').checked).toBe(false);
    expect(container.querySelector('[role="alert"]').textContent)
      .toContain("NGP-LR-01: Paid status was not saved. The trip ledger is locked");
    prompt.mockRestore();
  });

  it("shows English trip ledger heading and actions", async () => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      return Promise.resolve({ data: trip });
    });
    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(container.textContent).toContain(`Selected trip${trip.trip_ref}`);
    expect(container.textContent).toContain("Print");
    expect(container.textContent).toContain("Excel");
    expect(container.textContent).toContain("Complete trip ledger");
  });

  it("lets an owner undo a completed ledger while retaining its paid state", async () => {
    const completedTrip = {
      ...trip,
      ledger_completed_at: "2026-09-29T12:00:00+00:00",
      ledger_completed_by: "owner",
      ledger_completion_started_at: "2026-09-29T12:00:00+00:00",
    };
    const paidRow = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "closed", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      receiver_name: "Receiver", rent: "100.00", hamali: "0.00",
      total_rent: "100.00", paid_total: "102.00", outstanding: "0.00",
      amount_paid: true, goods_rows: [],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [paidRow], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [completedTrip], total: 1 } });
      }
      return Promise.resolve({ data: completedTrip });
    });
    api.post.mockResolvedValue({ data: { id: trip.id, ledger_completed: false } });
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(container.textContent).toContain("Ledger completed and locked");
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Undo ledger completion")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("will remain unchanged"));
    expect(api.post).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/ledger/uncomplete`,
    );
    expect(container.textContent).not.toContain("Ledger completed and locked");
    expect(container.querySelector('[aria-label="NGP-LR-01 Amount paid"]').checked).toBe(true);
    expect(container.querySelector('[aria-label="NGP-LR-01 Amount paid"]').disabled).toBe(false);
    expect(Array.from(container.querySelectorAll("button")).some((button) =>
      button.textContent.includes("Complete trip ledger"))).toBe(true);
    confirm.mockRestore();
  });

  it("does not offer completed-ledger undo to a manager", async () => {
    const completedTrip = { ...trip, ledger_completed_at: "2026-09-29T12:00:00+00:00" };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [], total: 0 } });
      }
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [completedTrip], total: 1 } });
      }
      return Promise.resolve({ data: completedTrip });
    });

    await renderBooking("ledger", "site_manager");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });

    expect(container.textContent).not.toContain("Undo ledger completion");
  });

  it("keeps the ledger locked and shows the server error when undo fails", async () => {
    const completedTrip = { ...trip, ledger_completed_at: "2026-09-29T12:00:00+00:00" };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [], total: 0 } });
      }
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [completedTrip], total: 1 } });
      }
      return Promise.resolve({ data: completedTrip });
    });
    api.post.mockRejectedValue({
      response: { status: 409, data: { detail: "This trip ledger changed. Reload and retry." } },
    });
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Undo ledger completion")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]').textContent)
      .toContain("This trip ledger changed. Reload and retry.");
    expect(container.textContent).toContain("Ledger completed and locked");
    expect(Array.from(container.querySelectorAll("button")).some((button) =>
      button.textContent.includes("Undo ledger completion"))).toBe(true);
    confirm.mockRestore();
  });

  it("keeps voided ledger row fields read-only", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "closed", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      receiver_name: "Receiver", rent: "100.00", hamali: "0.00",
      total_rent: "100.00", paid_total: "0.00", outstanding: "0.00",
      payment_status: "unpaid", voided: true, goods_rows: [],
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) return Promise.resolve({ data: { rows: [row], total: 1 } });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      return Promise.resolve({ data: trip });
    });

    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(container.querySelector('[aria-label="NGP-LR-01 Bhada"]').disabled).toBe(true);
    expect(container.querySelector('[aria-label="NGP-LR-01 Hamali"]').disabled).toBe(true);
    expect(container.textContent).toContain("VOID");
  });
});
