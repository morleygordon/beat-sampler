import { useState, useEffect, useRef, useCallback } from "react";

/* ═══ DRUM SYNTH ═══ */
class DrumSynth {
  constructor(){this.ctx=null;this.master=null;this.comp=null;this.fx={};this.fxOut=null;this.recorder=null;this.recChunks=[];}
  init(){
    if(this.ctx)return;
    this.ctx=new(window.AudioContext||window.webkitAudioContext)();
    this.comp=this.ctx.createDynamicsCompressor();
    this.comp.threshold.value=-12;this.comp.knee.value=10;this.comp.ratio.value=4;
    // FX chain: master -> filter -> delay -> reverb(dry/wet) -> compressor -> dest
    this.fxOut=this.ctx.createGain();this.fxOut.gain.value=1;
    this.fx.filter=this.ctx.createBiquadFilter();this.fx.filter.type="lowpass";this.fx.filter.frequency.value=20000;this.fx.filter.Q.value=1;
    this.fx.delay=this.ctx.createDelay(2);this.fx.delay.delayTime.value=0;
    this.fx.delayGain=this.ctx.createGain();this.fx.delayGain.gain.value=0;
    this.fx.delayFeedback=this.ctx.createGain();this.fx.delayFeedback.gain.value=0.3;
    this.fx.reverbGain=this.ctx.createGain();this.fx.reverbGain.gain.value=0;
    this.fx.dryGain=this.ctx.createGain();this.fx.dryGain.gain.value=1;
    // Build reverb impulse
    const len=this.ctx.sampleRate*2,buf=this.ctx.createBuffer(2,len,this.ctx.sampleRate);
    for(let c=0;c<2;c++){const d=buf.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);}
    this.fx.reverb=this.ctx.createConvolver();this.fx.reverb.buffer=buf;
    // Sidechain pump gain
    this.fx.sidechain=this.ctx.createGain();this.fx.sidechain.gain.value=1;
    // Connect: fxOut -> filter -> dry + reverb paths -> sidechain -> comp -> dest
    this.fxOut.connect(this.fx.filter);
    this.fx.filter.connect(this.fx.dryGain);
    this.fx.filter.connect(this.fx.reverb);this.fx.reverb.connect(this.fx.reverbGain);
    this.fx.filter.connect(this.fx.delay);this.fx.delay.connect(this.fx.delayGain);
    this.fx.delay.connect(this.fx.delayFeedback);this.fx.delayFeedback.connect(this.fx.delay);
    this.fx.dryGain.connect(this.fx.sidechain);
    this.fx.reverbGain.connect(this.fx.sidechain);
    this.fx.delayGain.connect(this.fx.sidechain);
    this.fx.sidechain.connect(this.comp);
    this.comp.connect(this.ctx.destination);
    this.master=this.ctx.createGain();this.master.gain.value=0.7;
    this.master.connect(this.fxOut);
  }
  resume(){if(this.ctx?.state==="suspended")this.ctx.resume();}
  triggerSidechain(amount,bpm){
    if(!this.ctx||amount<=0)return;
    const t=this.ctx.currentTime,dur=60/bpm/2;
    this.fx.sidechain.gain.cancelScheduledValues(t);
    this.fx.sidechain.gain.setValueAtTime(1-amount*0.8,t);
    this.fx.sidechain.gain.linearRampToValueAtTime(1,t+dur);
  }
  startRecording(){
    if(!this.ctx)return;
    const dest=this.ctx.createMediaStreamDestination();
    this.comp.connect(dest);
    this.recorder=new MediaRecorder(dest.stream,{mimeType:"audio/webm;codecs=opus"});
    this.recChunks=[];
    this.recorder.ondataavailable=e=>{if(e.data.size>0)this.recChunks.push(e.data);};
    this.recorder.start();
  }
  stopRecording(){
    return new Promise(res=>{
      if(!this.recorder||this.recorder.state==="inactive"){res(null);return;}
      this.recorder.onstop=()=>{
        const blob=new Blob(this.recChunks,{type:"audio/webm"});
        res(blob);
      };
      this.recorder.stop();
    });
  }
  play(type,vol=1,pitch=1){
    if(!this.ctx)this.init();this.resume();
    const t=this.ctx.currentTime,o=this.ctx.createGain();o.gain.value=vol;o.connect(this.master);
    const fn=this["_"+type];if(fn)fn.call(this,t,o,pitch);
  }
  _kick(t,o,p){const s=this.ctx.createOscillator(),g=this.ctx.createGain();s.type="sine";s.frequency.setValueAtTime(160*p,t);s.frequency.exponentialRampToValueAtTime(40*p,t+.12);g.gain.setValueAtTime(1.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.5);s.connect(g).connect(o);s.start(t);s.stop(t+.5);const c=this.ctx.createOscillator(),cg=this.ctx.createGain();c.type="square";c.frequency.value=800*p;cg.gain.setValueAtTime(.4,t);cg.gain.exponentialRampToValueAtTime(.001,t+.02);c.connect(cg).connect(o);c.start(t);c.stop(t+.02);}
  _snare(t,o,p){const s=this.ctx.createOscillator(),g=this.ctx.createGain();s.type="triangle";s.frequency.setValueAtTime(200*p,t);s.frequency.exponentialRampToValueAtTime(100*p,t+.1);g.gain.setValueAtTime(.7,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);s.connect(g).connect(o);s.start(t);s.stop(t+.15);const l=this.ctx.sampleRate*.2,b=this.ctx.createBuffer(1,l,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<l;i++)d[i]=Math.random()*2-1;const n=this.ctx.createBufferSource();n.buffer=b;const ng=this.ctx.createGain(),hp=this.ctx.createBiquadFilter();hp.type="highpass";hp.frequency.value=3000*p;ng.gain.setValueAtTime(.8,t);ng.gain.exponentialRampToValueAtTime(.001,t+.2);n.connect(hp).connect(ng).connect(o);n.start(t);n.stop(t+.2);}
  _hihat(t,o,p){const l=this.ctx.sampleRate*.08,b=this.ctx.createBuffer(1,l,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<l;i++)d[i]=Math.random()*2-1;const n=this.ctx.createBufferSource();n.buffer=b;const g=this.ctx.createGain(),bp=this.ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=10000*p;bp.Q.value=1.5;g.gain.setValueAtTime(.6,t);g.gain.exponentialRampToValueAtTime(.001,t+.06);n.connect(bp).connect(g).connect(o);n.start(t);n.stop(t+.08);}
  _openhat(t,o,p){const l=this.ctx.sampleRate*.4,b=this.ctx.createBuffer(1,l,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<l;i++)d[i]=Math.random()*2-1;const n=this.ctx.createBufferSource();n.buffer=b;const g=this.ctx.createGain(),bp=this.ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=9000*p;bp.Q.value=1;g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);n.connect(bp).connect(g).connect(o);n.start(t);n.stop(t+.4);}
  _clap(t,o,p){for(let i=0;i<3;i++){const off=t+i*.01,l=this.ctx.sampleRate*.15,b=this.ctx.createBuffer(1,l,this.ctx.sampleRate),d=b.getChannelData(0);for(let j=0;j<l;j++)d[j]=Math.random()*2-1;const n=this.ctx.createBufferSource();n.buffer=b;const g=this.ctx.createGain(),bp=this.ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=2500*p;bp.Q.value=2;g.gain.setValueAtTime(.7,off);g.gain.exponentialRampToValueAtTime(.001,off+.12);n.connect(bp).connect(g).connect(o);n.start(off);n.stop(off+.15);}}
  _tom(t,o,p){const s=this.ctx.createOscillator(),g=this.ctx.createGain();s.type="sine";s.frequency.setValueAtTime(130*p,t);s.frequency.exponentialRampToValueAtTime(60*p,t+.2);g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);s.connect(g).connect(o);s.start(t);s.stop(t+.35);}
  _rim(t,o,p){const s=this.ctx.createOscillator(),g=this.ctx.createGain();s.type="square";s.frequency.value=800*p;g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.03);s.connect(g).connect(o);s.start(t);s.stop(t+.03);}
  _cowbell(t,o,p){const o1=this.ctx.createOscillator(),o2=this.ctx.createOscillator(),g=this.ctx.createGain();o1.type="square";o2.type="square";o1.frequency.value=560*p;o2.frequency.value=845*p;g.gain.setValueAtTime(.4,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);const bp=this.ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=700*p;o1.connect(bp);o2.connect(bp);bp.connect(g).connect(o);o1.start(t);o2.start(t);o1.stop(t+.3);o2.stop(t+.3);}
}

