import{useState}from"react";
import{estimerLigne,genererDesignations}from"../lib/iaDevis";
const S={blue:"#2563EB",green:"#16A34A",orange:"#D97706",red:"#DC2626",gray:"#6B7280",border:"#E2E8F0",bg:"#F8FAFC",text:"#0F172A",sm:"#64748B",navy:"#1B3A5C",navyBg:"#EEF3F8"};
const UNITES=["U","ENS","F","M2","M3","ML","H","KG","T","L","M","forfait"];
const TAUX_DEFAUT=35;

// Taux horaire chargé moyen pour les salariés sélectionnés (sinon taux par défaut).
function tauxMoyenCharge(salaries,ids){
  if(!ids?.length||!salaries?.length)return TAUX_DEFAUT;
  const ss=ids.map(id=>salaries.find(s=>s.id===id)).filter(Boolean);
  if(!ss.length)return TAUX_DEFAUT;
  return ss.reduce((a,s)=>a+(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0)),0)/ss.length;
}

// Calcul pur du bloc MO + fournitures + 3 prix de vente.
// MO = heures × ouvriers × qte × coeffMO × tauxHoraireChargé
function compute({heures,ouvriers,qte,cm,cf,fourn,taux}){
  const totalMO=+(heures*ouvriers*qte*cm*taux).toFixed(2);
  const totalAchat=+fourn.reduce((a,f)=>a+(+(f.prixAchat||0)*(+(f.qte||1))),0).toFixed(2);
  const totalVente=+fourn.reduce((a,f)=>a+(+(f.prixVente||(f.prixAchat||0)*cf||0)*(+(f.qte||1))),0).toFixed(2);
  const base=totalMO+totalVente;
  const prix={
    bas:{puHT:+(base/(1-0.30)).toFixed(2),marge:30,label:"Compétitif"},
    moyen:{puHT:+(base/(1-0.40)).toFixed(2),marge:40,label:"Marché"},
    haut:{puHT:+(base/(1-0.50)).toFixed(2),marge:50,label:"Premium"}
  };
  return{totalMO,totalAchatFourn:totalAchat,totalVenteFourn:totalVente,prix};
}

