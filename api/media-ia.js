// ═══════════════════════════════════════════════════════════════════════════
// /api/media-ia — Génération de contenu Réseaux Sociaux par chantier
// ═══════════════════════════════════════════════════════════════════════════
// Reçoit :
//   { chantier: {nom, type_travaux, ville, duree, description, devis_ht?},
//     formats: ['linkedin-post','instagram-post','instagram-story',
//               'facebook-post','facebook-story','tiktok-video','tiktok-story'],
//     options: {ton, inclure_prix, mise_en_avant, ville} }
//
// Renvoie : { posts: { 'linkedin-post': '...', 'instagram-post': '...', ... } }
//
// Modèle : Claude Sonnet 4.6 — créativité + précision pour le marketing.
// Sortie : JSON strict (parse-able), pas de markdown autour.
// ═══════════════════════════════════════════════════════════════════════════

const FORMAT_RULES={
  "linkedin-post":"Post LinkedIn professionnel 150-300 mots. Mise en valeur de l'expertise, de la qualité du travail livré, et de l'avant/après si pertinent. Ton sérieux mais humain. Termine par exactement 5 hashtags pro pertinents (ex: #BTP #Renovation #Marseille #Artisan #Decoration).",
  "instagram-post":"Légende Instagram 50-100 mots. Émojis BTP pertinents (🏗️🔨✅🔧🏠🪜🎨), accroche en 1ère ligne, CTA léger en fin. Termine par 15-20 hashtags mêlant local (#marseille #provence) et métier (#btp #renovation #artisan #carrelage selon spécialité).",
  "instagram-story":"Texte court 1-2 phrases punchy pour Story Instagram. Inclure : (1) le texte à afficher (max 80 chars), (2) une suggestion entre crochets [STICKER: type — sondage/curseur émotion/quiz/etc], (3) un fond couleur recommandé entre crochets [FOND: hex ou nom]. Format de sortie : 'Texte\\n[STICKER: ...]\\n[FOND: ...]'.",
  "facebook-post":"Post Facebook 100-200 mots. Plus narratif que LinkedIn, plus long qu'Instagram. Pas d'émojis surabondants (1-3 max). 5-8 hashtags ciblés local + métier en fin. Inviter au commentaire/contact en fin.",
  "facebook-story":"Texte court 1-2 phrases pour Story Facebook. Format identique à instagram-story : 'Texte\\n[STICKER: ...]\\n[FOND: ...]'.",
  "tiktok-video":"Script TikTok parlé de 30 à 60 secondes. Format de sortie sur 4 sections séparées par des titres en MAJUSCULES :\\n\\nHOOK (1ère ligne accroche choc max 8 mots) :\\n<accroche>\\n\\nSCRIPT (texte parlé chronométré 30-60s) :\\n<paragraphes>\\n\\nDESCRIPTION (légende sous la vidéo, 80-150 chars + 8-12 hashtags tendance BTP/local) :\\n<description>\\n\\nMUSIQUE :\\n<suggestion morceau ou genre, ex: 'piano lo-fi calme' ou 'trap énergique'>",
  "tiktok-story":"Texte court pour Story TikTok 15s max. Format : 'Texte court avec 1 emoji'. Pas plus de 80 caractères.",
};

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});

  const anthropicKey=process.env.ANTHROPIC_API_KEY;
  if(!anthropicKey)return res.status(503).json({error:"ANTHROPIC_API_KEY manquante"});

  const {chantier,formats,options}=req.body||{};
  if(!chantier||!Array.isArray(formats)||formats.length===0){
    return res.status(400).json({error:"chantier + formats[] requis"});
  }

  const validFormats=formats.filter(f=>FORMAT_RULES[f]);
  if(validFormats.length===0){
    return res.status(400).json({error:"Aucun format reconnu. Disponibles : "+Object.keys(FORMAT_RULES).join(", ")});
  }

  const opt=options||{};
  const ton=opt.ton||"Professionnel";
  const ville=opt.ville||chantier.ville||"";
  const inclurePrix=opt.inclure_prix===true;
  const miseEnAvant=opt.mise_en_avant||"Qualité";

  // Construit le prompt principal
  const formatRulesBlock=validFormats.map(f=>`### ${f}\n${FORMAT_RULES[f]}`).join("\n\n");

  const systemPrompt=`Tu es un expert marketing digital spécialisé dans le BTP et l'artisanat français. Tu rédiges des contenus pour réseaux sociaux qui mettent en valeur le savoir-faire des artisans, attirent des prospects locaux, et respectent les codes de chaque plateforme.

Tu ne fais JAMAIS de promesses commerciales abusives. Tu mets en valeur le réel : qualité du travail, expertise, proximité.

CRITIQUE : tu réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown autour. Pas de \`\`\`json\`\`\`. Juste { ... }.

Le JSON contient une clé par format demandé, valeur = le contenu généré (string). Les sauts de ligne dans le contenu sont représentés par \\n littéraux dans la string JSON.

═══════════════════════════════════════════════════════════════════════════
RÈGLES PAR FORMAT :
${formatRulesBlock}
═══════════════════════════════════════════════════════════════════════════

OPTIONS DE L'UTILISATEUR :
- Ton : ${ton} (${ton==="Décontracté"?"familier mais pro, vouvoiement OK":ton==="Humoristique"?"légère touche d'humour BTP, pas de blague lourde":"sérieux, expertise mise en avant"})
- Inclure le prix : ${inclurePrix?"OUI — mention le montant si fourni, format ex: '~12 000 € HT'":"NON — ne jamais mentionner de prix exact"}
- Angle principal : ${miseEnAvant} — fais ressortir cet aspect
- Zone géo : ${ville||"non précisée"} — utilise pour le SEO local et hashtags`;

  const userPrompt=`CHANTIER À PROMOUVOIR :
- Nom : ${chantier.nom||"(non renseigné)"}
- Type travaux : ${chantier.type_travaux||"(non précisé)"}
- Ville/zone : ${chantier.ville||ville||"(non précisée)"}
- Durée : ${chantier.duree||"(non renseignée)"}
- Description : ${chantier.description||"(aucune)"}
${inclurePrix&&chantier.devis_ht?`- Montant : ${chantier.devis_ht} € HT`:""}

Génère le contenu pour CHAQUE format demandé : ${validFormats.join(", ")}.

Réponds avec un objet JSON unique, par exemple :
{${validFormats.map(f=>`\n  "${f}": "..."`).join(",")}\n}`;

  try{
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":anthropicKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:3000,
        system:systemPrompt,
        messages:[{role:"user",content:userPrompt}],
      }),
    });
    if(!r.ok){
      const txt=await r.text().catch(()=>"");
      return res.status(502).json({error:`Claude HTTP ${r.status}`,body:txt.slice(0,500)});
    }
    const data=await r.json();
    const text=(data?.content?.[0]?.text||"").trim();

    // Parse strict — Claude doit renvoyer du JSON pur
    let posts;
    try{posts=JSON.parse(text);}catch(e){
      // Fallback : essaie d'extraire un bloc JSON entre { } si Claude a ajouté du texte
      const m=text.match(/\{[\s\S]*\}/);
      if(m){try{posts=JSON.parse(m[0]);}catch{}}
    }
    if(!posts||typeof posts!=="object"){
      return res.status(502).json({error:"Claude n'a pas renvoyé de JSON parseable",raw:text.slice(0,800)});
    }

    return res.status(200).json({posts,formats:validFormats});
  }catch(e){
    return res.status(502).json({error:"appel Claude échoué",details:e.message});
  }
}
