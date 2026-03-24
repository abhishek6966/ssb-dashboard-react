import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Sun, Moon, Database, FileSpreadsheet, FileText, Cloud,
  ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Download,
  Home, Search, Layers, TrendingUp, TrendingDown, Award,
  AlertTriangle, BarChart2, Activity, Zap, Shield, Filter,
  Table2, Check, Sigma, Hash, ArrowUpRight, ArrowDownRight,
  Minus, Star, SlidersHorizontal, Eye
} from "lucide-react";

// ─────────────────────────────────────────────────────────
//  THEME TOKENS
// ─────────────────────────────────────────────────────────
const DARK = {
  bg:         "#07090F",
  panel:      "rgba(255,255,255,.042)",
  panelHov:   "rgba(255,255,255,.07)",
  border:     "rgba(255,255,255,.075)",
  borderAccent:"rgba(220,55,55,.5)",
  text:       "rgba(241,245,249,.96)",
  muted:      "rgba(148,163,184,.62)",
  dim:        "rgba(100,116,139,.45)",
  accent:     "#DC3737",
  accentSoft: "rgba(220,55,55,.13)",
  header:     "rgba(7,9,15,.85)",
  field:      "rgba(255,255,255,.048)",
  tHead:      "rgba(10,14,24,.82)",
  rowHov:     "rgba(255,255,255,.022)",
  pgBtn:      "rgba(255,255,255,.048)",
  g1:         "rgba(220,55,55,.06)",
  g2:         "rgba(56,115,220,.04)",
  scrollT:    "rgba(255,255,255,.11)",
};
const LIGHT = {
  bg:         "#EEF2F7",
  panel:      "rgba(255,255,255,.88)",
  panelHov:   "rgba(255,255,255,.99)",
  border:     "rgba(15,23,42,.08)",
  borderAccent:"rgba(200,40,40,.45)",
  text:       "#0D1524",
  muted:      "#4E6280",
  dim:        "#94A3B8",
  accent:     "#C0272C",
  accentSoft: "rgba(192,39,44,.1)",
  header:     "rgba(238,242,247,.88)",
  field:      "rgba(15,23,42,.045)",
  tHead:      "rgba(240,244,250,.95)",
  rowHov:     "rgba(15,23,42,.025)",
  pgBtn:      "rgba(15,23,42,.045)",
  g1:         "rgba(200,40,40,.035)",
  g2:         "rgba(56,115,220,.025)",
  scrollT:    "rgba(15,23,42,.13)",
};

const PALETTE = [
  "#DC3737","#3B82F6","#F59E0B","#10B981",
  "#8B5CF6","#EC4899","#06B6D4","#84CC16",
];

const CALC_TYPES = [
  { id:"sum",      Icon:Sigma,         label:"Sum",      desc:"Total of all values" },
  { id:"avg",      Icon:Activity,      label:"Average",  desc:"Mean value" },
  { id:"count",    Icon:Hash,          label:"Count",    desc:"Number of rows" },
  { id:"distinct", Icon:Layers,        label:"Distinct", desc:"Unique values" },
  { id:"min",      Icon:ArrowDownRight,label:"Min",      desc:"Lowest value" },
  { id:"max",      Icon:ArrowUpRight,  label:"Max",      desc:"Highest value" },
  { id:"median",   Icon:Minus,         label:"Median",   desc:"Middle value" },
];

// ─────────────────────────────────────────────────────────
//  DATA ENGINE
// ─────────────────────────────────────────────────────────
const JUNK_EXACT = ["sr no","s no","srno","serial no","roll no","rollno","reg no","regno","id","uid","uuid","_id"];
const JUNK_SUBS  = ["phone","mobile","contact no","contact_no","fax","whatsapp","email","e-mail","url","link","website","password","secret","token"];
const CAT_SUBS   = ["year","semester","term","session","batch","cohort","division","section","class","group","program","course","degree","major","stream","branch","dept","department","status","stage","state","phase","level","type","category","kind","mode","gender","sex","campus","location","city","region","race","ethnicity","diabetic","smoking","drinking","disease","condition","disorder","activity","active","industry","employment","role","nationality","country"];

const sv = v => { if (v===null||v===undefined) return ""; if (v instanceof Date) { try{return v.toLocaleDateString();}catch{return "";} } try{return String(v).trim();}catch{return "";} };
const toNum = v => { const s=sv(v).replace(/[$,%]/g,"").replace(/,/g,"").trim(); if(!s||s==="-")return null; const n=parseFloat(s); return isFinite(n)&&!isNaN(n)?n:null; };
const fmtN = (n,d=0) => { if(n===null||n===undefined)return"-"; if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+"M"; if(Math.abs(n)>=1e3&&d===0)return(n/1e3).toFixed(1)+"K"; if(d>0)return n.toFixed(d); if(n%1!==0)return n.toFixed(1); return n.toLocaleString(); };

function isJunk(name) {
  const n = name.toLowerCase().replace(/_/g," ").trim();
  return JUNK_EXACT.includes(n) || JUNK_SUBS.some(j=>n.includes(j));
}

function classify(col, rows) {
  const n = col.toLowerCase().replace(/_/g," ").trim();
  if (isJunk(n)) return "identifier";
  const step = rows.length>400 ? Math.ceil(rows.length/300) : 1;
  const vals = [];
  for (let i=0;i<rows.length;i+=step) { const v=sv((rows[i]||{})[col]); if(v&&v!=="null"&&v!=="undefined") vals.push(v); }
  if (!vals.length) return "empty";
  const uniq = [...new Set(vals)];
  if (uniq.length<=6 && uniq.every(v=>["yes","no","true","false","y","n"].includes(v.toLowerCase()))) return "category";
  const pc = vals.slice(0,60).filter(v=>/^\d{7,}$/.test(v.replace(/[\s\-\+\(\)\.]/g,""))).length;
  if (pc/Math.min(vals.length,60)>0.5) return "identifier";
  const nums = vals.map(toNum).filter(v=>v!==null);
  const nr = nums.length/vals.length;
  if (nr>=0.65) { if(!nums.length)return"text"; const mx=Math.max(...nums),avg=nums.reduce((a,b)=>a+b,0)/nums.length; if(mx>999999&&avg>99999&&uniq.length===vals.length)return"identifier"; return"metric"; }
  if (CAT_SUBS.some(h=>n.includes(h))) return "category";
  if (uniq.length<=30 && uniq.length/vals.length<0.6) return "category";
  if (vals.slice(0,20).filter(v=>/^\d{2}[-]\d{2}$/.test(v)||/^\d+ or (older|younger)$/i.test(v)).length>=3) return "category";
  return "text";
}

function analyzeRows(rows) {
  const out={metric:[],category:[],identifier:[],text:[]};
  if (!rows?.length) return out;
  Object.keys(rows[0]||{}).forEach(col=>{ try{const t=classify(col,rows);if(t==="empty")return;(out[t]||out.text).push(col);}catch{out.text.push(col);} });
  return out;
}

