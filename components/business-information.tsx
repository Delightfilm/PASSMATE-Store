import { businessInfo } from "@/lib/business-info";

export function BusinessInformation() {
  return (
    <dl className="business-information" aria-label="사업자 정보">
      <div><dt>상호</dt><dd>{businessInfo.companyName}</dd></div>
      {businessInfo.representative && <div><dt>대표</dt><dd>{businessInfo.representative}</dd></div>}
      <div><dt>사업자등록번호</dt><dd>{businessInfo.registrationNumber}</dd></div>
      {businessInfo.commerceRegistration && <div><dt>통신판매업 신고번호</dt><dd>{businessInfo.commerceRegistration}</dd></div>}
      {businessInfo.email && <div><dt>이메일</dt><dd><a href={`mailto:${businessInfo.email}`}>{businessInfo.email}</a></dd></div>}
      {businessInfo.address && <div><dt>사업장 소재지</dt><dd>{businessInfo.address}</dd></div>}
      {businessInfo.phone && <div><dt>전화</dt><dd><a href={`tel:${businessInfo.phone}`}>{businessInfo.phone}</a></dd></div>}
      {businessInfo.supportHours && <div><dt>고객센터 운영시간</dt><dd>{businessInfo.supportHours}</dd></div>}
    </dl>
  );
}
