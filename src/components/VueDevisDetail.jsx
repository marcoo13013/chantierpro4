import { useState } from "react";
import BoutonIALigne from "./BoutonIALigne";
const S={blue:"#2563EB",navy:"#1B3A5C",navyBg:"#EEF3F8",green:"#16A34A",orange:"#D97706",red:"#DC2626",border:"#E2E8F0",borderMd:"#CBD5E1",text:"#0F172A",textSm:"#64748B",textXs:"#94A3B8",surface:"#FFFFFF",bg:"#F4F6F9"};

// ─── ANCIEN FORMAT (tranches) ─────────────────────────────────────────────────
function Ligne({l,onChange}){
  const [edit,setEdit]=useState(false);
  const [d,setD]=useState(l);
  function upd(f,v){const n={...d,[f]:v};if(f==="qte"||f==="puHT")n.totalHT=+(n.qte*n.puHT).toFixed(2);setD(n);onChange(n);}
  function iaOk(r){const n={...d,puHT:r.puHT||d.puHT,heuresPrevues:r.heuresMO,fournitures:r.fournitures,totalHT:+((r.puHT||d.puHT)*d.qte).toFixed(2)};setD(n);onChange(n);}
  return(
    <div style={{borderBottom:`1px solid ${S.border}`,padding:"10px 12px"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {edit?<input value={d.libelle} onChange={e=>upd("libelle",e.target.value)} style={{flex:2,border:`1px solid ${S.blue}`,borderRadius:4,padding:"4px 8px",fontSize:13}}/>:<span style={{flex:2,fontSize:13}}>{d.libelle}</span>}
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {edit?<><input type="number" value={d.qte} onChange={e=>upd("qte",+e.target.value)} style={{width:60,border:`1px solid ${S.blue}`,borderRadius:4,padding:"4px 6px",fontSize:13}}/><span style={{fontSize:12}}>{d.unite}</span><input type="number" value={d.puHT} onChange={e=>upd("puHT",+e.target.value)} style={{width:80,border:`1px solid ${S.blue}`,borderRadius:4,padding:"4px 6px",fontSize:13}}/><span style={{fontSize:12}}>€/u</span></>:<><span style={{fontSize:12,color:S.textSm}}>{d.qte} {d.unite}</span><span style={{fontSize:13,fontWeight:600}}>{d.puHT} €</span></>}
          <span style={{fontSize:13,fontWeight:700,color:S.blue,minWidth:80,textAlign:"right"}}>{(+d.totalHT||0).toFixed(2)} €</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          <BoutonIALigne ligne={d} onResult={iaOk}/>
          <button onClick={()=>setEdit(!edit)} style={{background:edit?S.green:S.orange,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>{edit?"✓ OK":"✏️"}</button>
        </div>
      </div>
      {d.heuresPrevues>0&&<div style={{marginTop:6,fontSize:12,color:S.textSm}}>🔧 MO : {edit?<input type="number" value={d.heuresPrevues} onChange={e=>upd("heuresPrevues",+e.target.value)} style={{width:50,border:`1px solid ${S.border}`,borderRadius:4,padding:"2px 4px",fontSize:12}}/>:d.heuresPrevues}h × 35€ = <strong>{(d.heuresPrevues*35).toFixed(2)} €</strong></div>}
      {d.fournitures&&d.fournitures.length>0&&<div style={{marginTop:6}}>{d.fournitures.map((f,i)=><div key={i} style={{display:"flex",gap:8,fontSize:12,color:S.textSm,marginTop:2}}><span style={{minWidth:80,fontWeight:600}}>{f.fournisseur}</span><span>{f.designation}</span>{edit?<input type="number" value={f.prixAchat} onChange={e=>{const fs=[...d.fournitures];fs[i]={...f,prixAchat:+e.target.value};upd("fournitures",fs);}} style={{width:70,border:`1px solid ${S.border}`,borderRadius:4,padding:"2px 4px",fontSize:12}}/>:<span style={{fontWeight:600,color:S.blue}}>{(+f.prixAchat||0).toFixed(2)} €</span>}</div>)}</div>}
    </div>
  );
}

function VueDevisDetailTranches({devis,onClose,onSave,header}){
  const [tranches,setTranches]=useState(devis.tranches||[]);
  function updLigne(tId,li,upd){setTranches(tranches.map(t=>t.id!==tId?t:{...t,lignes:t.lignes.map((l,i)=>i===li?upd:l),sousTotalHT:+t.lignes.reduce((a,l,i)=>a+(i===li?upd.totalHT:l.totalHT||0),0).toFixed(2)}));}
  const totHT=+tranches.reduce((a,t)=>a+(+t.sousTotalHT||0),0).toFixed(2);
  const totTTC=+(totHT*1.2).toFixed(2);
  return(
    <Shell onClose={onClose}>
      <Header devis={devis} actions={
        <>
          <button onClick={()=>onSave({...devis,tranches,totalHT:totHT,totalTTC:totTTC})} style={{background:S.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer"}}>💾 Sauvegarder</button>
          <button onClick={onClose} style={{background:S.red,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer"}}>✕ Fermer</button>
        </>
      }/>
      <div style={{padding:"16px 24px"}}>
        {tranches.map(t=>(
          <div key={t.id} style={{marginBottom:16,border:`1px solid ${S.border}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{background:S.bg,padding:"8px 12px",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:13}}>{t.titre}</span><span style={{fontWeight:700,fontSize:13,color:S.blue}}>{(+t.sousTotalHT||0).toFixed(2)} €</span></div>
            {(t.lignes||[]).map((l,i)=><Ligne key={i} l={l} onChange={u=>updLigne(t.id,i,u)}/>)}
          </div>
        ))}
      </div>
      <Totaux totHT={totHT} totTTC={totTTC}/>
    </Shell>
  );
}

// ─── NOUVEAU FORMAT (lignes plates avec type titre/soustitre/ligne) ──────────
function isLigneItem(it){return !it?.type||it.type==="ligne";}
function calcFlatSubtotals(items){
  const titreSubs={},sousTitreSubs={};
  let curT=null,curST=null;
  for(const it of items||[]){
    if(it.type==="titre"){curT=it.id;curST=null;if(!(it.id in titreSubs))titreSubs[it.id]=0;}
    else if(it.type==="soustitre"){curST=it.id;if(!(it.id in sousTitreSubs))sousTitreSubs[it.id]=0;}
    else{
      const ht=(+it.qte||0)*(+(it.prixUnitHT??it.puHT)||0);
      if(curT!=null)titreSubs[curT]=(titreSubs[curT]||0)+ht;
      if(curST!=null)sousTitreSubs[curST]=(sousTitreSubs[curST]||0)+ht;
    }
  }
  return{titreSubs,sousTitreSubs};
}

function VueDevisDetailFlat({devis,onClose}){
  const items=devis.lignes||[];
  const {titreSubs,sousTitreSubs}=calcFlatSubtotals(items);
  const lignes=items.filter(isLigneItem);
  const totHT=+lignes.reduce((a,l)=>a+(+l.qte||0)*(+(l.prixUnitHT??l.puHT)||0),0).toFixed(2);
  const totTVA=+lignes.reduce((a,l)=>a+(+l.qte||0)*(+(l.prixUnitHT??l.puHT)||0)*((+l.tva||0)/100),0).toFixed(2);
  const totTTC=+(totHT+totTVA).toFixed(2);
  return(
    <Shell onClose={onClose}>
      <Header devis={devis} actions={
        <button onClick={onClose} style={{background:S.red,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer"}}>✕ Fermer</button>
      }/>
      <div style={{padding:"16px 24px"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:S.bg}}>
              {["Désignation","Qté","U","P.U. HT","TVA","Total HT"].map(h=>
                <th key={h} style={{textAlign:"left",padding:"8px 10px",fontSize:10,color:S.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${S.border}`}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((it,i)=>{
              if(it.type==="titre"){
                const sub=titreSubs[it.id]||0;
                return(
                  <tr key={it.id||i} style={{background:S.navy}}>
                    <td colSpan={5} style={{padding:"9px 10px",color:"#fff",fontSize:13,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase"}}>{it.libelle||"Titre"}</td>
                    <td style={{padding:"9px 10px",color:"#fff",fontSize:13,fontWeight:800,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{sub.toFixed(2)} €</td>
                  </tr>
                );
              }
              if(it.type==="soustitre"){
                const sub=sousTitreSubs[it.id]||0;
                return(
                  <tr key={it.id||i} style={{background:S.navyBg,borderBottom:`1px solid ${S.border}`}}>
                    <td colSpan={5} style={{padding:"7px 10px 7px 22px",color:S.navy,fontSize:12,fontWeight:700}}>{it.libelle||"Sous-titre"}</td>
                    <td style={{padding:"7px 10px",color:S.navy,fontSize:12,fontWeight:700,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{sub.toFixed(2)} €</td>
                  </tr>
                );
              }
              const pu=+(it.prixUnitHT??it.puHT)||0;
              const qte=+it.qte||0;
              const lineHT=qte*pu;
              return(
                <tr key={it.id||i} style={{borderBottom:`1px solid ${S.border}`,background:i%2===0?S.surface:S.bg,verticalAlign:"top"}}>
                  <td style={{padding:"8px 10px",fontSize:12,whiteSpace:"pre-wrap"}}>{it.libelle||""}</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:S.textSm,fontFamily:"monospace",whiteSpace:"nowrap"}}>{qte}</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:S.textSm}}>{it.unite||""}</td>
                  <td style={{padding:"8px 10px",fontSize:12,fontFamily:"monospace",whiteSpace:"nowrap"}}>{pu.toFixed(2)} €</td>
                  <td style={{padding:"8px 10px",fontSize:12,color:S.textSm,fontFamily:"monospace"}}>{(+it.tva||0)}%</td>
                  <td style={{padding:"8px 10px",fontSize:12,fontWeight:700,color:S.blue,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{lineHT.toFixed(2)} €</td>
                </tr>
              );
            })}
            {items.length===0&&(
              <tr><td colSpan={6} style={{padding:"40px 12px",textAlign:"center",color:S.textXs,fontSize:13}}>Ce devis n'a pas encore de ligne.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Totaux totHT={totHT} totTVA={totTVA} totTTC={totTTC}/>
    </Shell>
  );
}

// ─── COMMUN ───────────────────────────────────────────────────────────────────
function Shell({children,onClose}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:S.surface,borderRadius:12,width:"95%",maxWidth:880,margin:"auto"}}>
        {children}
      </div>
    </div>
  );
}

function Header({devis,actions}){
  return(
    <div style={{padding:"20px 24px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontSize:18,fontWeight:700}}>{devis.numero} — {devis.client}</div>
        {devis.titreChantier&&<div style={{fontSize:13,color:S.text,fontWeight:600,fontStyle:"italic",marginTop:2}}>{devis.titreChantier}</div>}
        {(devis.telClient||devis.emailClient)&&<div style={{fontSize:12,color:S.textSm,marginTop:2}}>{[devis.telClient,devis.emailClient].filter(Boolean).join(" · ")}</div>}
        {devis.objet&&!devis.titreChantier&&<div style={{fontSize:13,color:S.textSm}}>{devis.objet}</div>}
      </div>
      <div style={{display:"flex",gap:8}}>{actions}</div>
    </div>
  );
}

function Totaux({totHT,totTVA,totTTC}){
  return(
    <div style={{padding:"16px 24px",borderTop:`1px solid ${S.border}`,display:"flex",justifyContent:"flex-end",gap:24}}>
      <div style={{textAlign:"right"}}><div style={{fontSize:13,color:S.textSm}}>Total HT</div><div style={{fontSize:20,fontWeight:700}}>{(+totHT||0).toFixed(2)} €</div></div>
      {totTVA!=null&&<div style={{textAlign:"right"}}><div style={{fontSize:13,color:S.textSm}}>TVA</div><div style={{fontSize:20,fontWeight:700,color:S.textSm}}>{(+totTVA||0).toFixed(2)} €</div></div>}
      <div style={{textAlign:"right"}}><div style={{fontSize:13,color:S.textSm}}>Total TTC</div><div style={{fontSize:20,fontWeight:700,color:S.blue}}>{(+totTTC||0).toFixed(2)} €</div></div>
    </div>
  );
}

// ─── ENTRÉE ───────────────────────────────────────────────────────────────────
export default function VueDevisDetail({devis,onClose,onSave}){
  // Détection : si le doc a des `tranches` non vides → ancien format
  // (devis-démo finalisés, structure tranches[].lignes[]).
  // Sinon → nouveau format flat (Mediabat) avec items {type:titre/soustitre/ligne}.
  const hasTranches=Array.isArray(devis.tranches)&&devis.tranches.length>0;
  if(hasTranches)return <VueDevisDetailTranches devis={devis} onClose={onClose} onSave={onSave}/>;
  return <VueDevisDetailFlat devis={devis} onClose={onClose}/>;
}
