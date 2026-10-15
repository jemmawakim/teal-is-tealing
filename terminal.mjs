
const authStatus=document.getElementById('auth-message');
const googleButton=document.getElementById('teal-google');
googleButton.disabled=true;
authStatus.textContent='Initializing secure Google sign-in…';
let createClient;
let authLoadError=null;
for(const cdn of ['https://esm.sh/@supabase/supabase-js@2.76.1','https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.76.1/+esm']){
 try{
  const sdk=await import(cdn);
  if(typeof sdk.createClient==='function'){createClient=sdk.createClient;break;}
 }catch(error){authLoadError=error;}
}
if(!createClient){
 authStatus.textContent='Sign-in library failed to load. Check your connection or browser privacy blocking and reload. '+(authLoadError?.message||'');
 throw Error('Supabase authentication SDK unavailable');
}
googleButton.disabled=false;
const sb=createClient('https://tswbkmlaxxnjixjmgqne.supabase.co','sb_publishable_FKJn2ZLv1aTI1WeGVrHi2g_ayQ836SN',{auth:{persistSession:true,storage:window.sessionStorage,autoRefreshToken:true,detectSessionInUrl:false,flowType:'pkce'}});
const $=id=>document.getElementById(id), message=s=>$('auth-message').textContent=s;
const SESSION_MS=15*60*1000;
const SESSION_KEY='teal-session-boundary-v1';
let factorId=null,authRevision=0,activeSessionId=null,signingOut=false,mfaBusy=false;
const focusWhenReady=id=>{requestAnimationFrame(()=>{const el=$(id);if(el&&!el.closest("[hidden]")&&!el.disabled&&document.activeElement?.tagName!=="INPUT")el.focus({preventScroll:true});});};
const boundary=()=>{try {return JSON.parse(window.localStorage.getItem(SESSION_KEY)||'null');}catch{return null;}};
function saveBoundary(value){try{if(value)window.localStorage.setItem(SESSION_KEY,JSON.stringify(value));else window.localStorage.removeItem(SESSION_KEY);}catch{}}
function revokeBoundary(){saveBoundary({blocked:true,started:0,last:0});}
function sessionExpired(b,now=Date.now()){return !b||!Number.isFinite(b.started)||!Number.isFinite(b.last)||now-b.started>SESSION_MS||b.last>now+60000||b.started>now+60000;}
function lock(){authRevision++;document.body.classList.add('access-locked');if($('research-table'))researchReset();if($('autonomy-news'))autonomyReset();if($('terminal-status'))terminalReset();if($('terminal-quote-status'))quoteReset();}
async function signOut(reason='Signed out.'){
 if(signingOut)return;
 signingOut=true;lock();revokeBoundary();activeSessionId=null;
 $('teal-logout').hidden=true;$('login-fields').hidden=false;$('mfa-fields').hidden=true;
 $('auth-state').textContent='Signed out';$('api-result').textContent='No authenticated portfolio session.';
 message(reason);factorId=null;$('mfa-qr').replaceChildren();focusWhenReady('teal-google');
 try {const {data:{session}}=await sb.auth.getSession();if(session?.access_token)await fetch('https://teal-secure-api.vercel.app/api/session/revoke',{method:'POST',headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(4500)});}catch(e){}
 try {await sb.auth.signOut({scope:'local'});}catch(e){message(reason+' Close this page before signing in again.');}
 finally{signingOut=false;}
}
function checkSession(){
 if(document.body.classList.contains('access-locked'))return;
 const b=boundary();
 if(sessionExpired(b)){void signOut('Session expired. Sign in and verify 2FA again.');return;}
 const remaining=Math.max(0,Math.ceil((b.started+SESSION_MS-Date.now())/60000));
 $('session-remaining').textContent='Session: '+(remaining>=60?Math.ceil(remaining/60)+' h':remaining+' min')+' left';
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkSession();}});
window.addEventListener('storage',event=>{if(event.key===SESSION_KEY){checkSession();if(!event.newValue)lock();}});
setInterval(checkSession,15000);
$('teal-logout-dashboard').onclick=()=>{void signOut('Signed out securely.');};
$('teal-security-test').onclick=async()=>{
 const b=$('teal-security-test'),out=$('teal-security-result');
 b.disabled=true;out.textContent='Checking your 2FA session and one-time signed approval...';
 try{
   checkSession();
   if(document.body.classList.contains('access-locked'))throw Error('Session expired. Please sign in again.');
   const {data:{session}}=await sb.auth.getSession();
   if(!session?.access_token)throw Error('Sign in again before running the test.');
   const assurance=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
   if(assurance.error||assurance.data?.currentLevel!=='aal2')
     throw Error('TOTP assurance has not been verified.');
   const local=boundary();
   if(local?.blocked||sessionExpired(local)||local.user!==session.user?.id)
     throw Error('Owner session expired. Sign in and verify 2FA again.');
   const res=await fetch('https://teal-secure-api.vercel.app/api/security/self-test',{method:'POST',
     headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
     cache:'no-store',signal:AbortSignal.timeout(15000)});
   const data=await res.json();
   if(res.ok&&data.passed===true&&data.signature_accepted===true&&data.replay_rejected===true&&data.broker_used===false&&data.trading_enabled===false){
     out.textContent='PASS: owner session, TOTP AAL2, server session gate, signed approval, replay denial and broker isolation.';
   }else{
     out.textContent='NOT PASSED: '+(data.detail||('HTTP '+res.status))+'. No trading enabled.';
   }
 }catch(e){out.textContent='Test could not complete: '+(e?.message||'Network error');}
 finally{b.disabled=false;}
};

