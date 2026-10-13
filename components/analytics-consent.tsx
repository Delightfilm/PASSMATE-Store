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
  const notice=<p>방문 경로와 페이지 이용 시간을 Google Analytics로 분석해 학습 서비스를 개선합니다. 이름·이메일·답안은 보내지 않으며, 거절해도 모든 학습 기능을 이용할 수 있습니다. 하단 ‘분석 설정’에서 변경할 수 있습니다.</p>;
  const publicPage=Boolean(sanitizePage(`https://www.mypassmate.com${pathname}`,publicQualifications));
  return <>{loaded && choice===null && publicPage && <aside className="analytics-consent-banner" aria-label="방문 분석 선택"><div>{notice}</div>{buttons}</aside>}
    <dialog ref={dialog} className="analytics-consent-dialog" aria-labelledby="analytics-consent-title" onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close();}}><div><h2 id="analytics-consent-title">방문 분석 설정</h2>{notice}<p>현재 선택: {choice==='granted'?'허용':choice==='denied'?'거절':'선택 전'}</p>{buttons}<button type="button" className="analytics-close" onClick={close}>닫기</button></div></dialog></>;
}