function aggregate(rows, col, type) {
  const nums = rows.map(r=>toNum(r[col])).filter(v=>v!==null);
  if (!nums.length && type!=="count" && type!=="distinct") return {val:null,label:"-",sub:"0 records"};
  switch(type) {
    case"sum":    { const v=nums.reduce((a,b)=>a+b,0); return{val:v,label:fmtN(v),sub:`sum · ${nums.length} rows`}; }
    case"avg":    { const v=nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null; return{val:v,label:v!==null?fmtN(v,1):"-",sub:`avg · ${nums.length} rows`}; }
    case"count":  return{val:rows.length,label:rows.length.toLocaleString(),sub:"total rows"};
    case"distinct":{ const s=new Set(rows.map(r=>sv(r[col])).filter(Boolean)); return{val:s.size,label:s.size.toLocaleString(),sub:"unique values"}; }
    case"min":    { const v=nums.length?Math.min(...nums):null; return{val:v,label:v!==null?fmtN(v):"-",sub:"minimum"}; }
    case"max":    { const v=nums.length?Math.max(...nums):null; return{val:v,label:v!==null?fmtN(v):"-",sub:"maximum"}; }
    case"median": { const s=[...nums].sort((a,b)=>a-b);const m=Math.floor(s.length/2);const v=s.length%2?s[m]:(s[m-1]+s[m])/2; return{val:v,label:fmtN(v,1),sub:"median"}; }
    default:      { const v=nums.reduce((a,b)=>a+b,0); return{val:v,label:fmtN(v),sub:"sum"}; }
  }
}

const smartCalc = col => /rate|ratio|gpa|cgpa|bmi|score|avg|pct|percent/i.test(col) ? "avg" : "sum";

function buildInsights(ana, rows) {
  const ins=[]; const{category:cats,metric:mets}=ana;
  // Top performer
  if (cats.length&&mets.length) {
    const g={}; rows.forEach(r=>{const k=sv(r[cats[0]])||"Unknown";const v=toNum(r[mets[0]]);if(v!==null)g[k]=(g[k]||0)+v;});
    const e=Object.entries(g).sort((a,b)=>b[1]-a[1]);
    if (e.length>=2) { const pct=e[0][1]>0?Math.round((e[0][1]-e[e.length-1][1])/e[0][1]*100):0; ins.push({Icon:Award,title:`Top ${cats[0].replace(/_/g," ")}`,val:e[0][0],detail:`${fmtN(e[0][1])} ${mets[0].replace(/_/g," ").toLowerCase()} · ${pct}% above lowest`,color:"#F59E0B"}); }
  }
  // Concentration
  if (cats.length) {
    const c2=cats.length>1?cats[1]:cats[0]; const g2={}; rows.forEach(r=>{const k=sv(r[c2])||"Unknown";g2[k]=(g2[k]||0)+1;});
    const e2=Object.entries(g2).sort((a,b)=>b[1]-a[1]);
    if (e2.length>1) { const ts=Math.round(e2[0][1]/rows.length*100); if(ts>40) ins.push({Icon:Zap,title:"Concentration",val:`${ts}%`,detail:`${e2[0][0]} leads ${c2.replace(/_/g," ")} (${e2[0][1]} of ${rows.length})`,color:"#8B5CF6"}); }
  }
  // Spread
  if (mets.length) {
    const nums=rows.map(r=>toNum(r[mets[0]])).filter(v=>v!==null);
    if (nums.length>=3) { const avg=nums.reduce((a,b)=>a+b,0)/nums.length; const cv=avg!==0?(Math.sqrt(nums.reduce((a,b)=>a+Math.pow(b-avg,2),0)/nums.length)/avg)*100:0; if(cv>5) ins.push({Icon:BarChart2,title:`${mets[0].replace(/_/g," ")} range`,val:`${fmtN(Math.min(...nums))} – ${fmtN(Math.max(...nums))}`,detail:`Avg ${fmtN(avg,1)} · ${Math.round(cv)}% variation`,color:"#10B981"}); }
  }
  // Completeness
  if (rows.length>0) {
    const cc=Object.keys(rows[0]).length; const empty=rows.reduce((a,r)=>a+Object.values(r).filter(v=>sv(v)==="").length,0); const pct=Math.round((1-empty/(rows.length*cc))*100);
    if (pct<98) ins.push({Icon:pct>=85?AlertTriangle:Shield,title:"Data completeness",val:`${pct}%`,detail:`${empty} empty cells · ${100-pct}% missing`,color:pct>=85?"#F59E0B":"#EF4444"});
  }
  // Trend
  if (cats.length&&mets.length) {
    const tc=cats.find(c=>/year|term|semester|date|month|quarter/i.test(c));
    if (tc) { const tg={}; rows.forEach(r=>{const k=sv(r[tc]);const v=toNum(r[mets[0]]);if(k&&v!==null)tg[k]=(tg[k]||0)+v;}); const tk=Object.keys(tg); if(tk.length>=2){const ch=tg[tk[0]]>0?Math.round((tg[tk[tk.length-1]]-tg[tk[0]])/tg[tk[0]]*100):0;if(Math.abs(ch)>1)ins.push({Icon:ch>0?TrendingUp:TrendingDown,title:`Trend · ${mets[0].replace(/_/g," ")}`,val:`${ch>0?"▲":"▼"} ${Math.abs(ch)}%`,detail:`${tk[0]}: ${fmtN(tg[tk[0]])} → ${tk[tk.length-1]}: ${fmtN(tg[tk[tk.length-1]])}`,color:ch>0?"#10B981":"#EF4444"});} }
  }
  return ins.slice(0,4);
}

function cleanRows(raw) {
  if (!Array.isArray(raw)||!raw.length) return [];
  return raw.map(r=>{ if(!r||typeof r!=="object")return null; const c={};let hd=false; Object.entries(r).forEach(([k,v])=>{const key=sv(k);if(key&&key!=="null"){c[key]=sv(v);if(sv(v)!=="")hd=true;}}); return hd?c:null; }).filter(Boolean);
}
const groupBy=(rows,cat,met,fk,fv)=>{const g={};rows.forEach(r=>{if(fk&&fv&&sv(r[fk])!==fv)return;const k=sv(r[cat])||"Other";const v=toNum(r[met]);if(v!==null)g[k]=(g[k]||0)+v;});return Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,value])=>({name,value}));};
const countBy=(rows,cat)=>{const g={};rows.forEach(r=>{const k=sv(r[cat])||"Other";g[k]=(g[k]||0)+1;});return Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([name,value])=>({name,value}));};

