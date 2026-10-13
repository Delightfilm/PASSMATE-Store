"use client";
import {useEffect,useRef,useState} from 'react';
import {publicQualifications} from '@/lib/cbt-home-catalog';
import {sanitizePage} from '@/lib/analytics-policy.mjs';
import {readAnalyticsConsent,setAnalyticsConsent} from '@/lib/analytics';

export function AnalyticsConsent({pathname}:{pathname:string}) {
  const [choice,setChoice]=useState<'granted'|'denied'|null>(null);
  const [loaded,setLoaded]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),previousFocus=useRef<HTMLElement|null>(null);
  useEffect(()=> {
    const update=()=>{setChoice(readAnalyticsConsent());setLoaded(true);};
    const open=()=>{previousFocus.current=document.activeElement as HTMLElement;dialog.current?.showModal();};
    update();window.addEventListener('passmate:analytics-consent',update);window.addEventListener('passmate:analytics-settings',open);
    return ()=>{window.removeEventListener('passmate:analytics-consent',update);window.removeEventListener('passmate:analytics-settings',open);};
  },[]);
  const close=()=>{dialog.current?.close();previousFocus.current?.focus();};
  const choose=(value:'granted'|'denied')=>{setAnalyticsConsent(value);setChoice(value);close();};
  const buttons=<div className="analytics-consent-actions"><button type="button" onClick={()=>choose('denied')}>거절</button><button type="button" onClick={()=>choose('granted')}>허용</button></div>;
  const notice=<div><p>방문 경로와 페이지 이용 시간을 Google Analytics로 분석해 학습 서비스를 개선합니다. 이름·이메일·답안은 보내지 않으며, 거절해도 모든 학습 기능을 이용할 수 있습니다. 하단 ‘분석 설정’에서 변경할 수 있습니다.</p><details className="analytics-consent-detail"><summary>분석 정보 자세히 보기</summary><p>Google Analytics 4로 공개 페이지 주소, 유입 출처, 종목과 풀이 시작·완료, 참여 시간, 대략적인 국가·도시와 기기 정보를 집계합니다. Google의 분석 쿠키와 브라우저 식별자를 사용하며, 광고 신호와 광고 개인화는 이 측정에서 사용하지 않습니다.</p><p>현재 GA4 보관 설정은 이벤트 2개월, 사용자 데이터 14개월이며 새 활동 시 사용자 보관 기간이 갱신됩니다. 표준 집계 보고서는 이 기간과 별개입니다. 분석 쿠키의 기본 유효기간은 2년이며 이용 시 갱신될 수 있습니다.</p><p>허용한 경우 Google의 서버로 분석 정보가 전송되며 전 세계 서버에서 처리될 수 있습니다. 거절하거나 선택을 바꾸면 추가 측정을 중단합니다. 이전 집계가 자동 삭제되는 것은 아닙니다. 선택은 이 브라우저에 저장됩니다.</p><p><a href="https://policies.google.com/privacy?hl=ko" target="_blank" rel="noreferrer">Google 개인정보 안내</a> · <a href="mailto:report@mypassmate.com">분석 문의</a></p></details></div>;
  const publicPage=Boolean(sanitizePage(`https://www.mypassmate.com${pathname}`,publicQualifications));
  return <>{loaded && choice===null && publicPage && <aside className="analytics-consent-banner" aria-label="방문 분석 선택"><div>{notice}</div>{buttons}</aside>}
    <dialog ref={dialog} className="analytics-consent-dialog" aria-labelledby="analytics-consent-title" onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close();}}><div><h2 id="analytics-consent-title">방문 분석 설정</h2>{notice}<p>현재 선택: {choice==='granted'?'허용':choice==='denied'?'거절':'선택 전'}</p>{buttons}<button type="button" className="analytics-close" onClick={close}>닫기</button></div></dialog></>;
}
