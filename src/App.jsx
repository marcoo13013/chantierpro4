import React, { useState, useRef, useMemo } from "react";

// ─── DESIGN SYSTEM — LIGHT MODE PROFESSIONNEL BTP ────────────────────────────
// Palette : blanc cassé + bleu marine + orange chantier + gris ardoise
const L = {
  bg:       "#F8F9FB",
  surface:  "#FFFFFF",
  card:     "#FFFFFF",
  border:   "#E2E8F0",
  borderMd: "#CBD5E1",
  accent:   "#E8620A",   // orange chantier
  accentBg: "#FFF4EE",
  navy:     "#1B3A5C",   // bleu marine
  navyBg:   "#EEF3F8",
  blue:     "#2563EB",
  green:    "#16A34A",
  greenBg:  "#F0FDF4",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
  orange:   "#D97706",
  orangeBg: "#FFFBEB",
  purple:   "#7C3AED",
  teal:     "#0D9488",
  text:     "#0F172A",
  textMd:   "#334155",
  textSm:   "#64748B",
  textXs:   "#94A3B8",
  shadow:   "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.10)",
  shadowLg: "0 8px 24px rgba(0,0,0,0.12)",
};

// ─── STATUTS JURIDIQUES ────────────────────────────────────────────────────────
const STATUTS = {
  "micro": {
    label: "Auto-entrepreneur / Micro-entreprise",
    short: "Micro",
    icon: "👤",
    mode: "simple",
    color: L.green,
    bg: L.greenBg,
    description: "Sans TVA, sans salarié, comptabilité allégée",
    tauxCharges: 0.22,       // 22% charges micro BTP
    tvaSoumis: false,
    salaries: false,
    plafondCA: 188700,       // plafond BTP 2025
    modules: ["accueil","chantiers","devis","factures","assistant"],
  },
  "ei": {
    label: "Entrepreneur Individuel (EI)",
    short: "EI",
    icon: "🧑‍💼",
    mode: "simple",
    color: L.blue,
    bg: "#EFF6FF",
    description: "TVA possible, pas de salariés en général",
    tauxCharges: 0.40,
    tvaSoumis: true,
    salaries: false,
    plafondCA: null,
    modules: ["accueil","chantiers","devis","factures","frais","assistant"],
  },
  "eurl": {
    label: "EURL",
    short: "EURL",
    icon: "🏢",
    mode: "avance",
    color: L.orange,
    bg: L.orangeBg,
    description: "SARL unipersonnelle, gérant assimilé salarié",
    tauxCharges: 0.45,
    tvaSoumis: true,
    salaries: true,
    plafondCA: null,
    modules: ["accueil","chantiers","devis","factures","equipe","planning","compta","frais","coefficients","prix","assistant","import"],
  },
  "sarl": {
    label: "SARL",
    short: "SARL",
    icon: "🏗",
    mode: "avance",
    color: L.navy,
    bg: L.navyBg,
    description: "Société à responsabilité limitée",
    tauxCharges: 0.45,
    tvaSoumis: true,
    salaries: true,
    plafondCA: null,
    modules: ["accueil","chantiers","devis","factures","equipe","planning","compta","frais","coefficients","prix","connecteurs","assistant","import"],
  },
  "sas": {
    label: "SAS / SASU",
    short: "SAS",
    icon: "🏛",
    mode: "avance",
    color: L.purple,
    bg: "#F5F3FF",
    description: "Société par actions simplifiée",
    tauxCharges: 0.42,
    tvaSoumis: true,
    salaries: true,
    plafondCA: null,
    modules: ["accueil","chantiers","devis","factures","equipe","planning","compta","frais","coefficients","prix","connecteurs","assistant","import"],
  },
};

// ─── DONNÉES EXEMPLE FRANCE HABITAT ───────────────────────────────────────────
const ENTREPRISE_EXEMPLE = {
  nom: "France Habitat Rénovation Construction",
  nomCourt: "France Habitat",
  siret: "513 640 227 00031",
  statut: "sarl",
  tva: true,
  adresse: "48 route de la Valentine, 13013 Marseille",
  tel: "06.50.18.00.09",
  email: "contact@france-habitat.com",
  activite: "Maçonnerie, carrelage, rénovation",
  nbEmployes: "4",
  logo: null,
};

const CHANTIERS_EXEMPLE = [
  {
    id:1, nom:"Passerini – Maçonnerie Extérieur", client:"PASSERINI Jonathan",
    adresse:"13011 Marseille 11", statut:"en cours",
    dateDebut:"2026-04-01", dateFin:"2026-05-14",
    devisHT:71404.43, devisTTC:78544.87, tva:10,
    acompteEncaisse:31417.95, soldeEncaisse:0,
    postes:[
      {id:1,libelle:"Installation du chantier",montantHT:950,fournitures:[{designation:"Location mini pelle",qte:1,unite:"F",prixUnit:350}]},
      {id:2,libelle:"Dalle béton armé (4,5m²)",montantHT:457.28,fournitures:[{designation:"Béton 350kg/m³",qte:0.9,unite:"m³",prixUnit:120}]},
      {id:3,libelle:"Terrasse carrelage R+1 (24m²)",montantHT:3639.78,fournitures:[{designation:"Carrelage 120x120",qte:26,unite:"m²",prixUnit:48}]},
      {id:4,libelle:"Rehausse muret 30ML",montantHT:2950,fournitures:[{designation:"Parpaings",qte:150,unite:"U",prixUnit:3.5}]},
      {id:5,libelle:"Terrassement",montantHT:1472.40,fournitures:[]},
      {id:6,libelle:"Carrelage piscine (138m²)",montantHT:18333.30,fournitures:[{designation:"Colle C2S1",qte:40,unite:"sac",prixUnit:35}]},
      {id:7,libelle:"Carrelage terrasse (160m²)",montantHT:13008,fournitures:[{designation:"Ciment-colle flex",qte:45,unite:"sac",prixUnit:28}]},
      {id:8,libelle:"Fin de travaux",montantHT:380,fournitures:[]},
    ],
    salaries:[
      {id:1,nom:"Dupont Thomas",role:"Chef de chantier",tauxHoraire:18,chargesPatron:0.42,heuresPrevues:120,qualification:"chef"},
      {id:2,nom:"Martin Paul",role:"Maçon qualifié",tauxHoraire:14,chargesPatron:0.42,heuresPrevues:140,qualification:"qualifie"},
      {id:3,nom:"Lopez Carlos",role:"Maçon",tauxHoraire:14,chargesPatron:0.42,heuresPrevues:140,qualification:"qualifie"},
      {id:4,nom:"Brun Eric",role:"Aide maçon",tauxHoraire:12,chargesPatron:0.42,heuresPrevues:100,qualification:"manoeuvre"},
    ],
    planning:[
      {jour:"2026-04-01",tache:"Installation + terrassement",salaries:[1,2,3,4]},
      {jour:"2026-04-07",tache:"Coulage dalles béton",salaries:[1,2,3,4]},
      {jour:"2026-04-15",tache:"Dalle contour piscine",salaries:[1,2,3,4]},
      {jour:"2026-04-28",tache:"Carrelage piscine",salaries:[1,2,3]},
      {jour:"2026-05-10",tache:"Carrelage terrasse",salaries:[1,2,3,4]},
      {jour:"2026-05-14",tache:"Finitions + nettoyage",salaries:[1,2,3,4]},
    ],
    depensesReelles:[
      {id:1,libelle:"Béton Express PACA",montant:3720,categorie:"fourniture",date:"2026-04-03"},
      {id:2,libelle:"Matériaux Sud",montant:1850,categorie:"fourniture",date:"2026-04-05"},
    ],
    checklist:{},
    notes:"Grand chantier piscine. Carrelage piscine fourni par le client.",
    photos:[],
    facturesFournisseurs:[
      {id:1,fournisseur:"Béton Express PACA",montantTTC:3720,date:"2026-04-03",statut:"payé"},
    ],
  },
  {
    id:2, nom:"Bonacchi – Dalle + Carrelage", client:"M. et Mme Bonacchi",
    adresse:"7 rue du martinet, 13390 Auriol", statut:"planifié",
    dateDebut:"2026-05-05", dateFin:"2026-05-16",
    devisHT:7043.79, devisTTC:7748.17, tva:10,
    acompteEncaisse:3099.27, soldeEncaisse:0,
    postes:[
      {id:1,libelle:"Installation / Protection",montantHT:150,fournitures:[]},
      {id:2,libelle:"Dalle béton armé (37,80m²)",montantHT:2636.27,fournitures:[{designation:"Béton 350kg/m³",qte:5.67,unite:"m³",prixUnit:120}]},
      {id:3,libelle:"Carrelage 60x60 (37,80m²)",montantHT:2927.99,fournitures:[{designation:"Carrelage 60x60",qte:40,unite:"m²",prixUnit:25}]},
      {id:4,libelle:"Reprise enduit façade",montantHT:1329.53,fournitures:[]},
    ],
    salaries:[
      {id:1,nom:"Dupont Thomas",role:"Chef de chantier",tauxHoraire:18,chargesPatron:0.42,heuresPrevues:35,qualification:"chef"},
      {id:2,nom:"Martin Paul",role:"Maçon qualifié",tauxHoraire:14,chargesPatron:0.42,heuresPrevues:40,qualification:"qualifie"},
    ],
    planning:[
      {jour:"2026-05-05",tache:"Installation + dalle",salaries:[1,2]},
      {jour:"2026-05-08",tache:"Pose carrelage",salaries:[1,2]},
      {jour:"2026-05-13",tache:"Finitions",salaries:[1,2]},
    ],
    depensesReelles:[],
    checklist:{},
    notes:"Client disponible matin uniquement.",
    photos:[],
    facturesFournisseurs:[],
  },
];

const DOCUMENTS_EXEMPLE = [
  {id:1,type:"devis",numero:"2009002864",date:"2026-04-01",dateEcheance:"2026-04-16",client:"PASSERINI Jonathan",adresseClient:"13011 Marseille 11",statut:"accepté",chantierId:1,lignes:[{id:1,libelle:"Installation du chantier",qte:1,unite:"F",prixUnitHT:950,tva:10,photo:null},{id:2,libelle:"Dalle béton 4,5m²",qte:4.5,unite:"m²",prixUnitHT:101.62,tva:10,photo:null},{id:3,libelle:"Carrelage piscine 138m²",qte:138,unite:"m²",prixUnitHT:132.85,tva:10,photo:null}],conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:31417.95},
  {id:2,type:"devis",numero:"2009002888",date:"2026-04-14",dateEcheance:"2026-04-29",client:"M. et Mme Bonacchi",adresseClient:"13390 Auriol",statut:"accepté",chantierId:2,lignes:[{id:1,libelle:"Dalle béton 37,80m²",qte:5.67,unite:"m³",prixUnitHT:464.95,tva:10,photo:null},{id:2,libelle:"Carrelage 60x60",qte:37.8,unite:"m²",prixUnitHT:77.46,tva:10,photo:null}],conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:3099.27},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function euro(n){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n||0);}
function pct(v,t){return !t?0:Math.round((v/t)*100);}
function calcCouts(c){
  const f=c.postes.reduce((a,p)=>a+p.fournitures.reduce((b,x)=>b+x.qte*x.prixUnit,0),0);
  const m=c.salaries.reduce((a,s)=>a+s.heuresPrevues*s.tauxHoraire*(1+s.chargesPatron),0);
  const d=(c.depensesReelles||[]).reduce((a,x)=>a+x.montant,0);
  const t=f+m+d;
  return{coutFourn:f,coutMO:m,depR:d,total:t,marge:c.devisHT-t,tauxMarge:pct(c.devisHT-t,c.devisHT)};
}
function calcDocTotal(doc){
  const ht=doc.lignes.reduce((a,l)=>a+l.qte*l.prixUnitHT,0);
  const tv=doc.lignes.reduce((a,l)=>a+l.qte*l.prixUnitHT*(l.tva/100),0);
  return{ht,tva:tv,ttc:ht+tv};
}


