import { afterEach, describe, expect, it } from "vitest";
import { toast, toastStore } from "./toast";

const items = () => toastStore.getSnapshot();

afterEach(() => {
  for (const item of items()) toastStore.remove(item.id);
});

describe("toast", () => {
  it("adds a toast per call with the type's duration", () => {
    toast.success("Saved");
    toast.error("Failed");
    toast("Copied");
    toast.loading("Saving…");
    expect(items().map((t) => [t.type, t.duration])).toEqual([
      ["success", 4000],
      ["error", 6000],
      ["neutral", 4000],
      ["loading", Infinity],
    ]);
  });

  it("gives toasts with buttons more time, unless a duration is set", () => {
    toast.success("Deleted", { action: { label: "Undo", onClick: () => {} } });
    toast.info("Invite", { cancel: { label: "Not now", onClick: () => {} }, duration: 2000 });
    expect(items().map((t) => t.duration)).toEqual([8000, 2000]);
  });

  it("updates a toast in place when the id is reused", () => {
    const id = toast.loading("Saving…", { description: "One moment" });
    toast.success("Saved", { id });
    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ id, type: "success", title: "Saved", version: 2 });
    expect(items()[0].description).toBeUndefined();
  });

  it("marks toasts as leaving on dismiss and keeps them until removed", () => {
    const a = toast("A");
    toast("B");
    toast.dismiss(a);
    expect(items().map((t) => t.leaving)).toEqual([true, false]);
    toast.dismiss();
    expect(items().every((t) => t.leaving)).toBe(true);
    toastStore.remove(a);
    expect(items()).toHaveLength(1);
  });

  it("calls onClose once when the toast closes, not when it is updated", () => {
    let closed = 0;
    const id = toast("Deleted", { onClose: () => closed++ });
    toast("Deleted again", { id, onClose: () => closed++ });
    expect(closed).toBe(0);
    toast.dismiss(id);
    toast.dismiss(id);
    toast.dismiss();
    expect(closed).toBe(1);
  });

  it("resolves a promise toast to success or error", async () => {
    await toast.promise(Promise.resolve(124), { loading: "Importing…", success: (n) => `${n} imported`, error: "Failed" });
    expect(items()[0]).toMatchObject({ type: "success", title: "124 imported" });

    const failing = Promise.reject(new Error("Bad file"));
    await toast.promise(failing, { loading: "Importing…", success: "Done", error: (e) => (e as Error).message }).catch(() => {});
    await Promise.resolve();
    expect(items()[1]).toMatchObject({ type: "error", title: "Bad file" });
  });

  it("notifies subscribers", () => {
    let calls = 0;
    const unsubscribe = toastStore.subscribe(() => calls++);
    toast("Hi");
    unsubscribe();
    toast("Bye");
    expect(calls).toBe(1);
  });
});
