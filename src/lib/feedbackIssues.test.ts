import { describe, expect, it } from "vitest";
import { feedbackIssueBody, feedbackIssueTitle, neutralizeUserText } from "./feedbackIssues";

const WJ = "⁠";

describe("neutralizeUserText", () => {
  it("breaks mentions and issue references", () => {
    const out = neutralizeUserText("ping @octocat and @org/team, see #12, owner/repo#3 and GH-4");
    expect(out).not.toMatch(/@[a-z]/i);
    expect(out).not.toMatch(/#\d/);
    expect(out).not.toMatch(/GH-\d/);
    expect(out).toContain(`@${WJ}octocat`);
  });

  it("escapes markdown and html so the text renders literally", () => {
    const out = neutralizeUserText("**bold** <img src=x onerror=alert(1)> [link](http://x) `code`");
    expect(out).not.toContain("**");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("](");
    expect(out).toContain("\\`code\\`");
  });
});

describe("feedbackIssueTitle", () => {
  it("uses the first non-empty line, collapsed", () => {
    expect(feedbackIssueTitle("\n\n  La   campana\ttarda  \nmás detalles")).toBe("La campana tarda");
  });

  it("cuts long messages at a word boundary", () => {
    const title = feedbackIssueTitle(
      "En pantallas pequeñas, en el inicio, determinados meses hacen que se sobreponga la etiqueta de hoy sobre el mes"
    );
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });

  it("breaks mentions in the title too", () => {
    expect(feedbackIssueTitle("hola @octocat #5")).toBe(`hola @${WJ}octocat #${WJ}5`);
  });
});

describe("feedbackIssueBody", () => {
  it("quotes every line and carries the type, date and id but nothing about the user", () => {
    const body = feedbackIssueBody({
      id: "3f1400a6-5fe2-467a-9785-2a8bd79b2db2",
      type: "error",
      message: "línea uno\r\n\r\nlínea dos",
      created_at: "2026-11-20 14:18:06.106881+00",
    });
    expect(body).toBe(
      "> línea uno\n>\n> línea dos\n\n---\nError enviado desde la app · 2026-11-20 · feedback `3f1400a6-5fe2-467a-9785-2a8bd79b2db2`"
    );
  });

  it("can't break out of the quote with a newline", () => {
    const body = feedbackIssueBody({ id: "x", type: "suggestion", message: "a\n# Heading\n---", created_at: "2026-11-20" });
    for (const line of body.split("\n\n---\n")[0].split("\n")) expect(line.startsWith(">")).toBe(true);
  });
});