const DT=[
  {id:"kick",label:"KICK",color:"#FF3B30"},{id:"snare",label:"SNR",color:"#FF9500"},
  {id:"hihat",label:"HH",color:"#FFCC00"},{id:"openhat",label:"OH",color:"#34C759"},
  {id:"clap",label:"CLP",color:"#5AC8FA"},{id:"tom",label:"TOM",color:"#007AFF"},
  {id:"rim",label:"RIM",color:"#AF52DE"},{id:"cowbell",label:"BEL",color:"#FF2D55"},
];

const PRESETS={
  "Boom Bap":{kick:[1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0],snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],openhat:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],clap:new Array(16).fill(false),tom:new Array(16).fill(false),rim:new Array(16).fill(false),cowbell:new Array(16).fill(false),bpm:90},
  "Trap":{kick:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],hihat:[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],openhat:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],clap:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],tom:new Array(16).fill(false),rim:new Array(16).fill(false),cowbell:new Array(16).fill(false),bpm:140},
  "Lo-Fi":{kick:[1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],snare:[0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0],hihat:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],openhat:new Array(16).fill(false),clap:new Array(16).fill(false),tom:new Array(16).fill(false),rim:[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],cowbell:new Array(16).fill(false),bpm:80},
  "House":{kick:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],snare:new Array(16).fill(false),hihat:[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],openhat:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],clap:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],tom:new Array(16).fill(false),rim:new Array(16).fill(false),cowbell:new Array(16).fill(false),bpm:124},
  "R&B":{kick:[1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0],snare:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],hihat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],openhat:new Array(16).fill(false),clap:[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],tom:new Array(16).fill(false),rim:[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],cowbell:new Array(16).fill(false),bpm:85},
};

