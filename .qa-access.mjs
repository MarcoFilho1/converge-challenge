import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const profile = await mkdtemp(join(tmpdir(), 'praevenius-qa-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide:true, stdio:'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let port;
  for(let i=0;i<50;i++) { try { port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; break; } catch { await pause(200); } }
  if(!port) throw Error('Chrome did not start');
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0;const pending=new Map();const errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
  await call('Runtime.enable');await call('Page.enable');
  const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(200);}throw Error('Timeout: '+expression);};
  const visit=async path=>{await call('Page.navigate',{url:'http://localhost:3100'+path});await until('document.readyState === "complete"');await pause(900);};
  const check=async(width,height)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(200);return evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,logo:[...document.images].filter(i=>i.src.includes("transparent-logo")).map(i=>({loaded:i.complete&&i.naturalWidth>0,width:i.getBoundingClientRect().width})),title:document.querySelector("h1")?.textContent})');};
  for(const page of ['/experiencia/login','/experiencia/cadastro?perfil=gestor','/experiencia']){
    await visit(page);for(const width of [1440,768,390]) console.log(page,JSON.stringify(await check(width,1000)));
  }
  await visit('/experiencia/cadastro?perfil=trabalhador');
  await evaluate(`document.querySelector('#access-name').value='Pessoa Teste';document.querySelector('#access-email').value='teste@example.com';document.querySelector('#access-password').value='example123';document.querySelector('#access-confirm').value='different123';document.querySelector('form').requestSubmit();`);
  await until('!!document.querySelector("#access-error")'); console.log('Password mismatch: verified');
  await evaluate(`document.querySelector('#access-confirm').value='example123';document.querySelector('form').requestSubmit();`);
  await until('document.querySelector("h1")?.textContent === "Como você chega hoje?"'); console.log('Worker signup destination: verified');
  await visit('/experiencia/login?perfil=gestor');
  await evaluate(`document.querySelector('#access-email').value='teste@example.com';document.querySelector('#access-password').value='example123';document.querySelector('form').requestSubmit();`);
  await until('document.querySelector("h1")?.textContent === "Visão geral"'); console.log('Manager login destination: verified');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await pause(300);
  const shot=await call('Page.captureScreenshot',{format:'png'});
  const screen=join(tmpdir(),'praevenius-dashboard-review.png');await writeFile(screen,Buffer.from(shot.data,'base64'));console.log('SCREENSHOT',screen);
  await visit('/experiencia/login');
  const shot2=await call('Page.captureScreenshot',{format:'png'});
  const screen2=join(tmpdir(),'praevenius-login-review.png');await writeFile(screen2,Buffer.from(shot2.data,'base64'));console.log('SCREENSHOT',screen2);
  console.log('Runtime errors',JSON.stringify(errors));
  await call('Browser.close').catch(()=>{});
} finally {
  ws?.close();browser.kill();await pause(700);
  await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:500}).catch(()=>{});
}
