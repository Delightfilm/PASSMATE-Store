"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addToCart,
  getPackagePrice,
  getPackageSlug,
  PACKAGE_LABELS,
  PackageType,
} from "@/lib/cart";

const packageRows = [
  ["PASS PACK 상세 합격교재", false, true],
  ["CORE 핵심요약", true, true],
  ["SHEET 공식·숫자 치트시트", true, true],
  ["CHECK 시험직전 체크리스트", true, true],
] as const;

function toFamilyTitle(title: string) {
  return title
    .replace(/\s*핵심요약\s*패키지\s*$/, "")
    .replace(/\s*합격팩\s*$/, "")
    .trim();
}

export function ProductPurchaseOptions({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [kind, setKind] = useState<PackageType>("core");
  const [notice, setNotice] = useState("");
  const familyTitle = useMemo(() => toFamilyTitle(title), [title]);
  const selectedPrice = getPackagePrice(kind);
  const selectedSlug = getPackageSlug(slug, kind);

  function add() {
    const result = addToCart({
      familySlug: slug,
      title: familyTitle,
      packageType: kind,
    });

    setNotice(
      result === "replaced"
        ? PACKAGE_LABELS[kind] + "으로 장바구니 구성을 변경했습니다."
        : result === "unchanged"
          ? "이미 같은 상품이 장바구니에 있습니다."
          : PACKAGE_LABELS[kind] + "을 장바구니에 담았습니다."
    );
  }

  return (
    <>
      <div className="package-tabs" role="tablist" aria-label="상품 구성 선택">
        <button
          type="button"
          className={kind === "core" ? "package-tab package-tab--active" : "package-tab"}
          onClick={() => { setKind("core"); setNotice(""); }}
          role="tab"
          aria-selected={kind === "core"}
        >
          핵심요약 패키지
          <small>{getPackagePrice("core").toLocaleString("ko-KR")}원</small>
        </button>
        <button
          type="button"
          className={kind === "pass" ? "package-tab package-tab--active" : "package-tab"}
          onClick={() => { setKind("pass"); setNotice(""); }}
          role="tab"
          aria-selected={kind === "pass"}
        >
          합격팩
          <small>{getPackagePrice("pass").toLocaleString("ko-KR")}원</small>
        </button>
      </div>

      <div className="package-compare" aria-label="상품 구성 비교">
        <div className="package-compare-row package-compare-head">
          <b>구성품</b><b>핵심요약</b><b>합격팩</b>
        </div>
        {packageRows.map(([label, core, pass]) => (
          <div className="package-compare-row" key={label}>
            <span>{label}</span>
            <span aria-label={core ? "포함" : "미포함"}>{core ? "✓" : "—"}</span>
            <span aria-label={pass ? "포함" : "미포함"}>{pass ? "✓" : "—"}</span>
          </div>
        ))}
      </div>

      <p className="package-help">
        합격팩은 핵심요약 패키지 전체에 PASS PACK 상세 합격교재가 추가됩니다.
      </p>

      <div className="package-actions">
        <button type="button" className="button button-primary" onClick={add}>
          장바구니 담기
        </button>
        <Link
          className="button button-ghost"
          href={"/checkout/?product=" + encodeURIComponent(selectedSlug)}
        >
          {selectedPrice.toLocaleString("ko-KR")}원 바로 구매
        </Link>
      </div>

      {notice ? <p className="package-cart-notice" role="status">{notice}</p> : null}
    </>
  );
}
