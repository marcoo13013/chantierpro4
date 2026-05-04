// ═══════════════════════════════════════════════════════════════════════════
// /api/agent-chantier — Cron toutes les 6h (suivi chantiers en cours)
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque patron avec agents_enabled.chantier=true :
//   1. Charge tous les chantiers statut='en cours'
//   2. Date de fin prévue dépassée → 'urgent' (chantier en retard)
//   3. Aucun pointage / mise à jour terrain depuis 5 jours → 'warning'
// ═══════════════════════════════════════════════════════════════════════════

import { checkCronAuth, supaConfig, fetchActivePatrons, fetchUserData, pushNotification, logRun, naturalize } from "./_agent-helpers.js";

const AGENT="chantier";
const SEUIL_INACTIVITE_J=5;

function lastUpdateMs(c){
  // Dernière "activité" : max(updated_at chantier, photos récentes, terrain.lastUpdate, pointages récents)
  let m=new Date(c.updated_at||c.created_at||0).getTime();
  const t=c.data?.terrain;
  if(t?.lastUpdate&&+t.lastUpdate>m)m=+t.lastUpdate;
  return m;
}

function endDateOfChantier(c){
  // Date de fin = max(planning[].dateDebut + dureeJours)
  const planning=c.data?.planning||[];
  let maxEnd=null;
  for(const p of planning){
    if(!p.dateDebut)continue;
    const s=new Date(p.dateDebut+"T00:00:00");
    s.setDate(s.getDate()+(+p.dureeJours||1)-1);
    if(!maxEnd||s>maxEnd)maxEnd=s;
  }
  return maxEnd;
}

export default async function handler(req,res){
  const authErr=checkCronAuth(req);
  if(authErr)return res.status(401).json({error:authErr});

  const supa=supaConfig();
  if(!supa)return res.status(503).json({error:"supabase non configuré"});

  const patrons=await fetchActivePatrons(supa,AGENT);
  const stats={patrons:patrons.length,detected:0,errors:0};
  const now=Date.now();
  const todayMidnight=new Date();todayMidnight.setHours(0,0,0,0);

  for(const p of patrons){
    try{
      const chs=await fetchUserData(supa,"chantiers_v2",p.user_id);
      const detections=[];
      for(const r of chs){
        const c=r.data||{};
        if(c.statut!=="en cours")continue;
        // Retard
        const endDate=endDateOfChantier(r);
        if(endDate&&endDate<todayMidnight){
          const joursRetard=Math.round((todayMidnight-endDate)/86400000);
          detections.push({type:"retard",chantierId:r.id,nom:c.nom,client:c.client,joursRetard,endDate:endDate.toISOString().slice(0,10)});
          continue; // une seule alerte/chantier par run
        }
        // Inactivité
        const last=lastUpdateMs(r);
        const joursInac=Math.round((now-last)/86400000);
        if(joursInac>=SEUIL_INACTIVITE_J){
          detections.push({type:"inactif",chantierId:r.id,nom:c.nom,client:c.client,joursInac});
        }
      }
      for(const det of detections.slice(0,5)){
        if(det.type==="retard"){
          const naturel=await naturalize([
            {role:"user",content:`Le chantier "${det.nom||"sans nom"}" (client ${det.client||"?"}) devait se terminer le ${det.endDate} mais est encore en cours (${det.joursRetard} jour${det.joursRetard>1?"s":""} de retard). Reformule en 1 phrase courte avec une action concrète (replanifier, contacter le client, ajouter ouvrier…).`},
          ]);
          await pushNotification(supa,p.user_id,AGENT,{
            titre:`🚨 Chantier en retard — ${det.nom||"chantier"}`,
            message:naturel||`${det.nom||"Le chantier"} a ${det.joursRetard}j de retard. À replanifier ou clôturer.`,
            type:"urgent",
            data:{chantier_id:det.chantierId,jours_retard:det.joursRetard,end_date:det.endDate},
          });
        }else{
          const naturel=await naturalize([
            {role:"user",content:`Le chantier "${det.nom||"sans nom"}" (client ${det.client||"?"}) n'a pas eu de mise à jour terrain (photos, pointages, notes) depuis ${det.joursInac} jours. Reformule en 1 phrase pour suggérer un point d'avancement avec l'équipe.`},
          ]);
          await pushNotification(supa,p.user_id,AGENT,{
            titre:`💤 Chantier inactif — ${det.nom||"chantier"}`,
            message:naturel||`Aucune activité sur ${det.nom||"ce chantier"} depuis ${det.joursInac}j. Faire un point.`,
            type:"warning",
            data:{chantier_id:det.chantierId,jours_inactif:det.joursInac},
          });
        }
        stats.detected++;
      }
      await logRun(supa,p.user_id,AGENT,{title:`agent-chantier run`,chs:chs.length,detections:detections.length});
    }catch(e){
      stats.errors++;
      console.warn(`[agent-chantier] user ${p.user_id} :`,e.message);
    }
  }
  return res.status(200).json({ok:true,agent:AGENT,...stats,ran_at:new Date().toISOString()});
}
