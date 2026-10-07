import { act } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { api } from "../lib/api";
import { registerBookingTestHarness } from "./Booking.testUtils";
import { romanHindi } from "./Booking";
jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  errMsg: (error) => error?.response?.data?.detail || "Request failed",
}));

describe("simple booking workflow", () => {
  const { container, site, trip, flushMicrotasks, getByLabelText, getByRole, clickButton,
    createLedgerRow, mockBookingApi, renderBooking, setInput } = registerBookingTestHarness();

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

  describe("trip and receipt entry", () => {
  it("switches receipt entry to Hindi, remembers the choice, and keeps saved fields unchanged", async () => {
    api.post.mockImplementation((path, body) => Promise.resolve({
      data: path.endsWith("/lrs") ? { ...body, id: "lr-hi", lr_ref: "NGP-LR-HI" } : trip,
    }));
    await renderBooking();
    await clickButton("हिंदी");

    expect(localStorage.getItem("booking_language")).toBe("hi");
    expect(screen.getByRole("button", { name: "हिंदी" }).getAttribute("aria-pressed")).toBe("true");
    const dailySummary = screen.getByRole("region", { name: "आज के काम का सारांश" });
    expect(dailySummary.textContent).toContain("बाकी यात्राएँ");
    expect(dailySummary.textContent).toContain("बनी हुई रसीदें");
    expect(dailySummary.textContent).toContain("अभी लेना बाकी");
    await clickButton("यात्रा बनाएँ");
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushMicrotasks();
    });

    expect(getByLabelText("प्राप्तकर्ता का नाम")).not.toBeNull();
    expect(getByLabelText("सामान का नाम · 1").placeholder).toBe("सामान का नाम");
    expect(getByLabelText("मात्रा · 1").placeholder).toBe("मात्रा लिखें");
    expect(container.textContent).toContain("कुल रकम");

    await act(async () => {
      setInput("प्राप्तकर्ता का नाम", "Suresh");
      setInput("सामान का नाम · 1", "Cement");
      setInput("मात्रा · 1", "3");
    });
    await act(async () => {
      screen.getByRole("button", { name: "रसीद सेव करें", exact: true }).click();
      await flushMicrotasks();
    });
    await waitFor(() => expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(true));

    const [, submittedReceipt] = api.post.mock.calls.find(([path]) => path.endsWith("/lrs"));
    expect(submittedReceipt.receiver_name).toBe("Suresh");
    expect(submittedReceipt.goods_rows).toEqual([{ type: "Cement", type_hindi: "सीमेंट", description: "", description_hindi: "", quantity: 3 }]);
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
      await flushMicrotasks();
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
      await flushMicrotasks();
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

  it("rejects missing or fractional receipt goods without sending a request", async () => {
    await renderBooking();
    await clickButton("Create Trip");
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushMicrotasks();
    });
    await waitFor(() => expect(getByLabelText("Receiver name in English")).not.toBeNull());

    await clickButton("Save receipt");
    expect(screen.getByRole("alert").textContent)
      .toContain("Enter the receiver and at least one goods row.");
    expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(false);

    await act(async () => {
      setInput("Receiver name in English", "Suresh");
      setInput("Goods and description row 1", "Cement");
      setInput("Quantity row 1", "1.5");
    });
    await clickButton("Save receipt");
    expect(screen.getByRole("alert").textContent)
      .toContain("Goods quantity must be a whole number greater than zero.");
    expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(false);
  });

  it("recovers a locally saved receipt draft after closing and reopening the form", async () => {
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    mockBookingApi({ trips: [trip] });
    await renderBooking("receipts");
    await waitFor(() => expect(getByLabelText("Receiver name in English")).not.toBeNull());
    await act(async () => {
      setInput("Receiver name in English", "Suresh");
      setInput("Goods and description row 1", "Cement");
      setInput("Quantity row 1", "3");
    });

    const draftKey = `booking_receipt_draft:${encodeURIComponent(site.id)}:${encodeURIComponent(trip.id)}:Manager%20Name`;
    await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey)).form.receiver_name).toBe("Suresh"));
    expect(screen.getByText("Draft saved locally on this device.")).not.toBeNull();

    await clickButton("Cancel receipt");
    await clickButton("New receipt");
    await waitFor(() => expect(screen.getByText(/A saved receipt draft is available/)).not.toBeNull());
    await clickButton("Resume draft");
    expect(getByLabelText("Receiver name in English").value).toBe("Suresh");
    expect(getByLabelText("Goods and description row 1").value).toBe("Cement");
    expect(getByLabelText("Quantity row 1").value).toBe("3");
    expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(false);
  });

  it("lets the user discard an unreadable local receipt draft", async () => {
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    const draftKey = `booking_receipt_draft:${encodeURIComponent(site.id)}:${encodeURIComponent(trip.id)}:Manager%20Name`;
    localStorage.setItem(draftKey, "{malformed");
    mockBookingApi({ trips: [trip] });
    await renderBooking("receipts");

    await waitFor(() => expect(screen.getByRole("button", { name: "Discard unreadable draft" })).not.toBeNull());
    expect(screen.queryAllByText(/A saved receipt draft could not be read/).length).toBeGreaterThan(0);
    await clickButton("Discard unreadable draft");
    expect(localStorage.getItem(draftKey)).toBeNull();
    expect(screen.queryAllByText(/A saved receipt draft could not be read/)).toHaveLength(0);
    expect(getByLabelText("Receiver name in English").value).toBe("");
  });

  it("does not offer a saved draft belonging to a different trip or user", async () => {
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    const otherTripDraftKey =
      `booking_receipt_draft:${encodeURIComponent(site.id)}:trip-2:Manager%20Name`;
    const otherUserDraftKey =
      `booking_receipt_draft:${encodeURIComponent(site.id)}:${encodeURIComponent(trip.id)}:Owner%20Name`;
    const savedForm = {
      receipt_date: trip.operating_date, sender_name: "", sender_address: "",
      receiver_name: "Other person", receiver_address: "", receiver_phone: "",
      rent: "0", hamali: "0",
      goods_rows: [{ type: "", type_hindi: "", description: "", description_hindi: "", quantity: "" }],
    };
    localStorage.setItem(otherTripDraftKey, JSON.stringify({ version: 1, form: savedForm }));
    localStorage.setItem(otherUserDraftKey, JSON.stringify({ version: 1, form: savedForm }));
    mockBookingApi({ trips: [trip] });
    await renderBooking("receipts");

    await waitFor(() => expect(getByLabelText("Receiver name in English")).not.toBeNull());
    expect(screen.queryByText(/A saved receipt draft is available/)).toBeNull();
    expect(getByLabelText("Receiver name in English").value).toBe("");
    expect(localStorage.getItem(otherTripDraftKey)).not.toBeNull();
    expect(localStorage.getItem(otherUserDraftKey)).not.toBeNull();
  });

  it("suggests past receivers and copies goods without carrying forward charges", async () => {
    const previousReceipt = {
      id: "lr-previous", lr_ref: "NGP-LR-01", receiver_name: "Suresh",
      receiver_phone: "9876543210", sender_name: "Ramesh", rent: "500",
      hamali: "25", goods_rows: [{ type: "Cement", type_hindi: "सीमेंट", quantity: 4 }],
    };
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    mockBookingApi({ trips: [trip], receipts: [previousReceipt] });
    await renderBooking("receipts");
    await waitFor(() => expect(screen.getByLabelText("Use a previous receiver")).not.toBeNull());

    fireEvent.change(screen.getByLabelText("Use a previous receiver"), {
      target: { value: previousReceipt.id },
    });
    expect(getByLabelText("Receiver name in English").value).toBe("Suresh");
    expect(getByLabelText("Receiver phone (10 digits, optional)").value).toBe("9876543210");

    await clickButton("Copy previous receipt");
    expect(getByLabelText("Sender name in English").value).toBe("Ramesh");
    expect(getByLabelText("Receiver name in English").value).toBe("Suresh");
    expect(getByLabelText("Goods and description row 1").value).toBe("Cement");
    expect(getByLabelText("Quantity row 1").value).toBe("4");
    expect(getByLabelText("Receipt Bhada").value).toBe("0");
    expect(getByLabelText("Receipt Hamali").value).toBe("0");
    expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(false);
  });

  it("searches receipts and filters payment and void status", async () => {
    const receiptRows = [
      { id: "lr-paid", lr_ref: "NGP-LR-PAID", receiver_name: "Geeta",
        rent: "100", hamali: "0", receipt_fee: "2", paid_total: "102", outstanding: "0",
        payment_status: "paid", goods_rows: [{ type: "Rice", quantity: 1 }] },
      { id: "lr-unpaid", lr_ref: "NGP-LR-UNPAID", receiver_name: "Asha", receiver_phone: "1111111111",
        rent: "100", hamali: "0", receipt_fee: "2", paid_total: "0", outstanding: "102",
        payment_status: "unpaid", goods_rows: [{ type: "Cement", quantity: 1 }] },
      { id: "lr-partial", lr_ref: "NGP-LR-PARTIAL", receiver_name: "Suresh", receiver_phone: "2222222222",
        rent: "100", hamali: "0", receipt_fee: "2", paid_total: "40", outstanding: "62",
        payment_status: "partial", goods_rows: [{ type: "Grain", quantity: 2 }] },
      { id: "lr-unpriced", lr_ref: "NGP-LR-UNPRICED", receiver_name: "Mohan",
        payment_status: "unpriced", goods_rows: [{ type: "Steel", quantity: 3 }] },
      { id: "lr-voided", lr_ref: "NGP-LR-VOID", receiver_name: "Ramesh", voided: true,
        rent: "100", hamali: "0", receipt_fee: "2", paid_total: "0", outstanding: "102",
        payment_status: "unpaid", goods_rows: [{ type: "Steel", quantity: 3 }] },
    ];
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    mockBookingApi({ trips: [trip], receipts: receiptRows });
    await renderBooking("receipts");
    await waitFor(() => expect(container.textContent).toContain("NGP-LR-PARTIAL"));
    expect(container.textContent).toContain("Still to collect: ₹62");
    expect(container.textContent).toContain("Pending payment");
    expect(container.textContent).toContain("Partially paid");
    expect(container.textContent).toContain("Paid");
    expect(container.textContent).toContain("Unpriced");
    expect(container.textContent).toContain("VOID");
    expect(container.querySelector("svg.lucide-circle-check")).not.toBeNull();
    expect(Array.from(container.querySelectorAll("svg"), (icon) => icon.getAttribute("class")))
      .toEqual(expect.arrayContaining([expect.stringContaining("clock")]));
    expect(container.querySelector("svg.lucide-circle-help")).not.toBeNull();
    expect(container.querySelector("svg.lucide-ban")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Filter receipts by payment status"), {
      target: { value: "partial" },
    });
    expect(container.textContent).toContain("NGP-LR-PARTIAL");
    expect(container.textContent).not.toContain("NGP-LR-UNPAID");
    expect(container.textContent).not.toContain("NGP-LR-UNPRICED");

    fireEvent.change(screen.getByLabelText("Filter receipts by payment status"), {
      target: { value: "all" },
    });
    expect(container.textContent).toContain("Unpriced");
    fireEvent.change(screen.getByLabelText("Filter receipts by payment status"), {
      target: { value: "unpriced" },
    });
    expect(container.textContent).toContain("NGP-LR-UNPRICED");
    expect(container.textContent).not.toContain("NGP-LR-PARTIAL");
    fireEvent.change(screen.getByLabelText("Filter receipts by payment status"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("Search receipts"), { target: { value: "2222222222" } });
    expect(container.textContent).toContain("NGP-LR-PARTIAL");
    expect(container.textContent).not.toContain("NGP-LR-UNPAID");

    fireEvent.change(screen.getByLabelText("Search receipts"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter receipts by receipt status"), {
      target: { value: "voided" },
    });
    expect(container.textContent).toContain("NGP-LR-VOID");
    expect(container.textContent).not.toContain("NGP-LR-PARTIAL");

    fireEvent.change(screen.getByLabelText("Filter receipts by payment status"), {
      target: { value: "partial" },
    });
    expect(container.textContent).toContain("No receipts match these filters.");
  });

  it("keeps an unsaved receipt available for retry after reconnecting", async () => {
    api.post.mockImplementation((path) => Promise.resolve({
      data: path.endsWith("/lrs")
        ? { id: "lr-1", lr_ref: "NGP-LR-01", receipt_fee: "2.00" }
        : trip,
    }));

    await renderBooking();
    await clickButton("Create Trip");
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flushMicrotasks();
    });
    await waitFor(() => expect(getByLabelText("Receiver name in English")).not.toBeNull());
    await act(async () => {
      setInput("Receiver name in English", "Suresh");
      setInput("Goods and description row 1", "Cement");
      setInput("Quantity row 1", "3");
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    });

    await clickButton("Save receipt");
    expect(container.querySelector('[role="alert"]').textContent)
      .toContain("Offline — receipt not saved.");
    expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(false);

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    await clickButton("Save receipt");
    await waitFor(() => expect(api.post.mock.calls.some(([path]) => path.endsWith("/lrs"))).toBe(true));
    await waitFor(() => expect(container.textContent).toContain("Saved"));
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
      await flushMicrotasks();
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
        button.textContent.includes("Print paper")).click();
    });
    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

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
      await flushMicrotasks();
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
    await waitFor(() => expect(container.querySelector('[aria-label="Goods and description row 1"]')).not.toBeNull());
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
    await waitFor(() => expect(Array.from(container.querySelectorAll("button"))
      .some((button) => button.textContent === "Edit")).toBe(true));
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
      await flushMicrotasks();
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
    await waitFor(() => expect(Array.from(container.querySelectorAll("button"))
      .some((button) => button.textContent === "Edit")).toBe(true));
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
      await flushMicrotasks();
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
    await waitFor(() => expect(Array.from(container.querySelectorAll("button"))
      .some((button) => button.textContent === "Edit")).toBe(true));
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Edit").click();
    });
    await act(async () => {
      setInput('[aria-label="Goods and description row 1"]', "Cement");
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Save changes")).click();
      await flushMicrotasks();
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
      await flushMicrotasks();
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
      await flushMicrotasks();
    });
    expect(container.textContent).toContain("Check the receiver before saving");
    expect(container.textContent).toContain("Same receiver: Suresh");
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("Same receiver: Suresh")).click();
      await flushMicrotasks();
    });
    const receiptRequests = api.post.mock.calls.filter(([path]) => path.endsWith("/lrs"));
    expect(receiptAttempts).toBe(2);
    expect(receiptRequests[1][1]).toMatchObject({
      receiver_match_action: "same",
      receiver_identity_id: "receiver-1",
    });
  });

  it("still asks for duplicate-receiver confirmation after copying a previous receipt", async () => {
    const previousReceipt = {
      id: "lr-previous", lr_ref: "NGP-LR-01", sender_name: "Ramesh",
      receiver_name: "Suresh", receiver_phone: "9876543210", rent: "500",
      hamali: "25", goods_rows: [{ type: "Cement", quantity: 4 }],
    };
    let receiptAttempts = 0;
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    mockBookingApi({ trips: [trip], receipts: [previousReceipt] });
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
      return Promise.resolve({ data: { id: "lr-new", lr_ref: "NGP-LR-02" } });
    });
    await renderBooking("receipts");
    await waitFor(() => expect(screen.getByLabelText("Use a previous receiver")).not.toBeNull());
    await clickButton("Copy previous receipt");
    await clickButton("Save receipt");

    expect(screen.getByText("Check the receiver before saving")).not.toBeNull();
    expect(screen.getByText("Same receiver: Suresh")).not.toBeNull();
    const firstAttempt = api.post.mock.calls.filter(([path]) => path.endsWith("/lrs"))[0][1];
    expect(firstAttempt).toMatchObject({
      receiver_name: "Suresh",
      receiver_phone: "9876543210",
      rent: "0",
      hamali: "0",
    });
    expect(api.post.mock.calls.filter(([path]) => path.endsWith("/lrs"))).toHaveLength(1);
  });
  });
});
