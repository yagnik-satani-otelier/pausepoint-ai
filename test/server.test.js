'use strict';
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

let appProcess, appBaseUrl, ollamaServer, ollamaBaseUrl, appOutput = '';
let mockMode = 'capsule';
async function reservePort() {
  return new Promise((resolve,reject)=>{ const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));}); });
}
async function waitFor(url) {
  const end=Date.now()+8000;
  while(Date.now()<end){if(appProcess.exitCode!==null)throw new Error(`App exited: ${appOutput}`);try{const r=await fetch(url,{signal:AbortSignal.timeout(500)});if(r.ok)return;}catch{} await new Promise(r=>setTimeout(r,100));}
  throw new Error(`Server not ready: ${appOutput}`);
}
before(async()=>{
  ollamaServer=http.createServer(async(req,res)=>{
    res.setHeader('content-type','application/json');
    if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'test-model'}]}));return;}
    if(req.url==='/api/generate'&&req.method==='POST'){
      let raw='';for await(const ch of req)raw+=ch.toString();const request=JSON.parse(raw);
      if(typeof request.format!=='object') {res.writeHead(400);res.end(JSON.stringify({error:'schema missing'}));return;}
      const answer={title:'Resume: API schema',summary:'Continue from schema test.',workingOn:'Test structured generation.',verified:['Automated suite is passing.'],unverified:['Real model output not tested by this mock.'],nextSteps:['Run a local smoke test.'],firstCommand:'npm test',returnPrompt:'Resume by checking the API and running the tests.'};
      res.end(JSON.stringify({response:JSON.stringify(answer),done:true}));return;
    }
    res.writeHead(404);res.end(JSON.stringify({error:'not found'}));
  });
  await new Promise((resolve,reject)=>{ollamaServer.once('error',reject);ollamaServer.listen(0,'127.0.0.1',resolve);});
  ollamaBaseUrl=`http://127.0.0.1:${ollamaServer.address().port}`;
  const p=await reservePort();appBaseUrl=`http://127.0.0.1:${p}`;
  appProcess=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{...process.env,PORT:String(p),OLLAMA_URL:ollamaBaseUrl,OLLAMA_MODEL:'test-model'},stdio:['ignore','pipe','pipe']});
  appProcess.stdout.on('data',b=>appOutput+=b.toString());appProcess.stderr.on('data',b=>appOutput+=b.toString());
  await waitFor(`${appBaseUrl}/`);
});
after(async()=>{if(appProcess&&appProcess.exitCode===null)appProcess.kill('SIGTERM');if(ollamaServer)await new Promise(r=>ollamaServer.close(r));});

test('serves app shell with basic security headers',async()=>{
  const r=await fetch(`${appBaseUrl}/`);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(await r.text(),/PausePoint/);
});
test('reports model availability through Ollama tags endpoint',async()=>{
  const r=await fetch(`${appBaseUrl}/api/status`);const b=await r.json();assert.equal(r.status,200);assert.equal(b.ready,true);assert.equal(b.installed,true);assert.equal(b.model,'test-model');
});
test('sends JSON schema to Ollama and returns a local-AI capsule',async()=>{
  const r=await fetch(`${appBaseUrl}/api/capsule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectName:'API test',goal:'Add schema constraints',verified:'Server tests are running'})});
  const b=await r.json();assert.equal(r.status,200);assert.equal(b.mode,'local-ai');assert.equal(b.capsule.title,'Resume: API schema');assert.match(b.notice,/local Ollama/);
});
test('rejects invalid JSON and invalid capsule payloads',async()=>{
  const bad=await fetch(`${appBaseUrl}/api/capsule`,{method:'POST',headers:{'content-type':'application/json'},body:'{bad'});assert.equal(bad.status,400);
  const empty=await fetch(`${appBaseUrl}/api/capsule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({})});assert.equal(empty.status,400);
});
test('rejects unsupported methods and traversal',async()=>{
  const m=await fetch(`${appBaseUrl}/api/capsule`,{method:'PUT'});assert.equal(m.status,405);
  const t=await fetch(`${appBaseUrl}/..%2Fserver.js`);assert.equal(t.status,403);
});
test('captures only read-only Git state from a chosen repository',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pausepoint-git-'));
  execFileSync('git',['init','-q',folder]);
  const r=await fetch(`${appBaseUrl}/api/git-snapshot`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:folder})});
  const b=await r.json();assert.equal(r.status,200);assert.equal(path.resolve(b.root),path.resolve(folder));assert.ok(b.branch!==undefined);assert.match(b.gitStatus,/branch|working tree|No commits/i);
  fs.rmSync(folder,{recursive:true,force:true});
});
test('git snapshot rejects a folder that is not a repository',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pausepoint-notgit-'));
  const r=await fetch(`${appBaseUrl}/api/git-snapshot`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:folder})});assert.equal(r.status,400);fs.rmSync(folder,{recursive:true,force:true});
});
test('rejects oversized request bodies',async()=>{
  const r=await fetch(`${appBaseUrl}/api/capsule`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({goal:'x'.repeat(40000)})});assert.equal(r.status,413);
});
