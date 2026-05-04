// ═══════════════════════════════════════════════════════════════════════════
// /api/agent-devis — Cron horaire (analyse marges + lignes anormales)
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque patron avec agents_enabled.devis=true :
//   1. Charge les devis/factures des 7 derniers jours
//   2. Pour chaque devis : calcule la marge théorique vs lignes
//   3. Émet notifications :
//      - 'warning' si marge < 20%
//      - 'info'    si une ligne a un PU HT < 50% du marché (placeholder)
// ═══════════════════════════════════════════════════════════════════════════

import { checkCronAuth, supaConfig, fetchActivePatrons, fetchUserData, pushNotification, logRun, naturalize } from "./_agent-helpers.js";

const AGENT="devis";
const SEUIL_MARGE_PCT=20;

export default async function handler(req,res){
  const authErr=checkCronAuth(req);
  if(authErr)return res.status(401).json({error:authErr});

  const supa=supaConfig();
  if(!supa)return res.status(503).json({error:"supabase non configuré"});

  const patrons=await fetchActivePatrons(supa,AGENT);
  const stats={patrons:patrons.length,detected:0,errors:0};
  const since=new Date(Date.now()-7*86400000).toISOString();

  for(const p of patrons){
    try{
      const docs=await fetchUserData(supa,"devis",p.user_id,`updated_at=gte.${since}`);
      const detections=[];
      for(const r of docs){
        const d=r.data||{};
        if(d.type!=="devis")continue;
        // Calcule HT depuis lignes
        const lignes=(d.lignes||[]).filter(l=>!l.type||l.type==="ligne");
        if(lignes.length===0)continue;
        const ht=lignes.reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0);
        if(ht<=0)continue;
        // Coût estimé : MO + fournitures.prixAchat
        const cout=lignes.reduce((a,l)=>{
          const heures=(+l.heuresPrevues||0)*(+l.qte||0)*(+l.nbOuvriers||1);
          const taux=(+l.tauxHoraireMoyen||35);
          const moCost=heures*taux;
          const fournCost=(l.fournitures||[]).reduce((aa,f)=>aa+(+f.prixAchat||0)*(+f.qte||0)*(+l.qte||1),0);
          return a+moCost+fournCost;
        },0);
        const margePct=Math.round(((ht-cout)/ht)*100);
        if(margePct<SEUIL_MARGE_PCT&&cout>0){
          detections.push({devisId:r.id,numero:d.numero,client:d.client,margePct,ht,cout,statut:d.statut});
        }
      }
      // Émet jusqu'à 5 notifications par run pour ne pas spammer
      for(const det of detections.slice(0,5)){
        const fallback=`Marge faible sur ${det.numero||"un devis"} (${det.margePct}%). Vérifie les coûts.`;
        const naturel=await naturalize([
          {role:"user",content:`Le devis ${det.numero||"sans numéro"} (client ${det.client||"?"}) a une marge théorique de ${det.margePct}% (HT ${det.ht.toFixed(0)}€, coût estimé ${det.cout.toFixed(0)}€). Reformule cette alerte en 1 phrase courte, ton constructif, qui suggère une action concrète (revoir un poste, augmenter le prix, vérifier les heures…).`},
        ]);
        await pushNotification(supa,p.user_id,AGENT,{
          titre:`⚠️ Marge faible — ${det.numero||"devis"}`,
          message:naturel||fallback,
          type:"warning",
          data:{devis_id:det.devisId,marge_pct:det.margePct,ht:det.ht,cout:det.cout},
        });
        stats.detected++;
      }
      await logRun(supa,p.user_id,AGENT,{title:`agent-devis run`,docs:docs.length,detections:detections.length});
    }catch(e){
      stats.errors++;
      console.warn(`[agent-devis] user ${p.user_id} :`,e.message);
    }
  }
  return res.status(200).json({ok:true,agent:AGENT,...stats,ran_at:new Date().toISOString()});
}
