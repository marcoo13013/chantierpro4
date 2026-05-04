// ═══════════════════════════════════════════════════════════════════════════
// /api/agent-planning — Cron tous les matins à 7h
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque patron avec agents_enabled.planning=true :
//   1. Charge planning de la semaine courante (toutes phases couvrant
//      les 7 prochains jours)
//   2. Détecte conflits : un même salarié sur 2 phases qui se chevauchent
//      le même jour
//   3. Détecte salariés sans aucune affectation cette semaine
// ═══════════════════════════════════════════════════════════════════════════

import { checkCronAuth, supaConfig, fetchActivePatrons, fetchUserData, pushNotification, logRun, naturalize } from "./_agent-helpers.js";

const AGENT="planning";

function* daysIter(phase){
  if(!phase.dateDebut)return;
  const s=new Date(phase.dateDebut+"T00:00:00");
  const n=Math.max(1,+phase.dureeJours||1);
  for(let i=0;i<n;i++){
    const d=new Date(s);d.setDate(s.getDate()+i);
    yield d.toISOString().slice(0,10);
  }
}

export default async function handler(req,res){
  const authErr=checkCronAuth(req);
  if(authErr)return res.status(401).json({error:authErr});

  const supa=supaConfig();
  if(!supa)return res.status(503).json({error:"supabase non configuré"});

  const patrons=await fetchActivePatrons(supa,AGENT);
  const stats={patrons:patrons.length,detected:0,errors:0};
  const today=new Date();today.setHours(0,0,0,0);
  const dansSemaine=new Date(today);dansSemaine.setDate(today.getDate()+7);

  for(const p of patrons){
    try{
      const [chs,sals]=await Promise.all([
        fetchUserData(supa,"chantiers_v2",p.user_id),
        fetchUserData(supa,"salaries",p.user_id),
      ]);
      const salNoms=new Map();
      for(const s of sals){
        const d=s.data||{};
        salNoms.set(s.id,`${d.prenom||""} ${d.nom||""}`.trim()||"(sans nom)");
      }

      // Map jour → salarie_id → [phases]
      const occupation=new Map(); // key=`${day}|${sid}`, val=[{chantier,phaseLib}]
      const salariesActifs=new Set();
      for(const r of chs){
        const c=r.data||{};
        for(const ph of (c.planning||[])){
          if(!ph.dateDebut||!Array.isArray(ph.salariesIds))continue;
          const sids=ph.salariesIds;
          for(const day of daysIter(ph)){
            const dDate=new Date(day+"T00:00:00");
            if(dDate<today||dDate>dansSemaine)continue;
            for(const sid of sids){
              salariesActifs.add(sid);
              const k=`${day}|${sid}`;
              if(!occupation.has(k))occupation.set(k,[]);
              occupation.get(k).push({chantierId:r.id,chantierNom:c.nom,phaseLib:ph.tache||"phase",day});
            }
          }
        }
      }
      // Conflits : key avec >1 phase
      const conflitsParSal=new Map(); // sid → [{day,phases}]
      for(const [k,phases] of occupation){
        if(phases.length>=2){
          const [day,sid]=k.split("|");
          if(!conflitsParSal.has(sid))conflitsParSal.set(sid,[]);
          conflitsParSal.get(sid).push({day,phases});
        }
      }
      // Salariés inactifs cette semaine
      const inactifs=[...salNoms.keys()].filter(sid=>!salariesActifs.has(sid));

      // Notifications
      for(const [sid,confs] of conflitsParSal){
        const nom=salNoms.get(sid)||"un ouvrier";
        const detail=confs.slice(0,3).map(c=>`${c.day} : ${c.phases.map(p=>`"${p.phaseLib}" (${p.chantierNom})`).join(" + ")}`).join(" ; ");
        const naturel=await naturalize([
          {role:"user",content:`L'ouvrier ${nom} est planifié sur 2+ chantiers le(s) même(s) jour(s) cette semaine : ${detail}. Reformule en 1 phrase courte pour signaler le conflit + suggérer de réorganiser.`},
        ]);
        await pushNotification(supa,p.user_id,AGENT,{
          titre:`⚠️ Conflit planning — ${nom}`,
          message:naturel||`${nom} est planifié 2 fois le ${confs[0].day}. À déconflictualiser.`,
          type:"warning",
          data:{salarie_id:sid,jours_conflit:confs.map(c=>c.day)},
        });
        stats.detected++;
      }
      if(inactifs.length>0){
        const noms=inactifs.slice(0,5).map(sid=>salNoms.get(sid)||"?").filter(n=>n!=="(sans nom)");
        if(noms.length>0){
          const naturel=await naturalize([
            {role:"user",content:`Ces ${noms.length} ouvrier(s) n'ont aucune affectation planifiée cette semaine : ${noms.join(", ")}. Reformule en 1 phrase pour suggérer de leur trouver une mission ou de planifier des congés.`},
          ]);
          await pushNotification(supa,p.user_id,AGENT,{
            titre:`👷 ${noms.length} ouvrier${noms.length>1?"s":""} sans affectation`,
            message:naturel||`${noms.join(", ")} : aucune phase cette semaine. Penser à planifier.`,
            type:"info",
            data:{salaries_inactifs:noms},
          });
          stats.detected++;
        }
      }
      await logRun(supa,p.user_id,AGENT,{title:`agent-planning run`,conflits:conflitsParSal.size,inactifs:inactifs.length});
    }catch(e){
      stats.errors++;
      console.warn(`[agent-planning] user ${p.user_id} :`,e.message);
    }
  }
  return res.status(200).json({ok:true,agent:AGENT,...stats,ran_at:new Date().toISOString()});
}
