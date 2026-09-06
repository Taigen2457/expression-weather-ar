export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ExpressionGate {
  constructor(){this.reset();}
  reset(){this.smile=0;this.jaw=0;this.state='neutral';this.candidate='neutral';this.since=0;this.last=0;this.lastBurst=-Infinity;this.armed=true;this.relaxSince=0;}
  update(smile,jaw,now,threshold=.42){
    const a=1-Math.exp(-Math.min(200,now-(this.last||now-50))/100);this.last=now;
    this.smile+=(smile-this.smile)*a;this.jaw+=(jaw-this.jaw)*a;
    const laugh=this.smile>threshold+.12 && this.jaw>(this.state==='laugh'?.18:.25);
    const next=laugh?'laugh':this.smile>(this.state==='smile'?threshold-.10:threshold)?'smile':'neutral';
    if(next!==this.candidate){this.candidate=next;this.since=now;}
    if(now-this.since>=(next==='laugh'?220:160))this.state=next;
    if(next!=='laugh'){if(!this.relaxSince)this.relaxSince=now;if(now-this.relaxSince>400)this.armed=true;}else this.relaxSince=0;
    const burst=this.state==='laugh'&&next==='laugh'&&this.armed&&now-this.lastBurst>1600;
    if(burst){this.lastBurst=now;this.armed=false;}
    return {state:this.state,burst,smile:this.smile,jaw:this.jaw};
  }
}
// Continuous point sweep against an ellipse in its moving reference frame.
export function collide(p,h,dt){
  const cos=Math.cos(h.angle),sin=Math.sin(h.angle),rx=h.rx+2,ry=h.ry+2;
  const sx=p.px-(h.x-h.vx*dt),sy=p.py-(h.y-h.vy*dt),ex=p.x-h.x,ey=p.y-h.y;
  const ax=(cos*sx+sin*sy)/rx,ay=(-sin*sx+cos*sy)/ry;
  const bx=(cos*ex+sin*ey)/rx,by=(-sin*ex+cos*ey)/ry,dx=bx-ax,dy=by-ay;
  const A=dx*dx+dy*dy,B=2*(ax*dx+ay*dy),C=ax*ax+ay*ay-1;
  let t=null;
  if(C<0)t=0;
  else if(A>1e-9){const d=B*B-4*A*C;if(d>=0){const q=(-B-Math.sqrt(d))/(2*A);if(q>=0&&q<=1)t=q;}}
  if(t===null)return false;
  let ux=ax+dx*t,uy=ay+dy*t;const len=Math.hypot(ux,uy)||1;ux/=len;uy/=len;
  let nx=cos*ux/rx-sin*uy/ry,ny=sin*ux/rx+cos*uy/ry;const nl=Math.hypot(nx,ny);nx/=nl;ny/=nl;
  const vn=(p.vx-h.vx)*nx+(p.vy-h.vy)*ny;
  if(vn<0){p.vx-=1.72*vn*nx;p.vy-=1.72*vn*ny;}
  const speed=Math.hypot(p.vx,p.vy);if(speed>1000){p.vx*=1000/speed;p.vy*=1000/speed;}
  p.x=h.x+cos*ux*rx-sin*uy*ry+nx*1.5;p.y=h.y+sin*ux*rx+cos*uy*ry+ny*1.5;
  return vn<0;
}
