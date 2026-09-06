import {ExpressionGate,clamp,collide} from './core.mjs';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:true}),stage=$('stage');
const gate=new ExpressionGate(),pool=Array.from({length:900},()=>({life:0})),colors=['#b7f6df','#ffce76','#fe96af','#a8baff','#ffffff'];
const swept={};
let W=1,H=1,dpr=1,worker=null,stream=null,ready=false,busy=false,session=0,running=false,demo=false,rain=false;
let lastFrame=0,lastVideo=-1,lastResult=0,workerMs=0,nextInference=0,head=null,target=null,previous=performance.now(),uiTime=0,frames=0,fps=60,acc=0,hits=0,quality=1,gateState='neutral';
function resize(){const r=stage.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);head=null;target=null;}
new ResizeObserver(resize).observe(stage);
function spawn(x,y,vx,vy,life,type,color=0){const limit=Math.floor(900*quality);for(let i=0;i<limit;i++){const p=pool[i];if(p.life<=0){Object.assign(p,{x,y,px:x,py:y,vx,vy,life,maxLife:life,type,color});return;}}}
function burst(){const x=head?head.x:W*.5,y=head?Math.max(45,head.y-head.ry-75):H*.26;for(let i=0;i<Math.floor(250*quality);i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*230;spawn(x+(Math.random()-.5)*20,y,Math.cos(a)*s,Math.sin(a)*s,2+Math.random()*2,1,Math.floor(Math.random()*colors.length));}}
function resetParticles(){for(const p of pool)p.life=0;}
function setHint(text){$('hint').textContent=text;}
function stop(){session++;lastFrame=0;lastResult=0;running=false;demo=false;ready=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;head=target=null;rain=false;gate.reset();gateState='neutral';resetParticles();$('stop').hidden=true;$('welcome').hidden=false;$('demo-controls').hidden=true;$('mode').textContent='等待开启';$('start').disabled=false;$('start').innerHTML='开启摄像头 <span>↗</span>';setHint('准备好，用表情改变天气。');}
function error(message){stop();setHint(message);}
async function startCamera(){
  stop();const token=session;const start=$('start');start.disabled=true;start.textContent='正在打开摄像头…';setHint('请允许摄像头权限；首次加载模型需稍候。');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('请在 HTTPS 页面或 localhost 中打开，并使用支持摄像头的浏览器。');
    if(!window.Worker||!window.createImageBitmap||!window.OffscreenCanvas)throw new Error('此浏览器缺少离屏图像支持，请使用新版 Chrome、Edge 或 Safari。');
    const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}}});
    if(token!==session){camera.getTracks().forEach(t=>t.stop());return;}
    stream=camera;video.srcObject=camera;await video.play();if(token!==session)return;
    $('welcome').hidden=true;$('stop').hidden=false;$('mode').textContent='模型加载中';
    running=true;worker=new Worker('./face-worker.js');
    const timeout=setTimeout(()=>{if(token===session&&!ready)error('模型加载超时，请重试或换用新版 Chrome。');},45000);
    worker.onmessage=({data})=>{
      if(token!==session)return;
      if(data.type==='ready'){clearTimeout(timeout);ready=true;lastVideo=-1;nextInference=0;lastResult=performance.now();$('mode').textContent='摄像头已开启';setHint('请正对镜头，先微笑，再张嘴大笑。');}
      else if(data.type==='error'){clearTimeout(timeout);console.error(data.message);error('人脸识别未能运行，请重试或换用新版 Chrome。');}
      else if(data.type==='result'){
        busy=false;workerMs=data.ms;const now=performance.now();lastResult=now;
        if(document.hidden)return;
        if(now-data.timestamp>500){target=null;head=null;rain=false;gate.reset();gateState='neutral';return;}
        if(!data.face){target=null;head=null;rain=false;gate.reset();gateState='neutral';setHint('未检测到面部，请回到镜头中央。');return;}
        const scale=Math.max(W/video.videoWidth,H/video.videoHeight),ox=(W-video.videoWidth*scale)/2,oy=(H-video.videoHeight*scale)/2;
        const points=data.face.map(p=>({x:W-(p.x*video.videoWidth*scale+ox),y:p.y*video.videoHeight*scale+oy}));
        const [left,right,top,bottom]=points;
        target={x:(top.x+bottom.x)/2,y:(top.y+bottom.y)/2-5,rx:Math.max(24,Math.hypot(left.x-right.x,left.y-right.y)*.59),ry:Math.max(34,Math.hypot(top.x-bottom.x,top.y-bottom.y)*.63),angle:Math.atan2(bottom.y-top.y,bottom.x-top.x)-Math.PI/2};
        const result=gate.update(data.smile,data.jaw,now,.62-Number($('sensitivity').value)*.004);gateState=result.state;rain=result.state==='smile';if(result.burst)burst();
        setHint(result.state==='laugh'?'烟花绽放！摇摇头，弹开落下的粒子。':result.state==='smile'?'正在下雨 · 再张嘴大笑试试看。':'面部已跟踪 · 试着扬起嘴角。');
      }
    };
    worker.onerror=e=>{clearTimeout(timeout);console.error(e);if(token===session)error('识别线程初始化失败，请重试或换用新版 Chrome。');};
    worker.postMessage({type:'init'});
    camera.getVideoTracks()[0].onended=()=>{if(token===session)error('摄像头已断开，请重新开启。');};
  }catch(e){if(token!==session)return;const messages={NotAllowedError:'摄像头权限被拒绝，请在浏览器地址栏允许摄像头后重试。',NotFoundError:'未找到摄像头，请连接设备后重试。',NotReadableError:'摄像头正被其他应用占用，请关闭后重试。'};error(messages[e.name]||e.message);}
}
function startDemo(){stop();demo=true;$('welcome').hidden=true;$('stop').hidden=false;$('stop').textContent='退出演示';$('demo-controls').hidden=false;$('mode').textContent='手动演示 · 非摄像头识别';target={x:W*.5,y:H*.55,rx:W*.12,ry:W*.16,angle:0};setHint('点击右侧特效按钮，拖动轮廓体验碰撞。');}
$('start').onclick=()=>{$('stop').textContent='关闭摄像头';startCamera();};$('real-camera').onclick=$('start').onclick;$('stop').onclick=stop;$('demo').onclick=startDemo;
$('manual-rain').onclick=()=>{rain=!rain;gateState=rain?'smile':'neutral';$('manual-rain').textContent=rain?'停止下雨':'微笑下雨';};$('manual-fire').onclick=()=>{burst();gateState='laugh';};
$('sensitivity').oninput=()=>{$('sensitivity-value').textContent=Number($('sensitivity').value)<35?'偏低':Number($('sensitivity').value)>65?'偏高':'标准';};
let dragging=false;canvas.onpointerdown=e=>{if(demo){dragging=true;canvas.setPointerCapture(e.pointerId);move(e);}};canvas.onpointermove=e=>{if(demo&&dragging)move(e);};canvas.onpointerup=canvas.onpointercancel=()=>dragging=false;
function move(e){const r=canvas.getBoundingClientRect();if(target){target.x=clamp(e.clientX-r.left,20,W-20);target.y=clamp(e.clientY-r.top,30,H-30);}}
document.addEventListener('visibilitychange',()=>{previous=performance.now();rain=false;target=head=null;gate.reset();gateState='neutral';resetParticles();if(!document.hidden&&demo)target={x:W*.5,y:H*.55,rx:W*.12,ry:W*.16,angle:0};});
window.addEventListener('pagehide',stop);
async function infer(now){
  if(!running||!ready||busy||document.hidden||now<nextInference||video.readyState<2||video.currentTime===lastVideo)return;
  busy=true;lastVideo=video.currentTime;nextInference=now+Math.max(66,workerMs*1.2);const token=session;
  try{const bitmap=await createImageBitmap(video,{resizeWidth:480,resizeHeight:Math.round(480*video.videoHeight/video.videoWidth),resizeQuality:'low'});if(token!==session){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);lastFrame=now;}catch(e){busy=false;if(token===session)error('摄像头图像读取失败，请重新开启。');}
}
function tick(now){
  requestAnimationFrame(tick);if(document.hidden)return;const elapsed=Math.min(.05,(now-previous)/1000);previous=now;frames++;infer(now);
  if(running&&ready&&now-lastResult>700){head=target=null;rain=false;gate.reset();gateState='neutral';setHint('正在重新寻找面部…');}
  if(running&&busy&&now-lastFrame>12000&&lastFrame){error('识别响应超时，请重新开启摄像头。');}
  if(target){if(!head)head={...target,vx:0,vy:0};const a=1-Math.exp(-elapsed*18),x=head.x,y=head.y;head.x+=(target.x-head.x)*a;head.y+=(target.y-head.y)*a;head.rx+=(target.rx-head.rx)*a;head.ry+=(target.ry-head.ry)*a;head.angle+=(target.angle-head.angle)*a;head.vx=clamp((head.x-x)/Math.max(.001,elapsed),-700,700);head.vy=clamp((head.y-y)/Math.max(.001,elapsed),-700,700);}
  ctx.clearRect(0,0,W,H);if(rain){acc+=elapsed*110*quality;while(acc>=1){spawn(Math.random()*W,-20,20+Math.random()*25,350+Math.random()*300,3,0);acc--;}}else acc=0;
  let active=0;const steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;
  for(const p of pool){if(p.life<=0)continue;active++;p.life-=elapsed;const oldX=p.x,oldY=p.y;
    for(let j=0;j<steps;j++){p.px=p.x;p.py=p.y;if(p.type)p.vy+=175*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.type&&head){swept.x=head.x-head.vx*(elapsed-(j+1)*dt);swept.y=head.y-head.vy*(elapsed-(j+1)*dt);swept.vx=head.vx;swept.vy=head.vy;swept.rx=head.rx;swept.ry=head.ry;swept.angle=head.angle;if(collide(p,swept,dt))hits++;}
    }
    if(p.y>H+40||p.x<-100||p.x>W+100){p.life=0;continue;}
    ctx.globalAlpha=clamp(p.life/(p.type?.8:.35),0,1)*(p.type?1:.55);ctx.strokeStyle=p.type?colors[p.color]:'#a0cde8';ctx.lineWidth=p.type?1.8:1;ctx.beginPath();ctx.moveTo(p.type?oldX:p.x-p.vx*.025,p.type?oldY:p.y-p.vy*.025);ctx.lineTo(p.x,p.y);ctx.stroke();
    if(p.type){ctx.fillStyle=colors[p.color];ctx.fillRect(p.x-1.3,p.y-1.3,2.6,2.6);}
  }
  ctx.globalAlpha=1;
  if(head&&$('outline').checked){ctx.save();ctx.translate(head.x,head.y);ctx.rotate(head.angle);ctx.strokeStyle=demo?'#f0cd89aa':'#b7f6df80';ctx.lineWidth=1.5;ctx.setLineDash([5,7]);ctx.beginPath();ctx.ellipse(0,0,head.rx,head.ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(now-uiTime>500){fps=frames*1000/(now-uiTime);frames=0;uiTime=now;quality=fps<35?.6:fps>50?1:quality;$('fps').textContent=Math.round(fps);$('latency').textContent=running&&ready?Math.round(workerMs):'—';$('particles').textContent=active;
    const s=demo?(rain?.65:0):gate.smile,j=demo?0:gate.jaw;$('smile-meter').value=s;$('jaw-meter').value=j;$('smile-value').textContent=Math.round(s*100)+'%';$('jaw-value').textContent=Math.round(j*100)+'%';$('expression').textContent=demo?'手动演示':head?({neutral:'自然',smile:'微笑',laugh:'大笑'}[gateState]):'尚未识别';$('rain-card').classList.toggle('active',rain);$('fire-card').classList.toggle('active',gateState==='laugh');
  }
}
requestAnimationFrame(tick);
