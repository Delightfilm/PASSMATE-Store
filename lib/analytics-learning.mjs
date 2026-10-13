const KEY='passmate.analytics.learning.v1';
export function createLearningTracker(deps) {
  const pending=new Map(), memory=new Set();let generation=0;
  function keys() {try {const value=JSON.parse(deps.storage?.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string').slice(-1000):[];}catch{return null;}}
  async function send(input,epoch) {
    if(epoch!==generation)return 'drop';
    if(!deps.isPublicExam(input.localAttemptKey))return 'retry';
    const name=input.kind==='start'?'exam_start':'exam_complete', key=`${name}:${input.localAttemptKey}`;
    const saved=keys();
    if(input.kind==='complete'&&saved===null)return 'drop';
    if(memory.has(key)||(saved||[]).includes(key))return 'duplicate';
    try{deps.storage?.setItem(KEY,JSON.stringify([...new Set([...(saved||[]),key])].slice(-1000)));}catch{if(input.kind==='complete')return 'drop';}
    memory.add(key);
    const count=input.count, bucket=count<=20?'1-20':count<=40?'21-40':count<=60?'41-60':'61-plus';
    let delivered=false;try{delivered=Boolean(await deps.track(name,{qualification_slug:input.qualificationSlug,...(input.method?{learning_method:input.method}:{}),question_count_bucket:bucket},key));}catch{/* Never break CBT. */}
    if(!delivered){memory.delete(key);try{deps.storage?.setItem(KEY,JSON.stringify((keys()||[]).filter(x=>x!==key)));}catch{/* Optional. */}return epoch===generation?'retry':'drop';}
    if(memory.size>1000)memory.delete(memory.values().next().value);
    return 'sent';
  }
  async function deliver(input,epoch){
    if(input.kind==='complete'&&(!deps.withLock||!deps.storage))return 'drop';
    try{return deps.withLock?await deps.withLock('passmate.analytics.learning',()=>send(input,epoch)):await send(input,epoch);}catch{return 'drop';}
  }
  return {
    async record(input) {
      if(!input||typeof input!=='object'||Object.keys(input).some(x=>!['kind','qualificationSlug','method','count','localAttemptKey','persisted','alreadySubmitted'].includes(x)))return false;
      if(!['start','complete'].includes(input.kind)||!(input.kind==='complete'&&input.method===undefined)&&!['past','mock','custom','retry'].includes(input.method)||!Number.isInteger(input.count)||input.count<1||input.count>10000||!input.persisted||input.alreadySubmitted||typeof input.localAttemptKey!=='string'||input.localAttemptKey.length>200||typeof input.qualificationSlug!=='string')return false;
      const epoch=generation,key=`${input.kind}:${input.localAttemptKey}`;
      pending.set(key,{...input});if(pending.size>20)pending.delete(pending.keys().next().value);
      if(!deps.isPublicExam(input.localAttemptKey))return false;
      const result=await deliver(input,epoch);if(result!=='retry')pending.delete(key);return result==='sent';
    },
    async flush() { const epoch=generation;for(const [key,input] of pending){if(deps.isPublicExam(input.localAttemptKey)){const result=await deliver(input,epoch);if(result!=='retry')pending.delete(key);}} },
    clear() {generation++;pending.clear();memory.clear();},
  };
}