const RESEARCH_API='https://teal-secure-api.vercel.app';
let researchRequestId=0;
function researchReset(note='Sign in with MFA to load research.'){
 researchRequestId++;
 $('research-event-count').textContent='—';
 $('research-experiment-count').textContent='—';
 $('research-eligible-count').textContent='—';
 $('research-chain-state').textContent='Not checked';
 $('research-status').textContent=note;
 const body=$('research-table');body.replaceChildren();
 const row=document.createElement('tr'),cell=document.createElement('td');
 cell.colSpan=5;cell.className='empty';cell.textContent=note;row.appendChild(cell);body.appendChild(row);
}
function researchCell(row,value){
 const td=document.createElement('td');td.textContent=String(value);row.appendChild(td);
}
function researchPercent(value){
 return typeof value==='number'&&Number.isFinite(value)?(value*100).toFixed(2)+'%':'—';
}
async function researchToken(){
 checkSession();
 if(document.body.classList.contains('access-locked'))throw Error('Owner session is locked.');
 const {data:{session}}=await sb.auth.getSession();
 if(!session?.access_token)throw Error('Sign in with MFA again.');
 return session.access_token;
}
async function researchFetch(path,token){
 const response=await fetch(RESEARCH_API+path,{headers:{Authorization:'Bearer '+token},
    cache:'no-store',signal:AbortSignal.timeout(12000)});
 let data;
 try{data=await response.json();}catch{throw Error('Research API returned an invalid response.');}
 if(!response.ok)throw Error(data?.detail||'Research API HTTP '+response.status);
 return data;
}
async function loadResearch(){
 const id=++researchRequestId;
 $('research-status').textContent='Loading secured research history…';
 try{
  const token=await researchToken();
  const data=await researchFetch('/api/research/dashboard',token);
  if(id!==researchRequestId||document.body.classList.contains('access-locked'))return;
  if(data?.mode!=='paper_research'||data.live_trading_enabled!==false||!Array.isArray(data.experiments))throw Error('Unexpected research API response.');
  $('research-event-count').textContent=String(data.event_count??0);
  $('research-experiment-count').textContent=String(data.experiment_count??data.experiments.length);
  $('research-eligible-count').textContent=String(data.experiments.filter(x=>x?.eligible_for_paper_review===true).length);
  const body=$('research-table');body.replaceChildren();
  if(data.experiments.length===0){
   const tr=document.createElement('tr'),td=document.createElement('td');
   td.colSpan=5;td.className='empty';td.textContent='No research experiments recorded yet. The secured journal is empty.';
   tr.appendChild(td);body.appendChild(tr);
  }
  for(const e of data.experiments.slice(0,100)){
   const tr=document.createElement('tr');
   researchCell(tr,String(e.experiment_id||'').slice(0,50));
   researchCell(tr,String(e.hypothesis||'—').slice(0,140));
   researchCell(tr,researchPercent(e.strategy_net_return));
   researchCell(tr,researchPercent(e.max_drawdown));
   researchCell(tr,e.paper_approved===true?'Approved for paper only':e.eligible_for_paper_review===true?'Eligible for review':'Not eligible');
   body.appendChild(tr);
  }
  $('research-status').textContent='Connected to owner-only research API. '+data.experiments.length+' experiment(s). No live trading.';
 }catch(e){
  if(id===researchRequestId)$('research-status').textContent='Research unavailable: '+(e?.message||'Connection failed');
 }
}
async function verifyResearch(){
 $('research-chain-state').textContent='Checking…';
 try{
  const token=await researchToken();
  const data=await researchFetch('/api/research/integrity',token);
  $('research-chain-state').textContent=data.research_chain_valid===true?'Verified':'Failed';
  if(data.research_chain_valid!==true)$('research-status').textContent='Research audit integrity check did not pass.';
 }catch(e){
  $('research-chain-state').textContent='Unavailable';
  $('research-status').textContent='Audit check unavailable: '+(e?.message||'Network error');
 }
}
$('judgment-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const button=$('judgment-run'),status=$('judgment-status'),output=$('judgment-output');
 button.disabled=true;status.textContent='Evaluating evidence and uncertainty…';output.replaceChildren();
 try{
  const form=new FormData(event.currentTarget);
  const fields=['surprise_pct','price_change_pct','volume_ratio','source_count','conflicting_sources',
   'minutes_since_event','historical_cases','historical_successes','estimated_cost_bps','risk_budget_pct'];
  const data={event_type:form.get('event_type')};
  for(const field of fields)data[field]=Number(form.get(field));
  const token=await researchToken();
  const response=await fetch(RESEARCH_API+'/api/research/judge',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.detail||'Judgment service HTTP '+response.status);
  if(result.paper_only!==true||result.live_trading_enabled!==false)throw Error('Unsafe response');
  const headline=document.createElement('h3');headline.textContent='Judgment: '+result.decision.replaceAll('_',' ');
  output.append(headline);
  const summary=document.createElement('p');summary.textContent=result.analysis;output.append(summary);
  const line=document.createElement('p');
  line.textContent='Evidence quality: '+result.evidence_quality+' · Confidence: '+result.confidence+
   ' · Historical success lower bound: '+(result.wilson_95_lower_success_rate===null?'unavailable':(100*result.wilson_95_lower_success_rate).toFixed(1)+'%');
  output.append(line);
  for(const [label,values] of [['Reasons',result.reasons],['Cautions',result.cautions],['Next tests',result.next_tests],['Limitations',result.limitations]]){
   if(!values?.length)continue;
   const box=document.createElement('div');box.className='card';
   const title=document.createElement('strong');title.textContent=label;box.append(title);
   const list=document.createElement('ul');
   for(const value of values){const item=document.createElement('li');item.textContent=value.replaceAll('_',' ');list.append(item);}
   box.append(list);output.append(box);
  }
  status.textContent='Evaluation completed · Hypothetical evidence only · No trading.';
 }catch(error){status.textContent='Judgment unavailable: '+(error?.message||'Unknown error');}
 finally{button.disabled=false;}
});