export default function BoutonIALigne({ligne,onResult,onLibelle,salaries=[],onSaveOuvrage}){
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
  const[selSalIds,setSelSalIds]=useState(ligne.salariesAssignes||[]);
  const[desigs,setDesigs]=useState(null);const[desigChoix,setDesigChoix]=useState("detaillee");const[loadDesig,setLoadDesig]=useState(false);
  // Désignations éditables : on copie celles générées par l'IA pour permettre
  // à l'utilisateur de les ajuster avant application. La valeur effective est
  // desigsEdited?.[k] si modifiée, sinon desigs[k].
  const[desigsEdited,setDesigsEdited]=useState(null);

  function recalc(h,nb,fs,cm,cf,sids){
    if(!result)return;
    const heures=h??hMO??result.heuresMO;
    const ids=sids??selSalIds;
    const ouvriersAuto=ids.length>0?ids.length:(nbOuv??result.nbOuvriers);
    const ouvriers=nb??ouvriersAuto;
    const fourn=fs??fourns??result.fournitures;
    const qteTotal=ligne.qte||1;
    const taux=tauxMoyenCharge(salaries,ids);
    const r=compute({heures,ouvriers,qte:qteTotal,cm:cm??coeffMO,cf:cf??coeffFourn,fourn,taux});
    setResult(prev=>({...prev,heuresMO:heures,nbOuvriers:ouvriers,fournitures:fourn,tauxHoraireMoyen:+taux.toFixed(2),...r}));
    if(h!==null&&h!==undefined)setHMO(heures);
    if(nb!==null&&nb!==undefined)setNbOuv(ouvriers);
    if(fs!==null&&fs!==undefined)setFourns(fourn);
  }

  function toggleSal(sid){
    const newIds=selSalIds.includes(sid)?selSalIds.filter(x=>x!==sid):[...selSalIds,sid];
    setSelSalIds(newIds);
    if(newIds.length>0)setNbOuv(newIds.length);
    recalc(null,newIds.length>0?newIds.length:null,null,null,null,newIds);
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
      // Recalcule totalMO + prix avec la formule corrigée (× ouvriers) avant d'afficher
      const heures=r.heuresMO||0;
      const ouvriers=selSalIds.length>0?selSalIds.length:(r.nbOuvriers||1);
      const qteTotal=ligne.qte||1;
      const taux=tauxMoyenCharge(salaries,selSalIds);
      const fixed=compute({heures,ouvriers,qte:qteTotal,cm:coeffMO,cf:coeffFourn,fourn:r.fournitures||[],taux});
      const merged={...r,nbOuvriers:ouvriers,tauxHoraireMoyen:+taux.toFixed(2),...fixed};
      setResult(merged);setFourns(r.fournitures);setHMO(r.heuresMO);setNbOuv(ouvriers);
      setLoadDesig(true);setDesigsEdited(null);genererDesignations(lib,ligne.qte||1,ligne.unite||"U").then(d=>{setDesigs(d);setDesigsEdited({...d});setLoadDesig(false);}).catch(()=>setLoadDesig(false));
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
    onResult({...result,fournitures:fourns??result.fournitures,heuresMO:hMO??result.heuresMO,nbOuvriers:nbOuv??result.nbOuvriers,salariesAssignes:selSalIds,tauxHoraireMoyen:result.tauxHoraireMoyen,puHT:p.puHT,totalHT:+(p.puHT*(ligne.qte||1)).toFixed(2),margeChoisie:p.marge,labelChoix:p.label});
    setOpen(false);setResult(null);setFourns(null);
  }

  function sauverOuvrage(){
    if(!result||!onSaveOuvrage)return;
    if(!libelle?.trim()){alert("Renseigne la désignation avant de sauvegarder");return;}
    const heures=hMO??result.heuresMO??0;
    const ouvriers=nbOuv??result.nbOuvriers??1;
    const qteTotal=ligne.qte||1;
    const taux=tauxMoyenCharge(salaries,selSalIds);
    const moParUnit=qteTotal>0?+(heures*ouvriers*taux/qteTotal).toFixed(2):0;
    const fournLst=fourns??result.fournitures??[];
    const fournParUnit=qteTotal>0?+(fournLst.reduce((a,f)=>a+(+(f.prixAchat||0)*(+(f.qte||1))),0)/qteTotal).toFixed(2):0;
    const tempsMOParUnit=qteTotal>0?+(heures/qteTotal).toFixed(2):heures;
    const ouvrage={
      code:`MES-${Date.now()}`,
      corps:"Mes ouvrages",
      libelle:libelle.trim(),
      unite:ligne.unite||"U",
      moMin:+(moParUnit*0.85).toFixed(2),moMoy:moParUnit,moMax:+(moParUnit*1.2).toFixed(2),
      fournMin:+(fournParUnit*0.85).toFixed(2),fournMoy:fournParUnit,fournMax:+(fournParUnit*1.2).toFixed(2),
      tempsMO:tempsMOParUnit,
      detail:result.commentaire||"",
      source:"Mes ouvrages",
      composants:fournLst.map(f=>({designation:f.designation||"",qte:+(f.qte||1)/qteTotal,unite:f.unite||"U",prixAchat:+(f.prixAchat||0)})),
      affectations:[],
      // Champs étendus IA pour rechargement complet via addFromBiblio
      heuresPrevues:tempsMOParUnit,
      nbOuvriers:ouvriers,
      tauxHoraireMoyen:+taux.toFixed(2),
      salariesAssignes:[...selSalIds],
      // Fournitures complètes par unité (avec fournisseur + prixVente)
      fournitures:fournLst.map(f=>({
        fournisseur:f.fournisseur||"Point P",
        designation:f.designation||"",
        qte:qteTotal>0?+((+(f.qte||1))/qteTotal).toFixed(3):+f.qte||1,
        unite:f.unite||"U",
        prixAchat:+f.prixAchat||0,
        prixVente:+f.prixVente||+((+(f.prixAchat||0))*coeffFourn).toFixed(2),
      })),
    };
    onSaveOuvrage(ouvrage);
    alert(`✓ Ouvrage "${ouvrage.libelle}" ajouté à votre bibliothèque (${ouvrage.code})`);
  }

  const foursAff=fourns??(result?.fournitures??[]);
  const inp={padding:"4px 6px",border:`1px solid ${S.border}`,borderRadius:4,fontSize:12,outline:"none"};
  const tauxAff=tauxMoyenCharge(salaries,selSalIds);

  return(
    <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setOpen(true)} disabled={loading}
        style={{background:ecoute?"#DC2626":loading?"#94A3B8":result?"#16A34A":"#2563EB",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:loading?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
        {ecoute?"🔴":loading?"⏳":result?"✅ IA OK":"🚀 IA"}
      </button>

      {open&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget){setOpen(false);}}}>
        <div style={{background:"#fff",borderRadius:12,padding:24,width:640,maxWidth:"95vw",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>

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
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                <div><span style={{color:S.sm}}>Heures </span><input type="number" value={hMO??result.heuresMO} onChange={e=>{setHMO(+e.target.value);recalc(+e.target.value,null,null,null,null);}} style={{...inp,width:55,textAlign:"center"}}/><span style={{color:S.sm}}> h</span></div>
                <div><span style={{color:S.sm}}>Ouvriers </span><input type="number" value={nbOuv??result.nbOuvriers} onChange={e=>{setNbOuv(+e.target.value);recalc(null,+e.target.value,null,null,null);}} style={{...inp,width:45,textAlign:"center"}}/></div>
                <div><span style={{color:S.sm}}>Taux </span><strong style={{color:selSalIds.length>0?S.navy:S.text}}>{tauxAff.toFixed(2)}€/h{selSalIds.length>0&&<span style={{fontSize:10,color:S.navy,marginLeft:3}}>(réel)</span>}</strong></div>
                <div><span style={{color:S.sm}}>Coût MO </span><strong style={{color:S.blue}}>{result.totalMO?.toFixed(2)} €</strong></div>
              </div>
              {salaries.length>0&&<div>
                <div style={{fontSize:11,color:S.sm,marginBottom:4}}>👷 Affecter des salariés (taux réel + planning) :</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {salaries.map(s=>{
                    const sel=selSalIds.includes(s.id);
                    const tauxCharge=(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0));
                    return(
                      <button key={s.id} onClick={()=>toggleSal(s.id)} title={`${s.poste||""} · ${tauxCharge.toFixed(2)}€/h chargé`}
                        style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${sel?S.navy:S.border}`,background:sel?S.navyBg:"#fff",color:sel?S.navy:S.text,fontSize:11,fontWeight:sel?700:500,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:4}}>
                        {sel?"✓ ":""}{s.nom}<span style={{color:S.sm,fontSize:10,fontWeight:400}}>· {tauxCharge.toFixed(0)}€/h</span>
                      </button>
                    );
                  })}
                </div>
                {selSalIds.length>0&&<div style={{fontSize:10,color:S.navy,marginTop:4}}>↳ Affectés au planning : {selSalIds.length} ouvrier{selSalIds.length>1?"s":""} · taux moyen {tauxAff.toFixed(2)}€/h</div>}
              </div>}
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

            {(desigs||loadDesig)&&<div style={{background:"#F5F3FF",borderRadius:8,padding:10,marginBottom:10,fontSize:12}}>
              <div style={{fontWeight:700,marginBottom:6,color:"#7C3AED"}}>📝 Désignation professionnelle <span style={{fontSize:10,fontWeight:500,color:S.sm,marginLeft:6}}>· éditable avant application</span></div>
              {loadDesig&&<div style={{color:S.sm}}>⏳ Génération en cours...</div>}
              {desigs&&(()=>{
                const valeurAffichee=desigsEdited?.[desigChoix]??desigs[desigChoix]??"";
                const modifie=desigsEdited&&desigsEdited[desigChoix]!==undefined&&desigsEdited[desigChoix]!==desigs[desigChoix];
                return(
                  <>
                    <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
                      {["courte","detaillee","technique","commerciale"].map(k=>{
                        const edited=desigsEdited&&desigsEdited[k]!==undefined&&desigsEdited[k]!==desigs[k];
                        return(
                          <button key={k} onClick={()=>setDesigChoix(k)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${desigChoix===k?"#7C3AED":S.border}`,background:desigChoix===k?"#7C3AED":"#fff",color:desigChoix===k?"#fff":S.text,cursor:"pointer",fontSize:11,textTransform:"capitalize",fontWeight:edited?700:400}}>
                            {k}{edited&&<span title="Modifié" style={{marginLeft:3,fontSize:9}}>✎</span>}
                          </button>
                        );
                      })}
                    </div>
                    <textarea value={valeurAffichee}
                      onChange={e=>setDesigsEdited(prev=>({...(prev||desigs||{}),[desigChoix]:e.target.value}))}
                      rows={Math.min(8,Math.max(2,(valeurAffichee.match(/\n/g)?.length||0)+2))}
                      placeholder="Désignation… (modifiable)"
                      style={{width:"100%",background:"#fff",border:`1px solid #DDD6FE`,borderRadius:6,padding:8,fontSize:12,lineHeight:1.5,marginBottom:6,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <button onClick={()=>{const v=valeurAffichee;if(onLibelle)onLibelle(v);setLibelle(v);}} style={{background:"#7C3AED",color:"#fff",border:"none",borderRadius:4,padding:"4px 10px",fontSize:11,cursor:"pointer"}}>✓ Utiliser cette désignation</button>
                      {modifie&&<button onClick={()=>setDesigsEdited(prev=>({...(prev||{}),[desigChoix]:desigs[desigChoix]}))} title="Restaurer la version IA d'origine" style={{background:"#fff",color:S.sm,border:`1px solid ${S.border}`,borderRadius:4,padding:"4px 9px",fontSize:11,cursor:"pointer"}}>↺ Réinitialiser</button>}
                    </div>
                  </>
                );
              })()}
            </div>}
            {result.commentaire&&<div style={{background:"#FFFBEB",border:`1px solid #FDE68A`,borderRadius:6,padding:8,fontSize:11,color:"#92400E",marginBottom:12}}>💡 {result.commentaire}</div>}

            <div style={{display:"flex",gap:8,marginBottom:0}}>
              {onSaveOuvrage&&<button onClick={sauverOuvrage} title="Ajoute cet ouvrage dans 'Mes ouvrages' du catalogue" style={{padding:"10px 14px",background:"#fff",color:S.navy,border:`1px solid ${S.navy}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>⭐ Sauvegarder dans bibliothèque</button>}
              <button onClick={appliquer} style={{flex:1,padding:"10px",background:S.green,color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer"}}>
                ✓ Appliquer — {result.prix?.[choix]?.puHT?.toFixed(2)} € HT ({result.prix?.[choix]?.label})
              </button>
            </div>
          </>}
        </div>
      </div>}
    </div>
  );
}
