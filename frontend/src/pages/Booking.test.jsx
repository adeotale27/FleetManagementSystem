import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { api } from "../lib/api";
import Booking, { romanHindi } from "./Booking";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  errMsg: () => "Request failed",
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
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    api.post.mockResolvedValue({ data: trip });
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
          site_permissions: { [site.id]: ["trips:read", "trips:create", "trips:update", "trips:close", "lrs:read", "lrs:create", "lrs:update"] },
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
    expect(romanHindi("Food Grains")).toBe("खाद्यान्न");
    expect(romanHindi("कपड़ा")).toBe("कपड़ा");
  });

  it("uses the server's latest row version for queued ledger edits", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Old sender", receiver_name: "Old receiver",
      sender_name_hindi: "", receiver_name_hindi: "", sender_address: "",
      receiver_address: "", rent: "100.00", hamali: "0.00", total_rent: "100.00",
      charge_editor_marker: "M",
      goods_rows: [{ type: "Cement", type_hindi: "सीमेंट", description: "", quantity: 1, rent: "100.00", hamali: "0.00" }],
      updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [row], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
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
    const ledgerTable = container.querySelector("table.w-full.table-fixed");
    expect(ledgerTable).not.toBeNull();
    expect(ledgerTable.classList.contains("min-w-[1500px]")).toBe(false);
    expect(container.querySelector('[aria-label="NGP-LR-01 sender address"]')).toBeNull();
    expect(container.querySelector('[aria-label="NGP-LR-01 receiver address"]')).toBeNull();
    expect(container.querySelector('[aria-label="Last charge edit by manager"]')).not.toBeNull();
    const ledgerBhada = container.querySelector('[aria-label="NGP-LR-01 Bhada"]');
    expect(ledgerBhada.disabled).toBe(false);
    expect(ledgerBhada.value).toBe("100");
    expect(container.querySelector('[aria-label="NGP-LR-01 Bhada row 1"]')).toBeNull();
    expect(Array.from(ledgerTable.querySelectorAll("th")).map((header) => header.textContent))
      .not.toContain("Total");
    const senderName = container.querySelector('[aria-label="NGP-LR-01 sender"]');
    const senderHindi = container.querySelector('[aria-label="NGP-LR-01 sender Hindi"]');
    expect(senderName.compareDocumentPosition(senderHindi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[aria-label="NGP-LR-01 sender"]')).not.toBeNull();
    await act(async () => {
      setInput('[aria-label="NGP-LR-01 sender"]', "New sender");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(patches).toHaveLength(1);
    expect(patches[0].expected_updated_at).toBe("version-1");

    await act(async () => {
      setInput('[aria-label="NGP-LR-01 receiver"]', "New receiver");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(patches).toHaveLength(1);

    await act(async () => {
      resolveFirst({ data: { ...row, sender_name: "New sender", updated_at: "version-2" } });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(patches).toHaveLength(2);
    expect(patches[1]).toMatchObject({
      sender_name: "New sender",
      receiver_name: "New receiver",
      expected_updated_at: "version-2",
    });
  });

  it("lets site managers edit ledger charges and persists the editor marker", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", sender_name_hindi: "",
      receiver_name_hindi: "", rent: "100.00", hamali: "10.00", total_rent: "110.00",
      charge_editor_marker: "A", goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "", quantity: 1,
        rent: "100.00", hamali: "10.00",
      }], updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) {
        return Promise.resolve({ data: { rows: [row], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
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
    const quantityField = container.querySelector('table.w-full.table-fixed [aria-label="NGP-LR-01 quantity 1"]');
    expect(quantityField.className).toContain("min-w-16");
    expect(quantityField.className).toContain("text-base");
    expect(container.querySelector('table.w-full.table-fixed td:nth-child(2)').className).toContain("text-xs");

    await act(async () => {
      setInput('[aria-label="NGP-LR-01 Bhada"]', "125.00");
      rentField.dispatchEvent(new Event("blur", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 700));
    });

    expect(api.patch).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/lr-1`,
      expect.objectContaining({ rent: "125.00", expected_updated_at: "version-1" }),
    );
    expect(container.querySelector('[aria-label="Last charge edit by manager"]')).not.toBeNull();

    await act(async () => {
      setInput('[aria-label="NGP-LR-01 goods description 1"]', "Palletized cement");
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    const goodsUpdate = api.patch.mock.calls[1][1];
    expect(goodsUpdate.goods_rows[0]).not.toHaveProperty("rent");
    expect(goodsUpdate.goods_rows[0]).not.toHaveProperty("hamali");
    expect(goodsUpdate).not.toHaveProperty("rent");
    expect(goodsUpdate).not.toHaveProperty("hamali");
  });

  it("closes only the selected trip and leaves other trips open", async () => {
    const firstTrip = { ...trip, id: "trip-1", trip_ref: "NGP-TRIP-01", lr_count: 4 };
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
    api.post.mockResolvedValue({ data: { ...firstTrip, status: "closed" } });

    await renderBooking("dashboard");
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
    await act(async () => {
      Array.from(container.querySelectorAll("a")).find((link) =>
        link.textContent.includes("Dashboard")).click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.post).toHaveBeenCalledWith(`/sites/${site.id}/trips/${firstTrip.id}/close`, {});
    const firstCard = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes(firstTrip.trip_ref));
    const secondCard = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes(secondTrip.trip_ref));
    expect(firstCard.textContent).toContain("Closed");
    expect(firstCard.textContent).toContain("4 receipts");
    expect(secondCard.textContent).toContain("Open");
  });

  it("creates a trip without vehicle or driver, then shows five receipt goods rows", async () => {
    await renderBooking();
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Create Trip")).click();
    });
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.post).toHaveBeenCalledWith(`/sites/${site.id}/trips`, {
      operating_date: expect.any(String), truck_no: "", driver_name: "",
    });
    expect(container.textContent).toContain("Create New Receipt");
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Create New Receipt")).click();
    });
    expect(container.querySelectorAll('[aria-label^="Goods type row "]')).toHaveLength(5);
    expect(container.querySelector('[aria-label="Receipt Bhada"]').value).toBe("0");
    expect(container.querySelector('[aria-label="Receipt Hamali"]').value).toBe("0");
    expect(container.textContent).toContain("Bhada (₹)");
    expect(container.textContent).toContain("Hamali (₹)");
  });

  it("saves a receipt without a sender name or sender phone and includes a goods description", async () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
    const requestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => callback();
    const pendingReceiptRefreshes = [];
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      if (path.endsWith("/lrs")) {
        return new Promise((resolve) => pendingReceiptRefreshes.push(resolve));
      }
      return Promise.resolve({ data: trip });
    });
    const createdAt = "2026-09-29T07:04:05+00:00";
    api.post.mockImplementation((path, body) => Promise.resolve({
      data: path.endsWith("/lrs")
        ? { ...body, id: "lr-1", lr_ref: "NGP-LR-01", total_rent: "35.00", receipt_created_at: createdAt }
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
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Create New Receipt")).click();
    });
    await act(async () => {
      setInput('input[placeholder="Type name"]', "Suresh", 1);
      setInput('[aria-label="Goods type row 1"]', "Cement");
      setInput('[aria-label="Quantity row 1"]', "3");
      setInput('[aria-label="Goods description row 1"]', "Roof repair bags");
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
      goods_rows: [{
        type: "Cement", type_hindi: "सीमेंट", description: "Roof repair bags", quantity: 3,
      }],
      rent: "30.00",
      hamali: "5.00",
    });
    expect(receiptRequest[1]).not.toHaveProperty("sender_phone");
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("12:34:05 IST");
    expect(receiptRequest[1]).not.toHaveProperty("receipt_created_at");
    expect(container.querySelector(".receipt-print-goods").textContent).toContain("Roof repair bags");
    expect(container.querySelector(".receipt-print-charges").textContent).toContain("₹30");
    expect(container.querySelector(".receipt-print-charges").textContent).toContain("₹5");
    expect(container.querySelector(".receipt-print-charges").textContent).toContain("₹35");
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
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Create New Receipt")).click();
    });
    await act(async () => {
      setInput('input[placeholder="Type name"]', "Suresh", 1);
      setInput('[aria-label="Goods type row 1"]', "Cement");
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

  it("settles the full Bhada from the owner ledger with one payment tick", async () => {
    const row = {
      id: "lr-1", site_id: site.id, trip_id: trip.id, trip_ref: trip.trip_ref,
      trip_status: "open", lr_ref: "NGP-LR-01", receipt_date: trip.operating_date,
      sender_name: "Sender", receiver_name: "Receiver", rent: "100.00", hamali: "10.00",
      total_rent: "110.00", paid_total: "20.00", outstanding: "80.00",
      payment_status: "partial", ledger_settlement_created: false,
      goods_rows: [{ type: "Cement", type_hindi: "सीमेंट", quantity: 1, rent: "100.00", hamali: "10.00" }],
      updated_at: "version-1",
    };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/ledger/entries`) return Promise.resolve({ data: { rows: [row], total: 1 } });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    api.post.mockResolvedValue({
      data: { id: row.id, received: true, paid_total: "100.00", outstanding: "0.00" },
    });

    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    const received = container.querySelector('[aria-label="NGP-LR-01 payment received"]');
    expect(received.checked).toBe(false);
    await act(async () => {
      received.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.post).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/${row.id}/settlement`,
      expect.objectContaining({ received: true, idempotency_key: expect.any(String) }),
    );
    expect(container.querySelector('[aria-label="NGP-LR-01 payment received"]').checked).toBe(true);
  });

  it("offers owner-only restore for a voided ledger receipt", async () => {
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
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    const prompt = jest.spyOn(window, "prompt").mockReturnValue("Duplicate voided in error");

    await renderBooking("ledger", "owner");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    const restore = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Restore"));
    expect(restore).toBeDefined();
    await act(async () => {
      restore.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.post).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/${trip.id}/lrs/${row.id}/unvoid`,
      expect.objectContaining({ reason: "Duplicate voided in error", idempotency_key: expect.any(String) }),
    );
    prompt.mockRestore();
  });
});
