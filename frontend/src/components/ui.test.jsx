import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { scheduleMutationSuccess, toast, ToastHost } from "./ui";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("global toast host", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ToastHost />));
  });

  afterEach(() => {
    act(() => root.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    container.remove();
  });

  it("replaces a mutation success fallback when the page already announces success", () => {
    act(() => {
      scheduleMutationSuccess();
      toast("Trip updated");
      jest.advanceTimersByTime(700);
    });

    expect(container.querySelectorAll('[data-testid="toast"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="toast"] span').textContent).toBe("Trip updated");
  });

  it("deduplicates the matching page error without hiding separate failed writes", () => {
    act(() => {
      toast("Trip date is required", "err", { apiError: true });
      toast("Trip date is required", "err");
      toast("Trip date is required", "err", { apiError: true });
    });

    expect(container.querySelectorAll('[data-testid="toast"]')).toHaveLength(2);
  });
});
