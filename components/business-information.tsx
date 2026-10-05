import { businessInfo } from "@/lib/business-info";

export function BusinessInformation() {
  const details = [
    ["대표자", businessInfo.representative],
    ["주소", businessInfo.address],
    ["통신판매업 신고번호", businessInfo.commerceRegistration],
    ["고객센터 운영시간", businessInfo.supportHours],
  ].filter(([, value]) => value.trim());
  return <div className="business-information" aria-label="사업자 정보">
    <p>{businessInfo.companyName} · 사업자등록번호 {businessInfo.registrationNumber}</p>
    {details.map(([label, value]) => <p key={label}>{label} {value}</p>)}
    {businessInfo.email && <p>고객센터 <a href={`mailto:${businessInfo.email}`}>{businessInfo.email}</a></p>}
    {businessInfo.phone && <p>전화 <a href={`tel:${businessInfo.phone}`}>{businessInfo.phone}</a></p>}
  </div>;
}