// Protected owner intelligence terminal. No public/private GitHub fetches from browser.
// Market reference display. Third-party TradingView scripts are restricted to a
// sandboxed, opaque-origin iframe; they never share the owner's Supabase origin.
let quoteRequestId=0,quoteLastLoaded=0;
function quoteReset(){
 quoteRequestId++;
 $('terminal-quote-status').textContent='Sign in with 2FA to load current exchange quotes.';
 for(const id of ['quote-btc','quote-eth'])$(id).textContent='—';
 for(const id of ['quote-btc-time','quote-eth-time'])$(id).textContent='Locked. No market data retained.';
 const frame=$('terminal-tradingview');
 if(frame){frame.removeAttribute('srcdoc');frame.src='about:blank';}
 quoteLastLoaded=0;
}
function loadTradingView(){
 if(document.body.classList.contains('access-locked'))return;
 const frame=$('terminal-tradingview');
 if(frame.hasAttribute('srcdoc'))return;
 // No allow-same-origin! The external market widget has no access to Supabase
 // storage, session tokens, parent DOM or Teal's authenticated API.
 const tvBody='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<style>html,body{margin:0;padding:0;background:#fff;color:#454545;font:12px sans-serif;overflow:hidden}</style>'+
  '</head><body><div style="padding:12px 2px">Market reference supplied by TradingView · check symbol delay notices</div>'+
  '<tv-tickers symbols="AMEX:SPY,AMEX:GLD,TVC:US10Y,FX:EURUSD,BITSTAMP:BTCUSD,BITSTAMP:ETHUSD" hide-chart></tv-tickers>'+
  '<scr'+'ipt type="module" src="https://widgets.tradingview-widget.com/w/en/tv-tickers.js"></scr'+'ipt>'+
  '</body></html>';
 frame.srcdoc=tvBody;
}
function quoteRender(data){
 if(!data||data.schema!==1||data.mode!=='read_only_market_snapshot'||data.paper_only!==true||
    data.live_trading_enabled!==false||data.broker_connected!==false||!Array.isArray(data.quotes))
    throw Error('Unexpected market data response.');
 const format=(v)=>{const num=Number(v);return Number.isFinite(num)&&num>0?
   new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(num):'—'};
 const map={'BTC-USD':['quote-btc','quote-btc-time'],'ETH-USD':['quote-eth','quote-eth-time']};
 for(const [symbol,[valueId,timeId]]of Object.entries(map)){
   const x=data.quotes.find(q=>q.symbol===symbol&&q.quote_status==='recent_exchange_trade_snapshot'&&q.source==='Coinbase Exchange public ticker');
   if(x){
     $(valueId).textContent=format(x.last_trade_price);
     const when=new Date(x.observed_at);
     $(timeId).textContent='Coinbase Exchange · last trade '+(Number.isNaN(when.getTime())?'time unknown':when.toLocaleTimeString())+
      ' · '+String(x.age_seconds)+'s old when retrieved';
   }else{
     $(valueId).textContent='Unavailable';
     $(timeId).textContent='No recent verified exchange trade from this source';
   }
 }
 const count=data.quotes.length;
 $('terminal-quote-status').textContent=count+'/2 recent Coinbase Exchange trade snapshots · checked '+
   new Date(data.retrieved_at).toLocaleTimeString()+
   ' · on-demand refresh, not a continuous real-time stream.';
 quoteLastLoaded=Date.now();
}
async function loadCurrentQuotes(){
 if(document.body.classList.contains('access-locked'))return;
 const request=++quoteRequestId;
 $('terminal-quote-status').textContent='Checking recent exchange trades…';
 try{
  const token=await researchToken();
  const data=await researchFetch('/api/research/quotes',token);
  if(request!==quoteRequestId||document.body.classList.contains('access-locked'))return;
  quoteRender(data);
 }catch(error){
  if(request!==quoteRequestId||document.body.classList.contains('access-locked'))return;
  $('terminal-quote-status').textContent='Current quotes unavailable: '+(error?.message||'Provider/network issue')+
     '. Showing no fabricated fallback prices.';
  for(const id of ['quote-btc','quote-eth'])$(id).textContent='Unavailable';
  for(const id of ['quote-btc-time','quote-eth-time'])$(id).textContent='Current price not verified';
 }
}
$('terminal-quote-refresh').addEventListener('click',()=>{void loadCurrentQuotes();});
// Refresh while visible and signed in. No provider calls while locked/hidden.
setInterval(()=>{if(!document.hidden&&!document.body.classList.contains('access-locked')&&
  Date.now()-quoteLastLoaded>=60000)void loadCurrentQuotes();},60000);

