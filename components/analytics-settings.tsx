"use client";
import {useEffect,useState} from 'react';
import {applyTrafficPreference,readTrafficPreferences,firstPartyAnalyticsAvailable} from '@/lib/traffic-aggregate';
import {analyticsAvailable,syncAnalyticsPreference} from '@/lib/analytics';
import type {TrafficChoice} from '@/lib/traffic-aggregate-policy.mjs';
export function AnalyticsSettings(){
 const [choice,setChoice]=useState<TrafficChoice|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{const update=()=>setChoice(readTrafficPreferences());update();window.addEventListener('storage',update);window.addEventListener('passmate:traffic-preference',update);return ()=>{window.removeEventListener('storage',update);window.removeEventListener('passmate:traffic-preference',update);};},[]);
 const choose=(mode:'off'|'basic'|'detail')=>{applyTrafficPreference(mode);syncAnalyticsPreference();const next=readTrafficPreferences();setChoice(next);setMessage(mode!=='off'&&!next.basic?'브라우저의 개인정보 보호 신호 또는 저장 제한으로 측정이 중지돼 있습니다.':'설정을 적용했습니다. 이전 집계가 자동 삭제되지는 않습니다.');};
 return <article className="legal-policy" aria-labelledby="traffic-settings-title"><header><h1 id="traffic-settings-title">방문 분석 설정</h1><p>선택을 바꾸어도 모든 학습 기능을 이용할 수 있습니다.</p></header>
 <div className="legal-policy-body"><p role="status">현재 적용: {choice===null?'확인 중':choice.ga4&&analyticsAvailable?'기본 집계 + GA4 상세 분석':choice.basic&&firstPartyAnalyticsAvailable?'기본 집계만 사용':'측정 중지'}</p>
 <h2>기본 집계</h2><p>공개 학습 화면의 조회수, 방문 시작 수, 네이버·구글 등 유입 분류와 화면이 보이고 포커스가 있는 동안의 활성 시간을 집계해 서비스를 개선합니다. 기본 집계용 쿠키나 방문자·기기 식별자를 만들지 않습니다.</p>
 <p>PASSMATE 서버를 거쳐 일별 전체·유입별·페이지별 합계를 따로 저장하며 최근 90일을 보관합니다. 분석 DB에 IP·회원 ID·이메일·답안·개별 이동 기록은 저장하지 않습니다. 새로고침과 새 탭은 다시 집계될 수 있으므로 방문 시작 수는 순방문자 수와 다릅니다.</p>
 <p>기본 집계는 Google에 보내지 않습니다. 웹호스팅·보안 사업자는 HTTP 요청 처리에 관여하며 기본 집계 DB의 저장 범위와는 다릅니다. 기존 거절과 브라우저의 GPC 신호를 존중합니다.</p>
 <h2>선택하는 GA4 상세 분석</h2><p>‘상세 분석도 허용’을 누르면 Google Analytics 4의 분석 쿠키와 브라우저 식별자를 사용합니다. 공개 페이지, 유입 출처, 종목과 풀이 시작·완료, 참여 시간, 대략적인 국가·도시·기기를 분석합니다. 이름·이메일·답안은 보내지 않으며 광고 신호와 광고 개인화는 이 측정에서 사용하지 않습니다.</p>
 <p>기존 GA4 보관 설정은 이벤트 2개월, 사용자 데이터 14개월이며 새 활동 시 사용자 보관 기간이 갱신됩니다. 표준 집계 보고서는 별개입니다. 분석 쿠키의 기본 유효기간은 2년이며 이용 시 갱신될 수 있습니다. 허용한 분석 정보는 Google의 전 세계 서버에서 처리될 수 있습니다.</p>
 <p>자체 집계와 GA4는 별도로 표시하며 합산하지 않습니다. ‘모두 중지’는 추가 측정을 중단하고 대기 데이터를 폐기합니다. 선택만 이 브라우저에 저장되며 다른 열린 탭에도 반영됩니다.</p>
 <div className="analytics-consent-actions"><button type="button" onClick={()=>choose('off')}>모두 중지</button><button type="button" disabled={!firstPartyAnalyticsAvailable} onClick={()=>choose('basic')}>기본 집계만 사용</button><button type="button" disabled={!analyticsAvailable} onClick={()=>choose('detail')}>상세 분석도 허용</button></div><p role="status">{message}</p>
 <p><a href="https://policies.google.com/privacy?hl=ko" target="_blank" rel="noreferrer">Google 개인정보 안내</a> · <a href="mailto:report@mypassmate.com">분석 문의</a></p></div></article>;
}
