import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { flushPendingDeletes, startUndoableDelete } from "./undoableDelete";

type Row = { id: string };
const KEY = ["rows", "list"];
const rows = (queryClient: QueryClient) => queryClient.getQueryData<Row[]>(KEY);

function setup(commit: () => Promise<unknown> = () => Promise.resolve()) {
  const queryClient = new QueryClient();
  queryClient.setQueryData<Row[]>(KEY, [{ id: "a" }, { id: "b" }, { id: "c" }]);
  const commitFn = vi.fn(commit);
  const onError = vi.fn();
  const start = (id: string) =>
    startUndoableDelete({
      queryClient,
      edits: [{ queryKey: ["rows"], remove: (list: Row[]) => list.filter((row) => row.id !== id) }],
      commit: commitFn,
      invalidate: [["balances"]],
      onError,
    });
  return { queryClient, commitFn, onError, start };
}

describe("startUndoableDelete", () => {
  it("hides the item right away without calling the server", () => {
    const { queryClient, commitFn, start } = setup();
    start("b");
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "c" }]);
    expect(commitFn).not.toHaveBeenCalled();
  });

  it("restores the caches on undo and never sends the delete", async () => {
    const { queryClient, commitFn, start } = setup();
    const handle = start("b");
    handle.undo();
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    await handle.commit();
    expect(commitFn).not.toHaveBeenCalled();
  });

  it("sends the delete once, however many times commit runs", async () => {
    const { queryClient, commitFn, start } = setup();
    const handle = start("b");
    await Promise.all([handle.commit(), handle.commit()]);
    await handle.commit();
    expect(commitFn).toHaveBeenCalledTimes(1);
    expect(commitFn).toHaveBeenCalledWith({ keepalive: false });
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("ignores undo once the delete was sent", async () => {
    const { queryClient, start } = setup();
    const handle = start("b");
    await handle.commit();
    handle.undo();
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("hides the item again when a background refetch brings it back", () => {
    const { queryClient, start } = setup();
    start("b");
    queryClient.setQueryData<Row[]>(KEY, [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]);
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "c" }, { id: "d" }]);
  });

  it("keeps other pending deletes hidden when one is undone", () => {
    const { queryClient, start } = setup();
    const first = start("a");
    start("b");
    first.undo();
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("brings the item back and reports the error when the delete fails", async () => {
    const error = new Error("boom");
    const { queryClient, onError, start } = setup(() => Promise.reject(error));
    queryClient.setQueryDefaults(["rows"], { queryFn: () => [{ id: "a" }, { id: "b" }, { id: "c" }] });
    const handle = start("b");
    await handle.commit();
    expect(onError).toHaveBeenCalledWith(error);
    expect(rows(queryClient)).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("flushes every pending delete with keepalive when the page hides", async () => {
    const { commitFn, start } = setup();
    start("a");
    const undone = start("b");
    undone.undo();
    await flushPendingDeletes();
    expect(commitFn).toHaveBeenCalledTimes(1);
    expect(commitFn).toHaveBeenCalledWith({ keepalive: true });
  });
});