let terminalRequestId=0;
function terminalEmptyRow(tbody,columns,message){
 const tr=document.createElement('tr'),td=document.createElement('td');
 td.colSpan=columns;td.className='empty';td.textContent=message;tr.appendChild(td);
 tbody.replaceChildren(tr);
}
function terminalReset(note='Sign in with 2FA to load private intelligence.'){
 terminalRequestId++;
 $('terminal-status').textContent=note;
 for(const id of ['terminal-publications','terminal-market-count','terminal-forecast-count','terminal-scored-count','terminal-paper-cases','terminal-accuracy'])$(id).textContent='—';
 $('terminal-performance').textContent='Awaiting evidence';
 terminalEmptyRow($('terminal-market-rows'),4,'Secured market data not loaded.');
 terminalEmptyRow($('terminal-predictions'),4,'Secured predictions not loaded.');
 for(const id of ['terminal-investigations','terminal-alerts','terminal-sources'])$(id).replaceChildren();
 $('terminal-provenance').textContent='No private research is retained in this page after the session is locked.';
}
function terminalLine(parent,main,sub,description,href){
 const box=document.createElement('div');box.className='terminal-item';
 const title=document.createElement('div');title.className='terminal-item-title';
 if(typeof href==='string'&&/^https:\/\//.test(href)){
   const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=String(main||'Untitled');title.append(link);
 }else{title.textContent=String(main||'Untitled');}
 box.append(title);
 if(sub){const note=document.createElement('div');note.className='terminal-item-sub';note.textContent=String(sub);box.append(note);}
 if(description){const p=document.createElement('p');p.textContent=String(description);box.append(p);}
 parent.append(box);
}
function terminalTextCell(row,text){
 const cell=document.createElement('td');cell.textContent=String(text??'—');row.append(cell);return cell;
}
const terminalDate=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Unknown':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
function terminalDisplay(data){
 if(!data||data.schema!==1||data.mode!=='owner_paper_research'||data.paper_only!==true||
   data.live_trading_enabled!==false||data.broker_connected!==false||
   !Array.isArray(data.assets)||!Array.isArray(data.research_events)||!Array.isArray(data.predictions)||
   !Array.isArray(data.alerts)||!data.overview)throw Error('Unexpected private research format. Nothing was displayed.');
 const counts=data.overview;
 $('terminal-publications').textContent=String(counts.publications??0);
 $('terminal-market-count').textContent=String(counts.market_series??data.assets.length);
 $('terminal-forecast-count').textContent=String(counts.forecasts??0);
 $('terminal-scored-count').textContent=String(counts.scored??0);
 const fetched=new Date(data.generated_at);
 const stale=Number.isFinite(fetched.getTime())&&(Date.now()-fetched.getTime())>6*3600*1000;
 $('terminal-status').textContent=(stale?'STALE SNAPSHOT. ':'')+'Owner-only research · Updated '+terminalDate(data.generated_at)+
   (stale?' · Data may no longer be current.':' · Research and historical prices only.');
 const market=$('terminal-market-rows');market.replaceChildren();
 for(const item of data.assets.slice(0,25)){
   const tr=document.createElement('tr');terminalTextCell(tr,String(item.id||'—').replaceAll('_',' '));
   terminalTextCell(tr,item.last_daily_observation===null?'—':String(item.last_daily_observation)+' · '+String(item.as_of||''));
   const pct=item.five_session_return_pct;
   terminalTextCell(tr,typeof pct==='number'&&Number.isFinite(pct)?pct.toFixed(2)+'%':'—');
   const td=terminalTextCell(tr,item.source||'Unverified source');
   if(typeof item.source_url==='string'&&item.source_url.startsWith('https://')){
     td.replaceChildren();const a=document.createElement('a');a.href=item.source_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='View source';td.append(a);
   }
   market.append(tr);
 }
 if(!data.assets.length)terminalEmptyRow(market,4,'No validated historical observations available.');
 const findings=$('terminal-investigations');findings.replaceChildren();
 for(const e of data.research_events.slice(0,8)){
  const sub=[e.source,terminalDate(e.published_at),'Judgment: '+String(e.judgment||'unverified')].join(' · ');
  const context=e.watch_assets?.length?'Assets to investigate: '+e.watch_assets.join(', '):'No verified instrument link';
  terminalLine(findings,e.title,sub,context,e.url);
 }
 if(!data.research_events.length)terminalLine(findings,'No source-confirmed investigations yet','Waiting for official releases','Teal will not invent market findings.');
 const forecasts=$('terminal-predictions');forecasts.replaceChildren();
 for(const p of [...data.predictions].reverse().slice(0,15)){
  const tr=document.createElement('tr');terminalTextCell(tr,String(p.series_id||'unknown').replaceAll('_',' '));
  terminalTextCell(tr,(p.prediction_type==='zero_return_baseline'?'No-change benchmark':String(p.direction||'unknown').toUpperCase())+' · '+String(p.model_version||'unverified').replaceAll('_',' '));
  terminalTextCell(tr,terminalDate(p.created_at));
  let outcomeLabel;
  if(p.status==='observed'&&p.outcome){
    const verdict=p.prediction_type==='zero_return_baseline'?'Benchmark observed':
      p.outcome.direction_matched===true?'Direction correct':
      p.outcome.direction_matched===false?'Direction incorrect':'Outcome observed';
    outcomeLabel=verdict+' · '+String(p.outcome.observed_direction||'?').toUpperCase()+
      ' · '+terminalDate(p.outcome.outcome_date)+' close';
  }else if(p.status==='unverifiable_baseline'){
    outcomeLabel='Unverifiable · starting price was not pre-recorded';
  }else if(p.status==='pending'){
    outcomeLabel='Pending · waiting for completed '+String(p.horizon_sessions||1)+
      '-session daily close'+(p.earliest_eligible_session_date?
      ' · earliest '+String(p.earliest_eligible_session_date):'');
  }else{
    outcomeLabel='Not evaluated · '+String(p.status||'unknown');
  }
  terminalTextCell(tr,outcomeLabel);
  forecasts.append(tr);
 }
 if(!data.predictions.length)terminalEmptyRow(forecasts,4,'No pre-registered forecasts yet.');
 const review=$('terminal-paper-cases'),performance=data.paper_evaluation||{};
 review.textContent=String(performance.evaluated_hypothetical_cases??0);
 const accuracy=performance.direction_accuracy;
 $('terminal-accuracy').textContent=typeof accuracy==='number'&&Number.isFinite(accuracy)?(100*accuracy).toFixed(1)+'%':'Not established';
 const returns=performance.average_hypothetical_net_pct;
 $('terminal-performance').textContent=typeof returns==='number'&&Number.isFinite(returns)?
    returns.toFixed(2)+'% hypothetical':'Awaiting observations';
 const alerts=$('terminal-alerts');alerts.replaceChildren();
 for(const alert of data.alerts.slice(0,6)){
  terminalLine(alerts,alert.headline||'Publication alert',
    [alert.priority||'normal',alert.source||'',terminalDate(alert.published_at)].join(' · '),
    'Publication detected, market impact unverified.',alert.source_url);
 }
 if(!data.alerts.length)terminalLine(alerts,'No new publication alerts','Only new items after the initial archive','Historical events do not generate repeated notifications.');
 const sources=$('terminal-sources');sources.replaceChildren();
 for(const [name,v] of Object.entries(data.source_health||{})){
  const row=document.createElement('div');row.className='terminal-health-row';
  const label=document.createElement('span');label.textContent=name;
  const status=document.createElement('span');status.textContent=String(v.status||'unknown');
  row.append(label,status);sources.append(row);
 }
 if(!sources.childNodes.length)terminalLine(sources,'Source health unavailable','No verified ingestion status','');
 $('terminal-provenance').textContent='Private evidence fingerprint: '+String(data.evidence_sha256||'unavailable').slice(0,16)+
  ' · Source check: '+terminalDate(data.source_checked_at)+' · Delayed, unadjusted prices; no verified market causality.';
}
async function loadOwnerTerminal(){
 const request=++terminalRequestId;
 $('terminal-status').textContent='Loading owner-only market intelligence…';
 try{
  const token=await researchToken();
  const data=await researchFetch('/api/research/terminal',token);
  if(request!==terminalRequestId||document.body.classList.contains('access-locked'))return;
  terminalDisplay(data);
 }catch(error){
  if(request!==terminalRequestId)return;
  terminalReset('Private intelligence unavailable: '+(error?.message||'Research connection could not be established')+
    '. The journal and other authenticated tools can still be used.');
 }
}
$('terminal-refresh').addEventListener('click',()=>{void loadOwnerTerminal();});

