import { useState } from "react";
import BoutonIALigne from "./BoutonIALigne";
const S={blue:"#2563EB",green:"#16A34A",orange:"#D97706",red:"#DC2626",border:"#E2E8F0",text:"#0F172A",textSm:"#64748B",surface:"#FFFFFF",bg:"#F4F6F9"};
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
export default function VueDevisDetail({devis,onClose,onSave}){
  const [tranches,setTranches]=useState(devis.tranches||[]);
  function updLigne(tId,li,upd){setTranches(tranches.map(t=>t.id!==tId?t:{...t,lignes:t.lignes.map((l,i)=>i===li?upd:l),sousTotalHT:+t.lignes.reduce((a,l,i)=>a+(i===li?upd.totalHT:l.totalHT||0),0).toFixed(2)}));}
  const totHT=+tranches.reduce((a,t)=>a+(+t.sousTotalHT||0),0).toFixed(2);
  const totTTC=+(totHT*1.2).toFixed(2);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflowY:"auto",padding:"20px 0"}}>
      <div style={{background:S.surface,borderRadius:12,width:"95%",maxWidth:800,margin:"auto"}}>
        <div style={{padding:"20px 24px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:18,fontWeight:700}}>{devis.numero} — {devis.client}</div><div style={{fontSize:13,color:S.textSm}}>{devis.objet||""}</div></div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>onSave({...devis,tranches,totalHT:totHT,totalTTC:totTTC})} style={{background:S.green,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer"}}>💾 Sauvegarder</button>
            <button onClick={onClose} style={{background:S.red,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,cursor:"pointer"}}>✕ Fermer</button>
          </div>
        </div>
        <div style={{padding:"16px 24px"}}>
          {tranches.map(t=>(
            <div key={t.id} style={{marginBottom:16,border:`1px solid ${S.border}`,borderRadius:8,overflow:"hidden"}}>
              <div style={{background:S.bg,padding:"8px 12px",display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:13}}>{t.titre}</span><span style={{fontWeight:700,fontSize:13,color:S.blue}}>{(+t.sousTotalHT||0).toFixed(2)} €</span></div>
              {(t.lignes||[]).map((l,i)=><Ligne key={i} l={l} onChange={u=>updLigne(t.id,i,u)}/>)}
            </div>
          ))}
        </div>
        <div style={{padding:"16px 24px",borderTop:`1px solid ${S.border}`,display:"flex",justifyContent:"flex-end",gap:24}}>
          <div style={{textAlign:"right"}}><div style={{fontSize:13,color:S.textSm}}>Total HT</div><div style={{fontSize:20,fontWeight:700}}>{totHT.toFixed(2)} €</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:13,color:S.textSm}}>Total TTC</div><div style={{fontSize:20,fontWeight:700,color:S.blue}}>{totTTC.toFixed(2)} €</div></div>
        </div>
      </div>
    </div>
  );
}
