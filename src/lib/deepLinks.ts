/** Parsing of the URL params that deep links use (`?sub=`, `?expense=`, `?tx=`, `?month=`). Pure, so it can be tested. */

/** An id in a URL: uuids and the like, never anything that could be markup or a path. */
export function parseIdParam(raw: string | null | undefined): string | null {
  return raw && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null;
}

/** `YYYY-MM` → year and month (1-12), or null when it isn't a valid month. */
export function parseMonthParam(raw: string | null | undefined): { year: number; month: number } | null {
  const match = raw ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw) : null;
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** The same URL without the given param(s), keeping the rest of the query string. */
export function hrefWithoutParams(pathname: string, search: URLSearchParams | string, names: string | string[]): string {
  const params = new URLSearchParams(typeof search === "string" ? search : search.toString());
  for (const name of Array.isArray(names) ? names : [names]) params.delete(name);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