let autonomyRequestId=0;
function autonomyReset(){
 autonomyRequestId++;
 $('autonomy-news-count').textContent='—';
 $('autonomy-question-count').textContent='—';
 $('autonomy-cycle-state').textContent='Not loaded';
 $('autonomy-status').textContent='Sign in to view attributed research findings.';
 $('autonomy-news').replaceChildren();
 $('autonomy-questions').replaceChildren();
}
async function loadAutonomy(){
 const request=++autonomyRequestId;
 $('autonomy-status').textContent='Loading source-attributed agent findings…';
 try{
  const token=await researchToken();
  const data=await researchFetch('/api/research/autonomy',token);
  if(request!==autonomyRequestId||document.body.classList.contains('access-locked'))return;
  if(data.mode!=='paper_research'||data.live_trading_enabled!==false||data.snapshot!==true||
     !Array.isArray(data.news)||!Array.isArray(data.questions))throw Error('Unexpected research response');
  $('autonomy-news-count').textContent=String(data.news.length);
  $('autonomy-question-count').textContent=String(data.questions.length);
  $('autonomy-cycle-state').textContent='Collected';
  $('autonomy-questions').replaceChildren();
  for(const q of data.questions){
   const panel=document.createElement('div');panel.className='card';
   const heading=document.createElement('strong');heading.textContent=String(q.topic||'Research').toUpperCase();
   const p=document.createElement('p');p.textContent=q.question||'';
   const note=document.createElement('p');note.className='muted';note.textContent='Challenge: '+(q.disconfirmation||'Not specified');
   panel.append(heading,p,note);$('autonomy-questions').append(panel);
  }
  $('autonomy-news').replaceChildren();
  for(const n of data.news){
   const panel=document.createElement('div');panel.className='card';
   const link=document.createElement('a');link.href=n.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=n.title;
   const note=document.createElement('p');note.className='muted';note.textContent=n.source+' · '+n.published_at.slice(0,10);
   panel.append(link,note);$('autonomy-news').append(panel);
  }
  $('autonomy-status').textContent='Last research snapshot: '+new Date(data.generated_at).toLocaleString()+'. Human review pending. No live prices.';
 }catch(e){if(request===autonomyRequestId)$('autonomy-status').textContent='Agent findings unavailable: '+(e?.message||'Network error');}
}
$('autonomy-refresh').onclick=()=>{void loadAutonomy();};
$('research-refresh').onclick=()=>{void loadResearch();};
async function runSyntheticResearch(){
 const button=$('research-demo');
 if(!window.confirm('Run a clearly labeled SYNTHETIC paper-only research experiment and save its audit events to your private journal? No real prices, orders or broker activity.'))return;
 button.disabled=true;
 $('research-status').textContent='Running synthetic paper research through the protected API…';
 try{
  const token=await researchToken();
  const train=Array.from({length:40},(_,i)=>Number((0.001+0.0003*Math.sin(i)).toFixed(7)));
  const test=Array.from({length:40},(_,i)=>Number((0.0012+0.0003*Math.cos(i)).toFixed(7)));
  const benchmark=Array.from({length:40},(_,i)=>Number((0.0002+0.0002*Math.sin(i)).toFixed(7)));
  const payload={hypothesis:'SYNTHETIC UI-to-database research integration test; not market evidence',
   dataset_id:'synthetic-ui-integration-v1',strategy_version:'integration-smoke-v1',
   train_returns:train,test_returns:test,benchmark_returns:benchmark,costs_bps:5};
  const response=await fetch(RESEARCH_API+'/api/research/run',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok)throw Error(data?.detail||'Research worker HTTP '+response.status);
  if(data.persisted_remotely!==true||data.live_trading_enabled!==false)throw Error('Research persistence was not confirmed');
  await loadResearch();
  $('research-status').textContent='Synthetic paper research saved: '+data.cycle_id+'. '+data.events_recorded+' immutable events. No live trades.';
 }catch(e){$('research-status').textContent='Synthetic research failed: '+(e?.message||'Unknown error');}
 finally{button.disabled=false;}
}
$('research-demo').onclick=()=>{void runSyntheticResearch();};