// ─── UI BASE COMPONENTS ────────────────────────────────────────────────────────
function Btn({children,onClick,variant="primary",size="md",disabled,icon,fullWidth}){
  const base={border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"all .15s",opacity:disabled?0.5:1,width:fullWidth?"100%":undefined,justifyContent:fullWidth?"center":undefined};
  const variants={
    primary:{background:L.accent,color:"#fff",boxShadow:`0 2px 6px ${L.accent}44`},
    secondary:{background:L.surface,color:L.textMd,border:`1px solid ${L.border}`},
    navy:{background:L.navy,color:"#fff",boxShadow:`0 2px 6px ${L.navy}33`},
    ghost:{background:"transparent",color:L.textSm,border:"none"},
    danger:{background:L.red,color:"#fff"},
    success:{background:L.green,color:"#fff"},
  };
  const sizes={sm:{padding:"5px 10px",fontSize:11},md:{padding:"8px 16px",fontSize:13},lg:{padding:"11px 22px",fontSize:15}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...variants[variant],...sizes[size]}}>{icon&&<span>{icon}</span>}{children}</button>;
}

function Card({children,style,onClick,hover}){
  const [h,setH]=useState(false);
  return <div onClick={onClick} onMouseEnter={()=>hover&&setH(true)} onMouseLeave={()=>hover&&setH(false)} style={{background:L.card,border:`1px solid ${h?L.borderMd:L.border}`,borderRadius:12,boxShadow:h?L.shadowMd:L.shadow,transition:"all .2s",cursor:onClick?"pointer":undefined,...style}}>{children}</div>;
}

function KPI({label,value,sub,color,icon,trend}){
  const c=color||L.navy;
  return(
    <Card style={{padding:"16px 20px",flex:1,minWidth:140}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>{label}</div>
        {icon&&<span style={{fontSize:18}}>{icon}</span>}
      </div>
      <div style={{fontSize:22,fontWeight:800,color:c,letterSpacing:-0.5}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:L.textXs,marginTop:4}}>{sub}</div>}
      {trend&&<div style={{fontSize:11,color:trend>=0?L.green:L.red,marginTop:4,fontWeight:600}}>{trend>=0?"↑":"↓"} {Math.abs(trend)}%</div>}
    </Card>
  );
}

function Badge({children,color,bg}){
  const configs={
    "en cours":{c:L.green,b:L.greenBg},
    "planifié":{c:L.blue,b:"#EFF6FF"},
    "terminé":{c:L.textSm,b:L.bg},
    "annulé":{c:L.red,b:L.redBg},
    "accepté":{c:L.green,b:L.greenBg},
    "en attente":{c:L.orange,b:L.orangeBg},
    "refusé":{c:L.red,b:L.redBg},
    "brouillon":{c:L.textSm,b:L.bg},
    "payé":{c:L.green,b:L.greenBg},
    "devis":{c:L.blue,b:"#EFF6FF"},
    "facture":{c:L.teal,b:"#F0FDFA"},
  };
  const cfg=configs[children]||{c:color||L.textSm,b:bg||L.bg};
  return <span style={{background:cfg.b,color:cfg.c,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600}}>{children}</span>;
}

function Input({label,value,onChange,placeholder,type="text",required,error,hint,prefix,suffix,readOnly}){
  return(
    <div>
      {label&&<div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:5}}>{label}{required&&<span style={{color:L.red,marginLeft:2}}>*</span>}</div>}
      <div style={{position:"relative",display:"flex",alignItems:"center"}}>
        {prefix&&<span style={{position:"absolute",left:12,color:L.textXs,fontSize:13,pointerEvents:"none"}}>{prefix}</span>}
        <input value={value} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder} type={type} readOnly={readOnly}
          style={{width:"100%",padding:`9px ${suffix?"36px":"12px"} 9px ${prefix?"36px":"12px"}`,background:readOnly?L.bg:L.surface,border:`1px solid ${error?L.red:L.border}`,borderRadius:8,fontSize:13,color:L.text,outline:"none",boxSizing:"border-box"}}/>
        {suffix&&<span style={{position:"absolute",right:12,color:L.textXs,fontSize:13,pointerEvents:"none"}}>{suffix}</span>}
      </div>
      {error&&<div style={{fontSize:11,color:L.red,marginTop:3}}>{error}</div>}
      {hint&&!error&&<div style={{fontSize:11,color:L.textXs,marginTop:3}}>{hint}</div>}
    </div>
  );
}

function Select({label,value,onChange,options,required}){
  return(
    <div>
      {label&&<div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:5}}>{label}{required&&<span style={{color:L.red,marginLeft:2}}>*</span>}</div>}
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"9px 12px",background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,color:L.text,outline:"none",cursor:"pointer"}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Tabs({tabs,active,onChange}){
  return(
    <div style={{display:"flex",gap:2,borderBottom:`1px solid ${L.border}`,marginBottom:20}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"10px 16px",fontSize:13,fontWeight:active===t.id?700:500,color:active===t.id?L.accent:L.textSm,borderBottom:active===t.id?`2px solid ${L.accent}`:"2px solid transparent",marginBottom:-1,transition:"all .15s",display:"flex",alignItems:"center",gap:5}}>
          {t.icon&&<span style={{fontSize:14}}>{t.icon}</span>}{t.label}
        </button>
      ))}
    </div>
  );
}

function Modal({title,onClose,children,maxWidth=640}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:L.surface,borderRadius:16,width:"100%",maxWidth,maxHeight:"90vh",overflowY:"auto",boxShadow:L.shadowLg}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"18px 24px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:16,fontWeight:700,color:L.text}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${L.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:L.textSm,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

function Notif({msg,type,onClose}){
  const colors={success:{bg:L.greenBg,border:L.green,color:L.green},error:{bg:L.redBg,border:L.red,color:L.red},info:{bg:L.navyBg,border:L.navy,color:L.navy}};
  const c=colors[type]||colors.success;
  return(
    <div style={{position:"fixed",top:20,right:20,zIndex:9999,background:c.bg,border:`1px solid ${c.border}`,borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:600,color:c.color,boxShadow:L.shadowMd,display:"flex",alignItems:"center",gap:8,maxWidth:340}}>
      <span>{type==="success"?"✓":type==="error"?"✗":"ℹ"}</span>{msg}
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:c.color,marginLeft:8,fontSize:16}}>×</button>
    </div>
  );
}


// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const [step,setStep]=useState(1);
  const [data,setData]=useState({nom:"",siret:"",statut:"sarl",tva:true,nbEmployes:"1-5",activite:"Maçonnerie / Gros œuvre",tel:"",email:""});
  const [siretStatus,setSiretStatus]=useState(null); // null | "checking" | "ok" | "error"
  const [errors,setErrors]=useState({});

  const TOTAL_STEPS=3;

  function upd(k,v){setData(d=>({...d,[k]:v}));if(errors[k])setErrors(e=>({...e,[k]:null}));}

  function validateSIRET(s){
    const clean=s.replace(/\s/g,"");
    return /^\d{14}$/.test(clean);
  }

  async function checkSIRET(){
    const clean=data.siret.replace(/\s/g,"");
    if(!validateSIRET(clean)){setSiretStatus("error");return;}
    setSiretStatus("checking");
    await new Promise(r=>setTimeout(r,1200));
    // Simulation récupération données
    if(clean==="51364022700031"){
      setData(d=>({...d,nom:"France Habitat Rénovation Construction",activite:"Construction de bâtiments",statut:"sarl"}));
      setSiretStatus("ok");
    } else {
      setSiretStatus("ok"); // Simule toujours OK pour prototype
    }
  }

  function formatSIRET(v){
    const clean=v.replace(/\D/g,"").slice(0,14);
    if(clean.length>9)return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)} ${clean.slice(9)}`;
    if(clean.length>6)return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6)}`;
    if(clean.length>3)return `${clean.slice(0,3)} ${clean.slice(3)}`;
    return clean;
  }

  function validateStep(s){
    const e={};
    if(s===1){
      if(!data.nom.trim())e.nom="Nom requis";
      if(!data.siret.trim())e.siret="SIRET requis";
      else if(!validateSIRET(data.siret.replace(/\s/g,"")))e.siret="SIRET invalide (14 chiffres)";
    }
    if(s===2){
      if(!data.activite)e.activite="Activité requise";
    }
    setErrors(e);
    return Object.keys(e).length===0;
  }

  function next(){
    if(validateStep(step)){
      if(step<TOTAL_STEPS)setStep(s=>s+1);
      else onComplete(data);
    }
  }

  const statut=STATUTS[data.statut];

  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${L.navy} 0%,#2563EB 50%,${L.teal} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;}input:focus,select:focus,textarea:focus{border-color:${L.accent}!important;outline:none;box-shadow:0 0 0 3px ${L.accent}22;}`}</style>

      <div style={{width:"100%",maxWidth:560}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,fontWeight:900,color:"#fff",letterSpacing:-1}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
          <div style={{fontSize:14,color:"rgba(255,255,255,0.7)",marginTop:4}}>Configurez votre espace de travail</div>
        </div>

        {/* Carte principale */}
        <div style={{background:L.surface,borderRadius:20,boxShadow:"0 24px 64px rgba(0,0,0,0.2)",overflow:"hidden"}}>
          {/* Progress */}
          <div style={{background:L.bg,padding:"16px 24px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${L.border}`}}>
            {[1,2,3].map(s=>(
              <React.Fragment key={s}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:s<=step?L.accent:L.border,color:s<=step?"#fff":L.textXs,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,transition:"all .3s"}}>{s<step?"✓":s}</div>
                  <span style={{fontSize:12,fontWeight:s===step?600:400,color:s===step?L.text:L.textXs}}>{["Mon entreprise","Mon activité","Mon profil"][s-1]}</span>
                </div>
                {s<3&&<div style={{flex:1,height:2,background:s<step?L.accent:L.border,borderRadius:2,transition:"background .3s"}}/>}
              </React.Fragment>
            ))}
          </div>

          <div style={{padding:28}}>

            {/* ── STEP 1 : ENTREPRISE ── */}
            {step===1&&(
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:L.text,marginBottom:4}}>Votre entreprise</div>
                  <div style={{fontSize:13,color:L.textSm}}>Ces informations apparaîtront sur vos devis et factures</div>
                </div>

                {/* SIRET avec vérification */}
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:5}}>SIRET <span style={{color:L.red}}>*</span></div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{flex:1,position:"relative"}}>
                      <input value={data.siret} onChange={e=>upd("siret",formatSIRET(e.target.value))} placeholder="513 640 227 00031"
                        style={{width:"100%",padding:"9px 12px",background:L.surface,border:`1px solid ${errors.siret?L.red:siretStatus==="ok"?L.green:L.border}`,borderRadius:8,fontSize:13,color:L.text,outline:"none"}}/>
                      {siretStatus==="ok"&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:L.green,fontSize:16}}>✓</span>}
                    </div>
                    <Btn onClick={checkSIRET} variant="secondary" size="md" disabled={siretStatus==="checking"}>
                      {siretStatus==="checking"?"⏳":"🔍"} {siretStatus==="checking"?"Vérif...":"Vérifier"}
                    </Btn>
                  </div>
                  {errors.siret&&<div style={{fontSize:11,color:L.red,marginTop:3}}>{errors.siret}</div>}
                  {siretStatus==="ok"&&<div style={{fontSize:11,color:L.green,marginTop:3}}>✓ SIRET valide — informations récupérées</div>}
                  <div style={{fontSize:11,color:L.textXs,marginTop:3}}>14 chiffres — retrouvez-le sur votre Kbis ou avis URSSAF</div>
                </div>

                <Input label="Nom de l'entreprise" value={data.nom} onChange={v=>upd("nom",v)} placeholder="France Habitat Rénovation Construction" required error={errors.nom}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <Input label="Téléphone" value={data.tel} onChange={v=>upd("tel",v)} placeholder="06.50.18.00.09" prefix="📞"/>
                  <Input label="Email" value={data.email} onChange={v=>upd("email",v)} placeholder="contact@votre-entreprise.com" type="email"/>
                </div>
              </div>
            )}

            {/* ── STEP 2 : ACTIVITÉ + STATUT ── */}
            {step===2&&(
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:L.text,marginBottom:4}}>Votre activité</div>
                  <div style={{fontSize:13,color:L.textSm}}>L'application s'adapte automatiquement selon votre statut</div>
                </div>

                <div>
                  <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:10}}>Statut juridique <span style={{color:L.red}}>*</span></div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {Object.entries(STATUTS).map(([key,s])=>(
                      <div key={key} onClick={()=>upd("statut",key)} style={{padding:"12px 16px",borderRadius:10,border:`2px solid ${data.statut===key?s.color:L.border}`,background:data.statut===key?s.bg:L.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .15s"}}>
                        <span style={{fontSize:22}}>{s.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:data.statut===key?s.color:L.text}}>{s.label}</div>
                          <div style={{fontSize:11,color:L.textSm,marginTop:2}}>{s.description}</div>
                        </div>
                        <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${data.statut===key?s.color:L.borderMd}`,background:data.statut===key?s.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {data.statut===key&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Select label="Activité principale" value={data.activite} onChange={v=>upd("activite",v)} required options={[
                  {value:"Maçonnerie / Gros œuvre",label:"🧱 Maçonnerie / Gros œuvre"},
                  {value:"Carrelage / Revêtement",label:"⬛ Carrelage / Revêtement"},
                  {value:"Peinture / Enduit",label:"🎨 Peinture / Enduit"},
                  {value:"Plomberie / Sanitaire",label:"🔧 Plomberie / Sanitaire"},
                  {value:"Électricité",label:"⚡ Électricité"},
                  {value:"Menuiserie / Charpente",label:"🪵 Menuiserie / Charpente"},
                  {value:"Isolation / Plâtrerie",label:"🧊 Isolation / Plâtrerie"},
                  {value:"Rénovation générale",label:"🏗 Rénovation générale"},
                  {value:"Multi-corps d'état",label:"🔨 Multi-corps d'état"},
                ]}/>
              </div>
            )}

            {/* ── STEP 3 : RÉSUMÉ ── */}
            {step===3&&(
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:L.text,marginBottom:4}}>Prêt à démarrer ! 🎉</div>
                  <div style={{fontSize:13,color:L.textSm}}>Voici votre configuration — tout peut être modifié ensuite dans les paramètres</div>
                </div>

                {/* Résumé */}
                <div style={{background:L.bg,borderRadius:12,padding:16,display:"flex",flexDirection:"column",gap:10,border:`1px solid ${L.border}`}}>
                  {[
                    ["🏢","Entreprise",data.nom||"—"],
                    ["🔢","SIRET",data.siret||"—"],
                    ["⚖️","Statut",statut?.label||"—"],
                    ["🔨","Activité",data.activite],
                  ].map(([ic,l,v])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16,width:24,flexShrink:0}}>{ic}</span>
                      <span style={{fontSize:12,color:L.textSm,width:80,flexShrink:0}}>{l}</span>
                      <span style={{fontSize:13,fontWeight:600,color:L.text}}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Mode interface */}
                <div style={{background:statut?.bg,border:`1px solid ${statut?.color}44`,borderRadius:12,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:statut?.color,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>
                    {statut?.icon} Interface activée : Mode {statut?.mode==="simple"?"Simple":"Avancé"}
                  </div>
                  <div style={{fontSize:12,color:L.textMd,lineHeight:1.6,marginBottom:10}}>
                    {statut?.mode==="simple"
                      ? "Interface épurée avec les essentiels : devis, factures, rentabilité simplifiée et assistant IA."
                      : "Interface complète : gestion d'équipe, planning, comptabilité, export comptable et tous les modules avancés."}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {statut?.modules.map(m=>(
                      <span key={m} style={{background:statut.color+"22",color:statut.color,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600}}>✓ {m}</span>
                    ))}
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Select label="Nombre d'employés" value={data.nbEmployes} onChange={v=>upd("nbEmployes",v)} options={[{value:"0",label:"Seul (0 salarié)"},{value:"1-5",label:"1 à 5 salariés"},{value:"6-10",label:"6 à 10 salariés"},{value:"11+",label:"Plus de 10"}]}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:5}}>TVA</div>
                    <div style={{display:"flex",gap:6}}>
                      {[{v:true,l:"Assujetti TVA"},{v:false,l:"Franchise TVA"}].map(o=>(
                        <div key={String(o.v)} onClick={()=>upd("tva",o.v)} style={{flex:1,padding:"9px 8px",borderRadius:8,border:`2px solid ${data.tva===o.v?L.accent:L.border}`,background:data.tva===o.v?L.accentBg:L.surface,cursor:"pointer",textAlign:"center",fontSize:11,fontWeight:data.tva===o.v?700:400,color:data.tva===o.v?L.accent:L.textSm}}>
                          {o.l}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:24,paddingTop:20,borderTop:`1px solid ${L.border}`}}>
              {step>1
                ? <Btn onClick={()=>setStep(s=>s-1)} variant="secondary">← Retour</Btn>
                : <div/>}
              <Btn onClick={next} variant={step===TOTAL_STEPS?"success":"primary"} size="lg">
                {step===TOTAL_STEPS?"🚀 Lancer ChantierPro":"Continuer →"}
              </Btn>
            </div>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:16,fontSize:12,color:"rgba(255,255,255,0.5)"}}>
          Données stockées localement · Prototype fonctionnel · Modifiable à tout moment
        </div>
      </div>
    </div>
  );
}


// ─── NAVIGATION ADAPTIVE ──────────────────────────────────────────────────────
const NAV_CONFIG = {
  accueil:      {label:"Accueil",      icon:"🏠",  group:"principal"},
  chantiers:    {label:"Chantiers",    icon:"🏗",  group:"principal"},
  devis:        {label:"Devis",        icon:"📄",  group:"documents"},
  factures:     {label:"Factures",     icon:"🧾",  group:"documents"},
  equipe:       {label:"Équipe",       icon:"👷",  group:"gestion"},
  planning:     {label:"Planning",     icon:"📅",  group:"gestion"},
  compta:       {label:"Comptabilité", icon:"💰",  group:"gestion"},
  frais:        {label:"Frais fixes",  icon:"💸",  group:"gestion"},
  coefficients: {label:"Coefficients", icon:"🧮",  group:"outils"},
  prix:         {label:"Prix BTP",     icon:"📚",  group:"outils"},
  connecteurs:  {label:"Qonto / PL",   icon:"🔗",  group:"outils"},
  assistant:    {label:"Assistant IA", icon:"🤖",  group:"ia"},
  import:       {label:"Import PDF",   icon:"📤",  group:"outils"},
};

const NAV_GROUPS = {
  principal: "Principal",
  documents: "Documents",
  gestion:   "Gestion",
  outils:    "Outils",
  ia:        "Intelligence",
};

function Sidebar({modules,activeView,onNav,entreprise,statut,onSettings}){
  const grouped={};
  modules.forEach(m=>{
    const cfg=NAV_CONFIG[m];
    if(!cfg)return;
    if(!grouped[cfg.group])grouped[cfg.group]=[];
    grouped[cfg.group].push({id:m,...cfg});
  });
  const s=STATUTS[statut];

  return(
    <div style={{width:220,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0,fontFamily:"inherit"}}>
      {/* Logo */}
      <div style={{padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <div style={{fontSize:20,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>{entreprise.nomCourt||entreprise.nom}</div>
      </div>

      {/* Statut badge */}
      <div style={{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{background:s?.bg,borderRadius:7,padding:"6px 10px",display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:14}}>{s?.icon}</span>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:s?.color}}>{s?.short} · Mode {s?.mode==="simple"?"Simple":"Avancé"}</div>
            <div style={{fontSize:9,color:L.textSm}}>{entreprise.activite}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
        {Object.entries(grouped).map(([group,items])=>(
          <div key={group}>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1.2,padding:"10px 16px 4px"}}>{NAV_GROUPS[group]}</div>
            {items.map(item=>(
              <button key={item.id} onClick={()=>onNav(item.id)} style={{width:"100%",background:activeView===item.id?"rgba(255,255,255,0.12)":"transparent",border:"none",cursor:"pointer",padding:"9px 16px",display:"flex",alignItems:"center",gap:9,color:activeView===item.id?"#fff":"rgba(255,255,255,0.65)",fontSize:13,fontWeight:activeView===item.id?600:400,textAlign:"left",borderLeft:activeView===item.id?`3px solid ${L.accent}`:"3px solid transparent",transition:"all .15s"}}>
                <span style={{fontSize:15}}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Settings */}
      <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
        <button onClick={onSettings} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"9px 14px",cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:12,display:"flex",alignItems:"center",gap:7,fontFamily:"inherit"}}>
          ⚙️ Paramètres entreprise
        </button>
      </div>
    </div>
  );
}

// ─── HEADER PAGE ──────────────────────────────────────────────────────────────
function PageHeader({title,subtitle,actions}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:800,color:L.text,margin:0,letterSpacing:-0.5}}>{title}</h1>
        {subtitle&&<p style={{fontSize:13,color:L.textSm,margin:"4px 0 0"}}>{subtitle}</p>}
      </div>
      {actions&&<div style={{display:"flex",gap:8}}>{actions}</div>}
    </div>
  );
}


// ─── ACCUEIL / TABLEAU DE BORD ────────────────────────────────────────────────
function Accueil({chantiers,documents,entreprise,statut,onNav}){
  const s=STATUTS[statut];
  const totCA=chantiers.reduce((a,c)=>a+c.devisHT,0);
  const encaisse=chantiers.reduce((a,c)=>a+(c.acompteEncaisse||0)+(c.soldeEncaisse||0),0);
  const enCours=chantiers.filter(c=>c.statut==="en cours").length;
  const devisAttente=documents.filter(d=>d.type==="devis"&&d.statut==="en attente").length;
  const marges=chantiers.map(c=>calcCouts(c).tauxMarge);
  const margeMoy=marges.length?Math.round(marges.reduce((a,b)=>a+b,0)/marges.length):0;
  const mc=margeMoy>=25?L.green:margeMoy>=15?L.orange:L.red;

  return(
    <div>
      <PageHeader
        title={`Bonjour 👋`}
        subtitle={`${entreprise.nom} · ${new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}`}
      />

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:14,marginBottom:24}}>
        <KPI label="CA total" value={euro(totCA)} icon="💰" color={L.navy}/>
        <KPI label="Encaissé" value={euro(encaisse)} icon="✅" color={L.green}/>
        <KPI label="Chantiers actifs" value={enCours} icon="🏗" color={L.accent}/>
        {s?.mode==="avance"&&<KPI label="Marge moyenne" value={`${margeMoy}%`} icon="📊" color={mc} sub={margeMoy>=19.5?"✓ Au-dessus secteur":"⚠ Sous secteur BTP"}/>}
        {devisAttente>0&&<KPI label="Devis en attente" value={devisAttente} icon="⏳" color={L.orange}/>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
        {/* Chantiers récents */}
        <Card style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:L.text}}>Chantiers récents</div>
            <Btn onClick={()=>onNav("chantiers")} variant="ghost" size="sm">Voir tout →</Btn>
          </div>
          <div>
            {chantiers.slice(0,4).map((c,i)=>{
              const cc=calcCouts(c);
              const mc2=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
              return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 18px",borderBottom:i<3?`1px solid ${L.border}`:"none"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:c.statut==="en cours"?L.green:c.statut==="planifié"?L.blue:L.textXs,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
                    <div style={{fontSize:11,color:L.textSm}}>{c.client}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:L.navy}}>{euro(c.devisHT)}</div>
                    {s?.mode==="avance"&&<div style={{fontSize:11,fontWeight:600,color:mc2}}>{cc.tauxMarge}% marge</div>}
                  </div>
                  <Badge>{c.statut}</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Actions rapides */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:12}}>Actions rapides</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {icon:"✏️",label:"Nouveau devis",view:"devis",color:L.accent},
                {icon:"🏗",label:"Nouveau chantier",view:"chantiers",color:L.navy},
                {icon:"🤖",label:"Assistant IA",view:"assistant",color:L.purple},
                ...(s?.mode==="avance"?[{icon:"💰",label:"Comptabilité",view:"compta",color:L.green}]:[]),
              ].map(a=>(
                <button key={a.label} onClick={()=>onNav(a.view)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:L.bg,border:`1px solid ${L.border}`,borderRadius:9,cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.background=a.color+"11";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=L.border;e.currentTarget.style.background=L.bg;}}>
                  <span style={{fontSize:18}}>{a.icon}</span>
                  <span style={{fontSize:13,fontWeight:600,color:L.textMd}}>{a.label}</span>
                  <span style={{marginLeft:"auto",color:L.textXs,fontSize:12}}>→</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Alerte mode simple - plafond micro */}
          {s?.mode==="simple"&&s.plafondCA&&(
            <Card style={{padding:14,border:`1px solid ${L.accent}44`,background:L.accentBg}}>
              <div style={{fontSize:11,fontWeight:700,color:L.accent,marginBottom:4}}>⚠️ Plafond micro-entreprise</div>
              <div style={{fontSize:11,color:L.textMd,lineHeight:1.5}}>
                BTP 2025 : {euro(s.plafondCA)}/an<br/>
                CA actuel : {euro(totCA)}<br/>
                <strong style={{color:totCA>s.plafondCA*0.9?L.red:L.green}}>
                  {totCA>s.plafondCA*0.9?"⚠ Proche du plafond !":euro(s.plafondCA-totCA)+" restants"}
                </strong>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── VUE CHANTIERS ────────────────────────────────────────────────────────────
function VueChantiers({chantiers,setChantiers,selected,setSelected,statut,documents}){
  const [tab,setTab]=useState("detail");
  const [showNew,setShowNew]=useState(false);
  const [newForm,setNewForm]=useState({nom:"",client:"",adresse:"",statut:"planifié",devisHT:"",tva:"10",notes:""});
  const s=STATUTS[statut];
  const ch=chantiers.find(c=>c.id===selected);

  function creerChantier(){
    if(!newForm.nom||!newForm.client)return;
    const n={id:Date.now(),postes:[],salaries:[],planning:[],depensesReelles:[],checklist:{},photos:[],facturesFournisseurs:[],acompteEncaisse:0,soldeEncaisse:0,...newForm,devisHT:parseFloat(newForm.devisHT)||0,devisTTC:(parseFloat(newForm.devisHT)||0)*1.1};
    setChantiers(cs=>[...cs,n]);setSelected(n.id);setShowNew(false);
    setNewForm({nom:"",client:"",adresse:"",statut:"planifié",devisHT:"",tva:"10",notes:""});
  }

  const TABS_SIMPLE=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"rentabilite",label:"Rentabilité",icon:"📊"},{id:"suivi",label:"Suivi",icon:"✅"}];
  const TABS_AVANCE=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"rentabilite",label:"Rentabilité",icon:"📊"},{id:"planning",label:"Planning",icon:"📅"},{id:"fournitures",label:"Fournitures",icon:"🔧"},{id:"suivi",label:"Suivi",icon:"✅"},{id:"bilan",label:"Bilan",icon:"💹"}];
  const tabs=s?.mode==="simple"?TABS_SIMPLE:TABS_AVANCE;

  if(!ch&&chantiers.length>0){setSelected(chantiers[0].id);return null;}

  return(
    <div style={{display:"flex",gap:0,height:"100%"}}>
      {/* Liste chantiers */}
      <div style={{width:240,borderRight:`1px solid ${L.border}`,flexShrink:0,overflowY:"auto",background:L.bg}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.8}}>Chantiers</div>
          <button onClick={()=>setShowNew(true)} style={{background:L.accent,border:"none",borderRadius:6,width:26,height:26,cursor:"pointer",color:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
        </div>
        {chantiers.map(c=>{
          const cc=calcCouts(c);const ia=c.id===selected;
          const mc2=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
          return(
            <div key={c.id} onClick={()=>{setSelected(c.id);setTab("detail");}} style={{padding:"12px 14px",borderBottom:`1px solid ${L.border}`,cursor:"pointer",background:ia?L.surface:L.bg,borderLeft:ia?`3px solid ${L.accent}`:"3px solid transparent",transition:"all .15s"}}>
              <div style={{fontSize:12,fontWeight:ia?700:500,color:ia?L.text:L.textMd,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <Badge>{c.statut}</Badge>
                {s?.mode==="avance"&&<span style={{fontSize:11,fontWeight:700,color:mc2}}>{cc.tauxMarge}%</span>}
              </div>
            </div>
          );
        })}
        {chantiers.length===0&&<div style={{padding:20,textAlign:"center",color:L.textXs,fontSize:12}}>Aucun chantier<br/>Cliquez + pour créer</div>}
      </div>

      {/* Détail chantier */}
      {ch?(
        <div style={{flex:1,overflowY:"auto",padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <h1 style={{fontSize:20,fontWeight:800,color:L.text,margin:"0 0 4px"}}>{ch.nom}</h1>
              <div style={{fontSize:12,color:L.textSm}}>{ch.client} · {ch.adresse}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Badge>{ch.statut}</Badge>
              <select value={ch.statut} onChange={e=>setChantiers(cs=>cs.map(c=>c.id===ch.id?{...c,statut:e.target.value}:c))} style={{padding:"6px 10px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,background:L.surface,color:L.text,outline:"none",cursor:"pointer"}}>
                {["planifié","en cours","terminé","annulé"].map(s2=><option key={s2}>{s2}</option>)}
              </select>
            </div>
          </div>

          <Tabs tabs={tabs} active={tab} onChange={setTab}/>

          {tab==="detail"&&<ChantierDetail chantier={ch} statut={statut}/>}
          {tab==="rentabilite"&&<ChantierRentabilite chantier={ch} statut={statut}/>}
          {tab==="planning"&&s?.mode==="avance"&&<ChantierPlanning chantier={ch} setChantiers={setChantiers}/>}
          {tab==="fournitures"&&s?.mode==="avance"&&<ChantierFournitures chantier={ch}/>}
          {tab==="suivi"&&<ChantierSuivi chantier={ch} setChantiers={setChantiers}/>}
          {tab==="bilan"&&s?.mode==="avance"&&<ChantierBilan chantier={ch}/>}
        </div>
      ):(
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:L.textXs,fontSize:14}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>🏗</div>
            <div>Sélectionnez un chantier ou créez-en un nouveau</div>
            <Btn onClick={()=>setShowNew(true)} variant="navy" size="lg" style={{marginTop:16}}>+ Nouveau chantier</Btn>
          </div>
        </div>
      )}

      {/* Modal nouveau chantier */}
      {showNew&&(
        <Modal title="Nouveau chantier" onClose={()=>setShowNew(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Input label="Nom du chantier" value={newForm.nom} onChange={v=>setNewForm(f=>({...f,nom:v}))} placeholder="Dupont – Rénovation salle de bain" required/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Input label="Client" value={newForm.client} onChange={v=>setNewForm(f=>({...f,client:v}))} placeholder="Nom du client" required/>
              <Input label="Adresse" value={newForm.adresse} onChange={v=>setNewForm(f=>({...f,adresse:v}))} placeholder="Ville ou adresse"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Input label="Montant devis HT (€)" value={newForm.devisHT} onChange={v=>setNewForm(f=>({...f,devisHT:v}))} type="number" placeholder="0.00"/>
              <Select label="Statut" value={newForm.statut} onChange={v=>setNewForm(f=>({...f,statut:v}))} options={[{value:"planifié",label:"Planifié"},{value:"en cours",label:"En cours"},{value:"terminé",label:"Terminé"}]}/>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
              <Btn onClick={()=>setShowNew(false)} variant="secondary">Annuler</Btn>
              <Btn onClick={creerChantier} variant="success">✓ Créer le chantier</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ─── SOUS-VUES CHANTIER ───────────────────────────────────────────────────────
function ChantierDetail({chantier,statut}){
  const s=STATUTS[statut];
  const cc=calcCouts(chantier);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
        <KPI label="Devis HT" value={euro(chantier.devisHT)} icon="💰" color={L.navy}/>
        <KPI label="Acompte reçu" value={euro(chantier.acompteEncaisse||0)} icon="✅" color={L.green}/>
        <KPI label="Reste à encaisser" value={euro(chantier.devisTTC-(chantier.acompteEncaisse||0)-(chantier.soldeEncaisse||0))} icon="⏳" color={L.orange}/>
        {s?.mode==="avance"&&<KPI label="Marge estimée" value={`${cc.tauxMarge}%`} icon="📊" color={cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red}/>}
      </div>
      {chantier.postes.length>0&&(
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${L.border}`,fontSize:13,fontWeight:700,color:L.text}}>Postes de travaux</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>{["N°","Désignation","Montant HT"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 14px",fontSize:11,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {chantier.postes.map((p,i)=>(
                <tr key={p.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"9px 14px",fontSize:12,color:L.textXs,fontWeight:600}}>{String(i+1).padStart(2,"0")}</td>
                  <td style={{padding:"9px 14px",fontSize:13,color:L.text}}>{p.libelle}</td>
                  <td style={{padding:"9px 14px",fontSize:13,fontWeight:700,color:L.navy,textAlign:"right"}}>{euro(p.montantHT)}</td>
                </tr>
              ))}
              <tr style={{background:L.navyBg,borderTop:`2px solid ${L.navy}`}}>
                <td colSpan={2} style={{padding:"10px 14px",fontSize:12,fontWeight:700,color:L.navy}}>TOTAL HT</td>
                <td style={{padding:"10px 14px",fontSize:14,fontWeight:800,color:L.navy,textAlign:"right"}}>{euro(chantier.devisHT)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
      {chantier.notes&&(
        <Card style={{padding:14,background:L.orangeBg,border:`1px solid ${L.orange}33`}}>
          <div style={{fontSize:11,fontWeight:700,color:L.orange,marginBottom:4}}>📝 Notes</div>
          <div style={{fontSize:12,color:L.textMd}}>{chantier.notes}</div>
        </Card>
      )}
    </div>
  );
}