// ─────────────────────────────────────────────────────────
//  MICRO COMPONENTS
// ─────────────────────────────────────────────────────────
const ChartTip = ({active,payload,label,T}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:T.tHead,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 16px",backdropFilter:"blur(20px)"}}>
      <p style={{color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:".6px",marginBottom:4}}>{label}</p>
      {payload.map((p,i)=><p key={i} style={{color:T.text,fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>{fmtN(p.value)}</p>)}
    </div>
  );
};

function GlassCard({children,style={},hover=true,accent,T}){
  const[hov,setHov]=useState(false);
  return(
    <div
      onMouseEnter={()=>hover&&setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        background: hov?T.panelHov:T.panel,
        border:`1px solid ${hov&&accent?accent+"44":T.border}`,
        borderRadius:16, backdropFilter:"blur(20px)",
        boxShadow: hov ? `0 0 0 1px ${accent||T.accent}18, 0 16px 48px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.06)` : `inset 0 1px 0 rgba(255,255,255,.05), 0 4px 16px rgba(0,0,0,.08)`,
        transform: hov&&hover ? "translateY(-2px)" : "translateY(0)",
        transition:"all .2s cubic-bezier(.34,1.56,.64,1)",
        position:"relative", overflow:"visible",
        ...style,
      }}>
      {children}
    </div>
  );
}

function Pill({label,active,onClick,T}){
  return(
    <button onClick={onClick} style={{
      fontSize:11,padding:"4px 13px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",
      fontFamily:"inherit",fontWeight:600,transition:"all .15s",
      border:`1.5px solid ${active?T.accent:T.border}`,
      background:active?T.accentSoft:"transparent",
      color:active?T.accent:T.muted,
    }}
    onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor=T.accent+"55";e.currentTarget.style.color=T.text;}}}
    onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}}>
      {label}
    </button>
  );
}