function initGrid(){const g={};DT.forEach(t=>{g[t.id]=new Array(16).fill(false)});return g;}
function fmtTime(s){return`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;}
const EMPTY_SAMPLE=()=>({name:"",buffer:null,duration:0,volume:.8,speed:1,startTime:0,endTime:0,loop:true,muted:false});
const SC=["#FF9500","#5AC8FA","#AF52DE","#FF2D55"];

// Waveform drawing
function drawWave(canvas,buffer,color,start,end){
  if(!canvas||!buffer)return;
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const data=buffer.getChannelData(0),total=data.length;
  const s0=Math.floor(start/buffer.duration*total),s1=Math.floor((end||buffer.duration)/buffer.duration*total);
  // Draw full waveform dimmed
  ctx.fillStyle="#111";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#222";ctx.lineWidth=1;ctx.beginPath();
  for(let i=0;i<w;i++){const idx=Math.floor(i/w*total);const v=data[idx]||0;ctx.lineTo(i,h/2-v*h/2);}
  ctx.stroke();
  // Draw selected region bright
  const x0=s0/total*w,x1=s1/total*w;
  ctx.fillStyle="rgba(255,149,0,0.08)";ctx.fillRect(x0,0,x1-x0,h);
  ctx.strokeStyle=color+"88";ctx.lineWidth=1;ctx.beginPath();
  for(let i=Math.floor(x0);i<Math.ceil(x1);i++){
    const idx=Math.floor(i/w*total);const v=data[idx]||0;
    if(i===Math.floor(x0))ctx.moveTo(i,h/2-v*h/2);else ctx.lineTo(i,h/2-v*h/2);
  }
  ctx.stroke();
}

export default function BeatForge(){
  const synthRef=useRef(null);
  if(!synthRef.current)synthRef.current=new DrumSynth();

  const[bpm,setBpm]=useState(90);
  const[masterPlaying,setMasterPlaying]=useState(false);
  const[currentStep,setCurrentStep]=useState(-1);
  const[tab,setTab]=useState("samples");
  const[samples,setSamples]=useState([{...EMPTY_SAMPLE(),color:SC[0]}]);
  const sSourcesRef=useRef([]);const sGainsRef=useRef([]);
  const[drumGrid,setDrumGrid]=useState(initGrid);
  const[drumVol,setDrumVol]=useState(.8);
  const timerRef=useRef(null);const stepRef=useRef(-1);
  const[vocal,setVocal]=useState(EMPTY_SAMPLE());
  const vSrcRef=useRef(null);const vGainRef=useRef(null);const vTimeRef=useRef(0);
  const[vocalTime,setVocalTime]=useState(0);const vAnimRef=useRef(null);
  const[aiSong,setAiSong]=useState("");const[aiLoading,setAiLoading]=useState(false);const[aiResult,setAiResult]=useState(null);
  // FX state
  const[filterFreq,setFilterFreq]=useState(20000);
  const[filterType,setFilterType]=useState("lowpass");
  const[filterQ,setFilterQ]=useState(1);
  const[reverbMix,setReverbMix]=useState(0);
  const[delayTime,setDelayTime]=useState(0);
  const[delayFeedback,setDelayFeedback]=useState(.3);
  const[delayMix,setDelayMix]=useState(0);
  const[sidechainAmt,setSidechainAmt]=useState(0);
  // Recording
  const[recording,setRecording]=useState(false);
  const[recordedBlob,setRecordedBlob]=useState(null);
  // Canvas refs for waveforms
  const waveCanvasRefs=useRef([]);
  const vocalCanvasRef=useRef(null);

  // Apply FX params
  useEffect(()=>{
    const s=synthRef.current;if(!s.ctx)return;
    s.fx.filter.type=filterType;s.fx.filter.frequency.value=filterFreq;s.fx.filter.Q.value=filterQ;
    s.fx.reverbGain.gain.value=reverbMix;s.fx.dryGain.gain.value=1-reverbMix*0.5;
    s.fx.delay.delayTime.value=delayTime;s.fx.delayFeedback.gain.value=delayFeedback;s.fx.delayGain.gain.value=delayMix;
  },[filterFreq,filterType,filterQ,reverbMix,delayTime,delayFeedback,delayMix]);

  // Sample management
  const addSample=()=>{if(samples.length>=4)return;setSamples(s=>[...s,{...EMPTY_SAMPLE(),color:SC[s.length%4]}]);};
  const rmSample=(i)=>{stopSample(i);setSamples(s=>s.filter((_,j)=>j!==i));};
  const updSample=(i,u)=>setSamples(s=>s.map((x,j)=>j===i?{...x,...u}:x));

  const loadSampleFile=async(i,file)=>{
    const s=synthRef.current;s.init();
    const ab=await file.arrayBuffer(),dec=await s.ctx.decodeAudioData(ab);
    updSample(i,{name:file.name,buffer:dec,duration:dec.duration,endTime:dec.duration});
    setTimeout(()=>{if(waveCanvasRefs.current[i])drawWave(waveCanvasRefs.current[i],dec,SC[i%4],0,dec.duration);},100);
  };

  const playSample=(i)=>{
    stopSample(i);const s=samples[i];if(!s.buffer||s.muted)return;
    const sy=synthRef.current;sy.init();sy.resume();
    const src=sy.ctx.createBufferSource();src.buffer=s.buffer;src.playbackRate.value=s.speed;src.loop=s.loop;
    if(s.loop){src.loopStart=s.startTime;src.loopEnd=s.endTime||s.duration;}
    const gain=sy.ctx.createGain();gain.gain.value=s.volume;
    src.connect(gain).connect(sy.fxOut);
    src.start(0,s.startTime,s.loop?undefined:(s.endTime||s.duration)-s.startTime);
    sSourcesRef.current[i]=src;sGainsRef.current[i]=gain;
  };
  const stopSample=(i)=>{try{sSourcesRef.current[i]?.stop();}catch{}sSourcesRef.current[i]=null;};

  // Vocals
  const loadVocalFile=async(file)=>{
    const s=synthRef.current;s.init();
    const ab=await file.arrayBuffer(),dec=await s.ctx.decodeAudioData(ab);
    setVocal(v=>({...v,name:file.name,buffer:dec,duration:dec.duration,endTime:dec.duration}));
    setTimeout(()=>{if(vocalCanvasRef.current)drawWave(vocalCanvasRef.current,dec,"#AF52DE",0,dec.duration);},100);
  };
  const playVocal=()=>{
    stopVocal();if(!vocal.buffer||vocal.muted)return;
    const sy=synthRef.current;sy.init();sy.resume();
    const src=sy.ctx.createBufferSource();src.buffer=vocal.buffer;src.playbackRate.value=vocal.speed;src.loop=vocal.loop;
    if(vocal.loop){src.loopStart=vocal.startTime;src.loopEnd=vocal.endTime||vocal.duration;}
    const gain=sy.ctx.createGain();gain.gain.value=vocal.volume;
    src.connect(gain).connect(sy.fxOut);
    src.start(0,vocal.startTime);vSrcRef.current=src;vGainRef.current=gain;
    vTimeRef.current=sy.ctx.currentTime-vocal.startTime;
    src.onended=()=>{if(!vocal.loop){vSrcRef.current=null;cancelAnimationFrame(vAnimRef.current);}};
    const tick=()=>{if(sy.ctx&&vSrcRef.current){setVocalTime(Math.min((sy.ctx.currentTime-vTimeRef.current)*vocal.speed,vocal.duration));vAnimRef.current=requestAnimationFrame(tick);}};tick();
  };
  const stopVocal=()=>{try{vSrcRef.current?.stop();}catch{}vSrcRef.current=null;cancelAnimationFrame(vAnimRef.current);};

  useEffect(()=>{if(vGainRef.current)vGainRef.current.gain.value=vocal.volume;},[vocal.volume]);
  useEffect(()=>{if(vSrcRef.current)vSrcRef.current.playbackRate.value=vocal.speed;},[vocal.speed]);

  // Drum tick
  const drumTick=useCallback(()=>{
    stepRef.current=(stepRef.current+1)%16;setCurrentStep(stepRef.current);
    const s=stepRef.current,sy=synthRef.current;
    if(s%4===0&&sidechainAmt>0)sy.triggerSidechain(sidechainAmt,bpm);
    DT.forEach(track=>{if(drumGrid[track.id][s])sy.play(track.id,drumVol);});
  },[drumGrid,drumVol,bpm,sidechainAmt]);

  const masterPlay=()=>{
    const sy=synthRef.current;sy.init();sy.resume();setMasterPlaying(true);
    samples.forEach((_,i)=>{if(samples[i].buffer&&!samples[i].muted)playSample(i);});
    if(vocal.buffer&&!vocal.muted)playVocal();
    stepRef.current=-1;const ms=(60000/bpm)/4;drumTick();timerRef.current=setInterval(drumTick,ms);
  };
  const masterStop=()=>{
    setMasterPlaying(false);clearInterval(timerRef.current);setCurrentStep(-1);stepRef.current=-1;
    samples.forEach((_,i)=>stopSample(i));stopVocal();
  };

  useEffect(()=>{
    if(masterPlaying){clearInterval(timerRef.current);const ms=(60000/bpm)/4;timerRef.current=setInterval(drumTick,ms);}
    return()=>clearInterval(timerRef.current);
  },[bpm,drumTick,masterPlaying]);

  useEffect(()=>{samples.forEach((s,i)=>{if(sGainsRef.current[i])sGainsRef.current[i].gain.value=s.volume;});},[samples]);

  // Recording
  const toggleRecord=async()=>{
    if(recording){const blob=await synthRef.current.stopRecording();setRecordedBlob(blob);setRecording(false);masterStop();}
    else{synthRef.current.init();synthRef.current.startRecording();setRecording(true);setRecordedBlob(null);masterPlay();}
  };
  const downloadRecording=()=>{
    if(!recordedBlob)return;
    const url=URL.createObjectURL(recordedBlob),a=document.createElement("a");
    a.href=url;a.download=`beatforge-export-${Date.now()}.webm`;a.click();URL.revokeObjectURL(url);
  };

  // AI
  const analyzeAI=async()=>{
    if(!aiSong.trim())return;setAiLoading(true);setAiResult(null);
    try{
      const apiKey=import.meta.env.VITE_ANTHROPIC_API_KEY||"";
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,messages:[{role:"user",content:`You are a legendary hip-hop producer. A beatmaker wants to sample "${aiSong}". Respond ONLY with JSON (no markdown) with: "songBpm":number,"suggestedBpm":number,"samplePoints":array of 3-4 objects with "section","timestamp","description","chipmunkSoul"(bool),"drumPattern":object with keys kick,snare,hihat,openhat,clap,tom,rim,cowbell each array of 16 booleans,"genre":string,"vibe":string one-line mood,"productionTips":array of 3 tips,"speedSuggestion":string,"referenceTracks":array of 2-3 songs,"fxSuggestions":object with "filterType"(lowpass/highpass),"filterFreq":number,"reverbMix":number 0-1,"delayTime":number 0-1,"sidechainAmount":number 0-1`}]})});
      const data=await res.json(),text=data.content?.map(i=>i.text||"").join("")||"";
      setAiResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch(e){setAiResult({error:"Couldn't analyze. Try again."});}
    setAiLoading(false);
  };

  const applyAIDrums=()=>{
    if(!aiResult?.drumPattern)return;
    const g={};DT.forEach(t=>{g[t.id]=aiResult.drumPattern[t.id]||new Array(16).fill(false);});
    setDrumGrid(g);if(aiResult.suggestedBpm)setBpm(aiResult.suggestedBpm);setTab("drums");
  };
  const applyAIFx=()=>{
    if(!aiResult?.fxSuggestions)return;const f=aiResult.fxSuggestions;
    if(f.filterType)setFilterType(f.filterType);if(f.filterFreq)setFilterFreq(f.filterFreq);
    if(f.reverbMix!=null)setReverbMix(f.reverbMix);if(f.delayTime!=null){setDelayTime(f.delayTime);setDelayMix(f.delayTime>0?.4:0);}
    if(f.sidechainAmount!=null)setSidechainAmt(f.sidechainAmount);setTab("fx");
  };

  const loadPreset=(name)=>{
    const p=PRESETS[name];if(!p)return;
    const g={};DT.forEach(t=>{g[t.id]=[...p[t.id]];});setDrumGrid(g);setBpm(p.bpm);
  };

  const toggleDrum=(tid,step)=>setDrumGrid(g=>({...g,[tid]:g[tid].map((v,i)=>i===step?!v:v)}));

  // Redraw waveforms when start/end changes
  useEffect(()=>{samples.forEach((s,i)=>{if(s.buffer&&waveCanvasRefs.current[i])drawWave(waveCanvasRefs.current[i],s.buffer,s.color||SC[i%4],s.startTime,s.endTime);});},[samples]);
  useEffect(()=>{if(vocal.buffer&&vocalCanvasRef.current)drawWave(vocalCanvasRef.current,vocal.buffer,"#AF52DE",vocal.startTime,vocal.endTime);},[vocal]);

  return(
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#060606}::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer}
        input[type=range]::-webkit-slider-track{height:4px;background:#1a1a1a;border-radius:2px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;margin-top:-4.5px;border:2px solid #444}
        input[type=number]{-moz-appearance:textfield}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes recPulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={S.logoIcon}><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="3" height="12" rx="1" fill="#FF3B30"/><rect x="7" y="3" width="3" height="18" rx="1" fill="#FF9500"/><rect x="12" y="8" width="3" height="8" rx="1" fill="#FFCC00"/><rect x="17" y="4" width="3" height="16" rx="1" fill="#5AC8FA"/></svg></div>
          <div><div style={S.logoText}>BEATFORGE</div><div style={{fontSize:6,letterSpacing:4,color:"#2a2a2a"}}>SAMPLE STUDIO</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={toggleRecord} style={{...S.recBtn,background:recording?"#FF3B30":"#333",animation:recording?"recPulse 1s infinite":"none"}}>
            {recording?"⏺ REC":"⏺"}
          </button>
          <button onClick={masterPlaying?masterStop:masterPlay} style={{...S.masterBtn,background:masterPlaying?"#FF3B30":"#34C759"}}>
            {masterPlaying?"■ STOP":"▶ PLAY"}
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
          <div style={{fontSize:6,letterSpacing:3,color:"#2a2a2a"}}>BPM</div>
          <div style={{display:"flex",alignItems:"center",gap:2}}>
            <button style={S.tinyBtn} onClick={()=>setBpm(b=>Math.max(40,b-1))}>−</button>
            <input type="number" value={bpm} onChange={e=>setBpm(Math.max(40,Math.min(300,+e.target.value||90)))} style={S.bpmInput}/>
            <button style={S.tinyBtn} onClick={()=>setBpm(b=>Math.min(300,b+1))}>+</button>
          </div>
        </div>
      </div>

      {/* Export bar */}
      {recordedBlob&&!recording&&(
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"rgba(52,199,89,0.08)",border:"1px solid #1a3a1a",borderRadius:6}}>
          <span style={{fontSize:9,color:"#34C759",flex:1}}>✓ Recording ready ({Math.round(recordedBlob.size/1024)}KB)</span>
          <button onClick={downloadRecording} style={{...S.chipBtn,color:"#34C759",borderColor:"#34C759"}}>⬇ DOWNLOAD</button>
        </div>
      )}

      {/* TABS */}
      <div style={S.tabBar}>
        {[{id:"samples",icon:"💿"},{id:"drums",icon:"🥁"},{id:"vocals",icon:"🎤"},{id:"fx",icon:"🎚"},{id:"ai",icon:"🧠"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{...S.tabBtn,color:tab===t.id?"#FF9500":"#2a2a2a",borderBottom:tab===t.id?"2px solid #FF9500":"2px solid transparent",background:tab===t.id?"#0c0c0c":"transparent"}}>
            <span style={{fontSize:11}}>{t.icon}</span><br/><span style={{fontSize:7,letterSpacing:1}}>{t.id.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* ═══ SAMPLES ═══ */}
      {tab==="samples"&&(
        <div style={{animation:"slideUp .15s",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#333"}}>SAMPLE TRACKS ({samples.length}/4)</div>
            {samples.length<4&&<button onClick={addSample} style={S.addBtn}>+ ADD</button>}
          </div>
          {samples.map((s,i)=>(
            <div key={i} style={{...S.card,borderLeft:`3px solid ${s.color||SC[i%4]}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:9,fontWeight:700,color:s.color||SC[i%4],letterSpacing:2}}>SAMPLE {i+1}</div>
                <div style={{display:"flex",gap:3}}>
                  <button onClick={()=>updSample(i,{muted:!s.muted})} style={{...S.chipBtn,color:s.muted?"#FF3B30":"#333"}}>{s.muted?"MUTED":"MUTE"}</button>
                  {samples.length>1&&<button onClick={()=>rmSample(i)} style={{...S.chipBtn,color:"#FF3B30"}}>✕</button>}
                </div>
              </div>
              {!s.buffer?(
                <label style={{cursor:"pointer",display:"block"}}>
                  <input type="file" accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma,*/*" onChange={e=>{if(e.target.files[0])loadSampleFile(i,e.target.files[0])}} style={{display:"none"}}/>
                  <div style={S.uploadBox}><div style={{fontSize:20}}>💿</div><div style={{fontSize:9,color:"#444"}}>Load song to sample</div><div style={{fontSize:7,color:"#2a2a2a"}}>MP3 · WAV · OGG · AAC</div></div>
                </label>
              ):(
                <div>
                  <div style={{fontSize:9,color:"#555",marginBottom:4}}>📄 {s.name}</div>
                  <canvas ref={el=>waveCanvasRefs.current[i]=el} width={320} height={40} style={{width:"100%",height:40,borderRadius:4,marginBottom:6}}/>
                  <div style={{display:"flex",gap:4,marginBottom:8}}>
                    <button onClick={()=>playSample(i)} style={{...S.playSmBtn,background:s.color||SC[i%4]}}>▶</button>
                    <button onClick={()=>stopSample(i)} style={S.stopSmBtn}>■</button>
                    <button onClick={()=>updSample(i,{loop:!s.loop})} style={{...S.chipBtn,color:s.loop?"#FF9500":"#333"}}>LOOP</button>
                    <label style={{...S.chipBtn,cursor:"pointer",color:"#5AC8FA"}}>SWAP<input type="file" accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma,*/*" onChange={e=>{if(e.target.files[0])loadSampleFile(i,e.target.files[0])}} style={{display:"none"}}/></label>
                  </div>
                  {[{k:"volume",l:"VOL",min:0,max:100,v:Math.round(s.volume*100),fn:e=>updSample(i,{volume:+e.target.value/100}),d:"%"},
                    {k:"speed",l:"SPEED",min:25,max:250,v:Math.round(s.speed*100),fn:e=>updSample(i,{speed:+e.target.value/100}),d:"%"},
                    {k:"startTime",l:"START",min:0,max:Math.floor(s.duration*100),v:Math.round(s.startTime*100),fn:e=>updSample(i,{startTime:+e.target.value/100}),d:fmtTime(s.startTime)},
                    {k:"endTime",l:"END",min:0,max:Math.floor(s.duration*100),v:Math.round((s.endTime||s.duration)*100),fn:e=>updSample(i,{endTime:+e.target.value/100}),d:fmtTime(s.endTime||s.duration)}
                  ].map(sl=>(
                    <div key={sl.k} style={S.sliderRow}><span style={S.sLbl}>{sl.l}</span><input type="range" min={sl.min} max={sl.max} value={sl.v} onChange={sl.fn} style={{flex:1}}/><span style={S.sVal}>{sl.d==="%" ? sl.v+"%" : sl.d}</span></div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={S.tipBox}>
            💡 <b style={{color:"#444"}}>TIP:</b> Songs from Apple Music are DRM-protected and can't be loaded. Use files you've purchased (iTunes DRM-free), ripped from CD, or downloaded from production sites like Splice, Tracklib, or Loopcloud.
          </div>
        </div>
      )}

      {/* ═══ DRUMS ═══ */}
      {tab==="drums"&&(
        <div style={{animation:"slideUp .15s"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:4}}>
            <div style={{fontSize:9,letterSpacing:3,color:"#333"}}>DRUMS</div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {Object.keys(PRESETS).map(name=>(
                <button key={name} onClick={()=>loadPreset(name)} style={{...S.chipBtn,fontSize:7}}>{name}</button>
              ))}
              <button style={{...S.chipBtn,color:"#FF3B30"}} onClick={()=>setDrumGrid(initGrid())}>CLR</button>
            </div>
          </div>
          <div style={S.sliderRow}><span style={S.sLbl}>VOL</span><input type="range" min={0} max={100} value={Math.round(drumVol*100)} onChange={e=>setDrumVol(+e.target.value/100)} style={{flex:1,maxWidth:140}}/><span style={S.sVal}>{Math.round(drumVol*100)}%</span></div>

          <div style={{display:"flex",marginTop:4,marginBottom:1}}>
            <div style={{width:44,minWidth:44}}/>
            {Array.from({length:16},(_,i)=>(<div key={i} style={{flex:1,textAlign:"center",fontSize:6,color:i===currentStep?"#fff":i%4===0?"#333":"#181818",fontWeight:i===currentStep?700:400,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</div>))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:1}}>
            {DT.map(track=>(
              <div key={track.id} style={{display:"flex",alignItems:"center"}}>
                <button onClick={()=>{synthRef.current.init();synthRef.current.resume();synthRef.current.play(track.id,drumVol)}} style={{width:44,minWidth:44,background:"none",border:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:7,fontWeight:600,letterSpacing:1,color:track.color,cursor:"pointer",textAlign:"left",padding:"2px 2px 2px 0"}}>{track.label}</button>
                <div style={{display:"flex",flex:1,gap:1.5}}>
                  {Array.from({length:16},(_,step)=>{
                    const on=drumGrid[track.id][step],cur=step===currentStep&&masterPlaying;
                    return(<button key={step} onClick={()=>toggleDrum(track.id,step)} style={{flex:1,aspectRatio:"1",maxWidth:26,maxHeight:26,borderRadius:3,padding:0,cursor:"pointer",background:on?track.color:step%4===0?"#111":"#0a0a0a",border:`1px solid ${cur?"#fff":on?track.color:"#151515"}`,boxShadow:on?`0 0 4px ${track.color}33`:"none",transform:cur?"scale(1.08)":"scale(1)",transition:"all .05s"}}/>);
                  })}
                </div>
              </div>
            ))}
          </div>
          {aiResult?.drumPattern&&<button onClick={applyAIDrums} style={{...S.addBtn,width:"100%",marginTop:6,borderColor:"#FF9500",color:"#FF9500"}}>🧠 LOAD AI PATTERN</button>}
        </div>
      )}

      {/* ═══ VOCALS ═══ */}
      {tab==="vocals"&&(
        <div style={{animation:"slideUp .15s",display:"flex",flexDirection:"column",gap:8}}>
          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#333",marginBottom:6}}>VOCAL TRACK</div>
            {!vocal.buffer?(
              <label style={{cursor:"pointer",display:"block"}}>
                <input type="file" accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.wma,*/*" onChange={e=>{if(e.target.files[0])loadVocalFile(e.target.files[0])}} style={{display:"none"}}/>
                <div style={S.uploadBox}><div style={{fontSize:20}}>🎤</div><div style={{fontSize:9,color:"#444"}}>Load vocal / acapella</div><div style={{fontSize:7,color:"#2a2a2a"}}>MP3 · WAV · OGG · AAC</div></div>
              </label>
            ):(
              <div>
                <div style={{fontSize:9,color:"#555",marginBottom:4}}>🎤 {vocal.name}</div>
                <canvas ref={vocalCanvasRef} width={320} height={40} style={{width:"100%",height:40,borderRadius:4,marginBottom:4}}/>
                <div style={{height:4,background:"#111",borderRadius:2,overflow:"hidden",marginBottom:6}}>
                  <div style={{height:"100%",width:`${(vocalTime/vocal.duration)*100}%`,background:"linear-gradient(90deg,#AF52DE,#FF2D55)",borderRadius:2,transition:"width .1s linear"}}/>
                </div>
                <div style={{display:"flex",gap:4,marginBottom:8}}>
                  <button onClick={playVocal} style={{...S.playSmBtn,background:"#AF52DE"}}>▶</button>
                  <button onClick={stopVocal} style={S.stopSmBtn}>■</button>
                  <button onClick={()=>setVocal(v=>({...v,loop:!v.loop}))} style={{...S.chipBtn,color:vocal.loop?"#AF52DE":"#333"}}>LOOP</button>
                  <button onClick={()=>setVocal(v=>({...v,muted:!v.muted}))} style={{...S.chipBtn,color:vocal.muted?"#FF3B30":"#333"}}>{vocal.muted?"MUTED":"MUTE"}</button>
                </div>
                {[{l:"VOL",min:0,max:100,v:Math.round(vocal.volume*100),fn:e=>setVocal(v=>({...v,volume:+e.target.value/100})),d:Math.round(vocal.volume*100)+"%"},
                  {l:"SPEED",min:25,max:250,v:Math.round(vocal.speed*100),fn:e=>setVocal(v=>({...v,speed:+e.target.value/100})),d:Math.round(vocal.speed*100)+"%",hl:true},
                  {l:"START",min:0,max:Math.floor(vocal.duration*100),v:Math.round(vocal.startTime*100),fn:e=>setVocal(v=>({...v,startTime:+e.target.value/100})),d:fmtTime(vocal.startTime)},
                ].map(sl=>(<div key={sl.l} style={S.sliderRow}><span style={{...S.sLbl,color:sl.hl?"#AF52DE":"#333"}}>{sl.l}</span><input type="range" min={sl.min} max={sl.max} value={sl.v} onChange={sl.fn} style={{flex:1}}/><span style={S.sVal}>{sl.d}</span></div>))}
                <div style={{...S.tipBox,marginTop:8}}>🎵 <b style={{color:"#AF52DE"}}>CHIPMUNK SOUL:</b> Speed 120-140% = pitched-up Kanye style. Speed 70-85% = chopped & screwed.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ FX ═══ */}
      {tab==="fx"&&(
        <div style={{animation:"slideUp .15s",display:"flex",flexDirection:"column",gap:8}}>
          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#444",marginBottom:8}}>MASTER FILTER</div>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              {["lowpass","highpass","bandpass"].map(t=>(<button key={t} onClick={()=>setFilterType(t)} style={{...S.chipBtn,color:filterType===t?"#FFCC00":"#333",borderColor:filterType===t?"#FFCC00":"#181818"}}>{t.toUpperCase()}</button>))}
            </div>
            <div style={S.sliderRow}><span style={S.sLbl}>FREQ</span><input type="range" min={20} max={20000} value={filterFreq} onChange={e=>setFilterFreq(+e.target.value)} style={{flex:1}}/><span style={S.sVal}>{filterFreq>=1000?(filterFreq/1000).toFixed(1)+"k":filterFreq}Hz</span></div>
            <div style={S.sliderRow}><span style={S.sLbl}>RESO</span><input type="range" min={0} max={200} value={Math.round(filterQ*10)} onChange={e=>setFilterQ(+e.target.value/10)} style={{flex:1}}/><span style={S.sVal}>{filterQ.toFixed(1)}</span></div>
          </div>

          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#444",marginBottom:8}}>REVERB</div>
            <div style={S.sliderRow}><span style={S.sLbl}>MIX</span><input type="range" min={0} max={100} value={Math.round(reverbMix*100)} onChange={e=>setReverbMix(+e.target.value/100)} style={{flex:1}}/><span style={S.sVal}>{Math.round(reverbMix*100)}%</span></div>
          </div>

          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#444",marginBottom:8}}>DELAY</div>
            <div style={S.sliderRow}><span style={S.sLbl}>TIME</span><input type="range" min={0} max={100} value={Math.round(delayTime*100)} onChange={e=>setDelayTime(+e.target.value/100)} style={{flex:1}}/><span style={S.sVal}>{Math.round(delayTime*1000)}ms</span></div>
            <div style={S.sliderRow}><span style={S.sLbl}>FDBK</span><input type="range" min={0} max={90} value={Math.round(delayFeedback*100)} onChange={e=>setDelayFeedback(+e.target.value/100)} style={{flex:1}}/><span style={S.sVal}>{Math.round(delayFeedback*100)}%</span></div>
            <div style={S.sliderRow}><span style={S.sLbl}>MIX</span><input type="range" min={0} max={100} value={Math.round(delayMix*100)} onChange={e=>setDelayMix(+e.target.value/100)} style={{flex:1}}/><span style={S.sVal}>{Math.round(delayMix*100)}%</span></div>
          </div>

          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#444",marginBottom:8}}>SIDECHAIN PUMP</div>
            <div style={S.sliderRow}><span style={S.sLbl}>AMT</span><input type="range" min={0} max={100} value={Math.round(sidechainAmt*100)} onChange={e=>setSidechainAmt(+e.target.value/100)} style={{flex:1}}/><span style={S.sVal}>{Math.round(sidechainAmt*100)}%</span></div>
            <div style={{fontSize:8,color:"#2a2a2a",marginTop:4}}>Ducks audio on every beat for that classic pump effect</div>
          </div>

          {aiResult?.fxSuggestions&&<button onClick={applyAIFx} style={{...S.addBtn,width:"100%",borderColor:"#FF9500",color:"#FF9500"}}>🧠 APPLY AI FX SETTINGS</button>}

          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#34C759",marginBottom:6}}>⏺ EXPORT</div>
            <p style={{fontSize:9,color:"#3a3a3a",lineHeight:1.6,marginBottom:8}}>Hit RECORD (⏺ in header), play your beat, then stop to capture the output. Download as an audio file you can share or import into a DAW.</p>
            {recordedBlob&&<button onClick={downloadRecording} style={{...S.masterBtn,background:"#34C759",width:"100%",fontSize:10}}>⬇ DOWNLOAD RECORDING ({Math.round(recordedBlob.size/1024)}KB)</button>}
          </div>
        </div>
      )}

      {/* ═══ AI ═══ */}
      {tab==="ai"&&(
        <div style={{animation:"slideUp .15s",display:"flex",flexDirection:"column",gap:8}}>
          <div style={S.card}>
            <div style={{fontSize:9,letterSpacing:3,color:"#333",marginBottom:4}}>AI SAMPLE ADVISOR</div>
            <p style={{fontSize:9,color:"#2a2a2a",lineHeight:1.6,marginBottom:8}}>Type any song name. AI suggests where to chop, what drums to use, FX settings, BPM, speed, and reference tracks.</p>
            <div style={{display:"flex",gap:4,marginBottom:6}}>
              <input value={aiSong} onChange={e=>setAiSong(e.target.value)} placeholder='"With or Without You - U2"' onKeyDown={e=>{if(e.key==="Enter")analyzeAI()}}
                style={{flex:1,height:36,padding:"0 10px",borderRadius:6,border:"1px solid #1a1a1a",background:"#080808",color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}/>
              <button onClick={analyzeAI} disabled={aiLoading||!aiSong.trim()} style={{...S.masterBtn,background:aiLoading?"#222":"#FF9500",fontSize:9,padding:"0 12px",height:36,opacity:aiLoading||!aiSong.trim()?.5:1}}>
                {aiLoading?<span style={{display:"inline-block",width:12,height:12,border:"2px solid #FF9500",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>:"ANALYZE"}
              </button>
            </div>
          </div>

          {aiResult&&!aiResult.error&&(
            <div style={{...S.card,animation:"slideUp .2s"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div><div style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:"'Outfit',sans-serif"}}>{aiResult.genre}</div><div style={{fontSize:9,color:"#FF9500",fontStyle:"italic"}}>"{aiResult.vibe}"</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:8,color:"#333"}}>BPM</div><div style={{fontSize:13,fontWeight:700,color:"#fff",fontFamily:"'Outfit',sans-serif"}}>{aiResult.songBpm}→{aiResult.suggestedBpm}</div></div>
              </div>
              <div style={{background:"rgba(175,82,222,.06)",border:"1px solid #1a1230",borderRadius:6,padding:"7px 9px",marginBottom:8}}>
                <div style={{fontSize:7,letterSpacing:2,color:"#AF52DE",marginBottom:2}}>🎚 SPEED</div>
                <div style={{fontSize:9,color:"#666",lineHeight:1.5}}>{aiResult.speedSuggestion}</div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:8,letterSpacing:2,color:"#FFCC00",marginBottom:4}}>🔥 SAMPLE POINTS</div>
                {aiResult.samplePoints?.map((sp,i)=>(
                  <div key={i} style={{background:"#080808",borderRadius:5,padding:"6px 8px",marginBottom:3,border:"1px solid #121212"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{sp.section}</span>
                      <span style={{fontSize:9,color:"#FF9500",fontFamily:"'JetBrains Mono',monospace"}}>{sp.timestamp}</span>
                    </div>
                    <div style={{fontSize:8,color:"#555",lineHeight:1.5}}>{sp.description}</div>
                    {sp.chipmunkSoul&&<div style={{fontSize:7,color:"#AF52DE",marginTop:2}}>⚡ Speed this up for chipmunk soul!</div>}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:4,marginBottom:8}}>
                <button onClick={applyAIDrums} style={{...S.addBtn,flex:1,borderColor:"#FF9500",color:"#FF9500"}}>🥁 APPLY DRUMS</button>
                {aiResult.fxSuggestions&&<button onClick={applyAIFx} style={{...S.addBtn,flex:1,borderColor:"#AF52DE",color:"#AF52DE"}}>🎚 APPLY FX</button>}
              </div>
              <div style={{marginBottom:6}}>
                <div style={{fontSize:8,letterSpacing:2,color:"#34C759",marginBottom:3}}>🎛 TIPS</div>
                {aiResult.productionTips?.map((t,i)=>(<div key={i} style={{fontSize:9,color:"#555",padding:"2px 0",borderBottom:"1px solid #0a0a0a"}}>• {t}</div>))}
              </div>
              {aiResult.referenceTracks&&<div>
                <div style={{fontSize:8,letterSpacing:2,color:"#5AC8FA",marginBottom:3}}>🎧 REFERENCES</div>
                {aiResult.referenceTracks.map((r,i)=>(<div key={i} style={{fontSize:9,color:"#555",padding:"2px 0"}}>• {r}</div>))}
              </div>}
            </div>
          )}
          {aiResult?.error&&<div style={{...S.card,borderColor:"#331111"}}><div style={{fontSize:10,color:"#FF3B30"}}>{aiResult.error}</div></div>}
        </div>
      )}

      <div style={{textAlign:"center",fontSize:6,letterSpacing:2,color:"#151515",padding:"8px 0 4px",borderTop:"1px solid #0a0a0a"}}>
        BEATFORGE SAMPLE STUDIO · LOAD · CHOP · LAYER · CREATE
      </div>
    </div>
  );
}

const S={
  wrap:{minHeight:"100vh",background:"#050505",color:"#fff",fontFamily:"'JetBrains Mono',monospace",padding:"8px 8px",display:"flex",flexDirection:"column",gap:6,overflowX:"hidden"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,padding:"4px 0 6px",borderBottom:"1px solid #111",flexWrap:"wrap"},
  logoIcon:{width:28,height:28,borderRadius:5,background:"#0a0a0a",border:"1px solid #181818",display:"flex",alignItems:"center",justifyContent:"center"},
  logoText:{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:900,letterSpacing:3,background:"linear-gradient(135deg,#FF3B30,#FF9500,#FFCC00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  masterBtn:{height:32,padding:"0 12px",borderRadius:6,border:"none",color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer",transition:"all .15s"},
  recBtn:{width:28,height:28,borderRadius:"50%",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  tinyBtn:{width:18,height:18,borderRadius:3,border:"1px solid #181818",background:"#0a0a0a",color:"#555",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  bpmInput:{width:40,height:22,textAlign:"center",background:"#000",border:"1px solid #181818",borderRadius:3,color:"#FF9500",fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700},
  tabBar:{display:"flex",gap:0,borderBottom:"1px solid #111"},
  tabBtn:{flex:1,padding:"6px 0 4px",border:"none",background:"transparent",fontFamily:"'JetBrains Mono',monospace",cursor:"pointer",transition:"all .12s",lineHeight:1.3},
  card:{background:"#090909",border:"1px solid #141414",borderRadius:8,padding:"10px"},
  uploadBox:{border:"2px dashed #181818",borderRadius:8,padding:"16px 10px",textAlign:"center",background:"#060606",display:"flex",flexDirection:"column",alignItems:"center",gap:3},
  addBtn:{height:26,padding:"0 10px",borderRadius:4,border:"1px solid #1a1a1a",background:"transparent",color:"#34C759",fontFamily:"'JetBrains Mono',monospace",fontSize:8,letterSpacing:1,cursor:"pointer"},
  chipBtn:{height:22,padding:"0 7px",borderRadius:3,border:"1px solid #181818",background:"transparent",fontFamily:"'JetBrains Mono',monospace",fontSize:7,letterSpacing:1,cursor:"pointer",color:"#333",display:"inline-flex",alignItems:"center"},
  playSmBtn:{width:28,height:24,borderRadius:4,border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  stopSmBtn:{width:28,height:24,borderRadius:4,border:"1px solid #1a1a1a",background:"#0a0a0a",color:"#666",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  sliderRow:{display:"flex",alignItems:"center",gap:6,marginBottom:2},
  sLbl:{fontSize:7,letterSpacing:2,color:"#333",minWidth:32},
  sVal:{fontSize:8,color:"#444",minWidth:30,textAlign:"right"},
  tipBox:{padding:"7px 9px",background:"#070707",borderRadius:5,border:"1px solid #101010",fontSize:8,color:"#2a2a2a",lineHeight:1.6},
};