function ChantierRentabilite({chantier,statut}){
  const s=STATUTS[statut];
  const cc=calcCouts(chantier);
  const mc=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;

  if(s?.mode==="simple"){
    // Vue simplifiée pour micro/EI
    const charges=s.tauxCharges||0.22;
    const benefNet=chantier.devisHT*(1-charges);
    return(
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <Card style={{padding:20,border:`2px solid ${mc}44`,background:mc+"08"}}>
          <div style={{fontSize:13,fontWeight:700,color:L.textMd,marginBottom:12}}>💰 Résultat estimé — {s.label}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {[
              {l:"Chiffre d'affaires",v:euro(chantier.devisHT),c:L.navy},
              {l:`Charges ${s.label} (${Math.round(charges*100)}%)`,v:`− ${euro(chantier.devisHT*charges)}`,c:L.orange},
              {l:"Bénéfice net estimé",v:euro(benefNet),c:L.green,bold:true},
              {l:"Encaissé",v:euro((chantier.acompteEncaisse||0)+(chantier.soldeEncaisse||0)),c:L.blue},
            ].map(item=>(
              <div key={item.l} style={{background:L.surface,borderRadius:9,padding:"12px 14px",border:`1px solid ${L.border}`}}>
                <div style={{fontSize:11,color:L.textSm,marginBottom:4}}>{item.l}</div>
                <div style={{fontSize:item.bold?20:16,fontWeight:800,color:item.c}}>{item.v}</div>
              </div>
            ))}
          </div>
          {s.tvaSoumis===false&&<div style={{marginTop:10,fontSize:11,color:L.textSm,background:L.bg,padding:"7px 12px",borderRadius:7}}>ℹ️ Franchise TVA — vous ne facturez pas la TVA</div>}
        </Card>
        <Card style={{padding:14,background:L.accentBg,border:`1px solid ${L.accent}33`}}>
          <div style={{fontSize:11,fontWeight:700,color:L.accent,marginBottom:4}}>💡 Conseil pour votre statut</div>
          <div style={{fontSize:12,color:L.textMd,lineHeight:1.6}}>En micro-entreprise BTP, vos charges sont calculées à {Math.round(charges*100)}% du CA. Si ce chantier dépasse votre rentabilité attendue, pensez à ajuster vos tarifs.</div>
        </Card>
      </div>
    );
  }

  // Vue avancée
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
        <KPI label="Devis HT" value={euro(chantier.devisHT)} color={L.navy}/>
        <KPI label="Coûts totaux" value={euro(cc.total)} color={L.orange}/>
        <KPI label="Marge HT" value={euro(cc.marge)} color={mc}/>
        <KPI label="Taux de marge" value={`${cc.tauxMarge}%`} color={mc} sub={cc.tauxMarge>=25?"✓ Excellent":cc.tauxMarge>=19.5?"✓ Dans la moyenne":"⚠ Sous la moyenne"}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${L.border}`,fontSize:13,fontWeight:700,color:L.text}}>Décomposition des coûts</div>
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {[{l:"Main d'œuvre chargée",v:cc.coutMO,c:L.blue,pct2:pct(cc.coutMO,chantier.devisHT)},{l:"Fournitures estimées",v:cc.coutFourn,c:L.accent,pct2:pct(cc.coutFourn,chantier.devisHT)},{l:"Dépenses réelles",v:cc.depR,c:L.orange,pct2:pct(cc.depR,chantier.devisHT)},{l:"Marge estimée",v:Math.max(0,cc.marge),c:L.green,pct2:Math.max(0,cc.tauxMarge)}].map(item=>(
            <div key={item.l}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{color:L.textMd}}>{item.l}</span>
                <span style={{fontWeight:700,color:item.c}}>{euro(item.v)}</span>
              </div>
              <div style={{background:L.bg,borderRadius:4,height:7}}>
                <div style={{width:`${Math.min(100,item.pct2)}%`,height:7,background:item.c,borderRadius:4}}/>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{padding:14,background:L.navyBg,border:`1px solid ${L.navy}22`}}>
        <div style={{fontSize:12,fontWeight:700,color:L.navy,marginBottom:8}}>📊 Benchmark BTP France 2025</div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          {[["Moy. secteur","19,5%",L.textSm],["Cible artisan","20–30%",L.green],["Votre marge",`${cc.tauxMarge}%`,mc],["Écart",`${cc.tauxMarge>=19.5?"+":""}${(cc.tauxMarge-19.5).toFixed(1)}pts`,cc.tauxMarge>=19.5?L.green:L.red]].map(([l,v,c])=>(
            <div key={l}><div style={{fontSize:10,color:L.textSm,marginBottom:2}}>{l}</div><div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ChantierSuivi({chantier,setChantiers}){
  const phases=[
    {id:"avant",label:"Avant chantier",icon:"📋",items:["Devis signé reçu","Acompte 40% encaissé","Planning validé client","Commande fournitures","Salariés informés","Accès confirmé"]},
    {id:"pendant",label:"Pendant chantier",icon:"🔨",items:["Photos avant travaux","Conformité au devis","Suivi avancement","Photos en cours","Gestion imprévus","Accord modifications"]},
    {id:"apres",label:"Après chantier",icon:"✅",items:["Photos après travaux","Nettoyage final","Contrôle qualité","Levée de réserves","Facture finale émise","Solde 60% encaissé"]},
  ];
  const cl=chantier.checklist||{};
  const tot=phases.reduce((a,p)=>a+p.items.length,0);
  const done=Object.values(cl).filter(Boolean).length;
  const prog=pct(done,tot);
  function tog(ph,it){const k=`${ph}_${it}`;setChantiers(cs=>cs.map(c=>c.id!==chantier.id?c:{...c,checklist:{...cl,[k]:!cl[k]}}));}
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card style={{padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:L.text}}>Avancement global</span>
          <span style={{fontSize:14,fontWeight:800,color:prog>=100?L.green:prog>=50?L.orange:L.red}}>{prog}%</span>
        </div>
        <div style={{background:L.bg,borderRadius:6,height:10}}>
          <div style={{width:`${prog}%`,height:10,background:`linear-gradient(90deg,${L.blue},${L.green})`,borderRadius:6,transition:"width .3s"}}/>
        </div>
        <div style={{fontSize:11,color:L.textXs,marginTop:4}}>{done}/{tot} points validés</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14}}>
        {phases.map(phase=>{
          const phDone=phase.items.filter(it=>cl[`${phase.id}_${it}`]).length;
          return(
            <Card key={phase.id} style={{overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,background:L.bg,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700,color:L.text}}>{phase.icon} {phase.label}</span>
                <span style={{fontSize:11,color:L.textXs}}>{phDone}/{phase.items.length}</span>
              </div>
              <div style={{padding:12}}>
                {phase.items.map(it=>{
                  const d=cl[`${phase.id}_${it}`];
                  return(
                    <div key={it} onClick={()=>tog(phase.id,it)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer"}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${d?L.green:L.borderMd}`,background:d?L.green:L.surface,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {d&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                      </div>
                      <span style={{fontSize:12,color:d?L.textXs:L.textMd,textDecoration:d?"line-through":"none"}}>{it}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ChantierPlanning({chantier,setChantiers}){
  function tog(idx,sid){setChantiers(cs=>cs.map(c=>{if(c.id!==chantier.id)return c;const p=c.planning.map((j,i)=>{if(i!==idx)return j;const h=j.salaries.includes(sid);return{...j,salaries:h?j.salaries.filter(s=>s!==sid):[...j.salaries,sid]};});return{...c,planning:p};}));}
  const totalH=chantier.planning.reduce((a,j)=>a+j.salaries.length*8,0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        <KPI label="Séquences" value={chantier.planning.length} color={L.navy}/>
        <KPI label="Heures totales" value={`${totalH}h`} color={L.blue}/>
        <KPI label="Équipe" value={`${chantier.salaries.length} pers.`} color={L.accent}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${L.border}`,fontSize:13,fontWeight:700,color:L.text}}>Planning journalier</div>
        {chantier.planning.map((j,idx)=>(
          <div key={idx} style={{display:"grid",gridTemplateColumns:"130px 1fr auto",gap:12,padding:"10px 16px",borderBottom:`1px solid ${L.border}`,alignItems:"center"}}>
            <div style={{fontSize:12,color:L.accent,fontWeight:700}}>{new Date(j.jour).toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"2-digit"})}</div>
            <div>
              <div style={{fontSize:12,color:L.text,fontWeight:500}}>{j.tache}</div>
              <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                {chantier.salaries.map(s=>(
                  <button key={s.id} onClick={()=>tog(idx,s.id)} style={{padding:"2px 8px",borderRadius:5,fontSize:10,cursor:"pointer",border:`1px solid ${j.salaries.includes(s.id)?L.blue:L.border}`,background:j.salaries.includes(s.id)?L.navyBg:L.surface,color:j.salaries.includes(s.id)?L.blue:L.textXs,fontFamily:"inherit",fontWeight:j.salaries.includes(s.id)?600:400}}>
                    {s.nom.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{fontSize:11,color:j.salaries.length?L.green:L.textXs,fontWeight:600}}>{j.salaries.length?`${j.salaries.length}p.`:"—"}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ChantierFournitures({chantier}){
  const all=chantier.postes.flatMap(p=>p.fournitures.map(f=>({...f,poste:p.libelle})));
  const total=all.reduce((a,f)=>a+f.qte*f.prixUnit,0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <KPI label="Total fournitures" value={euro(total)} color={L.accent}/>
        <KPI label="Références" value={all.length} color={L.navy}/>
        <KPI label="% du devis" value={`${pct(total,chantier.devisHT)}%`} color={L.textMd}/>
      </div>
      {chantier.postes.filter(p=>p.fournitures.length>0).map(poste=>(
        <Card key={poste.id} style={{overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,background:L.bg,fontSize:12,fontWeight:700,color:L.navy}}>{poste.libelle}</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>{["Désignation","Qté","Unité","Prix unit.","Total"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {poste.fournitures.map((f,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"7px 12px",fontSize:12,color:L.text}}>{f.designation}</td>
                  <td style={{padding:"7px 12px",fontSize:12,color:L.textMd}}>{f.qte}</td>
                  <td style={{padding:"7px 12px",fontSize:11,color:L.textXs}}>{f.unite}</td>
                  <td style={{padding:"7px 12px",fontSize:12,textAlign:"right"}}>{euro(f.prixUnit)}</td>
                  <td style={{padding:"7px 12px",fontSize:12,fontWeight:700,color:L.navy,textAlign:"right"}}>{euro(f.qte*f.prixUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function ChantierBilan({chantier}){
  const cc=calcCouts(chantier);
  const mc=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
  const encaisse=(chantier.acompteEncaisse||0)+(chantier.soldeEncaisse||0);
  const tdS={padding:"9px 12px",fontSize:12,color:L.text,borderBottom:`1px solid ${L.border}`};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Résumé */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KPI label="Devis HT" value={euro(chantier.devisHT)} color={L.navy}/>
        <KPI label="Coût total" value={euro(cc.total)} color={L.orange}/>
        <KPI label="Marge HT" value={euro(cc.marge)} color={mc}/>
        <KPI label="Taux marge" value={`${cc.tauxMarge}%`} color={mc}/>
      </div>
      {/* Tableau détaillé */}
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${L.border}`,fontSize:13,fontWeight:700,color:L.text}}>Bilan financier détaillé</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Poste","Prévu","Réel","Écart"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:11,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>
            <tr style={{borderBottom:`1px solid ${L.border}`}}>
              <td style={{...tdS,fontWeight:600}}>👷 Main d'œuvre chargée</td>
              <td style={{...tdS,fontWeight:700,color:L.blue}}>{euro(cc.coutMO)}</td>
              <td style={{...tdS,color:L.textSm}}>—</td>
              <td style={{...tdS,color:L.textXs}}>—</td>
            </tr>
            <tr style={{borderBottom:`1px solid ${L.border}`}}>
              <td style={{...tdS,fontWeight:600}}>📦 Fournitures</td>
              <td style={{...tdS,fontWeight:700,color:L.accent}}>{euro(cc.coutFourn)}</td>
              <td style={{...tdS,color:L.textSm}}>—</td>
              <td style={{...tdS,color:L.textXs}}>—</td>
            </tr>
            {cc.depR>0&&<tr style={{borderBottom:`1px solid ${L.border}`}}>
              <td style={{...tdS,fontWeight:600}}>📋 Dépenses réelles</td>
              <td style={{...tdS,color:L.textSm}}>Non prévu</td>
              <td style={{...tdS,fontWeight:700,color:L.orange}}>{euro(cc.depR)}</td>
              <td style={{...tdS,color:L.red,fontWeight:600}}>+{euro(cc.depR)}</td>
            </tr>}
            <tr style={{background:L.bg,borderTop:`2px solid ${L.borderMd}`}}>
              <td style={{...tdS,fontWeight:800,color:L.text}}>TOTAL COÛTS</td>
              <td style={{...tdS,fontWeight:800,color:L.navy,fontSize:14}}>{euro(cc.total)}</td>
              <td style={{...tdS,color:L.textSm}}>—</td>
              <td/>
            </tr>
            <tr style={{background:mc+"08",borderTop:`2px solid ${mc}44`}}>
              <td style={{...tdS,fontWeight:800,color:mc}}>💰 MARGE BRUTE</td>
              <td style={{...tdS,fontWeight:900,color:mc,fontSize:15}}>{euro(cc.marge)}</td>
              <td style={{...tdS,fontWeight:800,color:mc}}>{cc.tauxMarge}%</td>
              <td/>
            </tr>
            <tr style={{borderBottom:`1px solid ${L.border}`}}>
              <td style={{...tdS,fontWeight:600}}>💳 Encaissé TTC</td>
              <td style={{...tdS,fontWeight:700,color:L.green}}>{euro(encaisse)}</td>
              <td style={{...tdS,color:encaisse<chantier.devisTTC?L.orange:L.green,fontWeight:600}}>{encaisse<chantier.devisTTC?`Reste ${euro(chantier.devisTTC-encaisse)}`:"✓ Soldé"}</td>
              <td/>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}


// ─── DEVIS & FACTURES ────────────────────────────────────────────────────────
function VueDevis({documents,setDocuments,chantiers,statut,entreprise}){
  const [apercu,setApercu]=useState(null);
  const [showCreer,setShowCreer]=useState(false);
  const [filtreType,setFiltreType]=useState("tous");
  const s=STATUTS[statut];
  const filtered=documents.filter(d=>filtreType==="tous"||d.type===filtreType);
  const totalD=documents.filter(d=>d.type==="devis").reduce((a,d)=>a+calcDocTotal(d).ttc,0);
  const totalF=documents.filter(d=>d.type==="facture").reduce((a,d)=>a+calcDocTotal(d).ttc,0);

  return(
    <div>
      <PageHeader
        title="Devis & Factures"
        subtitle="Créez, visualisez et convertissez vos documents"
        actions={<Btn onClick={()=>setShowCreer(true)} variant="accent" icon="✏️">Nouveau document</Btn>}
      />
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        <KPI label="Devis émis" value={documents.filter(d=>d.type==="devis").length} sub={euro(totalD)} color={L.blue}/>
        <KPI label="Factures" value={documents.filter(d=>d.type==="facture").length} sub={euro(totalF)} color={L.teal}/>
        <KPI label="Acceptés" value={documents.filter(d=>d.statut==="accepté").length} color={L.green}/>
        <KPI label="En attente" value={documents.filter(d=>d.statut==="en attente").length} color={L.orange}/>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["tous","devis","facture"].map(t=>(
          <button key={t} onClick={()=>setFiltreType(t)} style={{padding:"7px 16px",borderRadius:7,border:`1px solid ${filtreType===t?L.accent:L.border}`,background:filtreType===t?L.accentBg:L.surface,color:filtreType===t?L.accent:L.textSm,fontSize:12,fontWeight:filtreType===t?700:400,cursor:"pointer",fontFamily:"inherit"}}>
            {t==="tous"?"Tous":t==="devis"?"Devis":"Factures"}
          </button>
        ))}
      </div>

      <Card style={{overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Type","N°","Date","Client","Montant HT","TTC","Statut","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:11,color:L.textSm,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map((doc,i)=>{
              const t=calcDocTotal(doc);
              return(
                <tr key={doc.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"10px 14px"}}><Badge>{doc.type}</Badge></td>
                  <td style={{padding:"10px 14px",fontSize:12,color:L.textSm,fontFamily:"monospace"}}>{doc.numero}</td>
                  <td style={{padding:"10px 14px",fontSize:12,color:L.textSm}}>{doc.date}</td>
                  <td style={{padding:"10px 14px",fontSize:13,fontWeight:600,color:L.text}}>{doc.client}</td>
                  <td style={{padding:"10px 14px",fontSize:12,fontFamily:"monospace"}}>{euro(t.ht)}</td>
                  <td style={{padding:"10px 14px",fontSize:13,fontWeight:700,color:L.navy,fontFamily:"monospace"}}>{euro(t.ttc)}</td>
                  <td style={{padding:"10px 14px"}}><Badge>{doc.statut}</Badge></td>
                  <td style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setApercu(doc)} style={{padding:"4px 10px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>👁 Voir</button>
                      {doc.type==="devis"&&<button onClick={()=>setDocuments(ds=>ds.map(d=>d.id!==doc.id?d:{...d,type:"facture",statut:"en attente",numero:`FAC-${Date.now().toString().slice(-5)}`}))} style={{padding:"4px 10px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.green,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>→ Facture</button>}
                      <button onClick={()=>setDocuments(ds=>ds.filter(d=>d.id!==doc.id))} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={8} style={{padding:28,textAlign:"center",color:L.textXs,fontSize:13}}>Aucun document</td></tr>}
          </tbody>
        </table>
      </Card>

      {/* Aperçu devis style pro */}
      {apercu&&(
        <Modal title={`Aperçu — ${apercu.type} ${apercu.numero}`} onClose={()=>setApercu(null)} maxWidth={720}>
          <ApercuDocumentPro doc={apercu} entreprise={entreprise}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:`1px solid ${L.border}`}}>
            <Btn onClick={()=>window.print()} variant="navy" icon="🖨️">Imprimer / PDF</Btn>
            <Btn onClick={()=>setApercu(null)} variant="secondary">Fermer</Btn>
          </div>
        </Modal>
      )}

      {/* Créateur rapide */}
      {showCreer&&(
        <Modal title="Nouveau document" onClose={()=>setShowCreer(false)} maxWidth={500}>
          <CreateurRapide chantiers={chantiers} onSave={doc=>{setDocuments(d=>[...d,doc]);setShowCreer(false);}} onClose={()=>setShowCreer(false)}/>
        </Modal>
      )}
    </div>
  );
}

function ApercuDocumentPro({doc,entreprise}){
  const {ht,tva,ttc}=calcDocTotal(doc);
  const fmt=n=>new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2}).format(n);
  const reste=ttc-(doc.acompteVerse||0);
  const isF=doc.type==="facture";
  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",color:"#1E293B",fontSize:12}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20,paddingBottom:16,borderBottom:"2px solid #1B3A5C"}}>
        <div>
          <div style={{fontSize:18,fontWeight:900,color:"#1B3A5C"}}>{entreprise.nomCourt||entreprise.nom} <span style={{color:L.accent}}>·</span></div>
          <div style={{fontSize:10,color:"#64748B",lineHeight:1.8,marginTop:4}}>{entreprise.adresse||"48 route de la Valentine, 13013 Marseille"}<br/>{entreprise.tel||"06.50.18.00.09"} · {entreprise.email||"contact@france-habitat.com"}<br/>SIRET : {entreprise.siret||"513 640 227 00031"}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#1B3A5C",textTransform:"uppercase"}}>{isF?"Facture":"Devis"}</div>
          <div style={{color:"#475569",marginTop:4}}>N° {doc.numero}<br/>Date : {doc.date}<br/>{doc.dateEcheance&&`Échéance : ${doc.dateEcheance}`}</div>
        </div>
      </div>
      {/* Client */}
      <div style={{background:"#F8FAFC",borderRadius:7,padding:"10px 14px",marginBottom:16}}>
        <div style={{fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Client</div>
        <div style={{fontWeight:700,color:"#1B3A5C"}}>{doc.client}</div>
        <div style={{color:"#475569"}}>{doc.adresseClient}</div>
      </div>
      {/* Lignes */}
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:16}}>
        <thead><tr style={{background:"#1B3A5C",color:"#fff"}}>{["Désignation","Qté","U","P.U. HT","TVA","Total HT"].map((h,i)=><th key={h} style={{padding:"7px 10px",fontSize:10,textAlign:i===0?"left":"right",fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{doc.lignes.map((l,i)=><tr key={l.id} style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"#fff":"#F8FAFC"}}><td style={{padding:"7px 10px"}}>{l.libelle}</td><td style={{padding:"7px 10px",textAlign:"right",color:"#64748B"}}>{l.qte}</td><td style={{padding:"7px 10px",textAlign:"right",color:"#64748B"}}>{l.unite}</td><td style={{padding:"7px 10px",textAlign:"right"}}>{fmt(l.prixUnitHT)} €</td><td style={{padding:"7px 10px",textAlign:"right",color:"#64748B"}}>{l.tva}%</td><td style={{padding:"7px 10px",textAlign:"right",fontWeight:600}}>{fmt(l.qte*l.prixUnitHT)} €</td></tr>)}</tbody>
      </table>
      {/* Totaux */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <div style={{minWidth:220}}>
          {[["Montant HT",ht,"#334155"],["TVA",tva,"#64748B"],["Montant TTC",ttc,"#1B3A5C"]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #E2E8F0"}}>
              <span style={{color:c}}>{l}</span>
              <span style={{color:c,fontWeight:700,fontFamily:"monospace"}}>{fmt(v)} €</span>
            </div>
          ))}
          {(doc.acompteVerse||0)>0&&(
            <div style={{marginTop:6,padding:"8px",background:"#FFF7ED",borderRadius:5}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#92400E"}}>Acompte versé</span><span style={{color:"#059669",fontWeight:700,fontFamily:"monospace"}}>- {fmt(doc.acompteVerse)} €</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontWeight:700,color:"#92400E"}}>Solde à régler</span><span style={{fontWeight:800,color:"#92400E",fontFamily:"monospace"}}>{fmt(reste)} €</span></div>
            </div>
          )}
        </div>
      </div>
      <div style={{fontSize:10,color:"#94A3B8"}}>{doc.conditionsReglement} · {doc.notes}</div>
    </div>
  );
}

function CreateurRapide({chantiers,onSave,onClose}){
  const [form,setForm]=useState({type:"devis",numero:`DEV-${Date.now().toString().slice(-5)}`,date:new Date().toISOString().slice(0,10),dateEcheance:"",client:"",adresseClient:"",conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:0,statut:"brouillon",lignes:[{id:1,libelle:"",qte:1,unite:"U",prixUnitHT:0,tva:10,photo:null}]});
  const {ht,tva,ttc}=calcDocTotal(form);
  function updL(id,k,v){setForm(f=>({...f,lignes:f.lignes.map(l=>l.id!==id?l:{...l,[k]:k==="qte"||k==="prixUnitHT"?parseFloat(v)||0:v})}));}
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Select label="Type" value={form.type} onChange={v=>setForm(f=>({...f,type:v}))} options={[{value:"devis",label:"Devis"},{value:"facture",label:"Facture"}]}/>
        <Input label="Client" value={form.client} onChange={v=>setForm(f=>({...f,client:v}))} placeholder="Nom du client" required/>
        <Input label="Date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} type="date"/>
        <Input label="Adresse" value={form.adresseClient} onChange={v=>setForm(f=>({...f,adresseClient:v}))} placeholder="Adresse chantier"/>
      </div>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:8}}>Lignes</div>
        {form.lignes.map(l=>(
          <div key={l.id} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
            <input value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="Désignation" style={{flex:1,padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,outline:"none"}}/>
            <input value={l.qte} onChange={e=>updL(l.id,"qte",e.target.value)} type="number" style={{width:55,padding:"7px 8px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,outline:"none",textAlign:"center"}}/>
            <input value={l.prixUnitHT} onChange={e=>updL(l.id,"prixUnitHT",e.target.value)} type="number" style={{width:90,padding:"7px 8px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,outline:"none",textAlign:"right"}}/>
            <span style={{fontSize:11,color:L.textSm,fontWeight:700,minWidth:80,textAlign:"right"}}>{euro(l.qte*l.prixUnitHT)}</span>
            <button onClick={()=>setForm(f=>({...f,lignes:f.lignes.filter(x=>x.id!==l.id)}))} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
          </div>
        ))}
        <button onClick={()=>setForm(f=>({...f,lignes:[...f.lignes,{id:Date.now(),libelle:"",qte:1,unite:"U",prixUnitHT:0,tva:10,photo:null}]}))} style={{fontSize:11,color:L.accent,background:"none",border:`1px dashed ${L.accent}`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit"}}>+ Ligne</button>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:L.navyBg,borderRadius:8}}>
        <span style={{fontSize:13,color:L.navy,fontWeight:600}}>Total TTC</span>
        <span style={{fontSize:18,fontWeight:800,color:L.navy,fontFamily:"monospace"}}>{euro(ttc)}</span>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={onClose} variant="secondary">Annuler</Btn>
        <Btn onClick={()=>onSave({...form,id:Date.now(),chantierId:null})} variant="success">✓ Enregistrer</Btn>
      </div>
    </div>
  );
}


// ─── ASSISTANT IA ─────────────────────────────────────────────────────────────
function VueAssistant({entreprise,statut,chantiers}){
  const [messages,setMessages]=useState([{role:"assistant",content:`Bonjour ! Je suis votre assistant BTP spécialisé pour ${entreprise.nomCourt||entreprise.nom}.\n\nJe peux vous aider à :\n• Rédiger des désignations professionnelles pour vos devis\n• Analyser la rentabilité de vos chantiers\n• Calculer des prix et marges\n• Répondre à vos questions BTP\n\nQue puis-je faire pour vous ?`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null);
  const s=STATUTS[statut];

  const SUGGESTIONS=[
    "Rédige une désignation pro pour pose carrelage 60x60",
    "Comment calculer ma marge sur un chantier ?",
    "Quelles charges pour un auto-entrepreneur BTP ?",
    "Désignation pour enduit façade monocouche",
    "Comment améliorer ma rentabilité ?",
    "Quels délais moyens pour une dalle béton ?",
  ];

  async function envoyer(){
    if(!input.trim())return;
    const msg=input.trim();setInput("");
    setMessages(m=>[...m,{role:"user",content:msg}]);setLoading(true);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
    try{
      const system=`Tu es un assistant expert en BTP français pour ${entreprise.nom||"France Habitat"}, ${entreprise.activite||"entreprise de rénovation"} à Marseille.
Statut : ${s?.label||"SARL"}. Mode interface : ${s?.mode||"avance"}.
Tu peux rédiger des désignations BTP professionnelles, calculer des marges, donner des conseils métier.
Pour les désignations : "Fourniture et pose de [description], compris [détails], raccordements et finitions."
Réponds en français, de façon concise et professionnelle. Maximum 3-4 paragraphes.`;
      const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,system,messages:[...messages.filter((_,i)=>i>0).map(m=>({role:m.role,content:m.content})),{role:"user",content:msg}]})});
      const data=await resp.json();
      setMessages(m=>[...m,{role:"assistant",content:data.content?.[0]?.text||"Désolé, erreur de traitement."}]);
    }catch{setMessages(m=>[...m,{role:"assistant",content:"Erreur de connexion. Vérifiez votre accès internet."}]);}
    setLoading(false);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
  }

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 100px)"}}>
      <PageHeader title="Assistant IA" subtitle={`Spécialisé BTP · Alimenté par Claude · ${s?.label||""}`}/>
      <Card style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:14}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:10,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              {m.role==="assistant"&&<div style={{width:30,height:30,borderRadius:"50%",background:L.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,marginTop:2}}>🤖</div>}
              <div style={{maxWidth:"72%",padding:"12px 16px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?L.navy:L.bg,color:m.role==="user"?"#fff":L.text,fontSize:13,lineHeight:1.6,border:`1px solid ${m.role==="user"?L.navy:L.border}`,whiteSpace:"pre-wrap"}}>
                {m.content}
              </div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:10}}><div style={{width:30,height:30,borderRadius:"50%",background:L.navy,display:"flex",alignItems:"center",justifyContent:"center"}}>🤖</div><div style={{padding:"12px 16px",background:L.bg,borderRadius:"14px 14px 14px 4px",border:`1px solid ${L.border}`,display:"flex",gap:4,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:L.textXs,animation:`bounce .8s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>}
          <div ref={endRef}/>
        </div>
        {/* Suggestions */}
        <div style={{padding:"8px 16px",borderTop:`1px solid ${L.border}`,display:"flex",gap:6,overflowX:"auto",flexShrink:0,background:L.bg}}>
          {SUGGESTIONS.map(s2=>(
            <button key={s2} onClick={()=>setInput(s2)} style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:14,padding:"4px 12px",cursor:"pointer",color:L.textSm,fontSize:11,whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.borderColor=L.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=L.border}>
              {s2}
            </button>
          ))}
        </div>
        {/* Input */}
        <div style={{padding:"12px 16px",borderTop:`1px solid ${L.border}`,display:"flex",gap:8,flexShrink:0}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();envoyer();}}} placeholder="Tapez votre question... (Entrée pour envoyer)" rows={2} style={{flex:1,padding:"9px 12px",border:`1px solid ${L.border}`,borderRadius:9,fontSize:13,color:L.text,outline:"none",resize:"none",fontFamily:"inherit"}}/>
          <button onClick={envoyer} disabled={loading||!input.trim()} style={{background:loading||!input.trim()?L.bg:L.navy,border:`1px solid ${loading||!input.trim()?L.border:L.navy}`,borderRadius:9,padding:"9px 18px",cursor:loading||!input.trim()?"not-allowed":"pointer",color:loading||!input.trim()?L.textXs:"#fff",fontSize:13,fontWeight:700,fontFamily:"inherit",alignSelf:"flex-end"}}>
            {loading?"⏳":"➤"}
          </button>
        </div>
      </Card>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}

// ─── PARAMÈTRES ENTREPRISE ────────────────────────────────────────────────────
function VueParametres({entreprise,setEntreprise,statut,setStatut,onClose}){
  const [form,setForm]=useState({...entreprise});
  const [statForm,setStatForm]=useState(statut);
  function save(){setEntreprise({...form,nomCourt:form.nomCourt||form.nom.split(" ").slice(0,2).join(" ")});setStatut(statForm);onClose();}
  return(
    <Modal title="⚙️ Paramètres entreprise" onClose={onClose} maxWidth={580}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"span 2"}}><Input label="Nom complet" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))} required/></div>
          <Input label="Nom court (affichage)" value={form.nomCourt||""} onChange={v=>setForm(f=>({...f,nomCourt:v}))} placeholder="France Habitat"/>
          <Input label="SIRET" value={form.siret} onChange={v=>setForm(f=>({...f,siret:v}))}/>
          <Input label="Téléphone" value={form.tel||""} onChange={v=>setForm(f=>({...f,tel:v}))}/>
          <Input label="Email" value={form.email||""} onChange={v=>setForm(f=>({...f,email:v}))} type="email"/>
          <div style={{gridColumn:"span 2"}}><Input label="Adresse" value={form.adresse||""} onChange={v=>setForm(f=>({...f,adresse:v}))}/></div>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:8}}>Statut juridique</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {Object.entries(STATUTS).map(([key,s])=>(
              <div key={key} onClick={()=>setStatForm(key)} style={{padding:"9px 12px",borderRadius:8,border:`2px solid ${statForm===key?s.color:L.border}`,background:statForm===key?s.bg:L.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                <span>{s.icon}</span>
                <div style={{fontSize:12,fontWeight:statForm===key?700:400,color:statForm===key?s.color:L.textMd}}>{s.short}</div>
                <div style={{fontSize:10,color:L.textXs,flex:1}}>{s.description}</div>
                {statForm===key&&<div style={{width:14,height:14,borderRadius:"50%",background:s.color,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/></div>}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${L.border}`}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={save} variant="success">✓ Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}


// ─── VUES AVANCÉES (stub simplifié) ───────────────────────────────────────────
function VueCompta({chantiers,statut}){
  const totCA=chantiers.reduce((a,c)=>a+c.devisHT,0);
  const totEnc=chantiers.reduce((a,c)=>a+(c.acompteEncaisse||0)+(c.soldeEncaisse||0),0);
  const totCouts=chantiers.reduce((a,c)=>a+calcCouts(c).total,0);
  const benef=totCA-totCouts;
  const tb=pct(benef,totCA);
  const mc=tb>=25?L.green:tb>=15?L.orange:L.red;
  const MOIS=[{m:"Jan",ca:12500,enc:8000},{m:"Fév",ca:18200,enc:12000},{m:"Mar",ca:9800,enc:6500},{m:"Avr",ca:71404,enc:31417},{m:"Mai",ca:7044,enc:3099},{m:"Jun",ca:0,enc:0}];
  const maxCA=Math.max(...MOIS.map(d=>d.ca));
  return(
    <div>
      <PageHeader title="Comptabilité" subtitle="Vue d'ensemble financière"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
        <KPI label="CA total" value={euro(totCA)} icon="💰" color={L.navy}/>
        <KPI label="Encaissé" value={euro(totEnc)} icon="✅" color={L.green}/>
        <KPI label="Bénéfice estimé" value={euro(benef)} icon="📈" color={mc}/>
        <KPI label="Taux de marge" value={`${tb}%`} icon="📊" color={mc} sub={tb>=19.5?"✓ Au-dessus secteur":"⚠ Sous secteur"}/>
      </div>
      {/* Graphique SVG simplifié */}
      <Card style={{padding:20,marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,color:L.text,marginBottom:16}}>Évolution CA 2026</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:10,height:120}}>
          {MOIS.map(d=>(
            <div key={d.m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:10,color:L.textXs,fontFamily:"monospace"}}>{d.ca>0?`${Math.round(d.ca/1000)}k`:""}</div>
              <div style={{width:"100%",background:`linear-gradient(180deg,${L.accent},${L.navy})`,borderRadius:"4px 4px 0 0",height:`${maxCA>0?(d.ca/maxCA)*90:0}px`,minHeight:d.ca>0?4:0,transition:"height .3s"}}/>
              <div style={{fontSize:11,color:L.textSm,fontWeight:600}}>{d.m}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${L.border}`,fontSize:13,fontWeight:700,color:L.text}}>Bénéfice par chantier</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Chantier","CA HT","Coûts","Marge","Taux","Encaissé"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 14px",fontSize:11,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>
            {chantiers.map((c,i)=>{const cc=calcCouts(c);const mc2=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;const enc=(c.acompteEncaisse||0)+(c.soldeEncaisse||0);return(
              <tr key={c.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                <td style={{padding:"9px 14px",fontSize:13,fontWeight:600,color:L.text}}>{c.nom}<div style={{fontSize:10,color:L.textXs}}>{c.client}</div></td>
                <td style={{padding:"9px 14px",fontFamily:"monospace",fontSize:12}}>{euro(c.devisHT)}</td>
                <td style={{padding:"9px 14px",fontFamily:"monospace",fontSize:12,color:L.orange}}>{euro(cc.total)}</td>
                <td style={{padding:"9px 14px",fontFamily:"monospace",fontSize:12,fontWeight:700,color:mc2}}>{euro(cc.marge)}</td>
                <td style={{padding:"9px 14px"}}><span style={{background:mc2+"22",color:mc2,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{cc.tauxMarge}%</span></td>
                <td style={{padding:"9px 14px",fontFamily:"monospace",fontSize:12,color:L.green}}>{euro(enc)}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function VueFrais(){
  const [frais,setFrais]=useState([
    {id:1,cat:"local",    libelle:"Loyer local Marseille",      montant:850, per:"mensuel",actif:true},
    {id:2,cat:"credit",   libelle:"Crédit camionnette Renault", montant:420, per:"mensuel",actif:true},
    {id:3,cat:"credit",   libelle:"Crédit camion benne",        montant:680, per:"mensuel",actif:true},
    {id:4,cat:"assurance",libelle:"RC Pro + décennale",         montant:2800,per:"annuel", actif:true},
    {id:5,cat:"salaire",  libelle:"Secrétaire mi-temps",        montant:1100,per:"mensuel",actif:true},
    {id:6,cat:"telecom",  libelle:"Abonnements téléphone x3",   montant:120, per:"mensuel",actif:true},
    {id:7,cat:"compta",   libelle:"Expert-comptable",           montant:250, per:"mensuel",actif:true},
    {id:8,cat:"carburant",libelle:"Carburant véhicules",        montant:380, per:"mensuel",actif:true},
  ]);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({cat:"local",libelle:"",montant:"",per:"mensuel",actif:true});
  const CATS={local:"🏢 Local",credit:"🚛 Crédit/Leasing",assurance:"🛡️ Assurances",salaire:"👩‍💼 Salaires",telecom:"📱 Télécom",compta:"📊 Comptabilité",carburant:"⛽ Carburant",location:"🔑 Location",autre:"📦 Autre"};
  const PERS={mensuel:{l:"Mensuel",m:1},annuel:{l:"Annuel",m:1/12},trimestr:{l:"Trimestriel",m:1/3}};
  const toMens=f=>f.actif?(parseFloat(f.montant)||0)*(PERS[f.per]?.m||1/12):0;
  const totalMens=frais.reduce((a,f)=>a+toMens(f),0);
  function save(){if(!form.libelle||!form.montant)return;setFrais(fs=>[...fs,{...form,montant:parseFloat(form.montant),id:Date.now()}]);setForm({cat:"local",libelle:"",montant:"",per:"mensuel",actif:true});setShowForm(false);}
  return(
    <div>
      <PageHeader title="Frais fixes" subtitle="Loyer, crédits, assurances, salaires admin..."
        actions={<Btn onClick={()=>setShowForm(!showForm)} variant={showForm?"secondary":"primary"}>{showForm?"✕ Annuler":"+ Ajouter un frais"}</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
        <KPI label="Charges / mois" value={euro(totalMens)} color={L.orange}/>
        <KPI label="Charges / an" value={euro(totalMens*12)} color={L.red}/>
        <KPI label="Postes actifs" value={frais.filter(f=>f.actif).length} color={L.navy}/>
      </div>
      {showForm&&(
        <Card style={{padding:16,marginBottom:16,border:`1px solid ${L.accent}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
            <Select label="Catégorie" value={form.cat} onChange={v=>setForm(f=>({...f,cat:v}))} options={Object.entries(CATS).map(([k,v])=>({value:k,label:v}))}/>
            <div style={{gridColumn:"span 2"}}><Input label="Libellé" value={form.libelle} onChange={v=>setForm(f=>({...f,libelle:v}))} placeholder="ex: Crédit Ford Transit..." required/></div>
            <Input label="Montant (€)" value={form.montant} onChange={v=>setForm(f=>({...f,montant:v}))} type="number" required/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
            <Select label="" value={form.per} onChange={v=>setForm(f=>({...f,per:v}))} options={Object.entries(PERS).map(([k,v])=>({value:k,label:v.l}))}/>
            <Btn onClick={save} variant="success">✓ Enregistrer</Btn>
          </div>
        </Card>
      )}
      <Card style={{overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Catégorie","Libellé","Périodicité","Montant","Équiv./mois",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 14px",fontSize:11,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>
            {frais.map((f,i)=>(
              <tr key={f.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg,opacity:f.actif?1:0.5}}>
                <td style={{padding:"9px 14px",fontSize:12}}>{CATS[f.cat]||f.cat}</td>
                <td style={{padding:"9px 14px",fontSize:13,fontWeight:600,color:L.text}}>{f.libelle}</td>
                <td style={{padding:"9px 14px",fontSize:12,color:L.textSm}}>{PERS[f.per]?.l||f.per}</td>
                <td style={{padding:"9px 14px",fontSize:12,fontFamily:"monospace",fontWeight:700}}>{euro(f.montant)}</td>
                <td style={{padding:"9px 14px",fontSize:12,fontFamily:"monospace",fontWeight:700,color:L.orange}}>{euro(toMens(f))}</td>
                <td style={{padding:"9px 14px"}}>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setFrais(fs=>fs.map(x=>x.id!==f.id?x:{...x,actif:!x.actif}))} style={{padding:"3px 8px",border:`1px solid ${f.actif?L.green:L.border}`,borderRadius:5,background:f.actif?L.greenBg:L.surface,color:f.actif?L.green:L.textXs,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{f.actif?"Actif":"Inactif"}</button>
                    <button onClick={()=>setFrais(fs=>fs.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{background:L.navyBg,borderTop:`2px solid ${L.navy}`}}>
            <td colSpan={4} style={{padding:"9px 14px",fontSize:12,fontWeight:700,color:L.navy}}>TOTAL</td>
            <td style={{padding:"9px 14px",fontFamily:"monospace",fontSize:14,fontWeight:800,color:L.navy}}>{euro(totalMens)}/mois</td>
            <td/>
          </tr></tfoot>
        </table>
      </Card>
    </div>
  );
}

// ─── VUES PLACEHOLDER AVANCÉES ────────────────────────────────────────────────
function VuePlaceholder({title,icon,desc,comingSoon}){
  return(
    <div>
      <PageHeader title={title}/>
      <Card style={{padding:40,textAlign:"center",border:`2px dashed ${L.border}`}}>
        <div style={{fontSize:48,marginBottom:12}}>{icon}</div>
        <div style={{fontSize:16,fontWeight:700,color:L.text,marginBottom:6}}>{title}</div>
        <div style={{fontSize:13,color:L.textSm,maxWidth:400,margin:"0 auto",lineHeight:1.6}}>{desc}</div>
        {comingSoon&&<div style={{marginTop:16,display:"inline-block",background:L.orangeBg,color:L.orange,borderRadius:8,padding:"5px 14px",fontSize:11,fontWeight:700}}>Disponible dans la version complète</div>}
      </Card>
    </div>
  );
}


// ─── APP PRINCIPALE ────────────────────────────────────────────────────────────
export default function App(){
  const [onboardingDone,setOnboardingDone]=useState(false);
  const [entreprise,setEntreprise]=useState(ENTREPRISE_EXEMPLE);
  const [statut,setStatut]=useState("sarl");
  const [chantiers,setChantiers]=useState(CHANTIERS_EXEMPLE);
  const [documents,setDocuments]=useState(DOCUMENTS_EXEMPLE);
  const [selectedChantier,setSelectedChantier]=useState(1);
  const [mainView,setMainView]=useState("accueil");
  const [showSettings,setShowSettings]=useState(false);
  const [notif,setNotif]=useState(null);

  function showNotif(msg,type="success"){setNotif({msg,type});setTimeout(()=>setNotif(null),3000);}

  const s=STATUTS[statut];
  const modules=s?.modules||STATUTS.sarl.modules;

  function handleOnboardingComplete(data){
    setEntreprise({
      nom:data.nom||"Mon Entreprise",
      nomCourt:data.nom?.split(" ").slice(0,2).join(" ")||"Mon Entreprise",
      siret:data.siret||"",
      adresse:"",
      tel:data.tel||"",
      email:data.email||"",
      activite:data.activite||"Rénovation générale",
      nbEmployes:data.nbEmployes||"1-5",
    });
    setStatut(data.statut||"sarl");
    setOnboardingDone(true);
  }

  if(!onboardingDone){
    return <Onboarding onComplete={handleOnboardingComplete}/>;
  }

  // Garde la vue active accessible selon modules
  const activeView=modules.includes(mainView)?mainView:"accueil";

  return(
    <div style={{minHeight:"100vh",background:L.bg,color:L.text,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",display:"flex"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus,textarea:focus{border-color:${L.accent}!important;outline:none;box-shadow:0 0 0 3px ${L.accent}18;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${L.borderMd};border-radius:10px;}
        button{font-family:inherit;}
        @media print{.no-print{display:none!important;}}
      `}</style>

      {/* Notification */}
      {notif&&<Notif msg={notif.msg} type={notif.type} onClose={()=>setNotif(null)}/>}

      {/* Sidebar */}
      <div className="no-print">
        <Sidebar
          modules={modules}
          activeView={activeView}
          onNav={v=>setMainView(v)}
          entreprise={entreprise}
          statut={statut}
          onSettings={()=>setShowSettings(true)}
        />
      </div>

      {/* Contenu principal */}
      <div style={{flex:1,overflowY:"auto",padding:activeView==="chantiers"?0:28,display:"flex",flexDirection:"column"}}>

        {activeView==="accueil"&&(
          <Accueil chantiers={chantiers} documents={documents} entreprise={entreprise} statut={statut} onNav={v=>setMainView(v)}/>
        )}

        {activeView==="chantiers"&&(
          <VueChantiers
            chantiers={chantiers} setChantiers={setChantiers}
            selected={selectedChantier} setSelected={setSelectedChantier}
            statut={statut} documents={documents}
          />
        )}

        {(activeView==="devis"||activeView==="factures")&&(
          <VueDevis
            documents={documents} setDocuments={setDocuments}
            chantiers={chantiers} statut={statut} entreprise={entreprise}
          />
        )}

        {activeView==="compta"&&(
          <VueCompta chantiers={chantiers} statut={statut}/>
        )}

        {activeView==="frais"&&<VueFrais/>}

        {activeView==="assistant"&&(
          <VueAssistant entreprise={entreprise} statut={statut} chantiers={chantiers}/>
        )}

        {activeView==="equipe"&&(
          <VuePlaceholder title="Gestion de l'équipe" icon="👷" desc="Gérez vos salariés, leurs taux horaires, qualifications et affectations aux chantiers." comingSoon/>
        )}

        {activeView==="planning"&&(
          <VuePlaceholder title="Planning global" icon="📅" desc="Vue Gantt multi-chantiers, gestion des équipes par jour et suivi des heures." comingSoon/>
        )}

        {activeView==="coefficients"&&(
          <VuePlaceholder title="Coefficients & Rentabilité" icon="🧮" desc="Calculez automatiquement votre coefficient de frais généraux depuis vos charges fixes réelles." comingSoon/>
        )}

        {activeView==="prix"&&(
          <VuePlaceholder title="Prix de référence BTP" icon="📚" desc="Consultez les prix Artiprix / Batiprix 2025 pour comparer vos tarifs au marché." comingSoon/>
        )}

        {activeView==="connecteurs"&&(
          <VuePlaceholder title="Qonto & Pennylane" icon="🔗" desc="Synchronisez vos transactions bancaires Qonto et votre comptabilité Pennylane." comingSoon/>
        )}

        {activeView==="import"&&(
          <VuePlaceholder title="Import PDF" icon="📤" desc="L'IA analyse vos devis PDF et crée automatiquement le chantier correspondant." comingSoon/>
        )}
      </div>

      {/* Paramètres */}
      {showSettings&&(
        <VueParametres
          entreprise={entreprise} setEntreprise={setEntreprise}
          statut={statut} setStatut={setStatut}
          onClose={()=>setShowSettings(false)}
        />
      )}
    </div>
  );
}
