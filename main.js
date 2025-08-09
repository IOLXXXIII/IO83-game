const canvas=document.getElementById('game');const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const ASSETS={far:'assets/bg_far.png',mid:'assets/bg_mid.png',ground:'assets/ground.png',myo:'assets/char_myo_spritesheet_light.png'};
const images={};let loaded=0,toLoad=Object.keys(ASSETS).length;
for(const[k,src]of Object.entries(ASSETS)){const img=new Image();img.onload=()=>{images[k]=img;loaded++;if(loaded===toLoad)init();};img.src=src;}
const keys=new Set();addEventListener('keydown',e=>keys.add(e.key));addEventListener('keyup',e=>keys.delete(e.key));
let cameraX=0,worldLength=5000;
const player={x:200,y:H-140,vx:0,speed:3.2,facing:'right',frame:0,animTime:0};
const sprite={imgKey:'myo',frameCount:10,frameW:null,frameH:null,anims:{idle:[0,3],walk:[4,9]}};
function init(){const img=images[sprite.imgKey];sprite.frameW=Math.floor(img.width/sprite.frameCount);sprite.frameH=img.height;requestAnimationFrame(loop);}
function loop(){update();draw();requestAnimationFrame(loop);}
function update(){player.vx=0;if(keys.has('ArrowRight')||keys.has('d')){player.vx=player.speed;player.facing='right';}
if(keys.has('ArrowLeft')||keys.has('a')){player.vx=-player.speed;player.facing='left';}
player.x+=player.vx;if(player.x<0)player.x=0;if(player.x>worldLength)player.x=worldLength;
cameraX=Math.max(0,Math.min(player.x-W/2,worldLength-W));
const moving=Math.abs(player.vx)>0.01;const anim=moving?sprite.anims.walk:sprite.anims.idle;
player.animTime+=moving?0.25:0.10;const span=anim[1]-anim[0]+1;player.frame=anim[0]+Math.floor(player.animTime)%span;}
function draw(){ctx.clearRect(0,0,W,H);parallax(images.far,0.2);parallax(images.mid,0.5);parallax(images.ground,1.0);drawPlayer();}
function parallax(img,f){const x=-(cameraX*f)%img.width;for(let px=x-img.width;px<W;px+=img.width){ctx.drawImage(img,px,0);}}
function drawPlayer(){const img=images[sprite.imgKey],fw=sprite.frameW,fh=sprite.frameH;
const sx=fw*player.frame,sy=0;const screenX=Math.floor(player.x-cameraX),screenY=player.y;
ctx.save();if(player.facing==='left'){ctx.translate(screenX+fw/2,screenY);ctx.scale(-1,1);ctx.translate(-fw/2,0);ctx.drawImage(img,sx,sy,fw,fh,0,0,fw,fh);}else{ctx.drawImage(img,sx,sy,fw,fh,screenX,screenY,fw,fh);}ctx.restore();}
