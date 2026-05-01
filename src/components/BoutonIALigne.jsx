import{useState}from"react";
import{estimerLigne}from"../lib/iaDevis";
const S={blue:"#2563EB",green:"#16A34A",orange:"#D97706",red:"#DC2626",gray:"#6B7280",border:"#E2E8F0",bg:"#F8FAFC",text:"#0F172A",sm:"#64748B"};
export default function BoutonIALigne({ligne,onResult,onLibelle}){
  const[open,setOpen]=useState(false);
  const[loading,setLoading]=useState(false);
  const[ecoute,setEcoute]=useState(false);
  const[result,setResult]=useState(null);
  const[choix,setChoix]=useState("moyen");
  const[coeffMO,setCoeffMO]=useState(1.5);
  const[coeffFourn,setCoeffFourn]=useState(1.3);
  const[libelle,setLibelle]=useState(ligne.libelle||"");

  async function lancer(lib){
    if(!lib||lib.trim()==="")return;
    setLoading(true);setResult(null);
    try{
      const r=await estimerLigne(lib,ligne.qte||1,ligne.unite||"U",0,coeffMO,coeffFourn);
      setResult(r);
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
    rec.onresult=e=>{
      const txt=e.results[0][0].transcript;
      setLibelle(txt);
      if(onLibelle)onLibelle(txt);
      setOpen(true);
      lancer(txt);
    };
    rec.onerror=()=>setEcoute(false);
    rec.start();
  }

  function appliquer(){
    if(!result)return;
    const p=result.prix[choix];
    onResult({...result,puHT:p.puHT,totalHT:+(p.puHT*(ligne.qte||1)).toFixed(2),margeChoisie:p.marge,labelChoix:p.label});
    setOpen(false);setResult(null);
  }

  return(
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>{if(ecoute)return;micro();}} disabled={loading}
        title="Dicter ou estimer avec l'IA"
        style={{background:ecoute?"#DC2626":loading?"#94A3B8":result?"#16A34A":"#2563EB",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:loading?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
        {ecoute?"🔴 Écoute...":loading?"⏳...":result?"✅ IA OK":"🎤 IA"}
      </button>
      {open&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget){setOpen(false);setResult(null);}}}>
        <div style={{background:"#fff",borderRadius:12,padding:24,width:560,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <strong style={{fontSize:15}}>🤖 Estimation IA — Détail complet</strong>
            <button onClick={()=>{setOpen(false);setResult(null);}} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:S.sm}}>✕</button>
          </div>

          <div style={{background:S.bg,borderRadius:8,padding:12,marginBottom:16,fontSize:12}}>
            <div style={{fontWeight:700,color:S.text,marginBottom:8}}>⚙️ Coefficients de calcul</div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
              <div>
                <div style={{color:S.sm,marginBottom:4}}>Coeff MO (charges + bénéfice)</div>
                <div style={{display:"flex",gap:4}}>
                  {[1.3,1.5,1.7,2.0].map(v=><button key={v} onClick={()=>setCoeffMO(v)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${coeffMO===v?S.blue:S.border}`,background:coeffMO===v?S.blue:"#fff",color:coeffMO===v?"#fff":S.text,cursor:"pointer",fontSize:11,fontWeight:coeffMO===v?700:400}}>×{v}</button>)}
                </div>
              </div>
              <div>
                <div style={{color:S.sm,marginBottom:4}}>Coeff fournitures (achat → vente)</div>
                <div style={{display:"flex",gap:4}}>
                  {[1.2,1.3,1.4,1.5].map(v=><button key={v} onClick={()=>setCoeffFourn(v)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${coeffFourn===v?S.orange:S.border}`,background:coeffFourn===v?S.orange:"#fff",color:coeffFourn===v?"#fff":S.text,cursor:"pointer",fontSize:11,fontWeight:coeffFourn===v?700:400}}>×{v}</button>)}
                </div>
              </div>
            </div>
            {result&&<button onClick={()=>lancer(libelle||ligne.libelle)} style={{marginTop:10,padding:"4px 12px",background:"#7C3AED",color:"#fff",border:"none",borderRadius:6,fontSize:11,cursor:"pointer"}}>🔄 Recalculer avec ces coefficients</button>}
          </div>

          {loading&&<div style={{textAlign:"center",padding:24,color:S.sm}}>⏳ L'IA calcule...</div>}

          {result&&<>
            <div style={{background:"#EFF6FF",borderRadius:8,padding:12,marginBottom:12,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:8,color:S.blue}}>🔧 Main d'oeuvre</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                <div><span style={{color:S.sm}}>Heures estimées</span><br/><strong>{result.heuresMO}h</strong></div>
                <div><span style={{color:S.sm}}>Nb ouvriers</span><br/><strong>{result.nbOuvriers}</strong></div>
                <div><span style={{color:S.sm}}>Coût MO (×{coeffMO})</span><br/><strong style={{color:S.blue}}>{result.totalMO?.toFixed(2)} €</strong></div>
              </div>
            </div>

            <div style={{background:"#FFF7ED",borderRadius:8,padding:12,marginBottom:12,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:8,color:S.orange}}>📦 Fournitures détaillées</div>
              {result.fournitures?.map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${S.border}`}}>
                <div><span style={{fontWeight:600,color:S.sm,fontSize:10,marginRight:6}}>{f.fournisseur}</span>{f.designation}</div>
                <div style={{textAlign:"right",whiteSpace:"nowrap",marginLeft:8}}>
                  <span style={{color:S.sm}}>{f.qte} {f.unite} × {f.prixAchat?.toFixed(2)}€</span>
                  <span style={{marginLeft:6,fontWeight:700,color:S.orange}}>→ {f.prixVente?.toFixed(2)} €</span>
                </div>
              </div>)}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontWeight:700}}>
                <span>Total achat / vente</span>
                <span><span style={{color:S.sm}}>{result.totalAchatFourn?.toFixed(2)} €</span> → <span style={{color:S.orange}}>{result.totalVenteFourn?.toFixed(2)} €</span></span>
              </div>
            </div>

            <div style={{background:"#F0FDF4",borderRadius:8,padding:12,marginBottom:16,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:8,color:S.green}}>💰 Choix du prix de vente</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {Object.entries(result.prix||{}).map(([k,p])=><button key={k} onClick={()=>setChoix(k)} style={{padding:"10px 6px",borderRadius:8,border:`2px solid ${choix===k?S.green:S.border}`,background:choix===k?"#DCFCE7":"#fff",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:10,color:S.sm,marginBottom:2}}>{p.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:choix===k?S.green:S.text}}>{p.puHT?.toFixed(2)} €</div>
                  <div style={{fontSize:10,color:S.sm}}>Marge {p.marge}%</div>
                </button>)}
              </div>
            </div>

            {result.commentaire&&<div style={{background:"#FFFBEB",border:`1px solid #FDE68A`,borderRadius:6,padding:8,fontSize:11,color:"#92400E",marginBottom:12}}>💡 {result.commentaire}</div>}

            <button onClick={appliquer} style={{width:"100%",padding:"10px",background:S.green,color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer"}}>
              ✓ Appliquer le prix {result.prix?.[choix]?.label} — {result.prix?.[choix]?.puHT?.toFixed(2)} € HT
            </button>
          </>}
        </div>
      </div>}
    </div>
  );
}
