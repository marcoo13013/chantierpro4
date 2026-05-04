// ═══════════════════════════════════════════════════════════════════════════
// /api/agent-comptabilite — Cron quotidien à 8h (factures impayées + CA)
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque patron avec agents_enabled.comptabilite=true :
//   1. Factures statut='en attente' avec date > 30j → notif relance
//   2. CA du mois courant vs mois précédent → si baisse > 20% → alerte
// ═══════════════════════════════════════════════════════════════════════════

import { checkCronAuth, supaConfig, fetchActivePatrons, fetchUserData, pushNotification, logRun, naturalize } from "./_agent-helpers.js";

const AGENT="comptabilite";
const SEUIL_RELANCE_J=30;
const SEUIL_BAISSE_PCT=20;

function calcDocHT(d){
  return (d.lignes||[]).filter(l=>!l.type||l.type==="ligne").reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0);
}

export default async function handler(req,res){
  const authErr=checkCronAuth(req);
  if(authErr)return res.status(401).json({error:authErr});

  const supa=supaConfig();
  if(!supa)return res.status(503).json({error:"supabase non configuré"});

  const patrons=await fetchActivePatrons(supa,AGENT);
  const stats={patrons:patrons.length,detected:0,errors:0};
  const now=new Date();
  const moisCourant=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const moisPrec=(()=>{
    const d=new Date(now);d.setMonth(d.getMonth()-1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  })();

  for(const p of patrons){
    try{
      const docs=await fetchUserData(supa,"devis",p.user_id);
      // 1. Factures impayées > 30j
      const impayes=[];
      let caCourant=0,caPrec=0;
      for(const r of docs){
        const d=r.data||{};
        if(d.type==="facture"){
          const ht=calcDocHT(d);
          const dateStr=d.date||r.created_at?.slice(0,10);
          if(d.statut==="en attente"&&dateStr){
            const ageJ=Math.round((now-new Date(dateStr+"T00:00:00"))/86400000);
            if(ageJ>=SEUIL_RELANCE_J){
              impayes.push({factId:r.id,numero:d.numero,client:d.client,ageJ,ht});
            }
          }
          if(d.statut==="payé"&&dateStr){
            if(dateStr.startsWith(moisCourant))caCourant+=ht;
            else if(dateStr.startsWith(moisPrec))caPrec+=ht;
          }
        }
      }
      // Émet notifs relance (max 5)
      for(const det of impayes.slice(0,5)){
        const naturel=await naturalize([
          {role:"user",content:`La facture ${det.numero||"sans numéro"} (client ${det.client||"?"}, ${det.ht.toFixed(0)}€ HT) est impayée depuis ${det.ageJ} jours. Reformule en 1 phrase pour suggérer une relance ou un appel.`},
        ]);
        await pushNotification(supa,p.user_id,AGENT,{
          titre:`💸 Facture impayée — ${det.numero||"sans numéro"}`,
          message:naturel||`${det.numero||"Cette facture"} (${det.ht.toFixed(0)}€) impayée depuis ${det.ageJ}j. À relancer.`,
          type:"warning",
          data:{facture_id:det.factId,age_j:det.ageJ,ht:det.ht,client:det.client},
        });
        stats.detected++;
      }
      // 2. Baisse CA
      if(caPrec>0){
        const variation=Math.round(((caCourant-caPrec)/caPrec)*100);
        if(variation<=-SEUIL_BAISSE_PCT){
          const naturel=await naturalize([
            {role:"user",content:`Le chiffre d'affaires du mois courant (${caCourant.toFixed(0)}€) est en baisse de ${Math.abs(variation)}% par rapport au mois précédent (${caPrec.toFixed(0)}€). Reformule en 1 phrase pour proposer une action (relancer prospects, lancer une promo, contacter ex-clients…).`},
          ]);
          await pushNotification(supa,p.user_id,AGENT,{
            titre:`📉 CA en baisse de ${Math.abs(variation)}%`,
            message:naturel||`CA en baisse de ${Math.abs(variation)}% ce mois (${caCourant.toFixed(0)}€ vs ${caPrec.toFixed(0)}€). Penser à relancer.`,
            type:"warning",
            data:{ca_courant:caCourant,ca_prec:caPrec,variation_pct:variation},
          });
          stats.detected++;
        }
      }
      await logRun(supa,p.user_id,AGENT,{title:`agent-comptabilite run`,impayes:impayes.length,ca_courant:caCourant,ca_prec:caPrec});
    }catch(e){
      stats.errors++;
      console.warn(`[agent-comptabilite] user ${p.user_id} :`,e.message);
    }
  }
  return res.status(200).json({ok:true,agent:AGENT,...stats,ran_at:new Date().toISOString()});
}
