"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";
import { qualificationHref, searchQualifications } from "@/lib/cbt-home-catalog";

export function CertificationSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = useMemo(() => searchQualifications(query), [query]);
  const visible = open && !!query.trim();
  const expanded = visible && results.length > 0;
  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setActive(-1); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      if (results.length) setActive(current => event.key === "ArrowDown" ? (current + 1) % results.length : (current <= 0 ? results.length : current) - 1);
    } else if (event.key === "Enter" && visible && results.length && !event.nativeEvent.isComposing) {
      event.preventDefault(); router.push(qualificationHref(results[active >= 0 ? active : 0].slug));
    }
  }
  return <div className="learning-search">
    <label className="learning-search-label" htmlFor="certification-query">자격증 검색</label>
    <div className="learning-search-field">
      <input id="certification-query" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? "certification-results" : undefined} aria-activedescendant={expanded && active >= 0 ? `certification-option-${active}` : undefined} autoComplete="off" placeholder="자격증 이름 검색" value={query}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }} onKeyDown={handleKey} />
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </div>
    {visible && <div className="learning-search-popup">
      {results.length ? <ul id="certification-results" role="listbox" aria-label="자격증 검색 결과">
        {results.map((item, index) => <li role="presentation" key={item.code}>
          <Link id={`certification-option-${index}`} role="option" aria-selected={active === index} tabIndex={-1} href={qualificationHref(item.slug)} prefetch={false}
            onMouseDown={event => event.preventDefault()} onClick={() => setOpen(false)}>
            <strong>{item.title}</strong><span>{item.exams.toLocaleString("ko-KR")}개 회차</span>
          </Link>
        </li>)}
      </ul> : <p role="status">검색 결과가 없어요. 자격증 이름을 다시 확인해 주세요.</p>}
    </div>}
    <span className="learning-search-label" role="status" aria-live="polite">{visible ? `${results.length}개 검색 결과` : ""}</span>
  </div>;
}
