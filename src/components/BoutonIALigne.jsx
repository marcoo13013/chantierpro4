import{useState}from"react";
import{estimerLigne,genererDesignations}from"../lib/iaDevis";
const S={blue:"#2563EB",green:"#16A34A",orange:"#D97706",red:"#DC2626",gray:"#6B7280",border:"#E2E8F0",bg:"#F8FAFC",text:"#0F172A",sm:"#64748B"};
const UNITES=["U","ENS","F","M2","M3","ML","H","KG","T","L","M","forfait"];
export default function BoutonIALigne({ligne,onResult,onLibelle}){
  const[open,setOpen]=useState(false);
  const[loading,setLoading]=useState(false);
  const[ecoute,setEcoute]=useState(false);
  const[result,setResult]=useState(null);
  const[choix,setChoix]=useState("moyen");
  const[coeffMO,setCoeffMO]=useState(1.5);
  const[coeffFourn,setCoeffFourn]=useState(1.3);
  const[libelle,setLibelle]=useState(ligne.libelle||"");
  const[hMO,setHMO]=useState(null);
  const[nbOuv,setNbOuv]=useState(null);
  const[fourns,setFourns]=useState(null);
  const[desigs,setDesigs]=useState(null);const[desigChoix,setDesigChoix]=useState("detaillee");const[loadDesig,setLoadDesig]=useState(false);

  function recalc(h,nb,fs,cm,cf){
    if(!result)return;
    const heures=h??hMO??result.heuresMO;
    const ouvriers=nb??nbOuv??result.nbOuvriers;
    const fourn=fs??fourns??result.fournitures;
    const qteTotal=ligne.qte||1;const totalMO=+(heures*qteTotal*(cm??coeffMO)*35).toFixed(2);
    const totalAchat=+fourn.reduce((a,f)=>a+(+(f.prixAchat||0)*(+(f.qte||1))),0).toFixed(2);
    const totalVente=+fourn.reduce((a,f)=>a+(+(f.prixVente||f.prixAchat*(cf??coeffFourn)||0)*(+(f.qte||1))),0).toFixed(2);
    const base=totalMO+totalVente;
    const newPrix={
      bas:{puHT:+(base/(1-0.30)).toFixed(2),marge:30,label:"Compétitif"},
      moyen:{puHT:+(base/(1-0.40)).toFixed(2),marge:40,label:"Marché"},
      haut:{puHT:+(base/(1-0.50)).toFixed(2),marge:50,label:"Premium"}
    };
    setResult(r=>({...r,heuresMO:heures,nbOuvriers:ouvriers,totalMO,fournitures:fourn,totalAchatFourn:totalAchat,totalVenteFourn:totalVente,prix:newPrix}));
    if(h!==null)setHMO(heures);
    if(nb!==null)setNbOuv(ouvriers);
    if(fs!==null)setFourns(fourn);
  }

  function updFourn(i,field,val){
    const fs=[...(fourns??result.fournitures)];
    fs[i]={...fs[i],[field]:field==="prixAchat"||field==="prixVente"||field==="qte"?+val:val};
    if(field==="prixAchat")fs[i].prixVente=+(+val*coeffFourn).toFixed(2);
    setFourns(fs);
    recalc(null,null,fs,null,null);
  }

  function delFourn(i){
    const fs=(fourns??result.fournitures).filter((_,j)=>j!==i);
    setFourns(fs);
    recalc(null,null,fs,null,null);
  }

  function addFourn(){
    const fs=[...(fourns??result.fournitures),{fournisseur:"Point P",designation:"",qte:1,unite:"U",prixAchat:0,prixVente:0}];
    setFourns(fs);
    recalc(null,null,fs,null,null);
  }

  async function lancer(lib){
    if(!lib||lib.trim()==="")return;
    setLoading(true);setResult(null);setFourns(null);setHMO(null);setNbOuv(null);
    try{
      const r=await estimerLigne(lib,ligne.qte||1,ligne.unite||"U",0,coeffMO,coeffFourn);
      setResult(r);setFourns(r.fournitures);setHMO(r.heuresMO);setNbOuv(r.nbOuvriers);
      setLoadDesig(true);genererDesignations(lib,ligne.qte||1,ligne.unite||"U").then(d=>{setDesigs(d);setLoadDesig(false);}).catch(()=>setLoadDesig(false));
    }catch(e){alert("Erreur IA : "+e.message);}
    setLoading(false);
  }

  function micro(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Micro non supporté");return;}
    const rec=new SR();
    rec.lang="fr-FR";rec.interimResults=false;
    rec.onstart=()=>setEcoute(true);
    rec.onend=()=>setEcoute(false);
    rec.onresult=e=>{const txt=e.results[0][0].transcript;setLibelle(txt);if(onLibelle)onLibelle(txt);setOpen(true);lancer(txt);};
    rec.onerror=()=>setEcoute(false);
    rec.start();
  }

  function appliquer(){
    if(!result)return;
    const p=result.prix[choix];
    onResult({...result,fournitures:fourns??result.fournitures,heuresMO:hMO??result.heuresMO,nbOuvriers:nbOuv??result.nbOuvriers,puHT:p.puHT,totalHT:+(p.puHT*(ligne.qte||1)).toFixed(2),margeChoisie:p.marge,labelChoix:p.label});
    setOpen(false);setResult(null);setFourns(null);
  }

  const foursAff=fourns??(result?.fournitures??[]);
  const inp={padding:"4px 6px",border:`1px solid ${S.border}`,borderRadius:4,fontSize:12,outline:"none"};

  return(
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setOpen(true)} disabled={loading}
        style={{background:ecoute?"#DC2626":loading?"#94A3B8":result?"#16A34A":"#2563EB",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:loading?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
        {ecoute?"🔴":loading?"⏳":result?"✅ IA OK":"🚀 IA"}
      </button>

      {open&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget){setOpen(false);}}}>
        <div style={{background:"#fff",borderRadius:12,padding:24,width:620,maxWidth:"95vw",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <strong style={{fontSize:15}}>🤖 Estimation IA</strong>
            <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:S.sm}}>✕</button>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:700,marginBottom:6,fontSize:13}}>📝 Désignation</div>
            <div style={{display:"flex",gap:6}}>
              <input value={libelle} onChange={e=>setLibelle(e.target.value)} placeholder="Ex: Fourniture et pose receveur douche 120/90..." style={{...inp,flex:1,padding:"8px 10px",fontSize:13}}/>
              <button onClick={()=>micro()} style={{background:ecoute?"#DC2626":"#6B7280",color:"#fff",border:"none",borderRadius:6,padding:"8px 10px",cursor:"pointer"}}>{ecoute?"🔴":"🎤"}</button>
              <button onClick={()=>lancer(libelle)} disabled={!libelle||loading} style={{background:"#7C3AED",color:"#fff",border:"none",borderRadius:6,padding:"8px 12px",cursor:"pointer",fontSize:12}}>✨ Estimer</button>
            </div>
          </div>

          <div style={{background:S.bg,borderRadius:8,padding:10,marginBottom:12,fontSize:12}}>
            <div style={{fontWeight:700,marginBottom:6}}>⚙️ Coefficients</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div><div style={{color:S.sm,marginBottom:3}}>Coeff MO</div><div style={{display:"flex",gap:3}}>{[1.3,1.5,1.7,2.0].map(v=><button key={v} onClick={()=>{setCoeffMO(v);recalc(null,null,null,v,null);}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${coeffMO===v?S.blue:S.border}`,background:coeffMO===v?S.blue:"#fff",color:coeffMO===v?"#fff":S.text,cursor:"pointer",fontSize:11}}>×{v}</button>)}</div></div>
              <div><div style={{color:S.sm,marginBottom:3}}>Coeff fournitures</div><div style={{display:"flex",gap:3}}>{[1.2,1.3,1.4,1.5].map(v=><button key={v} onClick={()=>{setCoeffFourn(v);recalc(null,null,null,null,v);}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${coeffFourn===v?S.orange:S.border}`,background:coeffFourn===v?S.orange:"#fff",color:coeffFourn===v?"#fff":S.text,cursor:"pointer",fontSize:11}}>×{v}</button>)}</div></div>
            </div>
          </div>

          {loading&&<div style={{textAlign:"center",padding:24,color:S.sm}}>⏳ L'IA calcule...</div>}

          {result&&<>
            <div style={{background:"#EFF6FF",borderRadius:8,padding:10,marginBottom:10,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:6,color:S.blue}}>🔧 Main d'oeuvre</div>
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <div><span style={{color:S.sm}}>Heures </span><input type="number" value={hMO??result.heuresMO} onChange={e=>{setHMO(+e.target.value);recalc(+e.target.value,null,null,null,null);}} style={{...inp,width:55,textAlign:"center"}}/><span style={{color:S.sm}}> h</span></div>
                <div><span style={{color:S.sm}}>Ouvriers </span><input type="number" value={nbOuv??result.nbOuvriers} onChange={e=>{setNbOuv(+e.target.value);recalc(null,+e.target.value,null,null,null);}} style={{...inp,width:45,textAlign:"center"}}/></div>
                <div><span style={{color:S.sm}}>Taux </span><strong>35€/h</strong></div>
                <div><span style={{color:S.sm}}>Coût MO </span><strong style={{color:S.blue}}>{result.totalMO?.toFixed(2)} €</strong></div>
              </div>
            </div>

            <div style={{background:"#FFF7ED",borderRadius:8,padding:10,marginBottom:10,fontSize:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontWeight:700,color:S.orange}}>📦 Fournitures</div>
                <button onClick={addFourn} style={{background:S.green,color:"#fff",border:"none",borderRadius:4,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>+ Article</button>
              </div>
              {foursAff.map((f,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr 45px 60px 65px 65px 24px",gap:4,alignItems:"center",marginBottom:4,padding:"4px 0",borderBottom:`1px solid ${S.border}`}}>
                <select value={f.fournisseur} onChange={e=>updFourn(i,"fournisseur",e.target.value)} style={{...inp,fontSize:10}}>
                  {["Point P","Gedimat","Kiloutou","Leroy Merlin","Brico Dépôt","Autre"].map(v=><option key={v}>{v}</option>)}
                </select>
                <input value={f.designation} onChange={e=>updFourn(i,"designation",e.target.value)} style={{...inp,width:"100%"}}/>
                <input type="number" value={f.qte} onChange={e=>updFourn(i,"qte",e.target.value)} style={{...inp,textAlign:"center"}}/>
                <select value={f.unite} onChange={e=>updFourn(i,"unite",e.target.value)} style={{...inp}}>
                  {UNITES.map(u=><option key={u}>{u}</option>)}
                </select>
                <input type="number" value={f.prixAchat} onChange={e=>updFourn(i,"prixAchat",e.target.value)} placeholder="Achat" style={{...inp,textAlign:"right"}}/>
                <input type="number" value={f.prixVente} onChange={e=>updFourn(i,"prixVente",e.target.value)} placeholder="Vente" style={{...inp,textAlign:"right",color:S.orange}}/>
                <button onClick={()=>delFourn(i)} style={{background:"none",border:"none",color:S.red,cursor:"pointer",fontSize:14}}>×</button>
              </div>)}
              <div style={{display:"flex",justifyContent:"flex-end",gap:16,marginTop:6,fontWeight:700,fontSize:12}}>
                <span>Achat : <span style={{color:S.sm}}>{result.totalAchatFourn?.toFixed(2)} €</span></span>
                <span>Vente : <span style={{color:S.orange}}>{result.totalVenteFourn?.toFixed(2)} €</span></span>
              </div>
            </div>

            <div style={{background:"#F0FDF4",borderRadius:8,padding:10,marginBottom:12,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:8,color:S.green}}>💰 Prix de vente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {Object.entries(result.prix||{}).map(([k,p])=><button key={k} onClick={()=>setChoix(k)} style={{padding:"10px 6px",borderRadius:8,border:`2px solid ${choix===k?S.green:S.border}`,background:choix===k?"#DCFCE7":"#fff",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:10,color:S.sm}}>{p.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:choix===k?S.green:S.text}}>{p.puHT?.toFixed(2)} €</div>
                  <div style={{fontSize:10,color:S.sm}}>Marge {p.marge}%</div>
                </button>)}
              </div>
            </div>

            {(desigs||loadDesig)&&<div style={{background:"#F5F3FF",borderRadius:8,padding:10,marginBottom:10,fontSize:12}}><div style={{fontWeight:700,marginBottom:6,color:"#7C3AED"}}>📝 Désignation professionnelle</div>{loadDesig&&<div style={{color:S.sm}}>⏳ Génération en cours...</div>}{desigs&&<><div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>{["courte","detaillee","technique","commerciale"].map(k=><button key={k} onClick={()=>setDesigChoix(k)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${desigChoix===k?"#7C3AED":S.border}`,background:desigChoix===k?"#7C3AED":"#fff",color:desigChoix===k?"#fff":S.text,cursor:"pointer",fontSize:11,textTransform:"capitalize"}}>{k}</button>)}</div><div style={{background:"#fff",border:`1px solid #DDD6FE`,borderRadius:6,padding:8,fontSize:12,lineHeight:1.5,marginBottom:6}}>{desigs[desigChoix]}</div><button onClick={()=>{if(onLibelle)onLibelle(desigs[desigChoix]);setLibelle(desigs[desigChoix]);}} style={{background:"#7C3AED",color:"#fff",border:"none",borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✓ Utiliser cette désignation</button></>}</div>}
            {result.commentaire&&<div style={{background:"#FFFBEB",border:`1px solid #FDE68A`,borderRadius:6,padding:8,fontSize:11,color:"#92400E",marginBottom:12}}>💡 {result.commentaire}</div>}

            <button onClick={appliquer} style={{width:"100%",padding:"10px",background:S.green,color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer"}}>
              ✓ Appliquer — {result.prix?.[choix]?.puHT?.toFixed(2)} € HT ({result.prix?.[choix]?.label})
            </button>
          </>}
        </div>
      </div>}
    </div>
  );
}
