const KEY='passmate.analytics.learning.v1';
export function createLearningTracker(deps) {
  const pending=new Map(), memory=new Set();
  function keys() {try {const value=JSON.parse(deps.storage?.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string').slice(-1000):[];}catch{return [];}}
  function send(input) {
    const name=input.kind==='start'?'exam_start':'exam_complete', key=`${name}:${input.localAttemptKey}`;
    if(memory.has(key)||keys().includes(key))return false;
    const count=input.count, bucket=count<=20?'1-20':count<=40?'21-40':count<=60?'41-60':'61-plus';
    if(!deps.track(name,{qualification_slug:input.qualificationSlug,...(input.method?{learning_method:input.method}:{}),question_count_bucket:bucket},key))return false;
    memory.add(key);if(memory.size>1000)memory.delete(memory.values().next().value);
    try {deps.storage?.setItem(KEY,JSON.stringify([...new Set([...keys(),key])].slice(-1000)));}catch{/* In-memory dedupe remains. */}
    return true;
  }
  return {
    record(input) {
      if(!input||typeof input!=='object'||Object.keys(input).some(x=>!['kind','qualificationSlug','method','count','localAttemptKey','persisted','alreadySubmitted'].includes(x)))return false;
      if(!['start','complete'].includes(input.kind)||!(input.kind==='complete'&&input.method===undefined)&&!['past','mock','custom','retry'].includes(input.method)||!Number.isInteger(input.count)||input.count<1||input.count>10000||!input.persisted||input.alreadySubmitted||typeof input.localAttemptKey!=='string'||input.localAttemptKey.length>200||typeof input.qualificationSlug!=='string')return false;
      if(!deps.isPublicExam(input.localAttemptKey)){pending.set(`${input.kind}:${input.localAttemptKey}`,{...input});if(pending.size>20)pending.delete(pending.keys().next().value);return false;}
      return send(input);
    },
    flush() { for(const [key,input] of pending){if(deps.isPublicExam(input.localAttemptKey)){pending.delete(key);send(input);}} },
    clear() {pending.clear();memory.clear();},
  };
}