function ThemeToggle({isDark,toggle,T}){
  return(
    <button onClick={toggle} title={isDark?"Switch to light mode":"Switch to dark mode"} style={{
      display:"flex",alignItems:"center",gap:6,padding:"6px 13px",
      border:`1px solid ${T.border}`,borderRadius:9,cursor:"pointer",
      background:T.panel,color:T.muted,fontFamily:"inherit",fontSize:12,fontWeight:600,
      backdropFilter:"blur(12px)",transition:"all .2s",
    }}
    onMouseEnter={e=>{e.currentTarget.style.background=T.panelHov;e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor=T.accent+"50";}}
    onMouseLeave={e=>{e.currentTarget.style.background=T.panel;e.currentTarget.style.color=T.muted;e.currentTarget.style.borderColor=T.border;}}>
      {isDark?<Sun size={14}/>:<Moon size={14}/>}
      <span>{isDark?"Light":"Dark"}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
//  KPI CARD
// ─────────────────────────────────────────────────────────
function KpiCard({col,rows,color,calcType,onCalcChange,T}){
  const[open,setOpen]=useState(false);
  const ref=useRef();
  const res=useMemo(()=>aggregate(rows,col,calcType),[rows,col,calcType]);
  const ct=CALC_TYPES.find(c=>c.id===calcType)||CALC_TYPES[0];

  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  return(
    <GlassCard ref={ref} style={{padding:"20px 22px"}} accent={color} T={T}>
      {/* Top shimmer line */}
      <div style={{position:"absolute",top:0,left:"18%",right:"18%",height:"1.5px",background:`linear-gradient(90deg,transparent,${color}90,transparent)`,borderRadius:2}} />
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
        <span style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"1.3px",lineHeight:1.4}}>{col.replace(/_/g," ")}</span>
        <div ref={ref} style={{position:"relative"}}>
          <button onClick={()=>setOpen(!open)} style={{
            display:"flex",alignItems:"center",gap:5,padding:"4px 9px",borderRadius:8,
            border:`1px solid ${T.border}`,background:T.field,color:T.muted,
            fontFamily:"inherit",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all .15s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background=T.panelHov;e.currentTarget.style.color=T.text;}}
          onMouseLeave={e=>{e.currentTarget.style.background=T.field;e.currentTarget.style.color=T.muted;}}>
            <ct.Icon size={10}/><span>{ct.label}</span><ChevronDown size={9} style={{transition:"transform .15s",transform:open?"rotate(180deg)":""}}/>
          </button>
          {open&&(
            <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,zIndex:999,
              background:T.tHead,border:`1px solid ${T.border}`,borderRadius:14,padding:8,
              minWidth:215,boxShadow:"0 24px 64px rgba(0,0,0,.28)",backdropFilter:"blur(24px)"}}>
              <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"1px",padding:"4px 10px 8px"}}>Calculation Method</p>
              {CALC_TYPES.map(ct2=>(
                <div key={ct2.id} onClick={()=>{onCalcChange(col,ct2.id);setOpen(false);}} style={{
                  display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:9,cursor:"pointer",
                  background:calcType===ct2.id?`${color}14`:"transparent",
                  color:calcType===ct2.id?color:T.muted,transition:"background .1s",
                }}
                onMouseEnter={e=>{if(calcType!==ct2.id)e.currentTarget.style.background=T.panelHov;}}
                onMouseLeave={e=>{if(calcType!==ct2.id)e.currentTarget.style.background="transparent";}}>
                  <ct2.Icon size={13} style={{flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:600}}>{ct2.label}</span>
                  {calcType===ct2.id?<Check size={11} style={{marginLeft:"auto"}}/>:<span style={{fontSize:10,color:T.dim,marginLeft:"auto"}}>{ct2.desc}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{fontSize:30,fontWeight:800,fontFamily:"'DM Mono',monospace",color,lineHeight:1,marginBottom:7,letterSpacing:"-1.5px"}}>{res.label}</div>
      <div style={{fontSize:11,color:T.dim,fontWeight:500}}>{res.sub}</div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────
//  INSIGHT CARD
// ─────────────────────────────────────────────────────────
function InsightCard({ins,delay,T}){
  return(
    <div style={{
      background:T.panel,border:`1px solid ${ins.color}20`,borderRadius:14,
      padding:"16px 20px",display:"flex",gap:14,flex:1,minWidth:200,
      backdropFilter:"blur(20px)",animation:`fadeUp .45s cubic-bezier(.22,1,.36,1) ${delay}s both`,
      boxShadow:`inset 0 1px 0 rgba(255,255,255,.04)`,transition:"all .2s",
    }}
    onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${ins.color}45`;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${ins.color}20`;e.currentTarget.style.transform="";}}>
      <div style={{width:38,height:38,borderRadius:11,background:`${ins.color}14`,border:`1px solid ${ins.color}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <ins.Icon size={16} color={ins.color} strokeWidth={2}/>
      </div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{ins.title}</div>
        <div style={{fontSize:20,fontWeight:800,fontFamily:"'DM Mono',monospace",color:ins.color,lineHeight:1.1,marginBottom:5}}>{ins.val}</div>
        <div style={{fontSize:11,color:T.muted,lineHeight:1.55}}>{ins.detail}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────
function Dashboard({tabs,names,T,isDark,toggle}){
  const[active,setActive]=useState(names[0]||"");
  const[kpiCfg,setKpiCfg]=useState({});
  const[chartF,setChartF]=useState({});
  const[chartM,setChartM]=useState({});
  const[search,setSearch]=useState("");
  const[pages,setPages]=useState({});
  const PGSZ=25;

  useEffect(()=>{setActive(names[0]||"");setSearch("");},[names]);
  useEffect(()=>{setSearch("");},[active]);

  const rows=tabs[active]||[];
  const ana=useMemo(()=>analyzeRows(rows),[rows]);
  const insights=useMemo(()=>buildInsights(ana,rows),[ana,rows]);
  const cols=Object.keys(rows[0]||{});
  const metSet=new Set(ana.metric);
  const{category:cats,metric:mets}=ana;

  const getCalc=col=>(kpiCfg[active]||{})[col]||smartCalc(col);
  const setCalc=(col,type)=>setKpiCfg(p=>({...p,[active]:{...(p[active]||{}),[col]:type}}));

  const chartDefs=useMemo(()=>{
    const D=[];
    if(!cats.length&&!mets.length)return D;
    if(cats.length&&mets.length){
      const m0=chartM[`${active}_0`]||mets[0],fk=chartF[`${active}_0k`]||"",fv=chartF[`${active}_0v`]||"";
      D.push({id:0,type:"bar",title:`${m0.replace(/_/g," ")} by ${cats[0].replace(/_/g," ")}`,sub:"Sorted by value",data:groupBy(rows,cats[0],m0,fk,fv),filterCat:cats.length>1?cats[1]:null,met:m0,col:PALETTE[0]});
      const c2=cats.length>1?cats[1]:cats[0],g2=groupBy(rows,c2,mets[0]);
      if(g2.length>1&&g2.length<=12)D.push({id:1,type:"pie",title:`${mets[0].replace(/_/g," ")} breakdown`,sub:`By ${c2.replace(/_/g," ")}`,data:g2});
      if(mets.length>1){const m2=chartM[`${active}_2`]||mets[1];D.push({id:2,type:"bar",title:`${m2.replace(/_/g," ")} by ${cats[0].replace(/_/g," ")}`,sub:"Comparison",data:groupBy(rows,cats[0],m2),met:m2,col:PALETTE[1]});}
    }else if(cats.length){
      D.push({id:0,type:"bar",title:`Records by ${cats[0].replace(/_/g," ")}`,sub:"Distribution",data:countBy(rows,cats[0]),col:PALETTE[0]});
      if(cats.length>1){const d=countBy(rows,cats[1]);if(d.length<=12)D.push({id:1,type:"pie",title:`By ${cats[1].replace(/_/g," ")}`,sub:"Distribution",data:d});}
    }
    return D;
  },[rows,cats,mets,active,chartF,chartM]);

  const filtered=useMemo(()=>{if(!search.trim())return rows;const q=search.toLowerCase();return rows.filter(r=>Object.values(r).some(v=>sv(v).toLowerCase().includes(q)));},[rows,search]);
  const page=pages[active]||1,totalPg=Math.max(1,Math.ceil(filtered.length/PGSZ)),slice=filtered.slice((page-1)*PGSZ,page*PGSZ);
  const filterCat=chartDefs[0]?.filterCat;
  const filterVals=useMemo(()=>{if(!filterCat)return[];const s=new Set();rows.forEach(r=>{const v=sv(r[filterCat]);if(v)s.add(v);});return[...s].sort();},[rows,filterCat]);
  const activeFilter=chartF[`${active}_0v`]||"";
  const glCols=chartDefs.length===1?"1fr":chartDefs.length===2?"3fr 2fr":"2fr 1fr 1fr";

  const selSt={fontFamily:"inherit",fontSize:11,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 10px",background:T.field,color:T.muted,outline:"none",cursor:"pointer"};

  return(
    <div style={{padding:"28px 32px 80px"}}>

      {/* Tab strip */}
      <div style={{display:"flex",flexWrap:"wrap",marginBottom:24,background:T.panel,borderRadius:12,padding:4,border:`1px solid ${T.border}`,width:"fit-content",gap:2,backdropFilter:"blur(16px)"}}>
        {names.map(n=>(
          <button key={n} onClick={()=>setActive(n)} style={{
            fontFamily:"inherit",fontSize:13,fontWeight:active===n?700:500,
            padding:"8px 20px",border:"none",borderRadius:9,cursor:"pointer",
            background:active===n?T.accentSoft:"transparent",
            color:active===n?T.accent:T.muted,transition:"all .15s",whiteSpace:"nowrap",
          }}>{n}</button>
        ))}
      </div>

      {/* Stats badges */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {Icon:Database,val:rows.length.toLocaleString(),lbl:"records"},
          {Icon:Layers,val:cols.length,lbl:"columns"},
          mets.length&&{Icon:TrendingUp,val:mets.length,lbl:"metrics"},
          cats.length&&{Icon:Filter,val:cats.length,lbl:"categories"},
        ].filter(Boolean).map((b,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,background:T.panel,border:`1px solid ${T.border}`,color:T.muted,backdropFilter:"blur(12px)"}}>
            <b.Icon size={11} color={T.muted}/><strong style={{color:T.text,fontWeight:700}}>{b.val}</strong><span>{b.lbl}</span>
          </div>
        ))}
      </div>

      {/* KPI grid */}
      {mets.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:14,marginBottom:22}}>
          {mets.slice(0,5).map((col,i)=>(
            <KpiCard key={col} col={col} rows={rows} color={PALETTE[i%PALETTE.length]} calcType={getCalc(col)} onCalcChange={setCalc} T={T}/>
          ))}
        </div>
      )}

      {/* Insights */}
      {insights.length>0&&(
        <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap"}}>
          {insights.map((ins,i)=><InsightCard key={i} ins={ins} delay={i*.07} T={T}/>)}
        </div>
      )}

      {/* No-analytics notice */}
      {!mets.length&&!cats.length&&(
        <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:14,padding:"18px 22px",marginBottom:16,display:"flex",gap:12,alignItems:"center",color:T.muted,fontSize:13}}>
          <Eye size={15} color={T.muted}/><span><strong style={{color:T.text}}>Text / identifier data</strong> — Names, contact info, IDs. Searchable table below.</span>
        </div>
      )}

      {/* Charts */}
      {chartDefs.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:glCols,gap:16,marginBottom:16}}>
          {chartDefs.map(d=>{
            const controls=d.id===0&&(mets.length>1||filterCat)?(
              <>
                {mets.length>1&&<select value={chartM[`${active}_0`]||mets[0]} onChange={e=>setChartM(p=>({...p,[`${active}_0`]:e.target.value}))} style={selSt}>{mets.slice(0,6).map(m=><option key={m} value={m}>{m.replace(/_/g," ")}</option>)}</select>}
                {filterCat&&<><Pill label="All" active={!activeFilter} onClick={()=>setChartF(p=>({...p,[`${active}_0k`]:"", [`${active}_0v`]:""}))} T={T}/>{filterVals.slice(0,5).map(v=><Pill key={v} label={v} active={activeFilter===v} onClick={()=>setChartF(p=>({...p,[`${active}_0k`]:filterCat,[`${active}_0v`]:v}))} T={T}/>)}</>}
              </>
            ):d.id===2&&mets.length>2?(
              <select value={chartM[`${active}_2`]||mets[1]} onChange={e=>setChartM(p=>({...p,[`${active}_2`]:e.target.value}))} style={selSt}>{mets.slice(1,6).map(m=><option key={m} value={m}>{m.replace(/_/g," ")}</option>)}</select>
            ):null;

            return(
              <GlassCard key={d.id} style={{padding:"22px 24px"}} hover={false} T={T}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18,gap:10,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,letterSpacing:"-.2px"}}>{d.title}</div>
                    {d.sub&&<div style={{fontSize:11,color:T.muted,marginTop:3}}>{d.sub}</div>}
                  </div>
                  {controls&&<div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>{controls}</div>}
                </div>
                {d.type==="bar"?(
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={d.data} barCategoryGap="32%">
                      <CartesianGrid vertical={false} stroke={T.border} strokeDasharray="3 3"/>
                      <XAxis dataKey="name" tick={{fill:T.dim,fontSize:10,fontFamily:"inherit"}} axisLine={false} tickLine={false} interval={0} angle={d.data.length>7?-28:0} textAnchor={d.data.length>7?"end":"middle"} height={d.data.length>7?48:26}/>
                      <YAxis tick={{fill:T.dim,fontSize:10,fontFamily:"'DM Mono',monospace"}} axisLine={false} tickLine={false} tickFormatter={v=>fmtN(v)}/>
                      <Tooltip content={<ChartTip T={T}/>} cursor={{fill:T.rowHov}}/>
                      <Bar dataKey="value" radius={[6,6,0,0]}>
                        {d.data.map((_,i)=><Cell key={i} fill={i===0?(d.col||PALETTE[0]):(d.col||PALETTE[0])+"70"}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ):(
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={d.data} cx="50%" cy="50%" innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={2}>
                        {d.data.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                      </Pie>
                      <Tooltip content={<ChartTip T={T}/>}/>
                      <Legend formatter={v=><span style={{color:T.muted,fontSize:11}}>{v}</span>}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Data table */}
      <GlassCard style={{overflow:"hidden",borderRadius:18}} hover={false} T={T}>
        {/* Table toolbar */}
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:T.panel}}>
          <div style={{flex:1,minWidth:200,position:"relative"}}>
            <Search size={12} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:T.dim,pointerEvents:"none"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${active}...`}
              style={{width:"100%",padding:"8px 12px 8px 30px",border:`1px solid ${T.border}`,borderRadius:10,fontFamily:"inherit",fontSize:13,outline:"none",background:T.field,color:T.text,caretColor:T.accent,transition:"border .15s"}}
              onFocus={e=>e.currentTarget.style.border=`1px solid ${T.accent}55`}
              onBlur={e=>e.currentTarget.style.border=`1px solid ${T.border}`}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,color:T.dim,fontSize:12}}>
            <Table2 size={12}/><strong style={{color:T.muted}}>{filtered.length.toLocaleString()}</strong> rows · <strong style={{color:T.muted}}>{cols.length}</strong> cols
          </div>
        </div>

        {/* Table body */}
        <div style={{overflowX:"auto",maxHeight:400,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>{cols.map(c=>(
                <th key={c} style={{background:T.tHead,color:T.dim,padding:"9px 14px",textAlign:metSet.has(c)?"right":"left",fontWeight:700,fontSize:10,whiteSpace:"nowrap",position:"sticky",top:0,zIndex:2,letterSpacing:".8px",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:metSet.has(c)?"flex-end":"flex-start"}}>
                    {metSet.has(c)&&<Activity size={9} color={T.dim}/>}
                    {c.replace(/_/g," ")}
                  </div>
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {slice.map((r,i)=>(
                <tr key={i} style={{transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.rowHov}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  {cols.map(c=>(
                    <td key={c} style={{padding:"9px 14px",borderBottom:`1px solid ${T.border}`,color:metSet.has(c)?T.accent:T.text,textAlign:metSet.has(c)?"right":"left",fontFamily:metSet.has(c)?"'DM Mono',monospace":"inherit",fontWeight:metSet.has(c)?600:400,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {sv(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:T.tHead}}>
          <span style={{fontSize:11,color:T.dim}}>{((page-1)*PGSZ+1).toLocaleString()}–{Math.min(page*PGSZ,filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <button onClick={()=>setPages(p=>({...p,[active]:Math.max(1,(p[active]||1)-1)}))} disabled={page<=1} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:7,padding:"4px 7px",cursor:page<=1?"not-allowed":"pointer",color:T.muted,opacity:page<=1?.35:1,display:"flex",alignItems:"center",transition:"all .15s"}}
              onMouseEnter={e=>{if(page>1){e.currentTarget.style.borderColor=T.accent+"50";e.currentTarget.style.color=T.text;}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
              <ChevronLeft size={13}/>
            </button>
            {Array.from({length:Math.min(totalPg,5)},(_,i)=>{
              let pg; if(totalPg<=5)pg=i+1; else if(page<=3)pg=[1,2,3,4,totalPg][i]; else if(page>=totalPg-2)pg=[1,totalPg-3,totalPg-2,totalPg-1,totalPg][i]; else pg=[1,page-1,page,page+1,totalPg][i];
              return<button key={pg} onClick={()=>setPages(p=>({...p,[active]:pg}))} style={{fontSize:12,padding:"4px 10px",border:`1px solid ${pg===page?T.accent:T.border}`,borderRadius:7,cursor:"pointer",background:pg===page?T.accentSoft:T.pgBtn,color:pg===page?T.accent:T.muted,fontFamily:"inherit",fontWeight:pg===page?700:500,transition:"all .12s"}}>{pg}</button>;
            })}
            <button onClick={()=>setPages(p=>({...p,[active]:Math.min(totalPg,(p[active]||1)+1)}))} disabled={page>=totalPg} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:7,padding:"4px 7px",cursor:page>=totalPg?"not-allowed":"pointer",color:T.muted,opacity:page>=totalPg?.35:1,display:"flex",alignItems:"center",transition:"all .15s"}}
              onMouseEnter={e=>{if(page<totalPg){e.currentTarget.style.borderColor=T.accent+"50";e.currentTarget.style.color=T.text;}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
              <ChevronRight size={13}/>
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  CONNECT SCREEN
// ─────────────────────────────────────────────────────────
function ConnectScreen({onLoad,T,isDark,toggle}){
  const[panel,setPanel]=useState(null);
  const[gsId,setGsId]=useState(localStorage.getItem("ssb_gs")||"");
  const[gsTabs,setGsTabs]=useState(localStorage.getItem("ssb_gs_tabs")||"");
  const[err,setErr]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");
  const[file,setFile]=useState(null);

  const sources=[
    {id:"gs",  Icon:Database,      name:"Google Sheets",   desc:"Sheet ID + tab names. Live refresh every 5 min.",  tag:"Live",   tc:"#10B981"},
    {id:"xl",  Icon:FileSpreadsheet,name:"Excel (.xlsx)",   desc:"Every worksheet becomes a dashboard tab.",          tag:"Upload", tc:"#3B82F6"},
    {id:"csv", Icon:FileText,       name:"CSV File",         desc:"Any .csv — BANNER, PeopleSoft, Google Forms.",      tag:"Upload", tc:"#3B82F6"},
    {id:"sf",  Icon:Cloud,          name:"Salesforce",       desc:"Export as CSV. No API keys or IT approval needed.", tag:"No login",tc:"#F59E0B"},
  ];

  const doGS=async()=>{
    if(!gsId.trim()){setErr("Please paste your Sheet ID.");return;}
    const tabs=gsTabs.split(",").map(t=>t.trim()).filter(Boolean);
    setErr("");setBusy(true);
    try{
      const all={},names=[],base=`https://docs.google.com/spreadsheets/d/${gsId.trim()}/gviz/tq?tqx=out:csv`;
      for(let i=0;i<tabs.length;i++){
        const name=tabs[i];setMsg(`Reading ${name}...`);let loaded=false;
        try{const r=await fetch(`${base}&sheet=${encodeURIComponent(name)}`);if(r.ok){const raw=(await r.text()).trim();if(raw&&raw.length>5){const rows=cleanRows(Papa.parse(raw,{header:true,skipEmptyLines:true,dynamicTyping:false}).data||[]);if(rows.length){all[name]=rows;names.push(name);loaded=true;}}}}catch{}
        if(!loaded){try{const r=await fetch(`${base}&gid=${i}`);if(r.ok){const raw=(await r.text()).trim();if(raw&&raw.length>5){const rows=cleanRows(Papa.parse(raw,{header:true,skipEmptyLines:true,dynamicTyping:false}).data||[]);if(rows.length){all[name]=rows;names.push(name);}}}}catch{}}
      }
      if(!names.length)throw new Error("No data found");
      localStorage.setItem("ssb_gs",gsId.trim());localStorage.setItem("ssb_gs_tabs",gsTabs);
      setBusy(false);onLoad(all,names,"Google Sheets");
    }catch{setBusy(false);setErr("Could not load.\n1. Publish: File → Share → Publish to web → Entire Document → CSV → Publish\n2. Check Sheet ID and tab names match exactly");}
  };

  const doFile=async(type)=>{
    if(!file)return;setBusy(true);setMsg("Reading file...");
    try{
      if(type==="xl"){
        const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:"array"}),all={},names=[];
        for(const nm of wb.SheetNames||[]){try{const ws=wb.Sheets[nm];if(!ws)continue;const arr=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",blankrows:false,raw:false});if(arr.length<2)continue;let hi=0;while(hi<arr.length&&arr[hi].every(c=>sv(c)===""))hi++;if(hi>=arr.length-1)continue;const hdrs=arr[hi].map((h,j)=>sv(h)||`Col_${j+1}`),dr=[];for(let k=hi+1;k<arr.length;k++){const obj={};let hd=false;hdrs.forEach((h,j)=>{const v=sv(arr[k][j]);obj[h]=v;if(v!=="")hd=true;});if(hd)dr.push(obj);}if(dr.length){all[nm]=dr;names.push(nm);}}catch{}}
        if(!names.length)throw new Error("No readable data");setBusy(false);onLoad(all,names,"Excel");
      }else{
        let txt=await file.text();
        if(type==="sf")txt=txt.split("\n").filter(l=>!/^"?Grand\s+Total/i.test(l.trim())&&l.trim()).join("\n");
        const rows=cleanRows(Papa.parse(txt.trim(),{header:true,skipEmptyLines:true,dynamicTyping:false}).data||[]);
        if(!rows.length)throw new Error("No data found");
        const name=file.name.replace(/\.[^.]+$/,"").replace(/_/g," ")||type;
        setBusy(false);onLoad({[name]:rows},[name],type==="sf"?"Salesforce":"CSV");
      }
    }catch(e){setBusy(false);setErr(e.message);}
  };

  const demo=()=>{
    const tabs={"Enrollment":[{Term:"Spring 2025",Program:"BAIS",Division:"Graduate",Students:"398",Retention_Rate:"94.1",Avg_GPA:"3.7",Credits:"12"},{Term:"Spring 2025",Program:"MBA",Division:"Graduate",Students:"347",Retention_Rate:"93.2",Avg_GPA:"3.6",Credits:"12"},{Term:"Spring 2025",Program:"MS Finance",Division:"Graduate",Students:"282",Retention_Rate:"92.8",Avg_GPA:"3.5",Credits:"12"},{Term:"Spring 2025",Program:"MS Management",Division:"Graduate",Students:"167",Retention_Rate:"91.5",Avg_GPA:"3.4",Credits:"9"},{Term:"Fall 2024",Program:"BAIS",Division:"Graduate",Students:"352",Retention_Rate:"93.0",Avg_GPA:"3.6",Credits:"12"},{Term:"Fall 2024",Program:"MBA",Division:"Graduate",Students:"320",Retention_Rate:"92.1",Avg_GPA:"3.5",Credits:"12"},{Term:"Fall 2024",Program:"MS Finance",Division:"Graduate",Students:"265",Retention_Rate:"91.8",Avg_GPA:"3.4",Credits:"12"},{Term:"Fall 2024",Program:"MS Management",Division:"Graduate",Students:"152",Retention_Rate:"90.5",Avg_GPA:"3.3",Credits:"9"}],"Events":[{Event:"BAIS Career Panel",Type:"In-Person",Attendance:"142",Status:"Done",Organizer:"Career Services"},{Event:"Finance Night",Type:"In-Person",Attendance:"98",Status:"Done",Organizer:"Finance Dept"},{Event:"Admissions Webinar",Type:"Webinar",Attendance:"211",Status:"Done",Organizer:"Admissions"},{Event:"Research Symposium",Type:"In-Person",Attendance:"87",Status:"Done",Organizer:"Dean Office"},{Event:"MBA Info Session",Type:"Webinar",Attendance:"",Status:"Upcoming",Organizer:"Admissions"}],"Faculty":[{Name:"Dr. Sarah Chen",Role:"Director",Department:"BAIS",Type:"Full-Time",Courses:"3",Rating:"4.7",Years:"8",Status:"Active"},{Name:"Prof. James Miller",Role:"Assoc Prof",Department:"Finance",Type:"Full-Time",Courses:"4",Rating:"4.5",Years:"12",Status:"Active"},{Name:"Dr. Priya Sharma",Role:"Asst Prof",Department:"MBA",Type:"Full-Time",Courses:"3",Rating:"4.6",Years:"4",Status:"Active"},{Name:"Prof. Robert Davis",Role:"Adjunct",Department:"Marketing",Type:"Part-Time",Courses:"2",Rating:"4.2",Years:"6",Status:"Active"},{Name:"Dr. Lisa Wang",Role:"Director",Department:"Finance",Type:"Full-Time",Courses:"2",Rating:"4.8",Years:"10",Status:"Active"}]};
    onLoad(tabs,Object.keys(tabs),"Demo");
  };

  const fieldSt={width:"100%",padding:"11px 14px",border:`1.5px solid ${T.border}`,borderRadius:10,fontFamily:"inherit",fontSize:13,color:T.text,outline:"none",marginBottom:12,background:T.field,transition:"border .15s"};
  const infoBox=(color)=>({borderLeft:`3px solid ${color}`,background:`${color}10`,borderRadius:"0 10px 10px 0",padding:"12px 16px",fontSize:12,color:T.muted,marginBottom:18,lineHeight:1.8});
  const PrimaryBtn=({onClick,busy:b,msg:m,label,Icon:I})=>(
    <button onClick={onClick} disabled={b} style={{fontFamily:"inherit",fontSize:13,fontWeight:700,border:"none",borderRadius:10,padding:"11px 28px",cursor:b?"not-allowed":"pointer",background:`linear-gradient(135deg,${T.accent} 0%,${T.accent}cc 100%)`,color:"#fff",boxShadow:`0 4px 20px ${T.accent}28`,opacity:b?.65:1,display:"flex",alignItems:"center",gap:8,transition:"opacity .15s"}}>
      {b?<><RefreshCw size={13} style={{animation:"spin 1s linear infinite"}}/>{m}</>:<><I size={13}/>{label}</>}
    </button>
  );

  return(
    <div style={{maxWidth:760,margin:"72px auto",padding:"0 28px 100px"}}>
      {/* Hero */}
      <div style={{textAlign:"center",marginBottom:52,animation:"fadeUp .55s cubic-bezier(.22,1,.36,1) both"}}>
        <div style={{width:80,height:80,background:`linear-gradient(145deg,${T.accent},${T.accent}bb)`,borderRadius:24,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:22,boxShadow:`0 0 0 1px ${T.accent}28, 0 24px 64px ${T.accent}22, inset 0 1px 0 rgba(255,255,255,.18)`}}>
          <BarChart2 size={34} color="#fff" strokeWidth={1.7}/>
        </div>
        <h1 style={{fontSize:36,fontWeight:800,color:T.text,letterSpacing:"-2px",marginBottom:12,lineHeight:1.1}}>
          School of Business<br/>
          <span style={{color:T.accent}}>Analytics</span>
        </h1>
        <p style={{fontSize:15,color:T.muted,lineHeight:1.7,maxWidth:500,margin:"0 auto"}}>
          Connect any data source. Intelligent column classification, 7 KPI calculation modes, smart insights, and interactive charts — all automatic.
        </p>
      </div>

      {/* Source cards */}
      {!panel&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16,animation:"fadeUp .55s cubic-bezier(.22,1,.36,1) .08s both"}}>
            {sources.map(s=>(
              <div key={s.id} onClick={()=>setPanel(s.id)} style={{
                background:T.panel,border:`1.5px solid ${T.border}`,borderRadius:18,
                padding:"26px 24px",cursor:"pointer",position:"relative",overflow:"hidden",
                backdropFilter:"blur(16px)",transition:"all .2s cubic-bezier(.34,1.56,.64,1)",
                boxShadow:`inset 0 1px 0 rgba(255,255,255,.05)`,
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${s.tc}50`;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 16px 48px ${s.tc}12, inset 0 1px 0 rgba(255,255,255,.08)`;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=`inset 0 1px 0 rgba(255,255,255,.05)`;}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:"1.5px",background:`linear-gradient(90deg,transparent,${s.tc}55,transparent)`,opacity:0.7}}/>
                <span style={{position:"absolute",top:14,right:14,fontSize:10,padding:"3px 9px",borderRadius:20,fontWeight:700,background:`${s.tc}14`,border:`1px solid ${s.tc}22`,color:s.tc,letterSpacing:".3px"}}>{s.tag}</span>
                <div style={{width:42,height:42,borderRadius:12,background:T.accentSoft,border:`1px solid ${T.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
                  <s.Icon size={19} color={T.accent} strokeWidth={1.8}/>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:6,letterSpacing:"-.2px"}}>{s.name}</div>
                <div style={{fontSize:12,color:T.muted,lineHeight:1.6}}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center"}}>
            <button onClick={demo} style={{fontFamily:"inherit",fontSize:13,fontWeight:600,padding:"10px 26px",borderRadius:10,cursor:"pointer",background:T.panel,color:T.muted,border:`1.5px solid ${T.border}`,backdropFilter:"blur(12px)",transition:"all .2s",display:"inline-flex",alignItems:"center",gap:8}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.panelHov;e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor=T.accent+"45";}}
              onMouseLeave={e=>{e.currentTarget.style.background=T.panel;e.currentTarget.style.color=T.muted;e.currentTarget.style.borderColor=T.border;}}>
              <Star size={13}/><span>Try with demo data</span>
            </button>
          </div>
        </>
      )}

      {/* Panels */}
      {panel&&(
        <div style={{background:T.panel,borderRadius:20,border:`1px solid ${T.border}`,padding:"32px 36px",backdropFilter:"blur(24px)",animation:"fadeUp .35s cubic-bezier(.22,1,.36,1) both",boxShadow:`inset 0 1px 0 rgba(255,255,255,.05)`}}>
          <button onClick={()=>{setPanel(null);setErr("");setFile(null);}} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",padding:0,marginBottom:22,fontFamily:"inherit",fontWeight:600,display:"flex",alignItems:"center",gap:6,transition:"color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color=T.text} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
            <ChevronLeft size={14}/> Back to sources
          </button>

          {/* Google Sheets panel */}
          {panel==="gs"&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{width:40,height:40,borderRadius:11,background:T.accentSoft,border:`1px solid ${T.accent}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><Database size={17} color={T.accent}/></div>
                <div><div style={{fontSize:18,fontWeight:800,color:T.text,letterSpacing:"-.4px"}}>Connect Google Sheets</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>Enter your Sheet ID and exact tab names</div></div>
              </div>
              <div style={infoBox(T.accent)}>
                <strong style={{color:T.text}}>Step 1:</strong> File → Share → Publish to web → Entire Document → CSV → Publish<br/>
                <strong style={{color:T.text}}>Step 2 — Sheet ID:</strong> docs.google.com/spreadsheets/d/<strong style={{color:T.accent}}>ID_HERE</strong>/edit
              </div>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:7}}>Sheet ID</div>
              <input style={fieldSt} value={gsId} onChange={e=>setGsId(e.target.value)} placeholder="Paste your Sheet ID here" onFocus={e=>e.currentTarget.style.border=`1.5px solid ${T.accent}55`} onBlur={e=>e.currentTarget.style.border=`1.5px solid ${T.border}`}/>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:7}}>Tab names — comma separated</div>
              <input style={fieldSt} value={gsTabs} onChange={e=>setGsTabs(e.target.value)} placeholder="Enrollment, Applications, Events, Faculty, Internships" onFocus={e=>e.currentTarget.style.border=`1.5px solid ${T.accent}55`} onBlur={e=>e.currentTarget.style.border=`1.5px solid ${T.border}`}/>
              {err&&<div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.18)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#FCA5A5",marginBottom:10,whiteSpace:"pre-wrap",lineHeight:1.6}}>{err}</div>}
              <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}><PrimaryBtn onClick={doGS} busy={busy} msg={msg} label="Connect and load" Icon={Database}/></div>
            </>
          )}

          {/* File panels */}
          {(panel==="xl"||panel==="csv"||panel==="sf")&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{width:40,height:40,borderRadius:11,background:T.accentSoft,border:`1px solid ${T.accent}18`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {panel==="xl"?<FileSpreadsheet size={17} color={T.accent}/>:panel==="csv"?<FileText size={17} color={T.accent}/>:<Cloud size={17} color={T.accent}/>}
                </div>
                <div>
                  <div style={{fontSize:18,fontWeight:800,color:T.text,letterSpacing:"-.4px"}}>{panel==="xl"?"Upload Excel File":panel==="csv"?"Upload CSV File":"Salesforce Report"}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{panel==="xl"?"Every worksheet becomes a tab":"Works with any system export"}</div>
                </div>
              </div>
              {panel==="sf"&&<div style={infoBox("#F59E0B")}><strong style={{color:T.text}}>How to export:</strong> Open Report → arrow next to Edit → Export → Details Only → CSV → Export</div>}
              <label style={{border:`2px dashed ${T.border}`,borderRadius:14,padding:"38px 24px",textAlign:"center",cursor:"pointer",display:"block",marginBottom:14,background:T.field,transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${T.accent}55`;e.currentTarget.style.background=T.accentSoft;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.field;}}>
                <input type="file" accept={panel==="xl"?".xlsx,.xls":".csv,.txt"} onChange={e=>setFile(e.target.files?.[0])} style={{display:"none"}}/>
                <div style={{width:46,height:46,borderRadius:13,background:T.accentSoft,border:`1px solid ${T.accent}20`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
                  {panel==="xl"?<FileSpreadsheet size={20} color={T.accent}/>:panel==="csv"?<FileText size={20} color={T.accent}/>:<Cloud size={20} color={T.accent}/>}
                </div>
                <div style={{fontSize:14,fontWeight:600,color:file?T.text:T.muted,marginBottom:4}}>{file?file.name:"Drop file here or click to browse"}</div>
                <div style={{fontSize:11,color:T.dim}}>{panel==="xl"?".xlsx and .xls supported":".csv files supported"}</div>
              </label>
              {err&&<div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.18)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#FCA5A5",marginBottom:10,whiteSpace:"pre-wrap"}}>{err}</div>}
              {file&&<div style={{display:"flex",justifyContent:"flex-end"}}><PrimaryBtn onClick={()=>doFile(panel)} busy={busy} msg={msg} label="Load file" Icon={Download}/></div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────
export default function App(){
  const[isDark,setIsDark]=useState(false);
  const[state,setState]=useState({tabs:null,names:[],src:""});
  const T=isDark?DARK:LIGHT;
  const toggle=useCallback(()=>setIsDark(d=>!d),[]);
  const load=useCallback((tabs,names,src)=>setState({tabs,names,src}),[]);
  const home=useCallback(()=>setState({tabs:null,names:[],src:""}),[]);

  const SRC_ICONS={"Google Sheets":Database,"Excel":FileSpreadsheet,"CSV":FileText,"Salesforce":Cloud,"Demo":Star};
  const SRC_COL={"Google Sheets":"#10B981","Excel":"#3B82F6","CSV":"#64748B","Salesforce":"#8B5CF6","Demo":"#F59E0B"};
  const SI=state.src?SRC_ICONS[state.src]:null;
  const SC=SRC_COL[state.src]||"#64748B";

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,transition:"background .35s,color .35s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'DM Sans',sans-serif}
        body{background:${T.bg};transition:background .35s}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.scrollT};border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:${T.accent}55}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{opacity:.45}50%{opacity:1}}
        input::placeholder{color:${T.dim}!important}
        select option{background:${isDark?"#0A0E18":"#FFFFFF"};color:${T.text}}
      `}</style>

      {/* Ambient radial glows */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:-320,left:-280,width:800,height:800,background:`radial-gradient(circle,${T.g1} 0%,transparent 60%)`,borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:-280,right:-180,width:700,height:700,background:`radial-gradient(circle,${T.g2} 0%,transparent 60%)`,borderRadius:"50%"}}/>
      </div>

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:200,height:58,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",background:T.header,backdropFilter:"blur(28px)",borderBottom:`1px solid ${T.border}`,transition:"background .35s"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:34,height:34,background:`linear-gradient(145deg,${T.accent},${T.accent}bb)`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 2px 12px ${T.accent}35`}}>
            <BarChart2 size={16} color="#fff" strokeWidth={2.2}/>
          </div>
          <div style={{display:"flex",flexDirection:"column"}}>
            <span style={{fontSize:14,fontWeight:800,color:T.text,letterSpacing:"-.5px",lineHeight:1.2}}>SSB Analytics</span>
            <span style={{fontSize:10,color:T.dim,letterSpacing:".3px",fontWeight:500}}>Stevens Institute of Technology</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {state.src&&SI&&(
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:700,background:`${SC}12`,border:`1px solid ${SC}25`,color:SC}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:SC,display:"inline-block",animation:"glow 2s infinite"}}/>
              <SI size={11}/>{state.src}
            </div>
          )}
          {state.tabs&&(
            <>
              <button onClick={home} style={{display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",fontSize:12,fontWeight:600,borderRadius:9,padding:"6px 14px",cursor:"pointer",background:T.panel,color:T.muted,border:`1px solid ${T.border}`,backdropFilter:"blur(12px)",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.panelHov;e.currentTarget.style.color=T.text;}}
                onMouseLeave={e=>{e.currentTarget.style.background=T.panel;e.currentTarget.style.color=T.muted;}}>
                <Home size={12}/> Change source
              </button>
              <button onClick={()=>window.print()} style={{display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",fontSize:12,fontWeight:700,borderRadius:9,padding:"6px 14px",cursor:"pointer",background:`linear-gradient(135deg,${T.accent},${T.accent}bb)`,color:"#fff",border:"none",boxShadow:`0 2px 12px ${T.accent}30`,transition:"all .15s"}}>
                <Download size={12}/> Export PDF
              </button>
            </>
          )}
          <ThemeToggle isDark={isDark} toggle={toggle} T={T}/>
        </div>
      </header>

      <main style={{position:"relative",zIndex:1}}>
        {!state.tabs
          ? <ConnectScreen onLoad={load} T={T} isDark={isDark} toggle={toggle}/>
          : <Dashboard tabs={state.tabs} names={state.names} T={T} isDark={isDark} toggle={toggle}/>
        }
      </main>
    </div>
  );
}
