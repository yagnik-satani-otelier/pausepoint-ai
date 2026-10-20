'use strict';
const $ = id => document.getElementById(id);
const HISTORY_KEY = 'pausepoint.capsules.v1';
let currentResult = null;
let currentPayload = null;
let attachedGit = null;
let toastTimer = null;

function escapeHtml(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getHistory() { try { const x = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } }
function setHistory(list) { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); renderHistory(); }
function toast(message, error=false) { const el=$('toast'); el.textContent=message; el.classList.toggle('error',error); el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3000); }
function setBusy(busy) { const b=$('generateButton'); b.disabled=busy; b.innerHTML=busy?'<span class="spinner"></span> Shaping the capsule…':'Make my resume capsule <span>✦</span>'; }
function readForm() {
  return {
    projectName:$('projectName').value, tone:$('tone').value,
    goal:$('goal').value, stoppedAt:$('stoppedAt').value, changed:$('changed').value,
    verified:$('verified').value, unverified:$('unverified').value, blocker:$('blocker').value,
    nextHint:$('nextHint').value,
    ...(attachedGit || {})
  };
}
function setStatus(status) {
  const ready=Boolean(status.ready && status.installed);
  $('statusDot').classList.toggle('ready',ready); $('statusDot').classList.toggle('warning',!ready);
  $('modelStatus').textContent=ready?`Gemma ready · ${status.model}`:(status.ready?`${status.model} not installed`:'Template mode available');
  $('modelCard').textContent=ready?'Gemma ready':'Template mode';
  $('modelCardSub').textContent=ready?`${status.model} · local inference`:(status.reason || 'Local model unavailable');
}
async function refreshStatus() { try { const r=await fetch('/api/status'); setStatus(await r.json()); } catch { setStatus({ready:false,installed:false,reason:'Local server unavailable'}); } }
function capBlock(title, values, cls='') {
  if (!values || !values.length) return '';
  return `<section class="capsule-block ${cls}"><h3>${escapeHtml(title)}</h3><ul>${values.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul></section>`;
}
function renderResult(response) {
  currentResult=response; $('emptyState').classList.add('hidden'); $('resultArea').classList.remove('hidden'); $('resultActions').classList.remove('hidden');
  const c=response.capsule; const ai=response.mode==='local-ai';
  $('resultArea').innerHTML=`<div class="mode-banner ${ai?'':'template'}"><strong>${ai?'✦ LOCAL AI':'◌ TEMPLATE MODE'}</strong> · ${escapeHtml(response.notice || '')}</div>
    <h2 class="capsule-title">${escapeHtml(c.title)}</h2><p class="capsule-summary">${escapeHtml(c.summary)}</p>
    <div class="capsule-meta"><span class="meta-chip">${escapeHtml(currentPayload.projectName)}</span>${currentPayload.branch?`<span class="meta-chip">branch: ${escapeHtml(currentPayload.branch)}</span>`:''}<span class="meta-chip">${new Date().toLocaleString()}</span></div>
    <section class="capsule-block"><h3>Where I left off</h3><p><strong>${escapeHtml(c.workingOn)}</strong></p></section>
    ${capBlock('Verified facts',c.verified,'fact-block') || '<section class="capsule-block fact-block"><h3>Verified facts</h3><p>No verified facts were explicitly recorded.</p></section>'}
    ${capBlock('Still uncertain',c.unverified,'unknown-block') || '<section class="capsule-block unknown-block"><h3>Still uncertain</h3><p>Nothing else was marked uncertain. Verify the current state before acting.</p></section>'}
    ${capBlock('Next small steps',c.nextSteps,'step-block')}
    ${c.firstCommand?`<section class="capsule-block"><h3>First command</h3><code class="command-chip">${escapeHtml(c.firstCommand)}</code></section>`:''}
    <section class="capsule-block return-block"><h3>Prompt for your next session</h3><p class="return-prompt">${escapeHtml(c.returnPrompt)}</p></section>`;
  $('savedCount').textContent=getHistory().length;
}
async function generate(event) {
  event.preventDefault();
  const payload=readForm();
  if(!payload.goal.trim()&&!payload.stoppedAt.trim()&&!payload.changed.trim()&&!payload.blocker.trim()){toast('Add at least a goal, stopping point, change or blocker.',true);return;}
  currentPayload=payload; setBusy(true);
  try {
    const response=await fetch('/api/capsule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if (!response.ok) {
      if (response.status === 404 || response.status >= 500) {
        renderResult(window.PausePointFallback.makeFallback(payload));
        toast('Used browser template. Run locally for Gemma generation.');
        return;
      }
      const errData = await response.json().catch(()=>({}));
      throw new Error(errData.error||'Could not generate capsule.');
    }
    const data=await response.json();
    renderResult(data); toast(data.mode==='local-ai'?'Resume capsule created with local AI.':'Resume capsule created with template fallback.');
  } catch(err) {
    renderResult(window.PausePointFallback.makeFallback(payload, 'PausePoint local API is not reachable. Used the browser template; run locally with Ollama for Gemma generation.'));
    toast('Used browser template. Run locally for Gemma generation.');
  }
  finally { setBusy(false); }
}
async function captureGit() {
  const path=$('repoPath').value.trim(); if(!path){toast('Enter the local repository folder first.',true);return;}
  $('captureGit').disabled=true; $('captureGit').textContent='Reading Git…';
  try {
    const response=await fetch('/api/git-snapshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});
    const data=await response.json(); if(!response.ok) throw new Error(data.error||'Could not capture Git status.');
    attachedGit={branch:data.branch,gitStatus:data.gitStatus,diffStat:data.diffStat,lastCommits:data.lastCommits};
    $('gitNotice').textContent=`Snapshot captured · ${data.branch} · read-only`; $('gitNotice').classList.remove('error');
    $('gitPreview').textContent=[`Repository: ${data.root}`,`Branch: ${data.branch}`,'',data.gitStatus,'',data.diffStat?'Diff summary: '+data.diffStat:'','Recent commits:',data.lastCommits].filter(Boolean).join('\n'); $('gitPreview').classList.remove('hidden');
    toast('Read-only Git snapshot attached.');
  } catch(e) { attachedGit=null; $('gitNotice').textContent=e.message; $('gitNotice').classList.add('error'); $('gitPreview').classList.add('hidden'); toast(e.message,true); }
  finally { $('captureGit').disabled=false; $('captureGit').textContent='↳ Read Git status'; }
}
function markdown(c, payload, mode='local-ai') {
  const bullet = a => (a&&a.length?a.map(x=>'- '+x).join('\n'):'- None explicitly recorded');
  return `# ${c.title}\n\n> Created ${new Date().toLocaleString()} · ${mode==='local-ai'?'Local AI':'Template fallback'}\n\n## Summary\n${c.summary}\n\n## Working on\n${c.workingOn}\n\n## Verified\n${bullet(c.verified)}\n\n## Still uncertain\n${bullet(c.unverified)}\n\n## Next small steps\n${(c.nextSteps||[]).map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n${c.firstCommand?'## First command\n`'+c.firstCommand+'`\n\n':''}## Resume prompt\n${c.returnPrompt}\n\n---\nProject: ${payload.projectName}\n${payload.branch?'Branch snapshot: '+payload.branch+'\n':''}PausePoint keeps this capsule local in your browser unless you export it.`;
}
function download(name, text, type='text/markdown') { const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function saveCurrent() {
  if(!currentResult||!currentPayload){toast('Generate a capsule first.',true);return;}
  const item={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),createdAt:new Date().toISOString(),mode:currentResult.mode,payload:currentPayload,capsule:currentResult.capsule,notice:currentResult.notice};
  const list=getHistory();list.unshift(item);setHistory(list.slice(0,100));toast('Capsule saved in this browser.');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text);toast('Copied to clipboard.'); }
  catch { const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?'Copied to clipboard.':'Copy failed; select and copy manually.',!ok); }
}
function loadItem(id) { const item=getHistory().find(x=>x.id===id);if(!item)return;currentPayload=item.payload;currentResult={mode:item.mode,capsule:item.capsule,notice:item.notice};
  for(const key of ['projectName','tone','goal','stoppedAt','changed','verified','unverified','blocker','nextHint']) if($(key)) $(key).value=item.payload[key]||'';
  attachedGit=item.payload.branch?{branch:item.payload.branch,gitStatus:item.payload.gitStatus,diffStat:item.payload.diffStat,lastCommits:item.payload.lastCommits}:null;
  renderResult(currentResult);document.getElementById('capture').scrollIntoView({behavior:'smooth',block:'start'});toast('Saved capsule reopened.');
}
function renderHistory() {
  const list=getHistory(); $('historyCount').textContent=list.length; $('savedCount').textContent=list.length;
  if(!list.length){$('historyList').innerHTML='<div class="history-empty"><span>◷</span><strong>Nothing saved yet</strong><p>Your first capsule will live here.</p></div>';return;}
  $('historyList').innerHTML=list.slice(0,30).map(item=>`<article class="history-card"><div class="history-date">${escapeHtml(new Date(item.createdAt).toLocaleString())} · ${item.mode==='local-ai'?'LOCAL AI':'TEMPLATE'}</div><h3>${escapeHtml(item.capsule.title)}</h3><p>${escapeHtml(item.capsule.summary)}</p><div class="history-card-actions"><button data-open="${escapeHtml(item.id)}">Open capsule ↗</button><button class="delete-one" data-delete="${escapeHtml(item.id)}">Delete</button></div></article>`).join('');
}
function exportHistory() { const data=JSON.stringify({app:'PausePoint',version:1,exportedAt:new Date().toISOString(),capsules:getHistory()},null,2);download(`pausepoint-backup-${new Date().toISOString().slice(0,10)}.json`,data,'application/json');toast('JSON backup exported.'); }
function handleClicks(e) {
  const scroll=e.target.closest('[data-scroll]'); if(scroll){const target=$(scroll.dataset.scroll);if(target)target.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.scroll===scroll.dataset.scroll));return;}
  const action=e.target.closest('[data-action]'); if(action&&action.dataset.action==='export'){exportHistory();return;}
  const open=e.target.closest('[data-open]');if(open){loadItem(open.dataset.open);return;}
  const del=e.target.closest('[data-delete]');if(del){const list=getHistory().filter(x=>x.id!==del.dataset.delete);setHistory(list);toast('Capsule deleted.');}
}
function setup() {
  $('captureForm').addEventListener('submit',generate);$('captureGit').addEventListener('click',captureGit);$('saveButton').addEventListener('click',saveCurrent);
  $('copyButton').addEventListener('click',()=>currentResult&&copyText(currentResult.capsule.returnPrompt));
  $('downloadButton').addEventListener('click',()=>currentResult&&currentPayload&&download('pausepoint-resume-capsule.md',markdown(currentResult.capsule,currentPayload,currentResult.mode)));
  $('clearHistory').addEventListener('click',()=>{if(confirm('Delete every saved PausePoint capsule from this browser? This cannot be undone.')){setHistory([]);toast('Local history cleared.');}});
  $('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());$('closeAboutBottom').addEventListener('click',()=>$('aboutDialog').close());
  document.addEventListener('click',handleClicks);renderHistory();refreshStatus();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded',setup);
