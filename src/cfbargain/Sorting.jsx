import { useMemo, useState } from "react";

// Sort `rows` (arriving best first) by any column in `sorts`, a map of
// { value: row => sortable, dir: first-click direction (-1 = high to low, 1 = A to Z) }.
// Each row gets `rank`, its place in the original order, which never changes.
export function useSorted(rows, sorts) {
  const [sort, setSort] = useState({ key: "rank", dir: 1 });
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : sorts[key].dir }));
  const sorted = useMemo(() => {
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    const value = sort.key === "rank" ? (r) => r.rank : sorts[sort.key].value;
    return ranked.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null && vb == null) return a.rank - b.rank;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      return cmp * sort.dir || a.rank - b.rank;
    });
  }, [rows, sorts, sort]);
  return { sorted, sort, onSort };
}

// A column header that sorts the table; shows ↑/↓ on the active column.
export function SortHeader({ id, sort, onSort, className, title, children }) {
  const active = sort.key === id;
  return (
    <th className={className} title={title}
      aria-sort={active ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(id)}>
        {children}
        {active && <span aria-hidden="true">{sort.dir > 0 ? " ↑" : " ↓"}</span>}
      </button>
    </th>
  );
}