$('research-verify').onclick=()=>{void verifyResearch();};
async function refresh(){
 lock();
 const revision=authRevision;
 const {data:{session}}=await sb.auth.getSession();
 if(revision!==authRevision||signingOut)return;
 if(!session){saveBoundary(null);activeSessionId=null;$('auth-state').textContent='Signed out';$('login-fields').hidden=false;$('mfa-fields').hidden=true;$('teal-logout').hidden=true;message('Sign in with Google to continue.');focusWhenReady('teal-google');return;}
 $('login-fields').hidden=true;$('teal-logout').hidden=false;
 const {data,error}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
 if(error){message(error.message);return;}
 if(data.currentLevel==='aal2'){
   const now=Date.now(),existing=boundary();
   const identity=session.user?.id||'';
   if(existing&&(existing.blocked||existing.user===identity&&sessionExpired(existing,now))){await signOut('Session expired. Sign in and verify 2FA again.');return;}
   $('auth-state').textContent='2FA verified';$('mfa-fields').hidden=true;message('Authenticated. Checking secured API.');
   try {const r=await fetch('https://teal-secure-api.vercel.app/api/overview',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'}); const body=await r.json();if(revision!==authRevision||signingOut)return;if(r.ok && body.api_authenticated===true && body.mfa_verified===true && body.trading_enabled===false){
     const previous=boundary(),n=Date.now();
     if(previous&&(previous.blocked||previous.user===identity&&sessionExpired(previous,n))){await signOut('Session expired. Sign in and verify 2FA again.');return;}
     saveBoundary(previous&&previous.user===identity?previous:{user:identity,started:n,last:n});
     activeSessionId=identity;document.body.classList.remove('access-locked');checkSession();
     $('api-result').textContent='Verified backend connection.';void loadResearch();void loadAutonomy();void loadOwnerTerminal();void loadCurrentQuotes();loadTradingView();
   }else{$('api-result').textContent='Access locked: '+(body.detail||('API HTTP '+r.status));}}
   catch(e){$('api-result').textContent='Access locked: secure API unavailable ('+(e?.message||'network error')+').';}
   return;
 }
 $('auth-state').textContent='2FA required';$('mfa-fields').hidden=false;message('One more step: verify your identity with your authenticator app.');
 const factors=await sb.auth.mfa.listFactors();
 const existing=factors.data?.totp?.find(x=>x.status==='verified');
 if(existing){factorId=existing.id;$('mfa-instructions').textContent='Enter the code from your authenticator app.';focusWhenReady('teal-mfa-code');return;}
 const enrolled=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Teal dashboard'});
 if(enrolled.error){message(enrolled.error.message);return;}
 factorId=enrolled.data.id;
 $('mfa-instructions').textContent='Scan this QR code in your authenticator app, then enter its six-digit code.';
 const qr=enrolled.data.totp.qr_code;
 // Supabase returns a data:image/svg+xml URL; reject anything else.
 if(typeof qr==='string'&&qr.startsWith('data:image/svg+xml')){const image=document.createElement('img');image.src=qr;image.alt='Teal authenticator QR code';image.style.maxWidth='220px';$('mfa-qr').replaceChildren(image);}
 if(enrolled.data.totp.secret){const p=document.createElement('p');p.textContent='On this phone? Choose manual setup in your authenticator app and enter this key: '+enrolled.data.totp.secret;$('mfa-qr').append(p);}
 focusWhenReady('teal-mfa-code');
}
$('teal-google').onclick=async()=>{
 const button=$('teal-google');button.disabled=true;message('Redirecting to Google…');
 try{
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://jemmawakim.github.io/teal-is-tealing/'}});
  if(error)throw error;
  message('Google authorization requested. If the page does not change, allow redirects and try again.');
 }catch(error){message('Google sign-in unavailable: '+(error?.message||'Unknown authentication error'));}
 finally{button.disabled=false;}
};
$('mfa-fields').addEventListener('submit',async e=>{
 e.preventDefault();
 if(mfaBusy)return;
 const field=$('teal-mfa-code'),code=field.value.trim(),button=$('teal-verify');
 if(!/^[0-9]{6}$/.test(code)){message('Enter the six-digit code from your authenticator app.');field.focus();return;}
 if(!factorId){message('Sign in again to initialize 2FA.');return;}
 mfaBusy=true;button.disabled=true;button.textContent='Verifying…';
 try{
   const c=await sb.auth.mfa.challenge({factorId});
   if(c.error)throw Error(c.error.message);
   const v=await sb.auth.mfa.verify({factorId,challengeId:c.data.id,code});
   if(v.error)throw Error(v.error.message);
   field.value='';
   await refresh();
 }catch(error){message(error?.message||'Verification failed. Please try again.');field.value='';field.focus();}
 finally{mfaBusy=false;button.disabled=false;button.textContent='Verify 2FA';}
});
$('teal-logout').onclick=()=>{void signOut('Signed out securely.');};
async function initAuth(){
 const url=new URL(window.location.href);
 const oauthError=url.searchParams.get('error_description')||url.searchParams.get('error');
 if(oauthError){message('Google login failed: '+oauthError);focusWhenReady('teal-google');return;}
 const code=url.searchParams.get('code');
 if(code)saveBoundary(null);
 if(code){
   const {error}=await sb.auth.exchangeCodeForSession(code);
   window.history.replaceState({},'',window.location.pathname);
   if(error){message('Google login callback failed: '+error.message+'. Please open Teal in Safari and try again.');return;}
 }
 await refresh();
}
initAuth().catch(err=>message('Sign-in failed: '+(err?.message||'Unknown error')+'. Try opening Teal in Safari.'));

