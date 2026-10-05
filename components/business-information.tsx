import { businessInfo } from "@/lib/business-info";

export function BusinessInformation() {
  return <div className="business-information" aria-label="사업자 정보">
    <p>상호: {businessInfo.companyName}</p>
    <p className="business-information-meta"><span>사업자등록번호: {businessInfo.registrationNumber}</span>
      {businessInfo.representative && <span>대표: {businessInfo.representative}</span>}
      {businessInfo.email && <span>이메일: <a href={`mailto:${businessInfo.email}`}>{businessInfo.email}</a></span>}
    </p>
    {businessInfo.address && <p>사업장 소재지: {businessInfo.address}</p>}
    {businessInfo.commerceRegistration && <p>통신판매업 신고번호: {businessInfo.commerceRegistration}</p>}
    {businessInfo.phone && <p>전화 <a href={`tel:${businessInfo.phone}`}>{businessInfo.phone}</a></p>}
    {businessInfo.supportHours && <p>고객센터 운영시간: {businessInfo.supportHours}</p>}
  </div>;
}
