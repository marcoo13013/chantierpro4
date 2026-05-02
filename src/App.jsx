import React, { useState, useRef, useMemo } from "react";
import { useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginModal from "./components/LoginModal";
import { useOuvragesBibliotheque } from "./lib/ouvrages";
import { useDevis } from "./lib/useDevis";
import { DEVIS_DEMO_PAR_CORPS } from "./lib/devisDemo";
import TrancheCard from "./components/TrancheCard";
import { CHANTIERS_DEMO } from "./lib/chantiersDevis";
import VueDevisDetail from "./components/VueDevisDetail";
import { estimerLigne } from "./lib/iaDevis";
import BoutonIALigne from "./components/BoutonIALigne";
import BoutonDictaphone from "./components/BoutonDictaphone";
// ─── DESIGN SYSTEM ────────────────────────────────────────────────────────────
const L = {
  bg:"#F4F6F9", surface:"#FFFFFF", card:"#FFFFFF",
  border:"#E2E8F0", borderMd:"#CBD5E1",
  accent:"#E8620A", accentBg:"#FFF4EE",
  navy:"#1B3A5C", navyBg:"#EEF3F8",
  blue:"#2563EB", blueBg:"#EFF6FF",
  green:"#16A34A", greenBg:"#F0FDF4",
  red:"#DC2626", redBg:"#FEF2F2",
  orange:"#D97706", orangeBg:"#FFFBEB",
  purple:"#7C3AED", teal:"#0D9488",
  text:"#0F172A", textMd:"#334155", textSm:"#64748B", textXs:"#94A3B8",
  shadow:"0 1px 3px rgba(0,0,0,0.07)",
  shadowMd:"0 4px 12px rgba(0,0,0,0.10)",
  shadowLg:"0 8px 24px rgba(0,0,0,0.14)",
};

// ─── STATUTS ──────────────────────────────────────────────────────────────────
const STATUTS = {
  micro:{label:"Auto-entrepreneur / Micro",short:"Micro",icon:"👤",mode:"simple",color:L.green,bg:L.greenBg,description:"Sans TVA, comptabilité allégée",tauxCharges:0.22,tvaSoumis:false,plafondCA:188700,modules:["accueil","chantiers","devis","bibliotheque","assistant"]},
  ei:{label:"Entrepreneur Individuel",short:"EI",icon:"🧑‍💼",mode:"simple",color:L.blue,bg:L.blueBg,description:"TVA possible, structure légère",tauxCharges:0.40,tvaSoumis:true,modules:["accueil","chantiers","devis","bibliotheque","frais","assistant"]},
  eurl:{label:"EURL",short:"EURL",icon:"🏢",mode:"avance",color:L.orange,bg:L.orangeBg,description:"SARL unipersonnelle",tauxCharges:0.45,tvaSoumis:true,modules:["accueil","chantiers","devis","bibliotheque","equipe","planning","compta","frais","assistant"]},
  sarl:{label:"SARL",short:"SARL",icon:"🏗",mode:"avance",color:L.navy,bg:L.navyBg,description:"Société à responsabilité limitée",tauxCharges:0.45,tvaSoumis:true,modules:["accueil","chantiers","devis","bibliotheque","equipe","planning","compta","frais","coefficients","connecteurs","assistant","import"]},
  sas:{label:"SAS / SASU",short:"SAS",icon:"🏛",mode:"avance",color:L.purple,bg:"#F5F3FF",description:"Société par actions simplifiée",tauxCharges:0.42,tvaSoumis:true,modules:["accueil","chantiers","devis","bibliotheque","equipe","planning","compta","frais","coefficients","connecteurs","assistant","import"]},
};

const NAV_CONFIG = {
  accueil:{label:"Accueil",icon:"🏠",group:"principal"},
  chantiers:{label:"Chantiers",icon:"🏗",group:"principal"},
  devis:{label:"Devis",icon:"📄",group:"documents"},
  bibliotheque:{label:"Bibliothèque",icon:"📖",group:"documents"},
  equipe:{label:"Équipe",icon:"👷",group:"gestion"},
  planning:{label:"Planning",icon:"📅",group:"gestion"},
  compta:{label:"Comptabilité",icon:"💰",group:"gestion"},
  frais:{label:"Frais fixes",icon:"💸",group:"gestion"},
  coefficients:{label:"Coefficients",icon:"🧮",group:"outils"},
  connecteurs:{label:"Qonto / PL",icon:"🔗",group:"outils"},
  assistant:{label:"Assistant IA",icon:"🤖",group:"ia"},
  import:{label:"Import PDF",icon:"📤",group:"outils"},
};
const NAV_GROUPS={principal:"Principal",documents:"Documents",gestion:"Gestion",outils:"Outils",ia:"Intelligence"};

// ─── SALARIÉS EXEMPLE ─────────────────────────────────────────────────────────
const SALARIES_EXEMPLE = [
  {id:1,nom:"Dupont Thomas",poste:"Chef de chantier",qualification:"chef",tauxHoraire:18,chargesPatron:0.42,disponible:true,competences:["maçonnerie","gestion","béton"]},
  {id:2,nom:"Martin Paul",poste:"Maçon qualifié N3",qualification:"qualifie",tauxHoraire:14.5,chargesPatron:0.42,disponible:true,competences:["maçonnerie","béton","ferraillage"]},
  {id:3,nom:"Lopez Carlos",poste:"Maçon N2",qualification:"qualifie",tauxHoraire:13.5,chargesPatron:0.42,disponible:true,competences:["maçonnerie","carrelage","enduit"]},
  {id:4,nom:"Brun Eric",poste:"Carreleur",qualification:"qualifie",tauxHoraire:14,chargesPatron:0.42,disponible:true,competences:["carrelage","faïence","chape"]},
  {id:5,nom:"Moreau Julien",poste:"Peintre",qualification:"qualifie",tauxHoraire:13,chargesPatron:0.42,disponible:true,competences:["peinture","enduit","préparation"]},
  {id:6,nom:"Petit Marc",poste:"Aide maçon",qualification:"manoeuvre",tauxHoraire:11.88,chargesPatron:0.42,disponible:true,competences:["manutention","nettoyage","coffrages"]},
];

// ─── BIBLIOTHÈQUE BTP — 81 OUVRAGES (Artiprix/Batiprix 2025) ─────────────────
// Source : Bibliotheque-BTP.jsx + CalculateurMO-Fournitures.jsx fusionnés par code
const BIBLIOTHEQUE_BTP = [
  {code:"CAR-001",corps:"Carrelage",libelle:"Pose carrelage sol grès cérame ≤30x30",unite:"m²",moMin:18.0,moMoy:25.0,moMax:35.0,fournMin:15.0,fournMoy:22.0,fournMax:32.0,tempsMO:0.7,detail:"Mortier-colle, pose, joints, plinthes — carrelage non fourni",source:"Artiprix 2025",composants:[{designation:"Mortier-colle C2",qte:5.0,unite:"kg",prixAchat:0.65},{designation:"Joints ciment",qte:0.5,unite:"kg",prixAchat:1.2}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:0.5}]},
  {code:"CAR-002",corps:"Carrelage",libelle:"Pose carrelage sol format 60x60",unite:"m²",moMin:22.0,moMoy:30.0,moMax:42.0,fournMin:18.0,fournMoy:25.0,fournMax:35.0,tempsMO:1.1,detail:"Mortier-colle adapté, pose avec calepinage, joints, plinthes",source:"Artiprix 2025",composants:[{designation:"Ciment-colle flex C2S1",qte:6.0,unite:"kg",prixAchat:0.85},{designation:"Joints époxy",qte:0.8,unite:"kg",prixAchat:4.5}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"CAR-003",corps:"Carrelage",libelle:"Pose grand format 80x80 à 120x120",unite:"m²",moMin:30.0,moMoy:42.0,moMax:58.0,fournMin:22.0,fournMoy:32.0,fournMax:45.0,tempsMO:1.3,detail:"Double encollage, colle flex C2, calepinage, joints de finition",source:"Artiprix 2025",composants:[{designation:"Colle C2S1 immersion",qte:7.0,unite:"kg",prixAchat:1.1},{designation:"Joints hydrofuges chlore",qte:1.0,unite:"kg",prixAchat:6.5}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"CAR-004",corps:"Carrelage",libelle:"Pose faïence murale ≤20x30",unite:"m²",moMin:20.0,moMoy:28.0,moMax:38.0,fournMin:12.0,fournMoy:18.0,fournMax:26.0,tempsMO:0,detail:"Colle blanche, pose, joints époxy ou ciment — faïence non fournie",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"CAR-005",corps:"Carrelage",libelle:"Pose carrelage piscine immersion",unite:"m²",moMin:35.0,moMoy:48.0,moMax:65.0,fournMin:28.0,fournMoy:38.0,fournMax:52.0,tempsMO:0,detail:"Colle C2S1 immersion, joints hydrofuges chlore, double encollage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"CAR-006",corps:"Carrelage",libelle:"Chape mortier ciment + cunette",unite:"m²",moMin:10.0,moMoy:15.0,moMax:22.0,fournMin:8.0,fournMoy:12.0,fournMax:18.0,tempsMO:0,detail:"Chape 5cm, règle, cunette évacuation eaux, finition lissée",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"CAR-007",corps:"Carrelage",libelle:"Ragréage extérieur fibré P3",unite:"m²",moMin:6.0,moMoy:10.0,moMax:15.0,fournMin:6.0,fournMoy:10.0,fournMax:15.0,tempsMO:0,detail:"Primaire accrochage + ragréage auto-lissant fibré extérieur",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"CAR-008",corps:"Carrelage",libelle:"Pose margelle piscine",unite:"ml",moMin:18.0,moMoy:25.0,moMax:35.0,fournMin:18.0,fournMoy:24.0,fournMax:32.0,tempsMO:0,detail:"MO + mortier : mise à niveau, joints, nettoyage — margelle non fournie",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"CAR-009",corps:"Carrelage",libelle:"Revêtement PVC sol collé",unite:"m²",moMin:8.0,moMoy:12.0,moMax:18.0,fournMin:10.0,fournMoy:15.0,fournMax:22.0,tempsMO:0,detail:"Ragréage, colle acrylique, pose PVC 2mm, soudure à chaud",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"CAR-010",corps:"Carrelage",libelle:"Parquet flottant collé",unite:"m²",moMin:10.0,moMoy:15.0,moMax:22.0,fournMin:18.0,fournMoy:28.0,fournMax:40.0,tempsMO:0,detail:"Sous-couche, colle parquet, pose flottant 12mm, plinthes",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"DEM-001",corps:"Démolition",libelle:"Démolition cloison briques",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:0.0,fournMoy:0.0,fournMax:0.0,tempsMO:0,detail:"Démolition cloison brique creuse, enlèvement gravats, nettoyage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"DEM-002",corps:"Démolition",libelle:"Démolition cloison plâtre",unite:"m²",moMin:8.0,moMoy:12.0,moMax:18.0,fournMin:0.0,fournMoy:0.0,fournMax:0.0,tempsMO:0,detail:"Démolition plâtre ou BA13, enlèvement, tri, nettoyage",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"DEM-003",corps:"Démolition",libelle:"Dépose carrelage sol",unite:"m²",moMin:8.0,moMoy:13.0,moMax:20.0,fournMin:0.0,fournMoy:0.0,fournMax:0.0,tempsMO:0,detail:"Dépose carrelage, ragréage ancien, évacuation gravats en sacs",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"DEM-004",corps:"Démolition",libelle:"Dépose sanitaires (par appareil)",unite:"U",moMin:40.0,moMoy:60.0,moMax:85.0,fournMin:0.0,fournMoy:0.0,fournMax:0.0,tempsMO:0,detail:"Dépose et évacuation WC/lavabo/baignoire, obturation réseaux",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"DEM-005",corps:"Démolition",libelle:"Benne gravats 8m³",unite:"U",moMin:80.0,moMoy:120.0,moMax:170.0,fournMin:150.0,fournMoy:220.0,fournMax:320.0,tempsMO:0,detail:"Location benne 8m³, enlèvement, transport et évacuation en décharge agréée",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ELE-001",corps:"Électricité",libelle:"Tableau électrique 1 rangée 13 modules",unite:"U",moMin:120.0,moMoy:180.0,moMax:260.0,fournMin:80.0,fournMoy:130.0,fournMax:200.0,tempsMO:0.5,detail:"Coffret IP40, disjoncteur général, 6 disjoncteurs, différentiel 30mA, mise en service",source:"Artiprix 2025",composants:[{designation:"Prise 16A encastrée",qte:1.0,unite:"U",prixAchat:4.5},{designation:"Câble 2.5mm² (ml)",qte:3.0,unite:"ml",prixAchat:0.9},{designation:"Boîte encastrement",qte:1.0,unite:"U",prixAchat:1.2}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"ELE-002",corps:"Électricité",libelle:"Tableau électrique 2 rangées 26 modules",unite:"U",moMin:200.0,moMoy:300.0,moMax:420.0,fournMin:150.0,fournMoy:240.0,fournMax:380.0,tempsMO:0.6,detail:"Coffret IP40, disjoncteur général, 12 disjoncteurs, 2 différentiels, mise en service",source:"Batiprix 2025",composants:[{designation:"Boîte dérivation",qte:1.0,unite:"U",prixAchat:2.8},{designation:"Câble 1.5mm² (ml)",qte:5.0,unite:"ml",prixAchat:0.7},{designation:"Rosace plafond",qte:1.0,unite:"U",prixAchat:1.5}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"ELE-003",corps:"Électricité",libelle:"Prise de courant 2P+T simple",unite:"U",moMin:15.0,moMoy:22.0,moMax:32.0,fournMin:5.0,fournMoy:9.0,fournMax:15.0,tempsMO:0,detail:"Prise 16A, boîte encastrée, câble 2.5mm², connexion",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ELE-004",corps:"Électricité",libelle:"Prise de courant double",unite:"U",moMin:18.0,moMoy:26.0,moMax:38.0,fournMin:8.0,fournMoy:13.0,fournMax:20.0,tempsMO:0,detail:"Double prise 16A, boîte encastrée, câble 2.5mm², connexion",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ELE-005",corps:"Électricité",libelle:"Interrupteur va-et-vient",unite:"U",moMin:15.0,moMoy:22.0,moMax:32.0,fournMin:5.0,fournMoy:8.0,fournMax:14.0,tempsMO:0,detail:"Interrupteur VV, boîte encastrée, câble 1.5mm², connexion",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ELE-006",corps:"Électricité",libelle:"Point lumineux plafonnier",unite:"U",moMin:20.0,moMoy:30.0,moMax:44.0,fournMin:5.0,fournMoy:10.0,fournMax:18.0,tempsMO:0,detail:"Boîte de dérivation, câble 1.5mm², rosace, connexion — luminaire non fourni",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ELE-007",corps:"Électricité",libelle:"Spot encastré (par spot)",unite:"U",moMin:18.0,moMoy:28.0,moMax:40.0,fournMin:12.0,fournMoy:22.0,fournMax:38.0,tempsMO:0,detail:"Spot LED encastré, boîte de dérivation, câble, câblage en guirlande",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ELE-008",corps:"Électricité",libelle:"Câble alimentation VGV 3G2.5 mm²",unite:"ml",moMin:4.0,moMoy:6.0,moMax:9.0,fournMin:2.0,fournMoy:4.0,fournMax:6.0,tempsMO:0,detail:"Câble rigide encastré sous conduit IRL, fixation, raccordement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ELE-009",corps:"Électricité",libelle:"Saignée + rebouchage enduit",unite:"ml",moMin:8.0,moMoy:12.0,moMax:18.0,fournMin:2.0,fournMoy:4.0,fournMax:7.0,tempsMO:0,detail:"Saignée pour conduit, pose conduit IRL, rebouchage plâtre, ponçage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ELE-010",corps:"Électricité",libelle:"Prise RJ45 réseau informatique",unite:"U",moMin:20.0,moMoy:30.0,moMax:44.0,fournMin:10.0,fournMoy:18.0,fournMax:28.0,tempsMO:0,detail:"Prise RJ45 Cat6, câble réseau, boîte encastrée, connexion",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ELE-011",corps:"Électricité",libelle:"Détecteur de présence",unite:"U",moMin:25.0,moMoy:38.0,moMax:55.0,fournMin:25.0,fournMoy:42.0,fournMax:65.0,tempsMO:0,detail:"Détecteur infrarouge 360° encastré, réglage seuil/durée, câblage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ELE-012",corps:"Électricité",libelle:"Climatiseur split 3,5 kW",unite:"U",moMin:250.0,moMoy:380.0,moMax:520.0,fournMin:350.0,fournMoy:550.0,fournMax:800.0,tempsMO:0,detail:"Unité intérieure + extérieure, liaison frigorifique, mise en service, CEE attestée",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ISO-001",corps:"Isolation",libelle:"Isolation combles laine de verre soufflée",unite:"m²",moMin:8.0,moMoy:13.0,moMax:20.0,fournMin:8.0,fournMoy:14.0,fournMax:22.0,tempsMO:0.9,detail:"Laine de verre soufflée R=7 ep.300mm, pare-vapeur, 40cm d'épaisseur",source:"Artiprix 2025",composants:[{designation:"Plaque BA13 (m²)",qte:2.2,unite:"m²",prixAchat:4.8},{designation:"Rail / Montant (ml)",qte:3.5,unite:"ml",prixAchat:1.2},{designation:"Laine roche 45mm",qte:1.1,unite:"m²",prixAchat:3.5},{designation:"Bande acoustique (ml)",qte:1.2,unite:"ml",prixAchat:0.8}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:0.5}]},
  {code:"ISO-002",corps:"Isolation",libelle:"Isolation sous rampant laine de roche",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:14.0,fournMoy:22.0,fournMax:32.0,tempsMO:0,detail:"Laine de roche 140mm + 60mm, pare-vapeur, plaque de plâtre BA13",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ISO-003",corps:"Isolation",libelle:"Doublage thermo-acoustique",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:14.0,fournMoy:22.0,fournMax:32.0,tempsMO:0,detail:"Ossature métallique, laine de roche 45mm, BA13, bandes désolidarisation",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ISO-004",corps:"Isolation",libelle:"Cloison de distribution BA13",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:10.0,fournMoy:16.0,fournMax:24.0,tempsMO:0,detail:"Rail/montant 48mm, double parement BA13, bande acoustique, laine",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ISO-005",corps:"Isolation",libelle:"Faux plafond BA13 suspendu",unite:"m²",moMin:14.0,moMoy:20.0,moMax:30.0,fournMin:10.0,fournMoy:16.0,fournMax:24.0,tempsMO:0,detail:"Ossature tige de suspension, rails fourrures, plaque BA13, bandes",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ISO-006",corps:"Isolation",libelle:"Faux plafond BA18 humidité salle de bain",unite:"m²",moMin:16.0,moMoy:24.0,moMax:34.0,fournMin:12.0,fournMoy:20.0,fournMax:30.0,tempsMO:0,detail:"Ossature, BA18 hydrofuge, traitement joints, peinture primaire",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ISO-007",corps:"Isolation",libelle:"Plancher chauffant hydraulique",unite:"m²",moMin:18.0,moMoy:26.0,moMax:38.0,fournMin:25.0,fournMoy:38.0,fournMax:55.0,tempsMO:0,detail:"Isolant, tube PER, nourrices, chape anhydrite, mise en service",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"ISO-008",corps:"Isolation",libelle:"Isolation extérieure ITE polystyrène 100mm",unite:"m²",moMin:20.0,moMoy:30.0,moMax:42.0,fournMin:35.0,fournMoy:52.0,fournMax:72.0,tempsMO:0,detail:"PSE 100mm, colle + chevilles, treillis fibres, enduit de finition",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"ISO-009",corps:"Isolation",libelle:"Rebouchage saignées enduit plâtre",unite:"ml",moMin:5.0,moMoy:8.0,moMax:12.0,fournMin:2.0,fournMoy:4.0,fournMax:7.0,tempsMO:0,detail:"Enduit de rebouchage, staff, ponçage, finition prête à peindre",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MAC-001",corps:"Maçonnerie",libelle:"Dalle béton armé ep. 12 cm",unite:"m²",moMin:22.0,moMoy:30.0,moMax:40.0,fournMin:28.0,fournMoy:38.0,fournMax:50.0,tempsMO:0.8,detail:"Coffrage bois, film polyane, treillis ST25C, béton 300 kg/m³, finition talochée",source:"Artiprix 2025",composants:[{designation:"Film polyane",qte:1.1,unite:"m²",prixAchat:0.8},{designation:"Treillis soudé ST25C",qte:1.1,unite:"m²",prixAchat:3.5},{designation:"Béton 350 kg/m³",qte:0.17,unite:"m³",prixAchat:120.0}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"MAC-002",corps:"Maçonnerie",libelle:"Dalle béton armé ep. 15 cm",unite:"m²",moMin:25.0,moMoy:33.0,moMax:45.0,fournMin:32.0,fournMoy:42.0,fournMax:55.0,tempsMO:1.0,detail:"Coffrage bois, film polyane, treillis ST25C, béton 350 kg/m³, finition talochée",source:"Batiprix 2025",composants:[{designation:"Film polyane",qte:1.1,unite:"m²",prixAchat:0.8},{designation:"Treillis 8mm",qte:1.1,unite:"m²",prixAchat:5.2},{designation:"Béton toupie 350 kg/m³",qte:0.22,unite:"m³",prixAchat:155.0}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"MAC-003",corps:"Maçonnerie",libelle:"Dalle béton armé ep. 20 cm",unite:"m²",moMin:30.0,moMoy:40.0,moMax:55.0,fournMin:40.0,fournMoy:55.0,fournMax:70.0,tempsMO:1.2,detail:"Coffrage bois, treillis 8mm, béton 350 kg/m³ toupie + pompe, finition lissée",source:"Batiprix 2025",composants:[{designation:"Parpaings 20x20x50",qte:12.5,unite:"U",prixAchat:1.2},{designation:"Mortier colle",qte:2.5,unite:"kg",prixAchat:0.45}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"MAC-004",corps:"Maçonnerie",libelle:"Mur parpaings creux 20 cm",unite:"m²",moMin:18.0,moMoy:25.0,moMax:35.0,fournMin:20.0,fournMoy:28.0,fournMax:38.0,tempsMO:0,detail:"Parpaings 20x20x50, mortier, chaînage, montage alignement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MAC-005",corps:"Maçonnerie",libelle:"Mur parpaings plein 15 cm",unite:"m²",moMin:16.0,moMoy:22.0,moMax:30.0,fournMin:18.0,fournMoy:24.0,fournMax:32.0,tempsMO:0,detail:"Parpaings 15x20x50, mortier, montage alignement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MAC-006",corps:"Maçonnerie",libelle:"Rehausse muret parpaings (par rang)",unite:"ml",moMin:20.0,moMoy:28.0,moMax:38.0,fournMin:22.0,fournMoy:32.0,fournMax:45.0,tempsMO:0,detail:"Parpaings 20cm, mortier, alignement, chaînage HA 8mm",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MAC-007",corps:"Maçonnerie",libelle:"Terrassement mécanisé mise à plat",unite:"m²",moMin:5.0,moMoy:10.0,moMax:18.0,fournMin:3.0,fournMoy:5.0,fournMax:8.0,tempsMO:0,detail:"Décapage 30cm, déblai/remblai, compactage mécanique",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MAC-008",corps:"Maçonnerie",libelle:"Plancher poutrelles-hourdis",unite:"m²",moMin:35.0,moMoy:48.0,moMax:65.0,fournMin:55.0,fournMoy:75.0,fournMax:100.0,tempsMO:0,detail:"Poutrelles béton précontrainte, hourdis polystyrène, dalle compression BPE C25/30",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MAC-009",corps:"Maçonnerie",libelle:"Escalier béton armé coulé sur place",unite:"marche",moMin:180.0,moMoy:250.0,moMax:350.0,fournMin:180.0,fournMoy:240.0,fournMax:320.0,tempsMO:0,detail:"Coffrage, ferraillage, béton, finition brute — marche 1,50m x 0,30m x 0,18m",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MAC-010",corps:"Maçonnerie",libelle:"Chaînage horizontal béton armé",unite:"ml",moMin:12.0,moMoy:18.0,moMax:25.0,fournMin:15.0,fournMoy:22.0,fournMax:30.0,tempsMO:0,detail:"Coffrage, acier HA, béton dosé 350 kg/m³, section 15x20cm",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MAC-011",corps:"Maçonnerie",libelle:"Semelle filante béton armé",unite:"ml",moMin:28.0,moMoy:38.0,moMax:52.0,fournMin:32.0,fournMoy:45.0,fournMax:60.0,tempsMO:0,detail:"Fouille, coffrage, ferraillage HA, béton 350 kg/m³, section 50x30cm",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MAC-012",corps:"Maçonnerie",libelle:"Remblais gravier concassé",unite:"m³",moMin:15.0,moMoy:22.0,moMax:30.0,fournMin:30.0,fournMoy:42.0,fournMax:55.0,tempsMO:0,detail:"Fourniture gravier 6/14, mise en œuvre et compactage",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MAC-013",corps:"Maçonnerie",libelle:"Cuvelage béton piscine radier",unite:"m²",moMin:35.0,moMoy:48.0,moMax:65.0,fournMin:40.0,fournMoy:55.0,fournMax:72.0,tempsMO:0,detail:"Treillis 8mm x2 couches, acier HA, béton toupie + pompe 350 kg/m³",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MEN-001",corps:"Menuiserie",libelle:"Fenêtre PVC double vitrage 80x120",unite:"U",moMin:80.0,moMoy:120.0,moMax:170.0,fournMin:200.0,fournMoy:320.0,fournMax:480.0,tempsMO:0,detail:"Fenêtre PVC Uw≤1.3, double vitrage 4/16/4 Argon, pose + calfeutrement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MEN-002",corps:"Menuiserie",libelle:"Fenêtre PVC double vitrage 100x140",unite:"U",moMin:100.0,moMoy:150.0,moMax:210.0,fournMin:250.0,fournMoy:400.0,fournMax:600.0,tempsMO:0,detail:"Fenêtre PVC Uw≤1.3, double vitrage argon, pose, joints, calfeutrement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MEN-003",corps:"Menuiserie",libelle:"Porte d'entrée PVC 90x215",unite:"U",moMin:120.0,moMoy:180.0,moMax:260.0,fournMin:500.0,fournMoy:800.0,fournMax:1200.0,tempsMO:0,detail:"Porte PVC isolée, serrure multipoints, cylindre, pose et réglage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MEN-004",corps:"Menuiserie",libelle:"Porte intérieure isoplane 83x204",unite:"U",moMin:60.0,moMoy:90.0,moMax:130.0,fournMin:80.0,fournMoy:130.0,fournMax:200.0,tempsMO:0,detail:"Porte isoplane + bâti, quincaillerie, pose, réglage, joint bas de porte",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MEN-005",corps:"Menuiserie",libelle:"Porte coulissante galandage",unite:"U",moMin:100.0,moMoy:150.0,moMax:220.0,fournMin:150.0,fournMoy:250.0,fournMax:380.0,tempsMO:0,detail:"Bâti galandage, porte, rail, quincaillerie, pose dans cloison",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MEN-006",corps:"Menuiserie",libelle:"Volet roulant électrique",unite:"U",moMin:80.0,moMoy:120.0,moMax:175.0,fournMin:180.0,fournMoy:280.0,fournMax:420.0,tempsMO:0,detail:"Volet roulant électrique, tablier aluminium, moteur, commande, pose",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MEN-007",corps:"Menuiserie",libelle:"Bardage bois horizontal",unite:"m²",moMin:20.0,moMoy:30.0,moMax:42.0,fournMin:25.0,fournMoy:38.0,fournMax:55.0,tempsMO:0,detail:"Lames bardage pin traité classe 3, ossature bois, fixation inox",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MEN-008",corps:"Menuiserie",libelle:"Charpente traditionnelle (toiture standard)",unite:"m²",moMin:25.0,moMoy:38.0,moMax:55.0,fournMin:30.0,fournMoy:45.0,fournMax:65.0,tempsMO:0,detail:"Fermettes bois, contreventement, faîtage, sous-toiture, surface projetée",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"MEN-009",corps:"Menuiserie",libelle:"Terrasse bois composite 25mm",unite:"m²",moMin:20.0,moMoy:30.0,moMax:42.0,fournMin:30.0,fournMoy:45.0,fournMax:65.0,tempsMO:0,detail:"Lambourdes réglables, lames composite 25mm, fixations invisibles",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"MEN-010",corps:"Menuiserie",libelle:"Placard coulissant sur mesure",unite:"ml",moMin:80.0,moMoy:120.0,moMax:175.0,fournMin:120.0,fournMoy:200.0,fournMax:320.0,tempsMO:0,detail:"Caisson mélaminé, portes coulissantes, rail, aménagement intérieur",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PEI-001",corps:"Peinture",libelle:"Peinture façade extérieure 2 couches",unite:"m²",moMin:10.0,moMoy:16.0,moMax:24.0,fournMin:8.0,fournMoy:14.0,fournMax:20.0,tempsMO:0.4,detail:"Primaire + 2 couches peinture façade siloxane qualité pro",source:"Artiprix 2025",composants:[{designation:"Peinture façade siloxane",qte:0.35,unite:"L",prixAchat:8.5},{designation:"Primaire d'accrochage",qte:0.1,unite:"L",prixAchat:6.0}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-002",corps:"Peinture",libelle:"Enduit façade monocouche grainée",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:14.0,fournMoy:22.0,fournMax:32.0,tempsMO:0.5,detail:"Primaire d'accrochage + enduit monocouche grainée ton pierre",source:"Artiprix 2025",composants:[{designation:"Enduit monocouche grainé",qte:15.0,unite:"kg",prixAchat:0.55},{designation:"Primaire d'accrochage",qte:0.15,unite:"L",prixAchat:6.0}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:0.5}]},
  {code:"PEI-003",corps:"Peinture",libelle:"Enduit façade soubassement + solin",unite:"ml",moMin:18.0,moMoy:26.0,moMax:36.0,fournMin:18.0,fournMoy:28.0,fournMax:38.0,tempsMO:0,detail:"Baguette solin, primaire, enduit monocouche, nettoyage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PEI-004",corps:"Peinture",libelle:"ITE isolation thermique extérieure",unite:"m²",moMin:20.0,moMoy:30.0,moMax:42.0,fournMin:40.0,fournMoy:58.0,fournMax:78.0,tempsMO:0,detail:"Polystyrène 100mm, colle, treillis fibre de verre, enduit de finition",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PEI-005",corps:"Peinture",libelle:"Peinture intérieure murs 2 couches",unite:"m²",moMin:6.0,moMoy:10.0,moMax:15.0,fournMin:4.0,fournMoy:8.0,fournMax:12.0,tempsMO:0,detail:"Impression + 2 couches peinture vinylique mate, protection sol",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PEI-006",corps:"Peinture",libelle:"Peinture intérieure plafond",unite:"m²",moMin:8.0,moMoy:13.0,moMax:18.0,fournMin:4.0,fournMoy:8.0,fournMax:12.0,tempsMO:0,detail:"Impression + 2 couches peinture plafond blanche, protection",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PEI-007",corps:"Peinture",libelle:"Enduit de lissage intérieur",unite:"m²",moMin:5.0,moMoy:8.0,moMax:12.0,fournMin:3.0,fournMoy:6.0,fournMax:10.0,tempsMO:0,detail:"Enduit de lissage fin + ponçage dépoussiérage",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PEI-008",corps:"Peinture",libelle:"Enduit décoratif à la chaux",unite:"m²",moMin:14.0,moMoy:20.0,moMax:30.0,fournMin:12.0,fournMoy:18.0,fournMax:26.0,tempsMO:0,detail:"Gobetis, enduit à la chaux 2 passes, finition talochée",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PEI-009",corps:"Peinture",libelle:"Béton ciré murs / sols",unite:"m²",moMin:18.0,moMoy:28.0,moMax:40.0,fournMin:20.0,fournMoy:30.0,fournMax:42.0,tempsMO:0,detail:"Support préparé, 3 passes béton ciré, vernis de finition",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PEI-010",corps:"Peinture",libelle:"Peinture glycéro boiseries/fenêtres",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:6.0,fournMoy:10.0,fournMax:15.0,tempsMO:0,detail:"Ponçage, impression, 2 couches glycéro satinée, protection",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PLO-001",corps:"Plomberie",libelle:"Lavabo simple vasque posé",unite:"U",moMin:80.0,moMoy:120.0,moMax:170.0,fournMin:60.0,fournMoy:100.0,fournMax:180.0,tempsMO:4.5,detail:"Fourniture + pose lavabo céramique, robinetterie, siphon, raccordement",source:"Artiprix 2025",composants:[{designation:"WC suspendu céramique",qte:1.0,unite:"U",prixAchat:180.0},{designation:"Bâti-support Geberit",qte:1.0,unite:"U",prixAchat:145.0},{designation:"Plaque commande",qte:1.0,unite:"U",prixAchat:65.0}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PLO-002",corps:"Plomberie",libelle:"WC suspendu avec bâti-support",unite:"U",moMin:150.0,moMoy:220.0,moMax:320.0,fournMin:180.0,fournMoy:280.0,fournMax:420.0,tempsMO:0,detail:"Fourniture + pose WC suspendu, bâti-support, plaque de commande",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PLO-003",corps:"Plomberie",libelle:"WC à poser standard",unite:"U",moMin:80.0,moMoy:120.0,moMax:170.0,fournMin:80.0,fournMoy:130.0,fournMax:200.0,tempsMO:0,detail:"Fourniture + pose WC à poser, abattant, raccordement, scellement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PLO-004",corps:"Plomberie",libelle:"Douche receveur + colonne",unite:"U",moMin:120.0,moMoy:180.0,moMax:260.0,fournMin:150.0,fournMoy:240.0,fournMax:380.0,tempsMO:0,detail:"Receveur extra-plat, colonne de douche, joints, raccordement EU",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PLO-005",corps:"Plomberie",libelle:"Baignoire encastrée",unite:"U",moMin:150.0,moMoy:220.0,moMax:320.0,fournMin:200.0,fournMoy:320.0,fournMax:500.0,tempsMO:0,detail:"Baignoire acrylique, robinetterie, tablier, joints silicone, raccordements",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PLO-006",corps:"Plomberie",libelle:"Chauffe-eau électrique 150L",unite:"U",moMin:120.0,moMoy:180.0,moMax:250.0,fournMin:200.0,fournMoy:280.0,fournMax:400.0,tempsMO:0,detail:"Fourniture + pose CES 150L, raccordements eau + électricité, mise en service",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PLO-007",corps:"Plomberie",libelle:"Tube cuivre diamètre 14/16 mm",unite:"ml",moMin:8.0,moMoy:12.0,moMax:18.0,fournMin:5.0,fournMoy:8.0,fournMax:12.0,tempsMO:0,detail:"Tube cuivre recuit, raccords, soudures/brasures, colliers fixation",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PLO-008",corps:"Plomberie",libelle:"Tube cuivre diamètre 20/22 mm",unite:"ml",moMin:10.0,moMoy:15.0,moMax:22.0,fournMin:7.0,fournMoy:11.0,fournMax:16.0,tempsMO:0,detail:"Tube cuivre, raccords, soudures, colliers, calorifuge",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PLO-009",corps:"Plomberie",libelle:"Evacuation PVC diamètre 40 mm",unite:"ml",moMin:8.0,moMoy:12.0,moMax:18.0,fournMin:4.0,fournMoy:7.0,fournMax:11.0,tempsMO:0,detail:"Tube PVC, raccords collés, pentes, colliers de fixation",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PLO-010",corps:"Plomberie",libelle:"Evacuation PVC diamètre 100 mm",unite:"ml",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:8.0,fournMoy:13.0,fournMax:20.0,tempsMO:0,detail:"Tube PVC descente EU, raccords, joints, colliers, pentes 2%",source:"Batiprix 2025",composants:[],affectations:[]},
  {code:"PLO-011",corps:"Plomberie",libelle:"Robinet mélangeur lavabo",unite:"U",moMin:40.0,moMoy:60.0,moMax:85.0,fournMin:35.0,fournMoy:65.0,fournMax:120.0,tempsMO:0,detail:"Robinet mélangeur chromé, flexibles, pose et raccordement",source:"Artiprix 2025",composants:[],affectations:[]},
  {code:"PLO-012",corps:"Plomberie",libelle:"Bonde de fond piscine + réseau PVC HP",unite:"U",moMin:180.0,moMoy:260.0,moMax:380.0,fournMin:180.0,fournMoy:260.0,fournMax:380.0,tempsMO:0,detail:"Bonde piscine béton, réseau PVC HP, carottage, raccordements local technique",source:"Batiprix 2025",composants:[],affectations:[]},
];

// ─── DEVIS DJAOUEL — DONNÉES COMPLÈTES ────────────────────────────────────────
// 18 lots, 53 postes, Total HT: 242 962,96€
const CHANTIER_DJAOUEL = {
  id:1,
  nom:"Djaouel – Construction Maison Individuelle",
  client:"M. et Mme DJAOUEL",
  adresse:"Le clos de la sarriette, 13012 Marseille 12",
  statut:"en cours",
  dateDebut:"2025-10-15",
  dateFin:"2026-06-30",
  devisHT:242962.96,
  devisTTC:291555.55,
  tva:20,
  acompteEncaisse:116622.22,
  soldeEncaisse:0,
  notes:"Construction maison individuelle complète. Devis N°2009002771 du 06/10/2025. Acompte 40% versé.",
  checklist:{},photos:[],facturesFournisseurs:[],
  depensesReelles:[
    {id:1,libelle:"Béton Express PACA – fondations",montant:8400,categorie:"fourniture",date:"2025-10-20"},
    {id:2,libelle:"Point P – agglos + armatures lot 4",montant:12600,categorie:"fourniture",date:"2025-11-03"},
    {id:3,libelle:"Location grue + benne",montant:3200,categorie:"location",date:"2025-10-18"},
  ],
  postes:[
    // LOT 1
    {id:1,lot:"LOT 1 – INSTALLATION DE CHANTIER",libelle:"Installation de chantier – matériel, protections, bennes",montantHT:1450,qte:1,unite:"F",
      tempsMO:{heures:16,nbOuvriers:2,detail:"Mise en place protections, acheminement matériel"},
      fournitures:[
        {designation:"Bennes à gravats 10m³",qte:2,unite:"U",prixAchat:280,fournisseur:"Kiloutou",prixPointP:295,prixGedimat:270},
        {designation:"Barrières de chantier",qte:20,unite:"U",prixAchat:8.5,fournisseur:"Kiloutou",prixPointP:9,prixGedimat:8},
        {designation:"Panneau de signalisation",qte:3,unite:"U",prixAchat:45,fournisseur:"Point P",prixPointP:45,prixGedimat:42},
      ]},
    // LOT 2
    {id:2,lot:"LOT 2 – TERRASSEMENTS",libelle:"Terrassement complet – fouilles fondations, décapage, évacuation",montantHT:9000,qte:1,unite:"ENS",
      tempsMO:{heures:40,nbOuvriers:3,detail:"Implantation, fouilles 60x45cm, nivellement, évacuation déblais"},
      fournitures:[
        {designation:"Location mini-pelle 3T",qte:3,unite:"jour",prixAchat:350,fournisseur:"Kiloutou",prixPointP:380,prixGedimat:360},
        {designation:"Camion benne évacuation",qte:4,unite:"rotation",prixAchat:250,fournisseur:"Kiloutou",prixPointP:270,prixGedimat:260},
        {designation:"Piquets de traçage + cordeau",qte:1,unite:"ENS",prixAchat:35,fournisseur:"Point P",prixPointP:35,prixGedimat:32},
      ]},
    // LOT 3
    {id:3,lot:"LOT 3 – FONDATION",libelle:"Semelle de propreté béton 150kg/m³ (1 M3)",montantHT:1199.78,qte:1,unite:"M3",
      tempsMO:{heures:8,nbOuvriers:2,detail:"Préparation fonds fouilles, coulage béton de propreté"},
      fournitures:[
        {designation:"Béton C15 toupie",qte:1.2,unite:"m³",prixAchat:115,fournisseur:"Béton Express",prixPointP:125,prixGedimat:118},
        {designation:"Huile de décoffrage",qte:5,unite:"L",prixAchat:4.5,fournisseur:"Point P",prixPointP:4.5,prixGedimat:4.2},
      ]},
    {id:4,lot:"LOT 3 – FONDATION",libelle:"Fondations béton armé 350kg/m³ (15.5 M3) + armatures HA",montantHT:4918.93,qte:15.5,unite:"M3",
      tempsMO:{heures:48,nbOuvriers:4,detail:"Mise en place armatures, coulage béton C25, vibration"},
      fournitures:[
        {designation:"Béton C25 350kg/m³ toupie",qte:16.5,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
        {designation:"Armatures HA ø12",qte:180,unite:"kg",prixAchat:1.15,fournisseur:"Point P",prixPointP:1.15,prixGedimat:1.08},
        {designation:"Armatures HA ø10",qte:80,unite:"kg",prixAchat:1.10,fournisseur:"Point P",prixPointP:1.10,prixGedimat:1.05},
        {designation:"Fil de ligature",qte:5,unite:"kg",prixAchat:2.8,fournisseur:"Gedimat",prixPointP:3.2,prixGedimat:2.8},
        {designation:"Cales béton",qte:100,unite:"U",prixAchat:0.25,fournisseur:"Gedimat",prixPointP:0.30,prixGedimat:0.25},
      ]},
    // LOT 4
    {id:5,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Mur de soutènement agglos 20x20x50 – H0.70m (44 M2)",montantHT:2812.04,qte:44,unite:"M2",
      tempsMO:{heures:24,nbOuvriers:2,detail:"Montage agglos, jointement mortier, chaînage"},
      fournitures:[
        {designation:"Agglos creux 20x20x50",qte:220,unite:"U",prixAchat:1.85,fournisseur:"Point P",prixPointP:1.85,prixGedimat:1.75},
        {designation:"Mortier de maçonnerie 35kg",qte:12,unite:"sac",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"Armatures verticales HA10",qte:35,unite:"kg",prixAchat:1.10,fournisseur:"Point P",prixPointP:1.10,prixGedimat:1.05},
      ]},
    {id:6,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Plancher RDC poutrelles-hourdis polystyrène 16+4 (102.4 M2)",montantHT:10694.66,qte:102.4,unite:"M2",
      tempsMO:{heures:48,nbOuvriers:4,detail:"Pose poutrelles, hourdis polystyrène, treillis, dalle compression 4cm"},
      fournitures:[
        {designation:"Poutrelles béton précontraint",qte:55,unite:"U",prixAchat:28,fournisseur:"Point P",prixPointP:28,prixGedimat:27},
        {designation:"Hourdis polystyrène 16cm",qte:320,unite:"U",prixAchat:3.2,fournisseur:"Gedimat",prixPointP:3.5,prixGedimat:3.2},
        {designation:"Treillis soudé ST25C",qte:110,unite:"m²",prixAchat:4.8,fournisseur:"Point P",prixPointP:4.8,prixGedimat:4.5},
        {designation:"Béton C25 dalle compression",qte:6,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
        {designation:"Étançons",qte:20,unite:"U",prixAchat:12,fournisseur:"Kiloutou",prixPointP:14,prixGedimat:13},
      ]},
    {id:7,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Élévation RDC murs porteurs agglos 20x20x50 – H2.70m (147 M2)",montantHT:11649.75,qte:147,unite:"M2",
      tempsMO:{heures:80,nbOuvriers:4,detail:"Montage agglos, poteaux raidisseurs, linteaux, coffres VR, chaînage"},
      fournitures:[
        {designation:"Agglos creux 20x20x50",qte:1100,unite:"U",prixAchat:1.85,fournisseur:"Point P",prixPointP:1.85,prixGedimat:1.75},
        {designation:"Mortier de maçonnerie 35kg",qte:55,unite:"sac",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"Armatures HA 10/12",qte:280,unite:"kg",prixAchat:1.12,fournisseur:"Point P",prixPointP:1.12,prixGedimat:1.06},
        {designation:"Béton poteaux chaînages",qte:3.5,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
        {designation:"Coffres volets roulants",qte:5,unite:"U",prixAchat:85,fournisseur:"Point P",prixPointP:85,prixGedimat:82},
      ]},
    {id:8,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Linteau BA baie vitrée 5.15m",montantHT:1296.08,qte:1,unite:"U",
      tempsMO:{heures:16,nbOuvriers:3,detail:"Coffrage, ferraillage, coulage BA longrine 5.15m"},
      fournitures:[
        {designation:"Armatures HA12 et HA14",qte:45,unite:"kg",prixAchat:1.15,fournisseur:"Point P",prixPointP:1.15,prixGedimat:1.08},
        {designation:"Coffrage bois",qte:8,unite:"m²",prixAchat:22,fournisseur:"Gedimat",prixPointP:24,prixGedimat:22},
        {designation:"Béton C25",qte:0.8,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
      ]},
    {id:9,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Plancher R+1 poutrelles-hourdis polystyrène (84 M2)",montantHT:10554.60,qte:84,unite:"M2",
      tempsMO:{heures:40,nbOuvriers:4,detail:"Pose poutrelles, hourdis, trémie escalier, dalle compression"},
      fournitures:[
        {designation:"Poutrelles béton précontraint",qte:46,unite:"U",prixAchat:28,fournisseur:"Point P",prixPointP:28,prixGedimat:27},
        {designation:"Hourdis polystyrène 16cm",qte:260,unite:"U",prixAchat:3.2,fournisseur:"Gedimat",prixPointP:3.5,prixGedimat:3.2},
        {designation:"Treillis soudé ST25C",qte:90,unite:"m²",prixAchat:4.8,fournisseur:"Point P",prixPointP:4.8,prixGedimat:4.5},
        {designation:"Béton C25 dalle compression",qte:5,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
      ]},
    {id:10,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Élévation R+1 + pignon murs porteurs agglos (115 M2)",montantHT:9113.75,qte:115,unite:"M2",
      tempsMO:{heures:65,nbOuvriers:4,detail:"Montage R+1, pignons, linteaux 7 menuiseries, chaînage"},
      fournitures:[
        {designation:"Agglos creux 20x20x50",qte:860,unite:"U",prixAchat:1.85,fournisseur:"Point P",prixPointP:1.85,prixGedimat:1.75},
        {designation:"Mortier de maçonnerie 35kg",qte:42,unite:"sac",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"Armatures HA 10/12",qte:220,unite:"kg",prixAchat:1.12,fournisseur:"Point P",prixPointP:1.12,prixGedimat:1.06},
        {designation:"Béton poteaux chaînages R+1",qte:2.8,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
        {designation:"Coffres volets roulants R+1",qte:7,unite:"U",prixAchat:85,fournisseur:"Point P",prixPointP:85,prixGedimat:82},
      ]},
    {id:11,lot:"LOT 4 – ÉLÉVATION GROS ŒUVRE",libelle:"Escalier béton 2/4 tournant",montantHT:4469.05,qte:1,unite:"U",
      tempsMO:{heures:40,nbOuvriers:3,detail:"Traçage, coffrage, ferraillage, coulage béton C25 vibré taloché"},
      fournitures:[
        {designation:"Béton C25 350kg/m³",qte:2.5,unite:"m³",prixAchat:130,fournisseur:"Béton Express",prixPointP:140,prixGedimat:132},
        {designation:"Armatures HA10/12",qte:95,unite:"kg",prixAchat:1.12,fournisseur:"Point P",prixPointP:1.12,prixGedimat:1.06},
        {designation:"Coffrage bois escalier",qte:18,unite:"m²",prixAchat:22,fournisseur:"Gedimat",prixPointP:24,prixGedimat:22},
      ]},
    // LOT 5
    {id:12,lot:"LOT 5 – TOITURE",libelle:"Toiture complète 10.5x8m – charpente fermettes, tuiles mécaniques",montantHT:20000,qte:1,unite:"U",
      tempsMO:{heures:64,nbOuvriers:4,detail:"Charpente industrielle fermettes, écran HPV, tuiles mécaniques, accessoires"},
      fournitures:[
        {designation:"Charpente fermettes industrielles",qte:1,unite:"ENS",prixAchat:6800,fournisseur:"Point P",prixPointP:6800,prixGedimat:6600},
        {designation:"Tuiles mécaniques",qte:1050,unite:"U",prixAchat:0.95,fournisseur:"Gedimat",prixPointP:1.05,prixGedimat:0.95},
        {designation:"Écran HPV sous-toiture",qte:95,unite:"m²",prixAchat:2.8,fournisseur:"Point P",prixPointP:2.8,prixGedimat:2.6},
        {designation:"Faîtage + rives + accessoires",qte:1,unite:"ENS",prixAchat:850,fournisseur:"Gedimat",prixPointP:920,prixGedimat:850},
        {designation:"Liteaux bois",qte:180,unite:"ml",prixAchat:1.8,fournisseur:"Gedimat",prixPointP:2,prixGedimat:1.8},
      ]},
    // LOT 6
    {id:13,lot:"LOT 6 – GOUTTIÈRES",libelle:"Gouttière pendante demi-ronde PVC 100mm (31 ML)",montantHT:1612,qte:31,unite:"ML",
      tempsMO:{heures:8,nbOuvriers:1,detail:"Pose gouttières, crochets, naissances, collage"},
      fournitures:[
        {designation:"Gouttière PVC demi-ronde 100mm",qte:33,unite:"ml",prixAchat:5.5,fournisseur:"Point P",prixPointP:5.5,prixGedimat:5.2},
        {designation:"Crochets + accessoires",qte:1,unite:"ENS",prixAchat:85,fournisseur:"Point P",prixPointP:85,prixGedimat:80},
      ]},
    {id:14,lot:"LOT 6 – GOUTTIÈRES",libelle:"Descente EP PVC ø100mm (20 ML)",montantHT:880,qte:20,unite:"ML",
      tempsMO:{heures:4,nbOuvriers:1,detail:"Pose descentes EP, coudes 87°, colliers"},
      fournitures:[
        {designation:"Descente EP PVC 100mm",qte:22,unite:"ml",prixAchat:4.8,fournisseur:"Point P",prixPointP:4.8,prixGedimat:4.5},
        {designation:"Coudes 87° + colliers",qte:1,unite:"ENS",prixAchat:45,fournisseur:"Point P",prixPointP:45,prixGedimat:42},
      ]},
    // LOT 7
    {id:15,lot:"LOT 7 – PLOMBERIE",libelle:"Raccordement assainissement – disconnecteur, compteur, tubes PVC",montantHT:1347.56,qte:1,unite:"ENS",
      tempsMO:{heures:12,nbOuvriers:1,detail:"Disconnecteur laiton, compteur divisionnaire, tubes PVC 34/40 et 120/125"},
      fournitures:[
        {designation:"Disconnecteur laiton 20/27",qte:1,unite:"U",prixAchat:62,fournisseur:"Point P",prixPointP:62,prixGedimat:58},
        {designation:"Compteur divisionnaire EF/EC",qte:1,unite:"U",prixAchat:145,fournisseur:"Point P",prixPointP:145,prixGedimat:138},
        {designation:"Tube PVC 34/40 adduction",qte:11,unite:"ml",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"Tube PVC évacuation 120/125",qte:11,unite:"ml",prixAchat:12,fournisseur:"Point P",prixPointP:12,prixGedimat:11.5},
      ]},
    {id:16,lot:"LOT 7 – PLOMBERIE",libelle:"Distribution EF/EC + évacuation multicouche ø16 (80 ML)",montantHT:5209.12,qte:80,unite:"ML",
      tempsMO:{heures:28,nbOuvriers:2,detail:"Collecteurs sanitaires EF/EC, tubes multicouches ø16, PVC 100 et 40"},
      fournitures:[
        {designation:"Collecteur sanitaire EF/EC 10 départs",qte:2,unite:"U",prixAchat:185,fournisseur:"Point P",prixPointP:185,prixGedimat:178},
        {designation:"Tube multicouche ø16 EF/EC",qte:90,unite:"ml",prixAchat:4.2,fournisseur:"Point P",prixPointP:4.2,prixGedimat:3.9},
        {designation:"PVC évacuation 100mm",qte:12,unite:"ml",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"PVC évacuation 40mm",qte:14,unite:"ml",prixAchat:4.5,fournisseur:"Gedimat",prixPointP:5,prixGedimat:4.5},
        {designation:"Raccords + colliers divers",qte:1,unite:"ENS",prixAchat:120,fournisseur:"Point P",prixPointP:120,prixGedimat:115},
      ]},
    {id:17,lot:"LOT 7 – PLOMBERIE",libelle:"Chauffe-eau thermodynamique Thermor 250L",montantHT:2823.20,qte:1,unite:"ENS",
      tempsMO:{heures:8,nbOuvriers:1,detail:"Pose et raccordement chauffe-eau thermodynamique Aeromax 5"},
      fournitures:[
        {designation:"Chauffe-eau thermodynamique Thermor 250L",qte:1,unite:"U",prixAchat:1450,fournisseur:"Point P",prixPointP:1450,prixGedimat:1420},
        {designation:"Kit bypass + raccordements",qte:1,unite:"ENS",prixAchat:85,fournisseur:"Point P",prixPointP:85,prixGedimat:82},
      ]},
    // LOT 8
    {id:18,lot:"LOT 8 – ÉQUIPEMENTS SANITAIRES",libelle:"Mitigeurs encastrés Grohe lavabo x4",montantHT:2294.88,qte:4,unite:"U",
      tempsMO:{heures:8,nbOuvriers:1,detail:"Pose mitigeurs lavabo encastrables Grohe + bonde siphon inox"},
      fournitures:[
        {designation:"Mitigeur lavabo encastrable Grohe",qte:4,unite:"U",prixAchat:195,fournisseur:"Point P",prixPointP:195,prixGedimat:188},
        {designation:"Bonde siphon inox",qte:4,unite:"U",prixAchat:28,fournisseur:"Point P",prixPointP:28,prixGedimat:26},
      ]},
    {id:19,lot:"LOT 8 – ÉQUIPEMENTS SANITAIRES",libelle:"Colonnes de douche encastrées Grohe x2",montantHT:3071.86,qte:2,unite:"U",
      tempsMO:{heures:8,nbOuvriers:1,detail:"Pose kits mitigeurs douche encastrables Grohe"},
      fournitures:[
        {designation:"Kit mitigeur douche encastrable Grohe",qte:2,unite:"U",prixAchat:685,fournisseur:"Point P",prixPointP:685,prixGedimat:665},
      ]},
    {id:20,lot:"LOT 8 – ÉQUIPEMENTS SANITAIRES",libelle:"Caniveaux encastrés pack complet x2",montantHT:1643.82,qte:2,unite:"U",
      tempsMO:{heures:4,nbOuvriers:1,detail:"Pose caniveaux douche italienne, bonde, grille inox Caro"},
      fournitures:[
        {designation:"Caniveau douche italienne pack",qte:2,unite:"U",prixAchat:285,fournisseur:"Point P",prixPointP:285,prixGedimat:275},
      ]},
    {id:21,lot:"LOT 8 – ÉQUIPEMENTS SANITAIRES",libelle:"WC suspendus Geberit Duofix + Tesi x3",montantHT:3406.95,qte:3,unite:"U",
      tempsMO:{heures:9,nbOuvriers:1,detail:"Pose bâti-support Geberit UP320, cuvette AquaBlade Tesi, plaque Sigma01"},
      fournitures:[
        {designation:"Pack WC suspendu Geberit Sigma + Tesi",qte:3,unite:"U",prixAchat:685,fournisseur:"Point P",prixPointP:685,prixGedimat:665},
      ]},
    {id:22,lot:"LOT 8 – ÉQUIPEMENTS SANITAIRES",libelle:"Paroi de douche Walk In verre 8mm 80x200cm",montantHT:732,qte:1,unite:"U",
      tempsMO:{heures:3,nbOuvriers:1,detail:"Pose paroi fixe Walk In profil or mat"},
      fournitures:[
        {designation:"Paroi douche Walk In 80x200 verre 8mm",qte:1,unite:"U",prixAchat:385,fournisseur:"Point P",prixPointP:385,prixGedimat:370},
      ]},
    {id:23,lot:"LOT 8 – ÉQUIPEMENTS SANITAIRES",libelle:"Sèche-serviettes électriques x2",montantHT:1056,qte:2,unite:"U",
      tempsMO:{heures:4,nbOuvriers:1,detail:"Pose sèche-serviettes électriques glycol"},
      fournitures:[
        {designation:"Sèche-serviettes électrique glycol",qte:2,unite:"U",prixAchat:195,fournisseur:"Point P",prixPointP:195,prixGedimat:188},
      ]},
    // LOT 9
    {id:24,lot:"LOT 9 – ÉLECTRICITÉ",libelle:"Câbles prise courant H07V-U 2.5mm² (250 ML)",montantHT:4697.50,qte:250,unite:"ML",
      tempsMO:{heures:20,nbOuvriers:2,detail:"Tirage câbles 2.5mm² circuits prises"},
      fournitures:[
        {designation:"Câble H07V-U 2.5mm² 3G",qte:270,unite:"ml",prixAchat:1.85,fournisseur:"Point P",prixPointP:1.85,prixGedimat:1.75},
        {designation:"Tubes IRO gaines",qte:250,unite:"ml",prixAchat:0.85,fournisseur:"Point P",prixPointP:0.85,prixGedimat:0.80},
      ]},
    {id:25,lot:"LOT 9 – ÉLECTRICITÉ",libelle:"Câbles points lumineux R2V 1.5mm² (200 ML)",montantHT:2874,qte:200,unite:"ML",
      tempsMO:{heures:14,nbOuvriers:2,detail:"Tirage câbles 1.5mm² circuits éclairage"},
      fournitures:[
        {designation:"Câble R2V 1.5mm² 3G",qte:215,unite:"ml",prixAchat:1.45,fournisseur:"Point P",prixPointP:1.45,prixGedimat:1.38},
      ]},
    {id:26,lot:"LOT 9 – ÉLECTRICITÉ",libelle:"Câbles interrupteurs R2V 1.5mm² (200 ML)",montantHT:3072,qte:200,unite:"ML",
      tempsMO:{heures:14,nbOuvriers:2,detail:"Tirage câbles 1.5mm² circuits interrupteurs"},
      fournitures:[
        {designation:"Câble R2V 1.5mm² 2+3G",qte:215,unite:"ml",prixAchat:1.45,fournisseur:"Point P",prixPointP:1.45,prixGedimat:1.38},
      ]},
    {id:27,lot:"LOT 9 – ÉLECTRICITÉ",libelle:"Câbles RJ45 Cat6A Ethernet (100 ML)",montantHT:1315,qte:100,unite:"ML",
      tempsMO:{heures:8,nbOuvriers:1,detail:"Tirage câbles ethernet blindés Cat6A"},
      fournitures:[
        {designation:"Câble RJ45 Cat6A blindé",qte:110,unite:"ml",prixAchat:3.2,fournisseur:"Point P",prixPointP:3.2,prixGedimat:3.0},
      ]},
    {id:28,lot:"LOT 9 – ÉLECTRICITÉ",libelle:"Appareillages Schneider Neptune – interrupteurs, prises, spots",montantHT:3842.71,qte:1,unite:"ENS",
      tempsMO:{heures:20,nbOuvriers:2,detail:"Pose interrupteurs, prises 10/16A, prises RJ45, sorties câble, spots LED"},
      fournitures:[
        {designation:"Interrupteurs SA Schneider Neptune",qte:15,unite:"U",prixAchat:12,fournisseur:"Point P",prixPointP:12,prixGedimat:11.5},
        {designation:"Prises 10/16A 2P+T Schneider",qte:25,unite:"U",prixAchat:14.5,fournisseur:"Point P",prixPointP:14.5,prixGedimat:13.8},
        {designation:"Spots LED encastrés",qte:45,unite:"U",prixAchat:18.5,fournisseur:"Point P",prixPointP:18.5,prixGedimat:17.8},
        {designation:"Prises RJ45 + doubles TV",qte:11,unite:"U",prixAchat:28,fournisseur:"Point P",prixPointP:28,prixGedimat:26.5},
        {designation:"Boîtes d'encastrement",qte:103,unite:"U",prixAchat:0.85,fournisseur:"Gedimat",prixPointP:0.95,prixGedimat:0.85},
      ]},
    {id:29,lot:"LOT 9 – ÉLECTRICITÉ",libelle:"Tableau électrique 5 rangées encastré NF C 15-100",montantHT:2742,qte:1,unite:"U",
      tempsMO:{heures:12,nbOuvriers:1,detail:"Pose tableau encastré, disjoncteurs, étiquetage circuits"},
      fournitures:[
        {designation:"Tableau électrique 5 rangées",qte:1,unite:"U",prixAchat:185,fournisseur:"Point P",prixPointP:185,prixGedimat:178},
        {designation:"Disjoncteurs modulaires",qte:22,unite:"U",prixAchat:18.5,fournisseur:"Point P",prixPointP:18.5,prixGedimat:17.5},
        {designation:"Différentiels 40A",qte:4,unite:"U",prixAchat:45,fournisseur:"Point P",prixPointP:45,prixGedimat:43},
      ]},
    // LOT 10
    {id:30,lot:"LOT 10 – CLOISON PLÂTRERIE",libelle:"Faux plafond BA13 sur fourrure F47 RDC+R+1 (154 M2)",montantHT:10299.52,qte:154,unite:"M2",
      tempsMO:{heures:56,nbOuvriers:3,detail:"Pose fourrures F47, suspentes, plaques BA13, finition joints"},
      fournitures:[
        {designation:"Plaques BA13",qte:165,unite:"U",prixAchat:9.5,fournisseur:"Point P",prixPointP:9.5,prixGedimat:9.0},
        {designation:"Fourrure F47",qte:310,unite:"ml",prixAchat:1.85,fournisseur:"Point P",prixPointP:1.85,prixGedimat:1.75},
        {designation:"Suspentes réglables",qte:280,unite:"U",prixAchat:0.85,fournisseur:"Point P",prixPointP:0.85,prixGedimat:0.80},
        {designation:"Bande à joint + enduit",qte:1,unite:"ENS",prixAchat:185,fournisseur:"Gedimat",prixPointP:200,prixGedimat:185},
      ]},
    {id:31,lot:"LOT 10 – CLOISON PLÂTRERIE",libelle:"Membrane hygro-régulante Vario Xtra (105 M2)",montantHT:2357.25,qte:105,unite:"M2",
      tempsMO:{heures:12,nbOuvriers:2,detail:"Pose membrane Isover Vario Xtra pare-vapeur"},
      fournitures:[
        {designation:"Membrane Vario Xtra Isover",qte:4,unite:"rouleau",prixAchat:145,fournisseur:"Point P",prixPointP:145,prixGedimat:138},
        {designation:"Ruban adhésif chantier",qte:5,unite:"rouleau",prixAchat:12,fournisseur:"Point P",prixPointP:12,prixGedimat:11.5},
      ]},
    {id:32,lot:"LOT 10 – CLOISON PLÂTRERIE",libelle:"Cloisons doublage Optima laine verre 102mm (105 M2)",montantHT:7598.85,qte:105,unite:"M2",
      tempsMO:{heures:40,nbOuvriers:2,detail:"Pose cloisons doublage système Optima, laine de verre, BA13, finition"},
      fournitures:[
        {designation:"Plaques BA13 doublage",qte:115,unite:"U",prixAchat:9.5,fournisseur:"Point P",prixPointP:9.5,prixGedimat:9.0},
        {designation:"Rails + montants acier",qte:1,unite:"ENS",prixAchat:485,fournisseur:"Point P",prixPointP:485,prixGedimat:465},
        {designation:"Laine de verre 100mm",qte:108,unite:"m²",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"Bande à joint + enduit",qte:1,unite:"ENS",prixAchat:145,fournisseur:"Gedimat",prixPointP:155,prixGedimat:145},
      ]},
    {id:33,lot:"LOT 10 – CLOISON PLÂTRERIE",libelle:"Cloisons distribution Prégymetal double BA13 (108 M2)",montantHT:8976.96,qte:108,unite:"M2",
      tempsMO:{heures:44,nbOuvriers:2,detail:"Pose cloisons Prégymetal montants doubles, double BA13, laine verre"},
      fournitures:[
        {designation:"Plaques BA13 double",qte:235,unite:"U",prixAchat:9.5,fournisseur:"Point P",prixPointP:9.5,prixGedimat:9.0},
        {designation:"Rails + montants doubles",qte:1,unite:"ENS",prixAchat:685,fournisseur:"Point P",prixPointP:685,prixGedimat:658},
        {designation:"Laine de verre cloison",qte:115,unite:"m²",prixAchat:8.5,fournisseur:"Gedimat",prixPointP:9.2,prixGedimat:8.5},
        {designation:"Bande joint + enduit finition",qte:1,unite:"ENS",prixAchat:165,fournisseur:"Gedimat",prixPointP:178,prixGedimat:165},
      ]},
    {id:34,lot:"LOT 10 – CLOISON PLÂTRERIE",libelle:"Isolation comble perdu laine verre kraft R7.5 (71 M2)",montantHT:1998.65,qte:71,unite:"M2",
      tempsMO:{heures:8,nbOuvriers:2,detail:"Pose laine de verre TI212 en combles perdus"},
      fournitures:[
        {designation:"Laine verre kraft TI212 R7.5",qte:3,unite:"rouleau",prixAchat:145,fournisseur:"Gedimat",prixPointP:155,prixGedimat:145},
      ]},
    // LOT 11
    {id:35,lot:"LOT 11 – CLIMATISATION",libelle:"PAC air-air gainable Mitsubishi PEAD-SM100JA 9.5kW",montantHT:10937.61,qte:1,unite:"ENS",
      tempsMO:{heures:24,nbOuvriers:2,detail:"Pose PAC gainable, réseau gaines, bouches soufflage, raccordement électrique"},
      fournitures:[
        {designation:"PAC gainable Mitsubishi PEAD-SM100JA",qte:1,unite:"U",prixAchat:4850,fournisseur:"Point P",prixPointP:4850,prixGedimat:4780},
        {designation:"Réseau de gaines + bouches",qte:1,unite:"ENS",prixAchat:680,fournisseur:"Point P",prixPointP:680,prixGedimat:650},
        {designation:"Câble alimentation + protection",qte:1,unite:"ENS",prixAchat:145,fournisseur:"Point P",prixPointP:145,prixGedimat:138},
      ]},
    // LOT 12
    {id:36,lot:"LOT 12 – MENUISERIE",libelle:"Blocs-portes Séville chêne nervuré H204xL83cm x8",montantHT:3583.20,qte:8,unite:"UN",
      tempsMO:{heures:24,nbOuvriers:2,detail:"Pose blocs-portes complets avec huisseries, paumelles, quincaillerie"},
      fournitures:[
        {designation:"Bloc-porte Séville chêne nervuré",qte:8,unite:"U",prixAchat:245,fournisseur:"Point P",prixPointP:245,prixGedimat:238},
        {designation:"Quincaillerie (poignées + serrures)",qte:8,unite:"ENS",prixAchat:35,fournisseur:"Point P",prixPointP:35,prixGedimat:32},
      ]},
    {id:37,lot:"LOT 12 – MENUISERIE",libelle:"Systèmes porte galandage Scrigno x2",montantHT:3054.86,qte:2,unite:"UN",
      tempsMO:{heures:10,nbOuvriers:2,detail:"Pose châssis galandage Scrigno, porte chêne plaqué"},
      fournitures:[
        {designation:"Châssis galandage Scrigno plein",qte:2,unite:"U",prixAchat:485,fournisseur:"Point P",prixPointP:485,prixGedimat:468},
        {designation:"Porte chêne plaqué recoupable",qte:2,unite:"U",prixAchat:185,fournisseur:"Point P",prixPointP:185,prixGedimat:178},
      ]},
    // LOT 13
    {id:38,lot:"LOT 13 – CHAPE LIQUIDE",libelle:"Préparation avant chape – dépoussiérage, protection, primaire",montantHT:615.68,qte:1,unite:"ENS",
      tempsMO:{heures:8,nbOuvriers:2,detail:"Dépoussiérage support, protection murs 30cm, primaire d'accrochage"},
      fournitures:[
        {designation:"Primaire d'accrochage",qte:4,unite:"bidon",prixAchat:28,fournisseur:"Gedimat",prixPointP:32,prixGedimat:28},
        {designation:"Film de protection murs",qte:50,unite:"ml",prixAchat:1.2,fournisseur:"Gedimat",prixPointP:1.4,prixGedimat:1.2},
      ]},
    {id:39,lot:"LOT 13 – CHAPE LIQUIDE",libelle:"Chape liquide sulfate calcium autonivelante C20-F4 (15 M3)",montantHT:4275,qte:15,unite:"M3",
      tempsMO:{heures:16,nbOuvriers:2,detail:"Chape SP anhydrite autonivelante livrée en camion malaxeur"},
      fournitures:[
        {designation:"Chape liquide anhydrite camion",qte:15.5,unite:"m³",prixAchat:185,fournisseur:"Béton Express",prixPointP:198,prixGedimat:190},
      ]},
    {id:40,lot:"LOT 13 – CHAPE LIQUIDE",libelle:"Ponçage chape grain fin",montantHT:328,qte:1,unite:"ENS",
      tempsMO:{heures:6,nbOuvriers:1,detail:"Ponçage machine grain fin après séchage"},
      fournitures:[
        {designation:"Disques abrasifs grain fin",qte:1,unite:"ENS",prixAchat:45,fournisseur:"Point P",prixPointP:45,prixGedimat:42},
      ]},
    // LOT 14
    {id:41,lot:"LOT 14 – SOL INTÉRIEUR",libelle:"Préparation sol avant carrelage – dépoussiérage, primaire",montantHT:602.16,qte:1,unite:"ENS",
      tempsMO:{heures:6,nbOuvriers:1,detail:"Dépoussiérage, primaire d'accrochage sol"},
      fournitures:[
        {designation:"Primaire d'accrochage sol",qte:4,unite:"bidon",prixAchat:28,fournisseur:"Gedimat",prixPointP:32,prixGedimat:28},
      ]},
    {id:42,lot:"LOT 14 – SOL INTÉRIEUR",libelle:"Carrelage grand format 120x120 double encollage (154 M2)",montantHT:18379.90,qte:154,unite:"M2",
      tempsMO:{heures:72,nbOuvriers:3,detail:"Pose carrelage 120x120 double encollage colle flex, coupes, joints"},
      fournitures:[
        {designation:"Carrelage 120x120 (PA moyen 50€/m²)",qte:162,unite:"m²",prixAchat:50,fournisseur:"Gedimat",prixPointP:58,prixGedimat:50},
        {designation:"Ciment-colle flex C2S1",qte:55,unite:"sac",prixAchat:28.5,fournisseur:"Point P",prixPointP:28.5,prixGedimat:27},
        {designation:"Joint de carrelage",qte:25,unite:"sac",prixAchat:12.5,fournisseur:"Point P",prixPointP:12.5,prixGedimat:11.8},
        {designation:"Croisillons 3mm",qte:5,unite:"paquet",prixAchat:6.5,fournisseur:"Gedimat",prixPointP:7.2,prixGedimat:6.5},
      ]},
    // LOT 15
    {id:43,lot:"LOT 15 – CARRELAGE SDB",libelle:"Étanchéité sous carrelage zone douche KERDI",montantHT:793.08,qte:1,unite:"U",
      tempsMO:{heures:6,nbOuvriers:1,detail:"Pose natte KERDI sol et mur zone douche"},
      fournitures:[
        {designation:"Natte étanchéité Schlüter KERDI",qte:12,unite:"m²",prixAchat:22,fournisseur:"Point P",prixPointP:22,prixGedimat:21},
        {designation:"Colle à carrelage KERDI",qte:3,unite:"sac",prixAchat:28.5,fournisseur:"Point P",prixPointP:28.5,prixGedimat:27},
      ]},
    {id:44,lot:"LOT 15 – CARRELAGE SDB",libelle:"Faïence murale SDB principale (24 M2)",montantHT:2835.60,qte:24,unite:"M2",
      tempsMO:{heures:14,nbOuvriers:1,detail:"Pose faïence double encollage ciment-colle flex, coupes, joints"},
      fournitures:[
        {designation:"Faïence murale (PA ~50€/m²)",qte:26,unite:"m²",prixAchat:50,fournisseur:"Gedimat",prixPointP:58,prixGedimat:50},
        {designation:"Ciment-colle flex C2S1",qte:9,unite:"sac",prixAchat:28.5,fournisseur:"Point P",prixPointP:28.5,prixGedimat:27},
      ]},
    {id:45,lot:"LOT 15 – CARRELAGE SDB",libelle:"Faïence murale suite parentale (15 M2)",montantHT:1772.25,qte:15,unite:"M2",
      tempsMO:{heures:9,nbOuvriers:1,detail:"Pose faïence double encollage"},
      fournitures:[
        {designation:"Faïence murale suite (PA ~50€/m²)",qte:17,unite:"m²",prixAchat:50,fournisseur:"Gedimat",prixPointP:58,prixGedimat:50},
        {designation:"Ciment-colle flex C2S1",qte:6,unite:"sac",prixAchat:28.5,fournisseur:"Point P",prixPointP:28.5,prixGedimat:27},
      ]},
    {id:46,lot:"LOT 15 – CARRELAGE SDB",libelle:"Faïence chambre invité (25 M2)",montantHT:2953.75,qte:25,unite:"M2",
      tempsMO:{heures:14,nbOuvriers:1,detail:"Pose faïence double encollage"},
      fournitures:[
        {designation:"Faïence chambre invité (PA ~50€/m²)",qte:27,unite:"m²",prixAchat:50,fournisseur:"Gedimat",prixPointP:58,prixGedimat:50},
        {designation:"Ciment-colle flex C2S1",qte:9,unite:"sac",prixAchat:28.5,fournisseur:"Point P",prixPointP:28.5,prixGedimat:27},
      ]},
    // LOT 16
    {id:47,lot:"LOT 16 – PEINTURE",libelle:"Préparation – protection, ponçage joints, sous-couche airless (100+473 M2)",montantHT:10080.40,qte:573,unite:"M2",
      tempsMO:{heures:56,nbOuvriers:3,detail:"Protection bâches, ponçage joints 240, enduit garnissant Airliss G airless, sous-couche"},
      fournitures:[
        {designation:"Bâche auto-adhésive protection",qte:6,unite:"rouleau",prixAchat:28,fournisseur:"Point P",prixPointP:28,prixGedimat:26.5},
        {designation:"Enduit garnissant Airliss G Bagar 25kg",qte:18,unite:"sac",prixAchat:32,fournisseur:"Gedimat",prixPointP:35,prixGedimat:32},
        {designation:"Sous-couche universelle Seigneurie 10L",qte:8,unite:"bidon",prixAchat:38,fournisseur:"Point P",prixPointP:38,prixGedimat:36.5},
        {designation:"Abrasif grain 240",qte:3,unite:"paquet",prixAchat:18,fournisseur:"Gedimat",prixPointP:20,prixGedimat:18},
      ]},
    {id:48,lot:"LOT 16 – PEINTURE",libelle:"Peinture plafond 2 couches alkyde (154 M2)",montantHT:2964.50,qte:154,unite:"M2",
      tempsMO:{heures:28,nbOuvriers:2,detail:"2 couches peinture mate alkyde plafond au rouleau"},
      fournitures:[
        {designation:"Peinture plafond mate alkyde 15L",qte:8,unite:"bidon",prixAchat:52,fournisseur:"Point P",prixPointP:52,prixGedimat:49.5},
        {designation:"Rouleau + plateau",qte:4,unite:"U",prixAchat:12.5,fournisseur:"Gedimat",prixPointP:14,prixGedimat:12.5},
      ]},
    {id:49,lot:"LOT 16 – PEINTURE",libelle:"Peinture mur 2 couches alkyde (319 M2)",montantHT:5582.50,qte:319,unite:"M2",
      tempsMO:{heures:40,nbOuvriers:2,detail:"2 couches peinture mate alkyde murs au rouleau"},
      fournitures:[
        {designation:"Peinture mur mate alkyde 15L",qte:14,unite:"bidon",prixAchat:52,fournisseur:"Point P",prixPointP:52,prixGedimat:49.5},
        {designation:"Rouleau + plateau + brosses",qte:4,unite:"ENS",prixAchat:18,fournisseur:"Gedimat",prixPointP:20,prixGedimat:18},
      ]},
    // LOT 17
    {id:50,lot:"LOT 17 – ENDUIT FAÇADE",libelle:"Échafaudage – montage, démontage, transport",montantHT:950,qte:1,unite:"ENS",
      tempsMO:{heures:12,nbOuvriers:2,detail:"Montage démontage échafaudage façade, transport A/R"},
      fournitures:[
        {designation:"Location échafaudage 3 semaines",qte:1,unite:"ENS",prixAchat:485,fournisseur:"Kiloutou",prixPointP:520,prixGedimat:495},
      ]},
    {id:51,lot:"LOT 17 – ENDUIT FAÇADE",libelle:"Enduit façade 2 couches gobetis + finition (313 M2)",montantHT:11894,qte:313,unite:"M2",
      tempsMO:{heures:80,nbOuvriers:4,detail:"1ère couche gobetis accrochage, 2ème couche finition 5-8mm, teinte à définir"},
      fournitures:[
        {designation:"Enduit façade monocouche 25kg",qte:85,unite:"sac",prixAchat:22.5,fournisseur:"Gedimat",prixPointP:24.5,prixGedimat:22.5},
        {designation:"Filet armé de renfort",qte:95,unite:"m²",prixAchat:3.8,fournisseur:"Point P",prixPointP:3.8,prixGedimat:3.6},
        {designation:"Armatures angle PVC",qte:80,unite:"ml",prixAchat:1.8,fournisseur:"Gedimat",prixPointP:2.0,prixGedimat:1.8},
      ]},
    // LOT 18
    {id:52,lot:"LOT 18 – FIN DE TRAVAUX",libelle:"Repliement matériel, nettoyage fin de chantier",montantHT:350,qte:1,unite:"ENS",
      tempsMO:{heures:12,nbOuvriers:3,detail:"Ramassage détritus, sacs gravats, décharge, nettoyage final"},
      fournitures:[
        {designation:"Sacs à gravats",qte:20,unite:"U",prixAchat:1.8,fournisseur:"Gedimat",prixPointP:2.0,prixGedimat:1.8},
      ]},
  ],
  planning:[
    {id:1,tache:"Installation chantier + protections",dateDebut:"2025-10-15",dureeJours:2,salariesIds:[1,2,6],posteId:1},
    {id:2,tache:"Terrassements – fouilles fondations",dateDebut:"2025-10-18",dureeJours:5,salariesIds:[1,2,3,6],posteId:2},
    {id:3,tache:"Fondations – semelle propreté + béton armé",dateDebut:"2025-10-25",dureeJours:6,salariesIds:[1,2,3,6],posteId:4},
    {id:4,tache:"Élévation RDC – murs porteurs + plancher",dateDebut:"2025-11-05",dureeJours:18,salariesIds:[1,2,3,4,6],posteId:7},
    {id:5,tache:"Escalier béton 2/4 tournant",dateDebut:"2025-11-28",dureeJours:5,salariesIds:[1,2,3],posteId:11},
    {id:6,tache:"Élévation R+1 + pignon",dateDebut:"2025-12-05",dureeJours:15,salariesIds:[1,2,3,6],posteId:10},
    {id:7,tache:"Toiture charpente + couverture",dateDebut:"2025-12-22",dureeJours:8,salariesIds:[1,2,3,6],posteId:12},
    {id:8,tache:"Gouttières + descentes EP",dateDebut:"2026-01-05",dureeJours:2,salariesIds:[1,3],posteId:13},
    {id:9,tache:"Plomberie distribution EF/EC",dateDebut:"2026-01-08",dureeJours:6,salariesIds:[1,2],posteId:16},
    {id:10,tache:"Électricité – câblage complet",dateDebut:"2026-01-15",dureeJours:12,salariesIds:[1,2,3],posteId:24},
    {id:11,tache:"Cloisons + plâtrerie + faux plafonds",dateDebut:"2026-01-30",dureeJours:18,salariesIds:[1,2,3,4,5],posteId:30},
    {id:12,tache:"Climatisation gainable",dateDebut:"2026-02-20",dureeJours:3,salariesIds:[1,2],posteId:35},
    {id:13,tache:"Chape liquide",dateDebut:"2026-02-25",dureeJours:4,salariesIds:[1,4],posteId:39},
    {id:14,tache:"Menuiseries intérieures + galandages",dateDebut:"2026-03-02",dureeJours:5,salariesIds:[1,3],posteId:36},
    {id:15,tache:"Carrelage sol 120x120",dateDebut:"2026-03-10",dureeJours:10,salariesIds:[1,4,5],posteId:42},
    {id:16,tache:"Carrelage + faïence salles de bain",dateDebut:"2026-03-22",dureeJours:8,salariesIds:[1,4],posteId:44},
    {id:17,tache:"Équipements sanitaires",dateDebut:"2026-04-02",dureeJours:4,salariesIds:[1,2],posteId:18},
    {id:18,tache:"Enduit façade",dateDebut:"2026-04-08",dureeJours:10,salariesIds:[1,2,3,5],posteId:51},
    {id:19,tache:"Peinture intérieure complète",dateDebut:"2026-04-20",dureeJours:12,salariesIds:[1,5,6],posteId:47},
  ],
};


const ENTREPRISE_INIT = {
  nom:"France Habitat Rénovation Construction",nomCourt:"France Habitat",
  siret:"513 640 227 00031",statut:"sarl",tva:true,
  adresse:"48 route de la Valentine, 13013 Marseille",
  tel:"06.50.18.00.09",email:"contact@france-habitat.com",
  activite:"Maçonnerie, carrelage, rénovation",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function euro(n){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n||0);}
function pct(v,t){return !t?0:Math.round((v/t)*100);}
function fmt2(n){return new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2}).format(n||0);}

// Coût MO d'une tâche planning basé sur salariés globaux
function coutTache(tache, salaries){
  return (tache.salariesIds||[]).reduce((a,sid)=>{
    const s=salaries.find(x=>x.id===sid);
    if(!s)return a;
    return a+tache.dureeJours*8*s.tauxHoraire*(1+s.chargesPatron);
  },0);
}

// Prix fournitures retenu (le plus bas des 3 fournisseurs)
function prixRetenuFourn(f){
  const prix=[f.prixAchat,f.prixPointP,f.prixGedimat].filter(Boolean);
  return Math.min(...prix);
}

// Calcul complet rentabilité chantier
function rentaChantier(ch, salaries){
  const coutMO=(ch.planning||[]).reduce((a,t)=>a+coutTache(t,salaries),0);
  const coutFourn=(ch.postes||[]).reduce((a,p)=>
    a+(p.fournitures||[]).reduce((b,f)=>b+f.qte*prixRetenuFourn(f),0),0);
  const depR=(ch.depensesReelles||[]).reduce((a,x)=>a+x.montant,0);
  const totalCouts=coutMO+coutFourn+depR;
  const marge=ch.devisHT-totalCouts;
  const tauxMarge=pct(marge,ch.devisHT);
  const totalH=(ch.planning||[]).reduce((a,t)=>a+t.dureeJours*8*(t.salariesIds||[]).length,0);
  return{coutMO,coutFourn,depR,totalCouts,marge,tauxMarge,totalH};
}

// ─── CALCUL AUTO PAR LIGNE DE DEVIS ──────────────────────────────────────────
// Pour chaque désignation saisie dans un devis, calcule automatiquement :
// MO estimée, fournitures, prix de revient, marge, coefficient
const TAUX_MO_MOYEN = 13.5; // €/h taux moyen ouvrier qualifié chargé
const CHARGES_PATRON = 0.42;

// Référentiel rendement BTP (heures par unité selon type de travaux)
const RENDEMENTS = {
  "dalle béton":     {h:1.2,  nb:3, fourn_pct:0.55},
  "maçonnerie":      {h:0.8,  nb:2, fourn_pct:0.45},
  "carrelage":       {h:0.6,  nb:2, fourn_pct:0.50},
  "faïence":         {h:0.7,  nb:1, fourn_pct:0.52},
  "enduit façade":   {h:0.4,  nb:3, fourn_pct:0.38},
  "peinture":        {h:0.25, nb:2, fourn_pct:0.32},
  "plâtrerie":       {h:0.55, nb:2, fourn_pct:0.45},
  "faux plafond":    {h:0.5,  nb:2, fourn_pct:0.42},
  "plomberie":       {h:2.5,  nb:1, fourn_pct:0.55},
  "électricité":     {h:2.0,  nb:1, fourn_pct:0.50},
  "menuiserie":      {h:3.0,  nb:2, fourn_pct:0.60},
  "toiture":         {h:1.5,  nb:4, fourn_pct:0.55},
  "isolation":       {h:0.4,  nb:2, fourn_pct:0.48},
  "chape":           {h:0.3,  nb:2, fourn_pct:0.58},
  "sanitaire":       {h:3.0,  nb:1, fourn_pct:0.65},
  "default":         {h:1.0,  nb:2, fourn_pct:0.48},
};

function detectRendement(libelle){
  const l=(libelle||"").toLowerCase();
  if(l.includes("dalle")||l.includes("béton")||l.includes("fondation"))return RENDEMENTS["dalle béton"];
  if(l.includes("maçon")||l.includes("mur")||l.includes("agglo")||l.includes("parpaing"))return RENDEMENTS["maçonnerie"];
  if(l.includes("carrelage")||l.includes("sol intérieur")||l.includes("120x120"))return RENDEMENTS["carrelage"];
  if(l.includes("faïence")||l.includes("mur salle"))return RENDEMENTS["faïence"];
  if(l.includes("enduit façade")||l.includes("façade"))return RENDEMENTS["enduit façade"];
  if(l.includes("peinture"))return RENDEMENTS["peinture"];
  if(l.includes("plâtr")||l.includes("cloison")||l.includes("doublage"))return RENDEMENTS["plâtrerie"];
  if(l.includes("faux plafond")||l.includes("ba13"))return RENDEMENTS["faux plafond"];
  if(l.includes("plomb")||l.includes("eau")||l.includes("sanitaire")&&!l.includes("wc"))return RENDEMENTS["plomberie"];
  if(l.includes("électr")||l.includes("câble")||l.includes("tableau"))return RENDEMENTS["électricité"];
  if(l.includes("menuis")||l.includes("porte")||l.includes("galandage"))return RENDEMENTS["menuiserie"];
  if(l.includes("toiture")||l.includes("charpente")||l.includes("tuile"))return RENDEMENTS["toiture"];
  if(l.includes("isolat")||l.includes("laine"))return RENDEMENTS["isolation"];
  if(l.includes("chape")||l.includes("anhydrite"))return RENDEMENTS["chape"];
  if(l.includes("wc")||l.includes("mitigeur")||l.includes("douche")||l.includes("chauffe"))return RENDEMENTS["sanitaire"];
  return RENDEMENTS["default"];
}

// ─── HIÉRARCHIE DEVIS (Mediabat) ──────────────────────────────────────────────
// Les `lignes` d'un devis sont une liste plate où chaque item a un `type` :
//  - "titre"     : section principale (ex. "GROS ŒUVRE")
//  - "soustitre" : sous-section (ex. "Maçonnerie")
//  - "ligne"     : ouvrage chiffré (qte × P.U. → MO/fournitures/marge)
// Compat : un item sans `type` est traité comme "ligne".
function isLigneDevis(l){return !l?.type||l.type==="ligne";}
function calcDocSubtotals(items){
  const titreSubs=new Map(),sousTitreSubs=new Map();
  let curTitre=null,curSousTitre=null;
  for(const it of items||[]){
    if(it.type==="titre"){curTitre=it.id;curSousTitre=null;if(!titreSubs.has(it.id))titreSubs.set(it.id,0);}
    else if(it.type==="soustitre"){curSousTitre=it.id;if(!sousTitreSubs.has(it.id))sousTitreSubs.set(it.id,0);}
    else{
      const ht=(+it.qte||0)*(+it.prixUnitHT||0);
      if(curTitre!=null)titreSubs.set(curTitre,(titreSubs.get(curTitre)||0)+ht);
      if(curSousTitre!=null)sousTitreSubs.set(curSousTitre,(sousTitreSubs.get(curSousTitre)||0)+ht);
    }
  }
  return{titreSubs,sousTitreSubs};
}

// Convertit un doc devis en objet chantier prêt à être ajouté au state.
// - postes : 1 par ligne chiffrée, regroupés par titre (champ `lot`)
// - planning : 1 phase par titre, dateDebut espacée de 7 jours, budgetHT = sous-total
function devisVersChantier(doc){
  const items=doc.lignes||[];
  const {titreSubs}=calcDocSubtotals(items);
  const today=new Date().toISOString().slice(0,10);

  // Calcul HT/TVA réels
  const lignesChiffrees=items.filter(isLigneDevis);
  const ht=+lignesChiffrees.reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0).toFixed(2);
  const tva=+lignesChiffrees.reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0)*((+l.tva||0)/100),0).toFixed(2);
  const ttc=+(ht+tva).toFixed(2);

  // Postes (un par ligne) + agrégation des salariés assignés par titre
  let curTitreLib=null,curTitreId=null;
  const postes=[];
  const salariesParTitre=new Map(); // titreId -> Set<salarieId>
  let posteId=1;
  for(const it of items){
    if(it.type==="titre"){
      curTitreLib=it.libelle||"Lot";
      curTitreId=it.id;
      if(!salariesParTitre.has(it.id))salariesParTitre.set(it.id,new Set());
      continue;
    }
    if(it.type==="soustitre")continue;
    postes.push({
      id:posteId++,
      lot:curTitreLib||"Lot principal",
      libelle:it.libelle||"",
      montantHT:+((+it.qte||0)*(+it.prixUnitHT||0)).toFixed(2),
      qte:+it.qte||0,
      unite:it.unite||"",
      tempsMO:{heures:+it.heuresPrevues||0,nbOuvriers:+it.nbOuvriers||1,detail:""},
      fournitures:it.fournitures||[],
    });
    if(curTitreId!=null&&Array.isArray(it.salariesAssignes)){
      const set=salariesParTitre.get(curTitreId);
      for(const sid of it.salariesAssignes)set.add(sid);
    }
  }

  // Planning : un par titre, 7 jours par défaut, dates incrémentées,
  // salariesIds = union des salariesAssignes des lignes du titre
  const titres=items.filter(it=>it.type==="titre");
  const start=new Date(today);
  const planning=titres.map((t,i)=>{
    const d=new Date(start);d.setDate(d.getDate()+i*7);
    return{
      id:Date.now()+i,
      tache:t.libelle||`Phase ${i+1}`,
      dateDebut:d.toISOString().slice(0,10),
      dureeJours:7,
      salariesIds:Array.from(salariesParTitre.get(t.id)||[]),
      posteId:null,
      budgetHT:+(titreSubs.get(t.id)||0).toFixed(2),
    };
  });

  return{
    id:Date.now(),
    nom:doc.titreChantier||doc.client||`Chantier ${doc.numero}`,
    client:doc.client||"",
    adresse:doc.adresseClient||"",
    statut:"en cours",
    dateDebut:today,
    dateFin:"",
    devisHT:ht,devisTTC:ttc,tva:20,
    acompteEncaisse:0,soldeEncaisse:0,
    notes:`Chantier créé depuis le ${doc.type||"devis"} ${doc.numero} du ${doc.date}.`,
    devisId:doc.id,
    checklist:{},photos:[],facturesFournisseurs:[],depensesReelles:[],
    postes,planning,
  };
}

function calcLigneDevis(ligne, statut){
  const s=STATUTS[statut];
  const {qte,prixUnitHT,libelle,unite}=ligne;
  const montantHT=qte*prixUnitHT;
  if(!montantHT||montantHT<0)return null;

  const rend=detectRendement(libelle||"");

  // MO : heures * taux moyen chargé
  // Pour les unités surfaces, h/m² ; pour U/F/ENS, h total
  const isUnite=["U","F","ENS","u","f","ens"].includes(unite);
  const hTotal=ligne.heuresPrevues>0?ligne.heuresPrevues*qte:rend.h*qte*rend.nb;
  const tauxMOCharge=TAUX_MO_MOYEN*(1+CHARGES_PATRON);
  const coutMO=hTotal*tauxMOCharge;
  const coutFourn=ligne.fournitures?.length>0?ligne.fournitures.reduce((a,f)=>a+(+(f.prixVente||f.prixAchat||0)*(+(f.qte||1))),0):montantHT*rend.fourn_pct;
  // Frais généraux selon statut
  const tauxFG = s?.tauxCharges||0.45;
  const fraisGeneraux = coutMO*tauxFG;

  // Prix de revient
  const prixRevient = coutMO+coutFourn+fraisGeneraux;

  // Marge
  const marge = montantHT-prixRevient;
  const tauxMarge = montantHT>0?Math.round((marge/montantHT)*100):0;

  // Coefficient de vente
  const coeff = prixRevient>0?Math.round((montantHT/prixRevient)*100)/100:0;

  return{
    montantHT,coutMO,hTotal:Math.round(hTotal*10)/10,nbOuv:rend.nb,
    coutFourn,fraisGeneraux,prixRevient,marge,tauxMarge,coeff,
    tauxFournPct:Math.round(rend.fourn_pct*100),
  };
}

// ─── GÉNÉRATEUR IA LOCAL (sans connexion) ────────────────────────────────────
function genDesignationLocale(ctx){
  const {libelle,qte,unite,fourn,tempsMO,nbOuv,prixHT}=ctx;
  const hasFourn=fourn&&fourn.length>0;
  const fournituresStr=hasFourn?fourn.slice(0,3).map(f=>`${f.designation} (${f.qte} ${f.unite})`).join(", "):"";
  const moStr=tempsMO?`Temps estimé : ${tempsMO.heures}h / ${tempsMO.nbOuvriers||1} ouvrier${tempsMO.nbOuvriers>1?"s":""}. `:"";
  const lib=libelle||"prestation";

  return {
    courte:`Fourniture et pose — ${lib}. Quantité : ${qte} ${unite}. Toutes sujétions comprises.`,

    detaillee:`Fourniture et pose de ${lib.toLowerCase()}, quantité ${qte} ${unite} au prix unitaire de ${fmt2(prixHT)} € HT.\n${hasFourn?`Fournitures principales : ${fournituresStr}. `:""}${moStr}Mise en œuvre dans les règles de l'art, y compris préparation du support, fixations, coupes et ajustements. Finitions soignées. Nettoyage en fin d'intervention.`,

    technique:`Fourniture et pose de ${lib.toLowerCase()} — Quantité : ${qte} ${unite} — P.U. HT : ${fmt2(prixHT)} €.\n${hasFourn?`Fournitures : ${fournituresStr}. `:""}${moStr}Mise en œuvre conforme aux DTU et normes en vigueur. Contrôle qualité inclus. Évacuation des déchets.`,

    commerciale:`Réalisation complète de ${lib.toLowerCase()} dans le cadre de votre projet.\nNous prenons en charge l'ensemble de la prestation : fourniture des matériaux${hasFourn?` (${fourn[0]?.designation||""}, etc.)`:""},  pose professionnelle par nos équipes qualifiées${nbOuv?` (${nbOuv} intervenant${nbOuv>1?"s":""} dédiés)`:""}. Prix tout compris : ${fmt2(prixHT)} € HT / ${unite}. Travail soigné, délais respectés, garantie décennale.`,
  };
}


// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function Card({children,style,onClick}){return <div onClick={onClick} style={{background:L.card,border:`1px solid ${L.border}`,borderRadius:12,boxShadow:L.shadow,transition:"box-shadow .2s",cursor:onClick?"pointer":undefined,...style}}>{children}</div>;}

function KPI({label,value,sub,color,icon,onClick}){
  return(
    <div onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined}
      onKeyDown={onClick?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick(e);}}:undefined}
      style={{background:L.card,border:`1px solid ${L.border}`,borderRadius:12,padding:"14px 16px",flex:1,minWidth:130,boxShadow:L.shadow,cursor:onClick?"pointer":"default",transition:"box-shadow .15s, border-color .15s, transform .12s"}}
      onMouseEnter={onClick?e=>{e.currentTarget.style.borderColor=color||L.navy;e.currentTarget.style.boxShadow=L.shadowMd;}:undefined}
      onMouseLeave={onClick?e=>{e.currentTarget.style.borderColor=L.border;e.currentTarget.style.boxShadow=L.shadow;}:undefined}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",letterSpacing:0.6}}>{label}</div>
        {icon&&<span style={{fontSize:16}}>{icon}</span>}
      </div>
      <div style={{fontSize:20,fontWeight:800,color:color||L.navy,letterSpacing:-0.5}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:L.textXs,marginTop:3}}>{sub}</div>}
    </div>
  );
}

const STATUT_CFG={
  "en cours":{c:L.green,b:L.greenBg},"planifié":{c:L.blue,b:L.blueBg},
  "terminé":{c:L.textSm,b:L.bg},"annulé":{c:L.red,b:L.redBg},
  "accepté":{c:L.green,b:L.greenBg},"en attente":{c:L.orange,b:L.orangeBg},
  "envoyé":{c:L.blue,b:L.blueBg},
  "refusé":{c:L.red,b:L.redBg},"brouillon":{c:L.textSm,b:L.bg},
  "payé":{c:L.green,b:L.greenBg},"devis":{c:L.blue,b:L.blueBg},"facture":{c:L.teal,b:"#F0FDFA"},
};
const STATUTS_DEVIS=["brouillon","envoyé","en attente","accepté","refusé"];
const STATUTS_FACTURE=["en attente","payé","annulé"];
const STATUTS_CHANTIER=["planifié","en cours","terminé","annulé"];

function Badge({children,color,bg}){
  const cfg=STATUT_CFG[children]||{c:color||L.textSm,b:bg||L.bg};
  return <span style={{background:cfg.b,color:cfg.c,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>;
}

// Statut éditable inline : select stylé comme un badge
function StatutSelect({value,options,onChange}){
  const cfg=STATUT_CFG[value]||{c:L.textSm,b:L.bg};
  return(
    <select value={value||""} onChange={e=>{e.stopPropagation();onChange(e.target.value);}} onClick={e=>e.stopPropagation()}
      style={{background:cfg.b,color:cfg.c,border:`1px solid ${cfg.c}55`,borderRadius:6,padding:"3px 6px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",outline:"none",whiteSpace:"nowrap"}}>
      {!options.includes(value)&&value&&<option value={value} style={{background:"#fff",color:L.text}}>{value}</option>}
      {options.map(o=><option key={o} value={o} style={{background:"#fff",color:L.text}}>{o}</option>)}
    </select>
  );
}

function Btn({children,onClick,variant="primary",size="md",disabled,icon,fullWidth}){
  const v={
    primary:{background:L.accent,color:"#fff",border:"none",boxShadow:`0 2px 6px ${L.accent}44`},
    secondary:{background:L.surface,color:L.textMd,border:`1px solid ${L.border}`},
    navy:{background:L.navy,color:"#fff",border:"none"},
    ghost:{background:"transparent",color:L.textSm,border:"none"},
    success:{background:L.green,color:"#fff",border:"none"},
    danger:{background:L.red,color:"#fff",border:"none"},
    ai:{background:"linear-gradient(135deg,#7C3AED,#2563EB)",color:"#fff",border:"none"},
  }[variant]||{background:L.accent,color:"#fff",border:"none"};
  const sz={sm:{padding:"5px 10px",fontSize:11},md:{padding:"8px 14px",fontSize:13},lg:{padding:"11px 20px",fontSize:14}}[size];
  return <button onClick={disabled?undefined:onClick} style={{...v,...sz,borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?0.5:1,width:fullWidth?"100%":undefined,justifyContent:fullWidth?"center":undefined,fontFamily:"inherit",transition:"opacity .15s"}}>{icon&&<span>{icon}</span>}{children}</button>;
}

function Input({label,value,onChange,placeholder,type="text",required,error,hint,readOnly,suffix}){
  return(
    <div>
      {label&&<div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>{label}{required&&<span style={{color:L.red,marginLeft:2}}>*</span>}</div>}
      <div style={{position:"relative"}}>
        <input value={value||""} onChange={e=>onChange&&onChange(e.target.value)} placeholder={placeholder} type={type} readOnly={readOnly}
          style={{width:"100%",padding:`8px ${suffix?"34px":"12px"} 8px 12px`,background:readOnly?L.bg:L.surface,border:`1px solid ${error?L.red:L.border}`,borderRadius:8,fontSize:13,color:L.text,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
        {suffix&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:L.textXs}}>{suffix}</span>}
      </div>
      {error&&<div style={{fontSize:11,color:L.red,marginTop:2}}>{error}</div>}
      {hint&&!error&&<div style={{fontSize:11,color:L.textXs,marginTop:2}}>{hint}</div>}
    </div>
  );
}

function Sel({label,value,onChange,options,required}){
  return(
    <div>
      {label&&<div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>{label}{required&&<span style={{color:L.red,marginLeft:2}}>*</span>}</div>}
      <select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"8px 12px",background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,color:L.text,outline:"none",cursor:"pointer",fontFamily:"inherit"}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Textarea qui s'agrandit automatiquement pour afficher tout le contenu sans troncature.
function AutoTextarea({value,onChange,placeholder,style,minRows=1}){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    el.style.height="auto";
    el.style.height=el.scrollHeight+"px";
  },[value]);
  return <textarea ref={ref} value={value??""} onChange={onChange} placeholder={placeholder} rows={minRows}
    style={{resize:"none",overflow:"hidden",lineHeight:1.4,...style}}/>;
}

function Tabs({tabs,active,onChange}){
  return(
    <div style={{display:"flex",gap:1,borderBottom:`1px solid ${L.border}`,marginBottom:18,overflowX:"auto",flexShrink:0}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onChange(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"9px 14px",fontSize:12,fontWeight:active===t.id?700:500,color:active===t.id?L.accent:L.textSm,borderBottom:active===t.id?`2px solid ${L.accent}`:"2px solid transparent",marginBottom:-1,transition:"all .15s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
          {t.icon&&<span>{t.icon}</span>}{t.label}
        </button>
      ))}
    </div>
  );
}

function Modal({title,onClose,children,maxWidth=640,closeOnOverlay=true}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={closeOnOverlay?onClose:undefined}>
      <div style={{background:L.surface,borderRadius:16,width:"100%",maxWidth,maxHeight:"92vh",overflowY:"auto",boxShadow:L.shadowLg}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:L.surface,zIndex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:L.text}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${L.border}`,borderRadius:8,width:30,height:30,cursor:"pointer",color:L.textSm,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>×</button>
        </div>
        <div style={{padding:22}}>{children}</div>
      </div>
    </div>
  );
}

function Notif({msg,type,onClose}){
  const c={success:{bg:L.greenBg,border:L.green,color:L.green},error:{bg:L.redBg,border:L.red,color:L.red},info:{bg:L.navyBg,border:L.navy,color:L.navy}}[type]||{bg:L.greenBg,border:L.green,color:L.green};
  return <div style={{position:"fixed",top:20,right:20,zIndex:9999,background:c.bg,border:`1px solid ${c.border}`,borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:600,color:c.color,boxShadow:L.shadowMd,display:"flex",alignItems:"center",gap:8,maxWidth:340}}>
    <span>{type==="success"?"✓":type==="error"?"✗":"ℹ"}</span>{msg}
    <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:c.color,marginLeft:8,fontSize:15}}>×</button>
  </div>;
}

function PageH({title,subtitle,actions}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
      <div><h1 style={{fontSize:19,fontWeight:800,color:L.text,margin:0,letterSpacing:-0.3}}>{title}</h1>{subtitle&&<p style={{fontSize:12,color:L.textSm,margin:"3px 0 0"}}>{subtitle}</p>}</div>
      {actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>{actions}</div>}
    </div>
  );
}


// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({onComplete}){
  const [step,setStep]=useState(1);
  const [data,setData]=useState({nom:"",siret:"",statut:"sarl",tva:true,nbEmployes:"1-5",activite:"Maçonnerie / Gros œuvre",tel:"",email:""});
  const [siretOk,setSiretOk]=useState(null);
  const [err,setErr]=useState({});
  function upd(k,v){setData(d=>({...d,[k]:v}));}
  function fmt(v){const c=v.replace(/\D/g,"").slice(0,14);if(c.length>9)return`${c.slice(0,3)} ${c.slice(3,6)} ${c.slice(6,9)} ${c.slice(9)}`;if(c.length>6)return`${c.slice(0,3)} ${c.slice(3,6)} ${c.slice(6)}`;if(c.length>3)return`${c.slice(0,3)} ${c.slice(3)}`;return c;}
  async function chkSiret(){
    const c=data.siret.replace(/\s/g,"");
    if(!/^\d{14}$/.test(c)){setSiretOk("err");return;}
    setSiretOk("loading");
    await new Promise(r=>setTimeout(r,1000));
    if(c==="51364022700031")upd("nom","France Habitat Rénovation Construction");
    setSiretOk("ok");
  }
  function next(){
    if(step===1&&!data.nom.trim()){setErr({nom:"Nom requis"});return;}
    setErr({});
    if(step<3)setStep(s=>s+1);else onComplete(data);
  }
  const s=STATUTS[data.statut];
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${L.navy} 0%,#2a5298 60%,${L.teal} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;}input:focus,select:focus{border-color:${L.accent}!important;outline:none;}`}</style>
      <div style={{width:"100%",maxWidth:500}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:30,fontWeight:900,color:"#fff",letterSpacing:-1}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:3}}>Configurez votre espace</div>
        </div>
        <div style={{background:L.surface,borderRadius:18,boxShadow:"0 20px 56px rgba(0,0,0,0.2)",overflow:"hidden"}}>
          <div style={{background:L.bg,padding:"12px 20px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${L.border}`}}>
            {[1,2,3].map(n=>(
              <React.Fragment key={n}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:n<=step?L.accent:L.border,color:n<=step?"#fff":L.textXs,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{n<step?"✓":n}</div>
                  <span style={{fontSize:11,fontWeight:n===step?600:400,color:n===step?L.text:L.textXs}}>{["Entreprise","Statut","Fin"][n-1]}</span>
                </div>
                {n<3&&<div style={{flex:1,height:2,background:n<step?L.accent:L.border,borderRadius:2}}/>}
              </React.Fragment>
            ))}
          </div>
          <div style={{padding:24}}>
            {step===1&&(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{fontSize:16,fontWeight:800,color:L.text}}>Votre entreprise</div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>SIRET <span style={{color:L.red}}>*</span></div>
                  <div style={{display:"flex",gap:7}}>
                    <input value={data.siret} onChange={e=>upd("siret",fmt(e.target.value))} placeholder="513 640 227 00031" style={{flex:1,padding:"8px 12px",border:`1px solid ${siretOk==="ok"?L.green:L.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
                    <Btn onClick={chkSiret} variant="secondary" size="md" disabled={siretOk==="loading"}>{siretOk==="loading"?"⏳":"🔍"}</Btn>
                  </div>
                  {siretOk==="ok"&&<div style={{fontSize:11,color:L.green,marginTop:2}}>✓ SIRET valide</div>}
                </div>
                <Input label="Nom de l'entreprise" value={data.nom} onChange={v=>upd("nom",v)} placeholder="France Habitat Rénovation..." required error={err.nom}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Input label="Téléphone" value={data.tel} onChange={v=>upd("tel",v)} placeholder="06.50.18.00.09"/>
                  <Input label="Email" value={data.email} onChange={v=>upd("email",v)} type="email" placeholder="contact@..."/>
                </div>
              </div>
            )}
            {step===2&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:16,fontWeight:800,color:L.text}}>Statut & activité</div>
                {Object.entries(STATUTS).map(([key,s])=>(
                  <div key={key} onClick={()=>upd("statut",key)} style={{padding:"10px 14px",borderRadius:10,border:`2px solid ${data.statut===key?s.color:L.border}`,background:data.statut===key?s.bg:L.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:18}}>{s.icon}</span>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:data.statut===key?s.color:L.text}}>{s.label}</div><div style={{fontSize:11,color:L.textSm}}>{s.description}</div></div>
                    <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${data.statut===key?s.color:L.borderMd}`,background:data.statut===key?s.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{data.statut===key&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}</div>
                  </div>
                ))}
                <Sel label="Activité principale" value={data.activite} onChange={v=>upd("activite",v)} options={["Maçonnerie / Gros œuvre","Carrelage / Revêtement","Peinture / Enduit","Plomberie","Électricité","Menuiserie","Rénovation générale","Multi-corps d'état"].map(v=>({value:v,label:v}))}/>
              </div>
            )}
            {step===3&&(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{fontSize:16,fontWeight:800,color:L.text}}>Tout est prêt ! 🎉</div>
                <div style={{background:L.bg,borderRadius:10,padding:14,border:`1px solid ${L.border}`}}>
                  {[["🏢",data.nom||"—"],["🔢",data.siret||"—"],["⚖️",s?.label||"—"],["🔨",data.activite]].map(([ic,v])=>(
                    <div key={ic} style={{display:"flex",gap:10,marginBottom:6}}>
                      <span style={{fontSize:14,width:20}}>{ic}</span>
                      <span style={{fontSize:13,color:L.textMd}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:s?.bg,border:`1px solid ${s?.color}44`,borderRadius:10,padding:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:s?.color,marginBottom:6}}>{s?.icon} Mode {s?.mode==="simple"?"Simple":"Avancé"}</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{s?.modules.map(m=><span key={m} style={{background:s.color+"22",color:s.color,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:600}}>✓ {m}</span>)}</div>
                </div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:20,paddingTop:16,borderTop:`1px solid ${L.border}`}}>
              {step>1?<Btn onClick={()=>setStep(s=>s-1)} variant="secondary">← Retour</Btn>:<div/>}
              <Btn onClick={next} variant={step===3?"success":"primary"} size="lg">{step===3?"🚀 Lancer":"Continuer →"}</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({modules,active,onNav,entreprise,statut,onSettings}){
  const grouped={};
  modules.forEach(m=>{const cfg=NAV_CONFIG[m];if(!cfg)return;if(!grouped[cfg.group])grouped[cfg.group]=[];grouped[cfg.group].push({id:m,...cfg});});
  const s=STATUTS[statut];
  return(
    <div style={{width:205,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0,overflowY:"auto"}}>
      <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>{entreprise.nomCourt||entreprise.nom}</div>
      </div>
      <div style={{padding:"7px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{background:s?.bg,borderRadius:7,padding:"5px 9px",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12}}>{s?.icon}</span>
          <div><div style={{fontSize:10,fontWeight:700,color:s?.color}}>{s?.short} · {s?.mode==="simple"?"Simple":"Avancé"}</div><div style={{fontSize:9,color:L.textSm}}>{entreprise.activite}</div></div>
        </div>
      </div>
      <div style={{flex:1,padding:"5px 0"}}>
        {Object.entries(grouped).map(([group,items])=>(
          <div key={group}>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.2,padding:"7px 13px 2px"}}>{NAV_GROUPS[group]}</div>
            {items.map(item=>(
              <button key={item.id} onClick={()=>onNav(item.id)} style={{width:"100%",background:active===item.id?"rgba(255,255,255,0.13)":"transparent",border:"none",cursor:"pointer",padding:"7px 13px",display:"flex",alignItems:"center",gap:7,color:active===item.id?"#fff":"rgba(255,255,255,0.58)",fontSize:12,fontWeight:active===item.id?600:400,textAlign:"left",borderLeft:active===item.id?`3px solid ${L.accent}`:"3px solid transparent",fontFamily:"inherit"}}>
                <span style={{fontSize:13}}>{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div style={{padding:"9px 11px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
        <button onClick={onSettings} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 11px",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:11,display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}}>⚙️ Paramètres</button>
      </div>
    </div>
  );
}


// ─── ACCUEIL ──────────────────────────────────────────────────────────────────
function Accueil({chantiers,docs,entreprise,statut,salaries,onNav}){
  const s=STATUTS[statut];
  const totCA=chantiers.reduce((a,c)=>a+c.devisHT,0);
  const encaisse=chantiers.reduce((a,c)=>a+(c.acompteEncaisse||0)+(c.soldeEncaisse||0),0);
  const enCours=chantiers.filter(c=>c.statut==="en cours").length;
  const termines=chantiers.filter(c=>c.statut==="terminé").length;
  const reste=chantiers.reduce((a,c)=>a+(c.devisTTC-(c.acompteEncaisse||0)-(c.soldeEncaisse||0)),0);
  // Totaux par type/statut depuis les docs
  const allDocs=docs||[];
  function htDoc(d){return (d.lignes||[]).filter(isLigneDevis).reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0);}
  const caDevisAcceptes=allDocs.filter(d=>d.type==="devis"&&d.statut==="accepté").reduce((a,d)=>a+htDoc(d),0);
  const caFactures=allDocs.filter(d=>d.type==="facture").reduce((a,d)=>a+htDoc(d),0);
  const caEnAttente=allDocs.filter(d=>d.type==="devis"&&(d.statut==="en attente"||d.statut==="envoyé"||d.statut==="brouillon")).reduce((a,d)=>a+htDoc(d),0);
  // Marge moyenne sur devis du mois courant
  const now=new Date();const moisISO=now.toISOString().slice(0,7);
  const devisDuMois=allDocs.filter(d=>d.type==="devis"&&(d.date||"").startsWith(moisISO));
  const margesDevis=devisDuMois.map(d=>{
    let totHT=0,totMarge=0;
    for(const l of (d.lignes||[]).filter(isLigneDevis)){
      const c=calcLigneDevis(l,statut);
      if(!c)continue;
      totHT+=c.montantHT;totMarge+=c.marge;
    }
    return totHT>0?(totMarge/totHT)*100:null;
  }).filter(v=>v!==null);
  const margeMoyMois=margesDevis.length?Math.round(margesDevis.reduce((a,b)=>a+b,0)/margesDevis.length):0;
  const mcMois=margeMoyMois>=25?L.green:margeMoyMois>=15?L.orange:L.red;
  return(
    <div>
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:20,fontWeight:800,color:L.text,margin:"0 0 4px",letterSpacing:-0.3}}>Tableau de bord 👋</h1>
        <p style={{fontSize:13,color:L.textSm,margin:0}}>{entreprise.nom} · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:14}}>
        <KPI label="CA total" value={euro(totCA)} icon="💰" color={L.navy} onClick={()=>onNav("chantiers")}/>
        <KPI label="Encaissé" value={euro(encaisse)} icon="✅" color={L.green} onClick={()=>onNav("compta")}/>
        <KPI label="À encaisser" value={euro(reste)} icon="⏳" color={L.orange} onClick={()=>onNav("compta")}/>
        <KPI label="Chantiers en cours" value={enCours} icon="🏗" color={L.accent} sub={termines?`${termines} terminé${termines>1?"s":""}`:undefined} onClick={()=>onNav("chantiers")}/>
        <KPI label="Équipe" value={`${salaries.length} pers.`} icon="👷" color={L.purple} onClick={()=>onNav("equipe")}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:24}}>
        <KPI label="CA devis acceptés" value={euro(caDevisAcceptes)} icon="📄" color={L.green} onClick={()=>onNav("devis")}/>
        <KPI label="CA factures" value={euro(caFactures)} icon="🧾" color={L.teal} onClick={()=>onNav("devis")}/>
        <KPI label="Devis en attente" value={euro(caEnAttente)} icon="📨" color={L.blue} onClick={()=>onNav("devis")}/>
        {s?.mode==="avance"&&<KPI label="Marge devis du mois" value={`${margeMoyMois}%`} icon="📊" color={mcMois} sub={devisDuMois.length?`${devisDuMois.length} devis · ${margeMoyMois>=19.5?"✓ ≥ secteur":"⚠ < secteur"}`:"Aucun devis ce mois"} onClick={()=>onNav("devis")}/>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 260px",gap:18,alignItems:"start"}}>
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:L.bg}}>
            <div style={{fontSize:13,fontWeight:700,color:L.text}}>🏗 Chantiers</div>
            <Btn onClick={()=>onNav("chantiers")} variant="ghost" size="sm">Voir tout →</Btn>
          </div>
          {chantiers.map((c,i)=>{
            const cc=rentaChantier(c,salaries);const mc2=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
            const prog=pct((c.acompteEncaisse||0)+(c.soldeEncaisse||0),c.devisTTC);
            return <div key={c.id} style={{padding:"12px 16px",borderBottom:i<chantiers.length-1?`1px solid ${L.border}`:"none",cursor:"pointer"}} onClick={()=>onNav("chantiers")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div><div style={{fontSize:10,color:L.textSm}}>{c.client}</div></div>
                <Badge>{c.statut}</Badge>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:12,fontWeight:700,color:L.navy}}>{euro(c.devisHT)}</span>
                {s?.mode==="avance"&&<span style={{fontSize:11,fontWeight:700,color:mc2}}>Marge {cc.tauxMarge}%</span>}
              </div>
              <div style={{background:L.border,borderRadius:3,height:4}}><div style={{width:`${prog}%`,height:4,background:prog>=100?L.green:L.blue,borderRadius:3}}/></div>
              <div style={{fontSize:9,color:L.textXs,marginTop:2}}>Encaissé {prog}%</div>
            </div>;
          })}
          {chantiers.length===0&&<div style={{padding:20,textAlign:"center",color:L.textXs,fontSize:12}}>Aucun chantier</div>}
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {s?.mode==="avance"&&<Card style={{overflow:"hidden"}}>
            <div style={{padding:"11px 14px",borderBottom:`1px solid ${L.border}`,background:L.bg,fontSize:12,fontWeight:700,color:L.text}}>📊 Rentabilité</div>
            <div style={{padding:14}}>
              {chantiers.map(c=>{const cc=rentaChantier(c,salaries);const mc2=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;return(
                <div key={c.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:L.textMd,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}>{c.nom.split("–")[0].trim()}</span><span style={{fontWeight:700,color:mc2}}>{cc.tauxMarge}%</span></div>
                  <div style={{background:L.bg,borderRadius:3,height:5}}><div style={{width:`${Math.min(100,cc.tauxMarge)}%`,height:5,background:mc2,borderRadius:3}}/></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:L.textXs,marginTop:2}}><span>MO {euro(cc.coutMO)}</span><span>Fourn {euro(cc.coutFourn)}</span><span style={{color:mc2,fontWeight:600}}>Marge {euro(cc.marge)}</span></div>
                </div>
              );})}
            </div>
          </Card>}
          {s?.mode==="avance"&&<Card style={{overflow:"hidden"}}>
            <div style={{padding:"11px 14px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:L.bg}}>
              <div style={{fontSize:12,fontWeight:700,color:L.text}}>📅 Prochaines échéances</div>
              <Btn onClick={()=>onNav("planning")} variant="ghost" size="sm">→</Btn>
            </div>
            {chantiers.flatMap(c=>(c.planning||[]).map(t=>({...t,chNom:c.nom}))).filter(t=>!t.dateDebut||t.dateDebut>=new Date().toISOString().slice(0,10)).sort((a,b)=>(a.dateDebut||"").localeCompare(b.dateDebut||"")).slice(0,3).map((t,i,arr)=>(
              <div key={`${t.id}-${t.chNom}`} onClick={()=>onNav("planning")} style={{display:"flex",gap:9,padding:"9px 14px",borderBottom:i<arr.length-1?`1px solid ${L.border}`:"none",alignItems:"center",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.background=L.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{fontSize:11,fontWeight:700,color:L.accent,minWidth:38}}>{t.dateDebut?new Date(t.dateDebut).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}):"—"}</div>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.tache}</div><div style={{fontSize:9,color:L.textXs}}>{t.chNom.split("–")[0].trim()}</div></div>
                <div style={{background:L.navyBg,color:L.navy,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>{t.dureeJours}j · {(t.salariesIds||[]).length}p</div>
              </div>
            ))}
            {chantiers.every(c=>!c.planning?.length)&&<div style={{padding:12,textAlign:"center",color:L.textXs,fontSize:10}}>Aucune tâche</div>}
          </Card>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Card style={{padding:14}}>
            <div style={{fontSize:12,fontWeight:700,color:L.text,marginBottom:10}}>Actions rapides</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[{icon:"🏗",label:"Chantier Djaouel",view:"chantiers",color:L.navy},{icon:"📄",label:"Nouveau devis",view:"devis",color:L.accent},{icon:"👷",label:"Équipe",view:"equipe",color:L.purple},{icon:"📅",label:"Planning",view:"planning",color:L.blue},{icon:"🤖",label:"Assistant IA",view:"assistant",color:L.teal},{icon:"💰",label:"Comptabilité",view:"compta",color:L.green}].filter(a=>s?.modules?.includes(a.view)).map(a=>(
                <button key={a.label} onClick={()=>onNav(a.view)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",background:L.bg,border:`1px solid ${L.border}`,borderRadius:8,cursor:"pointer",textAlign:"left",fontFamily:"inherit",width:"100%"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.background=a.color+"11";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=L.border;e.currentTarget.style.background=L.bg;}}>
                  <span style={{fontSize:14}}>{a.icon}</span><span style={{fontSize:11,fontWeight:600,color:L.textMd}}>{a.label}</span><span style={{marginLeft:"auto",color:L.textXs,fontSize:10}}>→</span>
                </button>
              ))}
            </div>
          </Card>
          <Card style={{padding:12,background:s?.bg,border:`1px solid ${s?.color}33`}}>
            <div style={{fontSize:10,fontWeight:700,color:s?.color,textTransform:"uppercase",letterSpacing:0.7,marginBottom:6}}>{s?.icon} {s?.label}</div>
            {[["TVA",s?.tvaSoumis?"Assujetti":"Franchise"],["Charges",`${Math.round((s?.tauxCharges||0)*100)}%`],["Mode",s?.mode==="simple"?"Simple":"Avancé"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"2px 0"}}><span style={{color:L.textSm}}>{l}</span><span style={{fontWeight:700,color:s?.color}}>{v}</span></div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}


// ─── VUE ÉQUIPE ────────────────────────────────────────────────────────────────
function VueEquipe({salaries,setSalaries}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const EMPTY={nom:"",poste:"",qualification:"qualifie",tauxHoraire:"",chargesPatron:"0.42",disponible:true,competences:""};
  const [form,setForm]=useState(EMPTY);
  const QUALS=[{v:"chef",l:"Chef chantier",c:L.accent},{v:"qualifie",l:"Qualifié",c:L.blue},{v:"manoeuvre",l:"Manœuvre",c:L.green}];
  function save(){if(!form.nom||!form.tauxHoraire)return;const sal={...form,id:editId||Date.now(),tauxHoraire:parseFloat(form.tauxHoraire)||0,chargesPatron:parseFloat(form.chargesPatron)||0.42,competences:form.competences?form.competences.split(",").map(x=>x.trim()).filter(Boolean):[]};if(editId)setSalaries(ss=>ss.map(s=>s.id===editId?sal:s));else setSalaries(ss=>[...ss,sal]);setForm(EMPTY);setEditId(null);setShowForm(false);}
  function edit(s){setForm({...s,tauxHoraire:String(s.tauxHoraire),chargesPatron:String(s.chargesPatron),competences:(s.competences||[]).join(", ")});setEditId(s.id);setShowForm(true);}
  const totalJ=salaries.reduce((a,s)=>a+s.tauxHoraire*(1+s.chargesPatron)*8,0);
  return(
    <div>
      <PageH title="Équipe" subtitle={`${salaries.length} salarié${salaries.length>1?"s":""} · Coût journalier total : ${euro(totalJ)}`}
        actions={<Btn onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} variant="primary" icon="+">Ajouter</Btn>}/>
      {showForm&&(
        <Card style={{padding:18,marginBottom:18,border:`1px solid ${L.accent}`}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:14}}>{editId?"✏️ Modifier":"+ Nouveau salarié"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"span 2"}}><Input label="Nom complet" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))} required placeholder="Dupont Thomas"/></div>
            <Input label="Poste" value={form.poste} onChange={v=>setForm(f=>({...f,poste:v}))} placeholder="Maçon qualifié"/>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Qualification</div>
              <div style={{display:"flex",gap:5}}>{QUALS.map(q=><button key={q.v} onClick={()=>setForm(f=>({...f,qualification:q.v}))} style={{flex:1,padding:"6px 4px",border:`2px solid ${form.qualification===q.v?q.c:L.border}`,background:form.qualification===q.v?q.c+"22":L.surface,color:form.qualification===q.v?q.c:L.textSm,borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>{q.l}</button>)}</div>
            </div>
            <Input label="Taux horaire" value={form.tauxHoraire} onChange={v=>setForm(f=>({...f,tauxHoraire:v}))} type="number" required suffix="€/h"/>
            <Input label="Charges patronales" value={form.chargesPatron} onChange={v=>setForm(f=>({...f,chargesPatron:v}))} type="number" hint="Ex: 0.42 = 42%"/>
            <div style={{gridColumn:"span 3"}}><Input label="Compétences (virgule)" value={form.competences} onChange={v=>setForm(f=>({...f,competences:v}))} placeholder="maçonnerie, carrelage, béton..."/></div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setShowForm(false);setEditId(null);}} variant="secondary">Annuler</Btn>
            <Btn onClick={save} variant="success">✓ {editId?"Modifier":"Enregistrer"}</Btn>
          </div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
        {salaries.map(sal=>{
          const q=QUALS.find(q=>q.v===sal.qualification)||QUALS[1];
          return(
            <Card key={sal.id} style={{padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:q.c+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:q.c,fontWeight:800}}>{sal.nom.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
                  <div><div style={{fontSize:13,fontWeight:700,color:L.text}}>{sal.nom}</div><div style={{fontSize:11,color:L.textSm}}>{sal.poste}</div></div>
                </div>
                <div style={{width:7,height:7,borderRadius:"50%",background:sal.disponible?L.green:L.textXs,marginTop:4}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>
                {[["Qualification",q.l,q.c],["Taux/h",`${sal.tauxHoraire}€/h`,L.navy],["Taux chargé",`${(sal.tauxHoraire*(1+sal.chargesPatron)).toFixed(2)}€/h`,L.orange],["Coût/jour",euro(sal.tauxHoraire*(1+sal.chargesPatron)*8),L.accent]].map(([l,v,c])=>(
                  <div key={l} style={{background:L.bg,borderRadius:6,padding:"6px 9px"}}><div style={{fontSize:9,color:L.textXs,marginBottom:2}}>{l}</div><div style={{fontSize:11,fontWeight:700,color:c}}>{v}</div></div>
                ))}
              </div>
              {(sal.competences||[]).length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:9}}>{sal.competences.slice(0,4).map(c=><span key={c} style={{background:q.c+"15",color:q.c,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:600}}>{c}</span>)}</div>}
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>edit(sal)} style={{flex:1,padding:"5px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✏️ Modifier</button>
                <button onClick={()=>setSalaries(ss=>ss.filter(s=>s.id!==sal.id))} style={{padding:"5px 9px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


// ─── PLANNING ─────────────────────────────────────────────────────────────────
function VuePlanning({chantiers,setChantiers,salaries}){
  const [selId,setSelId]=useState(chantiers[0]?.id||null);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const EMPTY={tache:"",dateDebut:new Date().toISOString().slice(0,10),dureeJours:1,salariesIds:[],posteId:null};
  const [form,setForm]=useState(EMPTY);
  const ch=chantiers.find(c=>c.id===selId);
  function updCh(p){setChantiers(cs=>cs.map(c=>c.id===selId?{...c,...p}:c));}
  function save(){if(!form.tache)return;const t={...form,id:editId||Date.now(),dureeJours:parseInt(form.dureeJours)||1};const pl=editId?ch.planning.map(p=>p.id===editId?t:p):[...(ch.planning||[]),t];updCh({planning:pl});setForm(EMPTY);setEditId(null);setShowForm(false);}
  function del(id){updCh({planning:ch.planning.filter(t=>t.id!==id)});}
  function togSal(sid){setForm(f=>{const has=f.salariesIds.includes(sid);return{...f,salariesIds:has?f.salariesIds.filter(s=>s!==sid):[...f.salariesIds,sid]};});}
  if(!ch)return <div style={{padding:20,color:L.textSm}}>Sélectionnez un chantier</div>;
  const totalMO=(ch.planning||[]).reduce((a,t)=>a+coutTache(t,salaries),0);
  const totalH=(ch.planning||[]).reduce((a,t)=>a+t.dureeJours*8*(t.salariesIds||[]).length,0);
  return(
    <div>
      <PageH title="Planning" subtitle="Organisez les tâches et affectez votre équipe"
        actions={<Btn onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} variant="primary" icon="+">Nouvelle tâche</Btn>}/>
      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {chantiers.map(c=><button key={c.id} onClick={()=>setSelId(c.id)} style={{padding:"6px 12px",borderRadius:8,border:`2px solid ${selId===c.id?L.accent:L.border}`,background:selId===c.id?L.accentBg:L.surface,color:selId===c.id?L.accent:L.textSm,fontSize:12,fontWeight:selId===c.id?700:400,cursor:"pointer",fontFamily:"inherit"}}>{c.nom}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        <KPI label="Tâches" value={ch.planning?.length||0} color={L.navy}/>
        <KPI label="Heures totales" value={`${totalH}h`} color={L.blue}/>
        <KPI label="Coût MO chargé" value={euro(totalMO)} color={L.orange}/>
        <KPI label="Équipe" value={salaries.length} color={L.purple}/>
      </div>
      {showForm&&(
        <Card style={{padding:16,marginBottom:18,border:`1px solid ${L.accent}`}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:14}}>{editId?"✏️ Modifier la tâche":"+ Nouvelle tâche"}</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginBottom:12}}>
            <Input label="Désignation" value={form.tache} onChange={v=>setForm(f=>({...f,tache:v}))} placeholder="Coulage dalle béton..." required/>
            <Input label="Date début" value={form.dateDebut} onChange={v=>setForm(f=>({...f,dateDebut:v}))} type="date"/>
            <Input label="Durée" value={form.dureeJours} onChange={v=>setForm(f=>({...f,dureeJours:v}))} type="number" suffix="j"/>
          </div>
          {/* Poste lié */}
          {(ch.postes||[]).length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>Poste de devis associé</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <button onClick={()=>setForm(f=>({...f,posteId:null}))} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${form.posteId===null?L.navy:L.border}`,background:form.posteId===null?L.navyBg:L.surface,color:form.posteId===null?L.navy:L.textXs,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Aucun</button>
                {ch.postes.slice(0,8).map(p=><button key={p.id} onClick={()=>setForm(f=>({...f,posteId:p.id}))} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${form.posteId===p.id?L.navy:L.border}`,background:form.posteId===p.id?L.navyBg:L.surface,color:form.posteId===p.id?L.navy:L.textXs,fontSize:11,cursor:"pointer",fontFamily:"inherit",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.libelle.slice(0,35)}{p.libelle.length>35?"...":""}</button>)}
              </div>
            </div>
          )}
          {/* Affectation ouvriers */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:7}}>Ouvriers affectés ({form.salariesIds.length} sélectionné{form.salariesIds.length>1?"s":""})</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:6}}>
              {salaries.map(sal=>{
                const sel=form.salariesIds.includes(sal.id);
                const cJ=sal.tauxHoraire*(1+sal.chargesPatron)*8*parseInt(form.dureeJours||1);
                return <div key={sal.id} onClick={()=>togSal(sal.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",borderRadius:8,border:`2px solid ${sel?L.blue:L.border}`,background:sel?L.blueBg:L.surface,cursor:"pointer"}}>
                  <div style={{width:13,height:13,borderRadius:3,border:`2px solid ${sel?L.blue:L.borderMd}`,background:sel?L.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{color:"#fff",fontSize:7,fontWeight:900}}>✓</span>}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:sel?L.blue:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sal.nom}</div>
                    <div style={{fontSize:9,color:L.textXs}}>{sal.poste}</div>
                  </div>
                  {sel&&<div style={{fontSize:10,fontWeight:700,color:L.orange}}>{euro(cJ)}</div>}
                </div>;
              })}
            </div>
            {form.salariesIds.length>0&&<div style={{marginTop:7,padding:"7px 11px",background:L.orangeBg,borderRadius:6,fontSize:12,color:L.orange,fontWeight:600}}>💰 Coût MO cette tâche : {euro(form.salariesIds.reduce((a,sid)=>{const s=salaries.find(x=>x.id===sid);return s?a+s.tauxHoraire*(1+s.chargesPatron)*8*parseInt(form.dureeJours||1):a;},0))}</div>}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setShowForm(false);setEditId(null);}} variant="secondary">Annuler</Btn>
            <Btn onClick={save} variant="success">✓ {editId?"Modifier":"Ajouter"}</Btn>
          </div>
        </Card>
      )}
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"11px 16px",borderBottom:`1px solid ${L.border}`,background:L.bg,display:"flex",justifyContent:"space-between"}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>📅 {ch.nom}</div>
          <div style={{fontSize:11,color:L.textSm}}>{ch.planning?.length||0} tâche{(ch.planning?.length||0)>1?"s":""}</div>
        </div>
        {(ch.planning||[]).length===0
          ?<div style={{padding:24,textAlign:"center",color:L.textXs,fontSize:13}}>Aucune tâche — cliquez "+ Nouvelle tâche"</div>
          :(
            <div>
              {ch.planning.map((t,i)=>{
                const tSals=salaries.filter(s=>t.salariesIds.includes(s.id));
                const cout=coutTache(t,salaries);
                const poste=(ch.postes||[]).find(p=>p.id===t.posteId);
                return(
                  <div key={t.id} style={{display:"grid",gridTemplateColumns:"90px 1fr 110px 70px",gap:12,padding:"12px 16px",borderBottom:i<ch.planning.length-1?`1px solid ${L.border}`:"none",alignItems:"start"}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:L.accent}}>{t.dateDebut?new Date(t.dateDebut).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}):"—"}</div>
                      <div style={{background:L.navyBg,color:L.navy,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700,marginTop:3,display:"inline-block"}}>{t.dureeJours}j</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:L.text,marginBottom:4}}>{t.tache}</div>
                      {poste&&<div style={{fontSize:10,color:L.textXs,marginBottom:4}}>📋 {poste.libelle.slice(0,50)}</div>}
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{tSals.map(s=><span key={s.id} style={{background:L.blueBg,color:L.blue,borderRadius:8,padding:"1px 7px",fontSize:10,fontWeight:600}}>{s.nom.split(" ")[0]}</span>)}{tSals.length===0&&<span style={{fontSize:10,color:L.textXs}}>Aucun ouvrier</span>}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      {cout>0&&<div style={{fontSize:12,fontWeight:700,color:L.orange}}>{euro(cout)}</div>}
                      <div style={{fontSize:10,color:L.textXs}}>{t.dureeJours*8*(t.salariesIds||[]).length}h</div>
                    </div>
                    <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                      <button onClick={()=>{setForm({...t,dateDebut:t.dateDebut||""});setEditId(t.id);setShowForm(true);}} style={{padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                      <button onClick={()=>del(t.id)} style={{padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"10px 16px",background:L.navyBg,borderTop:`2px solid ${L.navy}`}}>
                <span style={{fontSize:12,fontWeight:700,color:L.navy}}>TOTAL MO chargée</span>
                <span style={{fontSize:13,fontWeight:800,color:L.navy,fontFamily:"monospace"}}>{euro(totalMO)}</span>
              </div>
            </div>
          )}
      </Card>
    </div>
  );
}


// ─── VUE CHANTIERS ────────────────────────────────────────────────────────────
function VueChantiers({chantiers,setChantiers,selected,setSelected,salaries,statut}){
  const [tab,setTab]=useState("detail");
  const [showNew,setShowNew]=useState(false);
  const [nf,setNf]=useState({nom:"",client:"",adresse:"",statut:"planifié",devisHT:"",tva:"20",notes:""});
  const s=STATUTS[statut];
  const ch=chantiers.find(c=>c.id===selected);
  function creer(){if(!nf.nom||!nf.client)return;const n={id:Date.now(),postes:[],planning:[],depensesReelles:[],checklist:{},photos:[],facturesFournisseurs:[],acompteEncaisse:0,soldeEncaisse:0,...nf,devisHT:parseFloat(nf.devisHT)||0,devisTTC:(parseFloat(nf.devisHT)||0)*1.2};setChantiers(cs=>[...cs,n]);setSelected(n.id);setShowNew(false);}
  const TABS_S=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"renta",label:"Rentabilité",icon:"📊"},{id:"suivi",label:"Suivi",icon:"✅"}];
  const TABS_A=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"renta",label:"Rentabilité",icon:"📊"},{id:"planning",label:"Planning",icon:"📅"},{id:"fourn",label:"Fournitures",icon:"🔧"},{id:"suivi",label:"Suivi",icon:"✅"},{id:"bilan",label:"Bilan",icon:"💹"}];
  const tabs=s?.mode==="simple"?TABS_S:TABS_A;
  return(
    <div style={{display:"flex",height:"100%",minHeight:0}}>
      <div style={{width:225,borderRight:`1px solid ${L.border}`,flexShrink:0,overflowY:"auto",background:L.bg}}>
        <div style={{padding:"11px 12px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.7}}>Chantiers</div>
          <button onClick={()=>setShowNew(true)} style={{background:L.accent,border:"none",borderRadius:6,width:22,height:22,cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>+</button>
        </div>
        {chantiers.map(c=>{const cc=rentaChantier(c,salaries);const ia=c.id===selected;const mc=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
          return <div key={c.id} onClick={()=>{setSelected(c.id);setTab("detail");}} style={{padding:"10px 12px",borderBottom:`1px solid ${L.border}`,cursor:"pointer",background:ia?L.surface:L.bg,borderLeft:ia?`3px solid ${L.accent}`:"3px solid transparent"}}>
            <div style={{fontSize:12,fontWeight:ia?700:500,color:ia?L.text:L.textMd,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <StatutSelect value={c.statut} options={STATUTS_CHANTIER} onChange={st=>setChantiers(cs=>cs.map(x=>x.id===c.id?{...x,statut:st}:x))}/>
              {s?.mode==="avance"&&<span style={{fontSize:10,fontWeight:700,color:mc}}>{cc.tauxMarge}%</span>}
            </div>
          </div>;
        })}
      </div>
      {ch?(
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div><h1 style={{fontSize:18,fontWeight:800,color:L.text,margin:"0 0 3px"}}>{ch.nom}</h1><div style={{fontSize:11,color:L.textSm}}>{ch.client} · {ch.adresse}</div></div>
            <div style={{display:"flex",gap:7,alignItems:"center"}}>
              <StatutSelect value={ch.statut} options={STATUTS_CHANTIER} onChange={s2=>setChantiers(cs=>cs.map(c=>c.id===ch.id?{...c,statut:s2}:c))}/>
            </div>
          </div>
          <Tabs tabs={tabs} active={tab} onChange={setTab}/>
          {tab==="detail"&&<ChantierDetail ch={ch} salaries={salaries} statut={statut}/>}
          {tab==="renta"&&<ChantierRenta ch={ch} salaries={salaries} statut={statut}/>}
          {tab==="planning"&&<ChantierPlanningTab ch={ch} salaries={salaries}/>}
          {tab==="fourn"&&<ChantierFourn ch={ch}/>}
          {tab==="suivi"&&<ChantierSuivi ch={ch} setChantiers={setChantiers}/>}
          {tab==="bilan"&&<ChantierBilan ch={ch} salaries={salaries}/>}
        </div>
      ):<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",color:L.textXs}}><div style={{fontSize:32,marginBottom:8}}>🏗</div><div>Sélectionnez un chantier</div></div></div>}
      {showNew&&(
        <Modal title="Nouveau chantier" onClose={()=>setShowNew(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            <Input label="Nom du chantier" value={nf.nom} onChange={v=>setNf(f=>({...f,nom:v}))} placeholder="Client – Type travaux" required/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Input label="Client" value={nf.client} onChange={v=>setNf(f=>({...f,client:v}))} required/>
              <Input label="Adresse" value={nf.adresse} onChange={v=>setNf(f=>({...f,adresse:v}))}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Input label="Montant devis HT (€)" value={nf.devisHT} onChange={v=>setNf(f=>({...f,devisHT:v}))} type="number"/>
              <Sel label="Statut" value={nf.statut} onChange={v=>setNf(f=>({...f,statut:v}))} options={["planifié","en cours","terminé"].map(v=>({value:v,label:v}))}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn onClick={()=>setShowNew(false)} variant="secondary">Annuler</Btn>
              <Btn onClick={creer} variant="success">✓ Créer</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChantierDetail({ch,salaries,statut}){
  const s=STATUTS[statut];const cc=rentaChantier(ch,salaries);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        <KPI label="Devis HT" value={euro(ch.devisHT)} color={L.navy}/>
        <KPI label="TTC" value={euro(ch.devisTTC)} color={L.textMd}/>
        <KPI label="Acompte reçu" value={euro(ch.acompteEncaisse||0)} color={L.green}/>
        <KPI label="Reste TTC" value={euro(ch.devisTTC-(ch.acompteEncaisse||0)-(ch.soldeEncaisse||0))} color={L.orange}/>
        {s?.mode==="avance"&&<KPI label="Marge est." value={`${cc.tauxMarge}%`} color={cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red}/>}
      </div>
      {(ch.postes||[]).length>0&&(
        <Card style={{overflow:"hidden"}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text}}>Postes — {ch.postes.length} postes</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>{["N°","Lot / Désignation","Qté","U","MO h","Montant HT"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {ch.postes.map((p,i)=>(
                <tr key={p.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"7px 12px",fontSize:11,color:L.textXs,fontFamily:"monospace"}}>{String(i+1).padStart(2,"0")}</td>
                  <td style={{padding:"7px 12px"}}>
                    <div style={{fontSize:12,fontWeight:600,color:L.text}}>{p.libelle}</div>
                    <div style={{fontSize:10,color:L.textXs}}>{p.lot}</div>
                  </td>
                  <td style={{padding:"7px 12px",fontSize:11,color:L.textSm}}>{p.qte}</td>
                  <td style={{padding:"7px 12px",fontSize:11,color:L.textSm}}>{p.unite}</td>
                  <td style={{padding:"7px 12px",fontSize:11,color:L.blue}}>{p.tempsMO?.heures||"—"}h</td>
                  <td style={{padding:"7px 12px",fontSize:12,fontWeight:700,color:L.navy,textAlign:"right",fontFamily:"monospace"}}>{euro(p.montantHT)}</td>
                </tr>
              ))}
              <tr style={{background:L.navyBg,borderTop:`2px solid ${L.navy}`}}>
                <td colSpan={5} style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:L.navy}}>TOTAL HT — {ch.postes.length} postes</td>
                <td style={{padding:"8px 12px",fontSize:13,fontWeight:800,color:L.navy,textAlign:"right",fontFamily:"monospace"}}>{euro(ch.devisHT)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
      {ch.notes&&<Card style={{padding:12,background:L.orangeBg,border:`1px solid ${L.orange}33`}}><div style={{fontSize:10,fontWeight:700,color:L.orange,marginBottom:2}}>📝 Notes</div><div style={{fontSize:12,color:L.textMd}}>{ch.notes}</div></Card>}
    </div>
  );
}

function ChantierRenta({ch,salaries,statut}){
  const s=STATUTS[statut];const cc=rentaChantier(ch,salaries);const mc=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
  // Total MO devis vs réel planning
  const moDevis=(ch.postes||[]).reduce((a,p)=>{const th=p.tempsMO?.heures||0;const no=p.tempsMO?.nbOuvriers||1;return a+th*no*14*(1.42);},0); // taux moyen
  if(s?.mode==="simple"){
    return(
      <div style={{display:"flex",flexDirection:"column",gap:13}}>
        <Card style={{padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:L.textMd,marginBottom:12}}>Résultat {s.label}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{l:"CA HT",v:euro(ch.devisHT),c:L.navy},{l:`Charges ${Math.round((s.tauxCharges||0.22)*100)}%`,v:`− ${euro(ch.devisHT*(s.tauxCharges||0.22))}`,c:L.orange},{l:"Bénéfice net est.",v:euro(ch.devisHT*(1-(s.tauxCharges||0.22))),c:L.green,b:true},{l:"Encaissé",v:euro((ch.acompteEncaisse||0)+(ch.soldeEncaisse||0)),c:L.blue}].map(it=>(
              <div key={it.l} style={{background:L.bg,borderRadius:8,padding:"10px 12px",border:`1px solid ${L.border}`}}>
                <div style={{fontSize:11,color:L.textSm,marginBottom:3}}>{it.l}</div>
                <div style={{fontSize:it.b?17:13,fontWeight:800,color:it.c}}>{it.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }
  const totalHPrevu=(ch.postes||[]).reduce((a,p)=>a+(p.tempsMO?.heures||0),0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <KPI label="Devis HT" value={euro(ch.devisHT)} color={L.navy}/>
        <KPI label="Coûts totaux" value={euro(cc.totalCouts)} color={L.orange}/>
        <KPI label="Marge HT" value={euro(cc.marge)} color={mc}/>
        <KPI label="Taux marge" value={`${cc.tauxMarge}%`} color={mc} sub={cc.tauxMarge>=19.5?"✓ ≥ secteur":"⚠ < secteur"}/>
      </div>
      <Card style={{padding:16}}>
        <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:12}}>Décomposition des coûts</div>
        {[{l:"MO chargée (planning réel)",v:cc.coutMO,c:L.blue,p:pct(cc.coutMO,ch.devisHT)},{l:"Fournitures (prix min 3 fourn.)",v:cc.coutFourn,c:L.accent,p:pct(cc.coutFourn,ch.devisHT)},{l:"Dépenses réelles",v:cc.depR,c:L.orange,p:pct(cc.depR,ch.devisHT)},{l:"Marge estimée",v:Math.max(0,cc.marge),c:L.green,p:Math.max(0,cc.tauxMarge)}].map(it=>(
          <div key={it.l} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:L.textMd}}>{it.l}</span><span style={{fontWeight:700,color:it.c}}>{euro(it.v)} <span style={{fontSize:11,color:L.textXs}}>({it.p}%)</span></span></div>
            <div style={{background:L.bg,borderRadius:4,height:7}}><div style={{width:`${Math.min(100,it.p)}%`,height:7,background:it.c,borderRadius:4}}/></div>
          </div>
        ))}
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Card style={{padding:14,background:L.navyBg,border:`1px solid ${L.navy}22`}}>
          <div style={{fontSize:11,fontWeight:700,color:L.navy,marginBottom:8}}>📊 Benchmark BTP 2025</div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {[["Moy. secteur","19,5%",L.textSm],["Cible","20–30%",L.green],["Votre marge",`${cc.tauxMarge}%`,mc],["Écart",`${cc.tauxMarge>=19.5?"+":""}${(cc.tauxMarge-19.5).toFixed(1)}pts`,mc]].map(([l,v,c])=>(
              <div key={l}><div style={{fontSize:10,color:L.textSm,marginBottom:1}}>{l}</div><div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div></div>
            ))}
          </div>
        </Card>
        <Card style={{padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:L.text,marginBottom:8}}>⏱ Main d'œuvre</div>
          {[["Heures planning",`${cc.totalH}h`],["Heures devis estimées",`${totalHPrevu}h`],["Coût MO",euro(cc.coutMO)]].map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:`1px solid ${L.border}`}}>
              <span style={{color:L.textSm}}>{l}</span><span style={{fontWeight:700,color:L.text}}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function ChantierPlanningTab({ch,salaries}){
  const totalMO=(ch.planning||[]).reduce((a,t)=>a+coutTache(t,salaries),0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <KPI label="Tâches" value={ch.planning?.length||0} color={L.navy}/>
        <KPI label="Heures" value={`${(ch.planning||[]).reduce((a,t)=>a+t.dureeJours*8*(t.salariesIds||[]).length,0)}h`} color={L.blue}/>
        <KPI label="Coût MO" value={euro(totalMO)} color={L.orange}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text}}>Planning chantier</div>
        {(ch.planning||[]).length===0?<div style={{padding:18,textAlign:"center",color:L.textXs,fontSize:12}}>Gérez le planning dans "Planning"</div>:(
          (ch.planning||[]).map((t,i)=>{
            const tSals=salaries.filter(s=>t.salariesIds.includes(s.id));
            return <div key={t.id} style={{display:"grid",gridTemplateColumns:"85px 1fr 100px",gap:10,padding:"10px 14px",borderBottom:i<ch.planning.length-1?`1px solid ${L.border}`:"none",alignItems:"center"}}>
              <div><div style={{fontSize:11,fontWeight:700,color:L.accent}}>{t.dateDebut?new Date(t.dateDebut).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"}):"—"}</div><div style={{background:L.navyBg,color:L.navy,borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700,marginTop:2,display:"inline-block"}}>{t.dureeJours}j</div></div>
              <div><div style={{fontSize:12,fontWeight:600,color:L.text,marginBottom:3}}>{t.tache}</div><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{tSals.map(s=><span key={s.id} style={{background:L.blueBg,color:L.blue,borderRadius:7,padding:"1px 6px",fontSize:10,fontWeight:600}}>{s.nom.split(" ")[0]}</span>)}</div></div>
              <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:L.orange}}>{euro(coutTache(t,salaries))}</div>
            </div>;
          })
        )}
      </Card>
    </div>
  );
}

function ChantierFourn({ch}){
  const [fournFilter,setFournFilter]=useState("min"); // min | pointp | gedimat | achat
  const allFourn=(ch.postes||[]).flatMap(p=>(p.fournitures||[]).map(f=>({...f,poste:p.libelle,lot:p.lot})));
  function getPrix(f){
    if(fournFilter==="pointp")return f.prixPointP||f.prixAchat;
    if(fournFilter==="gedimat")return f.prixGedimat||f.prixAchat;
    if(fournFilter==="achat")return f.prixAchat;
    return prixRetenuFourn(f); // min
  }
  const total=allFourn.reduce((a,f)=>a+f.qte*getPrix(f),0);
  const totalMin=allFourn.reduce((a,f)=>a+f.qte*prixRetenuFourn(f),0);
  const totalMax=allFourn.reduce((a,f)=>a+f.qte*Math.max(f.prixAchat,f.prixPointP||0,f.prixGedimat||0),0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
        <KPI label="Total fournitures" value={euro(total)} color={L.accent}/>
        <KPI label="Prix min (3 fourn.)" value={euro(totalMin)} color={L.green}/>
        <KPI label="Prix max" value={euro(totalMax)} color={L.red}/>
        <KPI label="Références" value={allFourn.length} color={L.navy}/>
      </div>
      {/* Filtre fournisseur */}
      <div style={{display:"flex",gap:7,alignItems:"center"}}>
        <span style={{fontSize:12,color:L.textSm,fontWeight:600}}>Afficher prix :</span>
        {[{v:"min",l:"Prix min (recommandé)"},{v:"pointp",l:"Point P"},{v:"gedimat",l:"Gedimat"},{v:"achat",l:"Prix achat"}].map(f=>(
          <button key={f.v} onClick={()=>setFournFilter(f.v)} style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${fournFilter===f.v?L.accent:L.border}`,background:fournFilter===f.v?L.accentBg:L.surface,color:fournFilter===f.v?L.accent:L.textSm,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:fournFilter===f.v?700:400}}>{f.l}</button>
        ))}
      </div>
      {/* Par lot */}
      {[...new Set(allFourn.map(f=>f.lot))].map(lot=>{
        const items=allFourn.filter(f=>f.lot===lot);
        const sousTotal=items.reduce((a,f)=>a+f.qte*getPrix(f),0);
        return(
          <Card key={lot} style={{overflow:"hidden"}}>
            <div style={{padding:"9px 14px",background:L.bg,borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:L.navy}}>{lot}</div>
              <div style={{fontSize:12,fontWeight:700,color:L.accent,fontFamily:"monospace"}}>{euro(sousTotal)}</div>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:L.bg}}>{["Désignation","Qté","U","Fournisseur","P.U.","Total","Fourn. conseillé"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
              <tbody>{items.map((f,i)=>{
                const pu=getPrix(f);
                const best=prixRetenuFourn(f);
                const bestFourn=f.prixAchat<=best?f.fournisseur:(f.prixGedimat<=best?"Gedimat":"Point P");
                return <tr key={i} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"6px 10px",fontSize:11,color:L.text}}>{f.designation}</td>
                  <td style={{padding:"6px 10px",fontSize:11}}>{f.qte}</td>
                  <td style={{padding:"6px 10px",fontSize:11,color:L.textXs}}>{f.unite}</td>
                  <td style={{padding:"6px 10px",fontSize:11,color:L.textSm}}>{f.fournisseur}</td>
                  <td style={{padding:"6px 10px",fontSize:11,fontFamily:"monospace",textAlign:"right"}}>{euro(pu)}</td>
                  <td style={{padding:"6px 10px",fontSize:11,fontWeight:700,color:L.navy,fontFamily:"monospace",textAlign:"right"}}>{euro(f.qte*pu)}</td>
                  <td style={{padding:"6px 10px"}}><span style={{background:L.greenBg,color:L.green,borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:600}}>{bestFourn}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}

function ChantierSuivi({ch,setChantiers}){
  const phases=[{id:"avant",label:"Avant",icon:"📋",items:["Devis signé","Acompte encaissé","Planning validé","Fournitures commandées","Équipe informée"]},{id:"pendant",label:"Pendant",icon:"🔨",items:["Photos avant","Conformité devis","Suivi avancement","Photos en cours","Gestion imprévus"]},{id:"apres",label:"Après",icon:"✅",items:["Photos finales","Nettoyage","Contrôle qualité","Facture émise","Solde encaissé"]}];
  const cl=ch.checklist||{};const tot=phases.reduce((a,p)=>a+p.items.length,0);const done=Object.values(cl).filter(Boolean).length;
  function tog(ph,it){const k=`${ph}_${it}`;setChantiers(cs=>cs.map(c=>c.id!==ch.id?c:{...c,checklist:{...cl,[k]:!cl[k]}}));}
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <Card style={{padding:13}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,fontWeight:700,color:L.text}}>Avancement</span><span style={{fontSize:13,fontWeight:800,color:done===tot?L.green:L.orange}}>{pct(done,tot)}%</span></div>
        <div style={{background:L.bg,borderRadius:5,height:8}}><div style={{width:`${pct(done,tot)}%`,height:8,background:`linear-gradient(90deg,${L.blue},${L.green})`,borderRadius:5,transition:"width .3s"}}/></div>
        <div style={{fontSize:10,color:L.textXs,marginTop:3}}>{done}/{tot} points</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {phases.map(phase=>(
          <Card key={phase.id} style={{overflow:"hidden"}}>
            <div style={{padding:"8px 12px",background:L.bg,borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:12,fontWeight:700,color:L.text}}>{phase.icon} {phase.label}</span>
              <span style={{fontSize:10,color:L.textXs}}>{phase.items.filter(it=>cl[`${phase.id}_${it}`]).length}/{phase.items.length}</span>
            </div>
            <div style={{padding:10}}>{phase.items.map(it=>{const d=cl[`${phase.id}_${it}`];return <div key={it} onClick={()=>tog(phase.id,it)} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",cursor:"pointer"}}>
              <div style={{width:14,height:14,borderRadius:4,border:`2px solid ${d?L.green:L.borderMd}`,background:d?L.green:L.surface,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{d&&<span style={{color:"#fff",fontSize:8,fontWeight:900}}>✓</span>}</div>
              <span style={{fontSize:11,color:d?L.textXs:L.textMd,textDecoration:d?"line-through":"none"}}>{it}</span>
            </div>;})}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChantierBilan({ch,salaries}){
  const cc=rentaChantier(ch,salaries);const mc=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;
  const enc=(ch.acompteEncaisse||0)+(ch.soldeEncaisse||0);
  const td={padding:"8px 11px",fontSize:12,color:L.text,borderBottom:`1px solid ${L.border}`};
  const tdr={...td,fontFamily:"monospace",textAlign:"right"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <KPI label="Devis HT" value={euro(ch.devisHT)} color={L.navy}/>
        <KPI label="Coûts" value={euro(cc.totalCouts)} color={L.orange}/>
        <KPI label="Marge HT" value={euro(cc.marge)} color={mc}/>
        <KPI label="Taux" value={`${cc.tauxMarge}%`} color={mc}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text}}>Bilan financier</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Poste","Montant","% devis"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 11px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>
            <tr style={{borderBottom:`1px solid ${L.border}`}}><td style={{...td,fontWeight:600}}>👷 MO chargée (planning)</td><td style={{...tdr,color:L.blue}}>{euro(cc.coutMO)}</td><td style={{...tdr,color:L.textSm}}>{pct(cc.coutMO,ch.devisHT)}%</td></tr>
            <tr style={{borderBottom:`1px solid ${L.border}`}}><td style={{...td,fontWeight:600}}>📦 Fournitures (min 3 fourn.)</td><td style={{...tdr,color:L.accent}}>{euro(cc.coutFourn)}</td><td style={{...tdr,color:L.textSm}}>{pct(cc.coutFourn,ch.devisHT)}%</td></tr>
            {cc.depR>0&&<tr style={{borderBottom:`1px solid ${L.border}`}}><td style={{...td,fontWeight:600}}>📋 Dépenses réelles</td><td style={{...tdr,color:L.orange}}>{euro(cc.depR)}</td><td style={{...tdr,color:L.textSm}}>{pct(cc.depR,ch.devisHT)}%</td></tr>}
            <tr style={{background:L.bg,borderTop:`2px solid ${L.borderMd}`}}><td style={{...td,fontWeight:800}}>TOTAL COÛTS</td><td style={{...tdr,fontWeight:800,fontSize:13,color:L.navy}}>{euro(cc.totalCouts)}</td><td style={{...tdr,color:L.textSm}}>{pct(cc.totalCouts,ch.devisHT)}%</td></tr>
            <tr style={{background:mc+"08",borderTop:`2px solid ${mc}44`}}><td style={{...td,fontWeight:800,color:mc}}>💰 MARGE BRUTE</td><td style={{...tdr,fontWeight:900,fontSize:14,color:mc}}>{euro(cc.marge)}</td><td style={{...tdr,fontWeight:800,color:mc}}>{cc.tauxMarge}%</td></tr>
            <tr><td style={{...td,fontWeight:600}}>💳 Encaissé TTC</td><td style={{...tdr,color:L.green}}>{euro(enc)}</td><td style={{...tdr,color:enc<ch.devisTTC?L.orange:L.green}}>{enc<ch.devisTTC?`Reste ${euro(ch.devisTTC-enc)}`:"✓ Soldé"}</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}


// ─── VUE DEVIS avec IA LOCALE ─────────────────────────────────────────────────
const DOCS_INIT = [
  {id:1,type:"devis",numero:"DEV-2771",date:"2025-10-06",client:"M. et Mme DJAOUEL",adresseClient:"Le clos de la sarriette, 13012 Marseille",statut:"accepté",chantierId:1,
    lignes:CHANTIER_DJAOUEL.postes.slice(0,5).map((p,i)=>({id:i+1,libelle:p.libelle,qte:p.qte,unite:p.unite,prixUnitHT:p.montantHT/p.qte,tva:20})),
    conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:116622.22}
 ,...Object.values(DEVIS_DEMO_PAR_CORPS).map(d=>({...d,type:"devis",client:d.client?.nom||d.client||""}))
];

function VueDevis({chantiers,salaries,statut,entreprise,docs,setDocs,onConvertirChantier,onSaveOuvrage}){
  const [apercu,setApercu]=useState(null);
  const [devisDetail,setDevisDetail]=useState(null);
  const [showCreer,setShowCreer]=useState(false);
  const [emailDoc,setEmailDoc]=useState(null);
  const [feuilleDoc,setFeuilleDoc]=useState(null);
  // Garde-fou fermeture CreateurDevis : on demande confirmation si données non sauvegardées
  const creerDirtyRef=useRef(false);
  const handleCreerDirty=useRef(v=>{creerDirtyRef.current=!!v;}).current;
  const closeCreer=useRef(()=>{
    if(creerDirtyRef.current&&!window.confirm("Vous avez des données non sauvegardées dans ce devis. Fermer sans enregistrer ?"))return;
    creerDirtyRef.current=false;
    setShowCreer(false);
  }).current;
  const totalD=docs.filter(d=>d.type==="devis").reduce((a,d)=>a+calcDocTotal(d).ttc,0);
function calcDocTotal(d){var h=0,t=0;(d.lignes||[]).filter(isLigneDevis).forEach(function(l){var ht=(+l.qte||0)*(+l.prixUnitHT||0);h+=ht;t+=ht*((+l.tva||0)/100);});return{ht:+h.toFixed(2),tv:+t.toFixed(2),ttc:+(h+t).toFixed(2)};}
  return(
    <div>
      <PageH title="Devis" subtitle="Créez vos devis avec l'assistant IA désignation"
        actions={<Btn onClick={()=>setShowCreer(true)} variant="primary" icon="✏️">Nouveau devis</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        <KPI label="Devis" value={docs.filter(d=>d.type==="devis").length} sub={euro(totalD)} color={L.blue}/>
        <KPI label="Acceptés" value={docs.filter(d=>d.statut==="accepté").length} color={L.green}/>
        <KPI label="En attente" value={docs.filter(d=>d.statut==="en attente").length} color={L.orange}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["N°","Date","Client","HT","TTC","Statut","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>
            {docs.map((doc,i)=>{const t=calcDocTotal(doc);return(
              <tr key={doc.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                <td style={{padding:"9px 12px",fontSize:12,color:L.textSm,fontFamily:"monospace"}}>{doc.numero}</td>
                <td style={{padding:"9px 12px",fontSize:12}}>{doc.date}</td>
                <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>{doc.client}</td>
                <td style={{padding:"9px 12px",fontSize:12,fontFamily:"monospace"}}>{euro(t.ht)}</td>
                <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace"}}>{euro(t.ttc)}</td>
                <td style={{padding:"9px 12px"}}><StatutSelect value={doc.statut} options={doc.type==="facture"?STATUTS_FACTURE:STATUTS_DEVIS} onChange={s=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,statut:s}))}/></td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>setDevisDetail(doc)} title="Voir le devis" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>👁</button>
                    <button onClick={()=>setApercu(doc)} title="Aperçu impression" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🖨</button>
                    <button onClick={()=>setFeuilleDoc(doc)} title="Feuille de chantier (sans prix)" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📋</button>
                    <button onClick={()=>setEmailDoc(doc)} title="Envoyer par email" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.purple,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📧</button>
                    {doc.type==="devis"&&doc.statut==="accepté"&&!doc.chantierId&&<button onClick={()=>onConvertirChantier&&onConvertirChantier(doc)} title="Convertir en chantier" style={{padding:"4px 8px",border:`1px solid ${L.navy}`,borderRadius:6,background:L.navyBg,color:L.navy,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>→ Chantier</button>}
                    {doc.chantierId&&<span title={`Chantier #${doc.chantierId} déjà créé`} style={{padding:"4px 8px",border:`1px solid ${L.green}`,borderRadius:6,background:L.greenBg,color:L.green,fontSize:11,fontWeight:700,fontFamily:"inherit"}}>✓ Chantier</span>}
                    {doc.type==="devis"&&<button onClick={()=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,type:"facture",statut:"en attente",numero:`FAC-${Date.now().toString().slice(-4)}`}))} style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.green,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>→ Fact.</button>}
                    <button onClick={()=>setDocs(ds=>ds.filter(d=>d.id!==doc.id))} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:13}}>×</button>
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </Card>
      
      {devisDetail&&<VueDevisDetail devis={devisDetail} onClose={()=>setDevisDetail(null)} onSave={(d)=>{setDocs(docs.map(x=>x.id===d.id?d:x));setDevisDetail(null);}}/>}
      {showCreer&&<Modal title="Nouveau devis + IA désignation" onClose={closeCreer} maxWidth={960} closeOnOverlay={false}><CreateurDevis chantiers={chantiers} salaries={salaries} statut={statut} docs={docs} onSave={doc=>{creerDirtyRef.current=false;setDocs(ds=>[...ds,doc]);setShowCreer(false);}} onClose={closeCreer} onDirtyChange={handleCreerDirty} onSaveOuvrage={onSaveOuvrage}/></Modal>}
      {apercu&&<Modal title={`Aperçu — ${apercu.numero}`} onClose={()=>setApercu(null)} maxWidth={820}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setApercu(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <ApercuDevis doc={apercu} entreprise={entreprise} calcDocTotal={calcDocTotal}/>
        </div>
      </Modal>}
      {emailDoc&&<EmailDevisModal doc={emailDoc} entreprise={entreprise} calcDocTotal={calcDocTotal} onClose={()=>setEmailDoc(null)}/>}
      {feuilleDoc&&<Modal title={`Feuille chantier — ${feuilleDoc.numero}`} onClose={()=>setFeuilleDoc(null)} maxWidth={900}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setFeuilleDoc(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <FeuilleChantier doc={feuilleDoc} entreprise={entreprise}/>
        </div>
      </Modal>}
    </div>
  );
}

function CreateurDevis({chantiers,salaries,statut,docs,onSave,onClose,onDirtyChange,onSaveOuvrage}){
  const [form,setForm]=useState({type:"devis",numero:`DEV-${Date.now().toString().slice(-5)}`,date:new Date().toISOString().slice(0,10),client:"",titreChantier:"",emailClient:"",telClient:"",adresseClient:"",statut:"brouillon",chantierId:null,conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:0,
    lignes:[{id:1,libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10}]});
  const [aiModal,setAiModal]=useState(null);
  const [showCalc,setShowCalc]=useState({}); // ligneId -> bool
  const [showBiblio,setShowBiblio]=useState(false);
  const [showImport,setShowImport]=useState(false);

  // Détecte si l'utilisateur a saisi quelque chose (pour confirmer avant de fermer)
  const dirty=!!form.client?.trim()||!!form.titreChantier?.trim()||!!form.emailClient?.trim()||!!form.telClient?.trim()||!!form.adresseClient?.trim()
    ||form.lignes.some(l=>l.type==="titre"||l.type==="soustitre"||(l.libelle&&l.libelle.trim())||(+l.prixUnitHT||0)>0);
  useEffect(()=>{if(onDirtyChange)onDirtyChange(dirty);},[dirty,onDirtyChange]);

  function calcDocTotal(doc){const items=(doc.lignes||[]).filter(isLigneDevis);const ht=items.reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0);const tv=items.reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0)*((+l.tva||0)/100),0);return{ht,tva:tv,ttc:ht+tv};}
  const {ht,tva,ttc}=calcDocTotal(form);
  const {titreSubs,sousTitreSubs}=calcDocSubtotals(form.lignes);

  // Totaux calcul MO+fournitures pour toutes les lignes
  const totalCalc=form.lignes.filter(isLigneDevis).reduce((acc,l)=>{
    const c=calcLigneDevis(l,statut);
    if(!c)return acc;
    return{mo:acc.mo+c.coutMO,fourn:acc.fourn+c.coutFourn,revient:acc.revient+c.prixRevient,marge:acc.marge+c.marge};
  },{mo:0,fourn:0,revient:0,marge:0});

  function updL(id,k,v){setForm(f=>({...f,lignes:f.lignes.map(l=>l.id!==id?l:{...l,[k]:k==="qte"||k==="prixUnitHT"?parseFloat(v)||0:v})}));}
  function addL(){setForm(f=>({...f,lignes:[...f.lignes,{id:Date.now(),type:"ligne",libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10}]}));}
  function addTitre(){setForm(f=>({...f,lignes:[...f.lignes,{id:Date.now(),type:"titre",libelle:"NOUVEAU TITRE"}]}));}
  function addSousTitre(){setForm(f=>({...f,lignes:[...f.lignes,{id:Date.now(),type:"soustitre",libelle:"Nouveau sous-titre"}]}));}
  function delItem(id){setForm(f=>({...f,lignes:f.lignes.filter(x=>x.id!==id)}));}
  function dupItem(id){setForm(f=>{
    const idx=f.lignes.findIndex(x=>x.id===id);
    if(idx<0)return f;
    const src=f.lignes[idx];
    const copy={...src,id:Date.now()+Math.floor(Math.random()*1000)};
    return{...f,lignes:[...f.lignes.slice(0,idx+1),copy,...f.lignes.slice(idx+1)]};
  });}
  function togCalc(id){setShowCalc(s=>({...s,[id]:!s[id]}));}

  // Ajout d'un ouvrage depuis la bibliothèque → crée une ligne pré-remplie avec le prix fourni-posé moyen
  function addFromBiblio(o){
    const prix = (o.moMoy||0) + (o.fournMoy||0);
    // Convertir unité biblio → unité V13 (M2, ML, U, etc.)
    const uMap = {"m²":"M2","ml":"ML","m³":"M3","U":"U","kg":"KG","L":"L"};
    const unite = uMap[o.unite] || o.unite.toUpperCase();
    setForm(f=>{
      // Si la dernière ligne est vide, on la remplace, sinon on ajoute
      const last = f.lignes[f.lignes.length-1];
      const emptyLast = last && !last.libelle && last.prixUnitHT===0;
      const newLigne = {id:Date.now(),libelle:o.libelle,qte:1,unite,prixUnitHT:prix,tva:10,_biblio:o.code};
      const lignes = emptyLast ? [...f.lignes.slice(0,-1),newLigne] : [...f.lignes,newLigne];
      return {...f,lignes};
    });
    setShowBiblio(false);
  }

  function buildCtx(ligne){
    const ch=chantiers.find(c=>c.id===form.chantierId);
    const poste=(ch?.postes||[]).find(p=>p.libelle===ligne.libelle);
    const planning=(ch?.planning||[]);
    const salsAff=[...new Set(planning.flatMap(t=>t.salariesIds))].map(id=>salaries.find(s=>s.id===id)).filter(Boolean);
    const calc=calcLigneDevis(ligne,statut);
    return{libelle:ligne.libelle,qte:ligne.qte,unite:ligne.unite,prixHT:ligne.prixUnitHT,fourn:poste?.fournitures,tempsMO:calc?{heures:calc.hTotal,nbOuvriers:calc.nbOuv}:poste?.tempsMO,nbOuv:salsAff.length||calc?.nbOuv,chantier:ch?.nom,client:ch?.client||form.client};
  }

  const mc=totalCalc.marge>0?L.green:L.red;
  const tauxMargeTot=ht>0?Math.round((totalCalc.marge/ht)*100):0;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <datalist id="unites-devis">
        {["m2","m3","ml","h","ENS","U","forfait","kg","T","L","pce","lot"].map(u=><option key={u} value={u}/>)}
      </datalist>
      {/* Infos document */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Sel label="Type" value={form.type} onChange={v=>setForm(f=>({...f,type:v}))} options={[{value:"devis",label:"Devis"},{value:"facture",label:"Facture"}]}/>
        <Input label="Date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} type="date"/>
      </div>

      {/* Renseignements client */}
      <div>
        <div style={{fontSize:12,fontWeight:700,color:L.textMd,marginBottom:6}}>Renseignements client</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Input label="Client (nom)" value={form.client} onChange={v=>setForm(f=>({...f,client:v}))} required/>
          <Input label="Titre du chantier" value={form.titreChantier} onChange={v=>setForm(f=>({...f,titreChantier:v}))}/>
          <Input label="Email client" value={form.emailClient} onChange={v=>setForm(f=>({...f,emailClient:v}))} type="email"/>
          <Input label="Téléphone client" value={form.telClient} onChange={v=>setForm(f=>({...f,telClient:v}))}/>
          <div style={{gridColumn:"span 2"}}><Input label="Adresse chantier" value={form.adresseClient} onChange={v=>setForm(f=>({...f,adresseClient:v}))}/></div>
        </div>
      </div>

      {/* Chantier lié */}
      <div>
        <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:5}}>
          Chantier associé <span style={{fontSize:10,color:L.purple}}>→ alimente l'IA et les calculs automatiques</span>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          <button onClick={()=>setForm(f=>({...f,chantierId:null}))} style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${form.chantierId===null?L.navy:L.border}`,background:form.chantierId===null?L.navyBg:L.surface,color:form.chantierId===null?L.navy:L.textSm,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Aucun</button>
          {chantiers.map(c=><button key={c.id} onClick={()=>setForm(f=>({...f,chantierId:c.id,client:c.client||f.client,adresseClient:c.adresse||f.adresseClient}))} style={{padding:"5px 11px",borderRadius:7,border:`1px solid ${form.chantierId===c.id?L.navy:L.border}`,background:form.chantierId===c.id?L.navyBg:L.surface,color:form.chantierId===c.id?L.navy:L.textSm,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{c.nom}</button>)}
        </div>
      </div>

      {/* Lignes + calcul auto */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>Lignes du {form.type}</div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <Btn onClick={()=>setShowImport(true)} variant="ghost" size="sm" icon="📥">Importer</Btn>
            <Btn onClick={()=>setShowBiblio(true)} variant="navy" size="sm" icon="📖">Catalogue BTP</Btn>
            <Btn onClick={addTitre} variant="primary" size="sm" icon="+">Titre</Btn>
            <Btn onClick={addSousTitre} variant="secondary" size="sm" icon="+">Sous-titre</Btn>
            <Btn onClick={addL} variant="secondary" size="sm" icon="+">Ligne</Btn>
          </div>
        </div>
        <Card style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>
              {["Désignation","Qté","U","P.U. HT","TVA","Total HT","🤖 IA","📊",""].map(h=><th key={h} style={{textAlign:"left",padding:"7px 9px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {form.lignes.map((l,i)=>{
                if(l.type==="titre"){
                  const sub=titreSubs.get(l.id)||0;
                  return(
                    <tr key={l.id} style={{background:L.navy}}>
                      <td colSpan={6} style={{padding:"9px 10px"}}>
                        <input value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="TITRE DE SECTION" style={{width:"100%",padding:"6px 10px",border:"none",background:"transparent",color:"#fff",fontSize:13,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase",outline:"none",fontFamily:"inherit"}}/>
                      </td>
                      <td colSpan={2} style={{padding:"9px 9px",fontSize:13,fontWeight:800,color:"#fff",fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{euro(sub)}</td>
                      <td style={{padding:"9px 5px"}}><button onClick={()=>delItem(l.id)} title="Supprimer le titre" style={{background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:14,opacity:0.85}}>×</button></td>
                    </tr>
                  );
                }
                if(l.type==="soustitre"){
                  const sub=sousTitreSubs.get(l.id)||0;
                  return(
                    <tr key={l.id} style={{background:L.navyBg,borderBottom:`1px solid ${L.border}`}}>
                      <td colSpan={6} style={{padding:"7px 10px 7px 22px"}}>
                        <input value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="Sous-titre" style={{width:"100%",padding:"5px 8px",border:`1px dashed ${L.borderMd}`,background:"transparent",color:L.navy,fontSize:12,fontWeight:700,outline:"none",fontFamily:"inherit"}}/>
                      </td>
                      <td colSpan={2} style={{padding:"7px 9px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{euro(sub)}</td>
                      <td style={{padding:"7px 5px"}}><button onClick={()=>delItem(l.id)} title="Supprimer le sous-titre" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button></td>
                    </tr>
                  );
                }
                const calc=calcLigneDevis(l,statut);
                const show=showCalc[l.id];
                const mc2=calc&&calc.tauxMarge>=20?L.green:calc&&calc.tauxMarge>=10?L.orange:L.red;
                return(
                  <React.Fragment key={l.id}>
                    <tr style={{borderBottom:show?`none`:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg,verticalAlign:"top"}}>
                      <td style={{padding:"6px 7px",minWidth:200}}>
                        <AutoTextarea value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="Ex: Carrelage 120x120, Dalle béton..." style={{width:"100%",padding:"5px 9px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                      </td>
                      <td style={{padding:"6px 5px"}}><input value={l.qte} onChange={e=>updL(l.id,"qte",e.target.value)} type="number" style={{width:55,padding:"5px 6px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,textAlign:"center",outline:"none",fontFamily:"inherit"}}/></td>
                      <td style={{padding:"6px 5px"}}><input list="unites-devis" value={l.unite} onChange={e=>updL(l.id,"unite",e.target.value)} style={{width:62,padding:"5px 5px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}/></td>
                      <td style={{padding:"6px 5px"}}><input value={l.prixUnitHT} onChange={e=>updL(l.id,"prixUnitHT",e.target.value)} type="number" style={{width:85,padding:"5px 6px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,textAlign:"right",outline:"none",fontFamily:"inherit"}}/></td>
                      <td style={{padding:"6px 5px"}}><select value={l.tva} onChange={e=>updL(l.id,"tva",parseFloat(e.target.value))} style={{width:62,padding:"5px 4px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}><option value={20}>20%</option><option value={10}>10%</option><option value={5.5}>5,5%</option><option value={0}>0%</option></select></td>
                      <td style={{padding:"6px 9px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace",whiteSpace:"nowrap"}}>{euro(l.qte*l.prixUnitHT)}</td>
                      <td style={{padding:"6px 5px"}}>
                        <BoutonIALigne ligne={{libelle:l.libelle,qte:l.qte,unite:l.unite||"U",puHT:l.prixUnitHT||0,salariesAssignes:l.salariesAssignes||[]}} salaries={salaries} onSaveOuvrage={onSaveOuvrage} onResult={r=>setForm(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,prixUnitHT:r.puHT||x.prixUnitHT,heuresPrevues:r.heuresMO,nbOuvriers:r.nbOuvriers,salariesAssignes:r.salariesAssignes||[],tauxHoraireMoyen:r.tauxHoraireMoyen,fournitures:r.fournitures}:x)}))}onLibelle={v=>updL(l.id,"libelle",v)}/>
                      </td>
                      <td style={{padding:"6px 5px"}}>
                        {calc&&<button onClick={()=>togCalc(l.id)} title="Voir le calcul MO+fournitures" style={{padding:"3px 7px",border:`1px solid ${show?L.accent:L.border}`,borderRadius:6,background:show?L.accentBg:L.surface,color:show?L.accent:L.textXs,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                          {show?"▲":"▼"} <span style={{color:mc2}}>{calc.tauxMarge}%</span>
                        </button>}
                      </td>
                      <td style={{padding:"6px 5px",whiteSpace:"nowrap"}}>
                        <button onClick={()=>dupItem(l.id)} title="Dupliquer la ligne" style={{background:"none",border:"none",color:L.textSm,cursor:"pointer",fontSize:13,marginRight:4}}>📋</button>
                        <button onClick={()=>delItem(l.id)} title="Supprimer la ligne" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
                      </td>
                    </tr>
                    {/* Panneau calcul automatique */}
                    {show&&calc&&(
                      <tr style={{background:i%2===0?"#FFFBF5":"#FFF7F0"}}>
                        <td colSpan={9} style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`}}>
                          <div style={{fontSize:11,fontWeight:700,color:L.accent,marginBottom:8}}>📊 Calcul automatique — {l.libelle||"cette prestation"}</div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
                            {[
                              {l:"MO estimée",v:euro(calc.coutMO),sub:`${calc.hTotal}h × ${calc.nbOuv} ouv.`,c:L.blue},
                              {l:"Fournitures",v:euro(calc.coutFourn),sub:`${calc.tauxFournPct}% du HT`,c:L.accent},
                              {l:"Frais généraux",v:euro(calc.fraisGeneraux),sub:`${Math.round(STATUTS[statut]?.tauxCharges*100)||45}% sur MO`,c:L.orange},
                              {l:"Prix de revient",v:euro(calc.prixRevient),sub:"MO+fourn+FG",c:L.navy},
                              {l:"Marge brute",v:euro(calc.marge),sub:`${calc.tauxMarge}% du HT`,c:mc2},
                              {l:"Coefficient",v:`× ${calc.coeff}`,sub:"Prix HT / Revient",c:L.purple},
                            ].map(item=>(
                              <div key={item.l} style={{background:L.surface,borderRadius:7,padding:"8px 10px",border:`1px solid ${L.border}`}}>
                                <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase",marginBottom:2}}>{item.l}</div>
                                <div style={{fontSize:12,fontWeight:800,color:item.c}}>{item.v}</div>
                                <div style={{fontSize:9,color:L.textXs}}>{item.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{marginTop:6,fontSize:10,color:L.textXs}}>
                            ℹ️ Calcul basé sur les rendements BTP moyens pour ce type d'ouvrage · Ajustez vos prix selon votre réalité terrain
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Totaux + synthèse rentabilité */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* Synthèse calcul */}
        <Card style={{padding:14,background:L.bg,border:`1px solid ${L.border}`}}>
          <div style={{fontSize:12,fontWeight:700,color:L.text,marginBottom:10}}>📊 Synthèse rentabilité du devis</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {[
              {l:"Total MO estimée",v:euro(totalCalc.mo),c:L.blue},
              {l:"Total fournitures",v:euro(totalCalc.fourn),c:L.accent},
              {l:"Prix de revient total",v:euro(totalCalc.revient),c:L.navy},
              {l:`Marge brute (${tauxMargeTot}%)`,v:euro(totalCalc.marge),c:tauxMargeTot>=20?L.green:tauxMargeTot>=10?L.orange:L.red},
            ].map(item=>(
              <div key={item.l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:`1px solid ${L.border}`}}>
                <span style={{color:L.textMd}}>{item.l}</span>
                <span style={{fontWeight:700,color:item.c,fontFamily:"monospace"}}>{item.v}</span>
              </div>
            ))}
          </div>
        </Card>
        {/* Totaux TTC */}
        <div style={{display:"flex",flexDirection:"column",gap:10,justifyContent:"flex-end"}}>
          <div style={{background:L.navyBg,borderRadius:10,padding:"14px 18px"}}>
            {[["Montant HT",euro(ht)],["TVA",euro(tva)],["TOTAL TTC",euro(ttc)]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${L.border}`}}>
                <span style={{fontSize:12,color:L.textMd}}>{l}</span>
                <span style={{fontSize:l==="TOTAL TTC"?15:12,color:L.navy,fontWeight:l==="TOTAL TTC"?800:500,fontFamily:"monospace"}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={onClose} variant="secondary">Annuler</Btn>
            <Btn onClick={()=>onSave({...form,id:Date.now()})} variant="success">✓ Enregistrer</Btn>
          </div>
        </div>
      </div>
      {aiModal&&<ModalIALocal {...aiModal} onApply={(text)=>{setForm(f=>({...f,lignes:f.lignes.map(l=>l.id!==aiModal.ligneId?l:{...l,libelle:text})}));setAiModal(null);}} onClose={()=>setAiModal(null)}/>}
      {showBiblio&&<BibliothequeSearchModal onPick={addFromBiblio} onClose={()=>setShowBiblio(false)}/>}
      {showImport&&<ImportDevisModal docs={docs} onImport={lignesAImporter=>setForm(f=>({...f,lignes:[...f.lignes,...lignesAImporter]}))} onClose={()=>setShowImport(false)}/>}
    </div>
  );
}

// ─── MODAL IA LOCALE (sans connexion) ─────────────────────────────────────────
function ModalIALocal({ctx,onApply,onClose}){
  const [mode,setMode]=useState("detaillee");
  const [results,setResults]=useState(null);
  const [input,setInput]=useState(ctx.libelle||"");
  const MODES=[{id:"courte",label:"Courte",icon:"📝"},{id:"detaillee",label:"Détaillée",icon:"📋"},{id:"technique",label:"Technique",icon:"🔧"},{id:"commerciale",label:"Commerciale",icon:"💼"}];

  function generate(){
    const res=genDesignationLocale({...ctx,libelle:input||ctx.libelle});
    setResults(res);
  }

  return(
    <Modal title="🤖 Assistant IA — Désignation locale" onClose={onClose} maxWidth={660}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Info locale */}
        <div style={{background:"#7C3AED11",border:"1px solid #7C3AED33",borderRadius:9,padding:11}}>
          <div style={{fontSize:11,fontWeight:700,color:L.purple,marginBottom:5}}>✅ Mode local — Fonctionne sans connexion</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[ctx.chantier&&`🏗 ${ctx.chantier}`,ctx.qte&&`📏 ${ctx.qte} ${ctx.unite}`,ctx.nbOuv&&`👷 ${ctx.nbOuv} ouvrier${ctx.nbOuv>1?"s":""}`,ctx.fourn?.length&&`📦 ${ctx.fourn.length} fournitures`,ctx.tempsMO&&`⏱ ${ctx.tempsMO.heures}h`].filter(Boolean).map((tag,i)=>(
              <span key={i} style={{background:"#7C3AED22",color:L.purple,borderRadius:5,padding:"1px 7px",fontSize:10,fontWeight:600}}>{tag}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:5}}>Décris la prestation</div>
          <div style={{display:"flex",gap:7}}>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ex: pose carrelage 120x120, dalle béton armé..." onKeyDown={e=>e.key==="Enter"&&generate()} style={{flex:1,padding:"9px 12px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            <Btn onClick={generate} variant="ai">✨ Générer</Btn>
          </div>
        </div>
        {results&&(
          <div>
            <div style={{display:"flex",gap:5,marginBottom:10}}>
              {MODES.map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:"6px 4px",border:`2px solid ${mode===m.id?L.purple:L.border}`,background:mode===m.id?"#7C3AED22":L.surface,color:mode===m.id?L.purple:L.textSm,borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>{m.icon} {m.label}</button>)}
            </div>
            {MODES.map(m=>(
              <div key={m.id} style={{display:mode===m.id?"block":"none"}}>
                <div style={{background:L.bg,borderRadius:9,padding:13,border:`1px solid ${L.border}`,marginBottom:9,fontSize:13,color:L.text,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{results[m.id]}</div>
                <div style={{display:"flex",gap:7,justifyContent:"flex-end"}}>
                  <button onClick={()=>navigator.clipboard?.writeText(results[m.id])} style={{padding:"6px 13px",border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.textMd,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📋 Copier</button>
                  <button onClick={()=>onApply(results[m.id])} style={{padding:"6px 14px",background:L.green,border:"none",borderRadius:7,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Utiliser dans le devis</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!results&&<div style={{padding:16,textAlign:"center",color:L.textXs,fontSize:12}}>Décris la prestation ci-dessus et clique "Générer" → 4 versions instantanées sans connexion</div>}
      </div>
    </Modal>
  );
}

function ApercuDevis({doc,entreprise,calcDocTotal}){
  const {ht,tva,ttc}=calcDocTotal(doc);
  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",color:"#1E293B",fontSize:12}}>
      {/* En-tête : logo à gauche · coordonnées entreprise à droite */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:"2px solid #1B3A5C",gap:16}}>
        <div style={{flex:"0 0 auto",minWidth:120,display:"flex",alignItems:"center"}}>
          {entreprise.logo
            ? <img src={entreprise.logo} alt={entreprise.nom||"logo"} style={{maxHeight:70,maxWidth:200,objectFit:"contain"}}/>
            : <div style={{fontSize:18,fontWeight:900,color:"#1B3A5C",letterSpacing:-0.3}}>{entreprise.nomCourt||entreprise.nom}</div>}
        </div>
        <div style={{textAlign:"right",fontSize:10,color:"#64748B",lineHeight:1.7}}>
          <div style={{fontSize:13,fontWeight:800,color:"#1B3A5C",marginBottom:2}}>{entreprise.nom}</div>
          {entreprise.adresse&&<>{entreprise.adresse}<br/></>}
          {(entreprise.tel||entreprise.email)&&<>{[entreprise.tel,entreprise.email].filter(Boolean).join(" · ")}<br/></>}
          {entreprise.siret&&<>SIRET : {entreprise.siret}</>}
        </div>
      </div>
      {/* Bandeau type / N° / date */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1B3A5C",textTransform:"uppercase",letterSpacing:0.5}}>{doc.type} N° {doc.numero}</div>
        <div style={{color:"#475569",fontSize:11}}>{doc.date}</div>
      </div>
      <div style={{background:"#F8FAFC",borderRadius:7,padding:"10px 12px",marginBottom:12}}>
        <div style={{fontWeight:700,color:"#1B3A5C",fontSize:12}}>{doc.client}</div>
        {doc.adresseClient&&<div style={{color:"#475569",fontSize:11,marginTop:2}}>{doc.adresseClient}</div>}
        {(doc.telClient||doc.emailClient)&&<div style={{color:"#475569",fontSize:11,marginTop:2}}>{[doc.telClient,doc.emailClient].filter(Boolean).join(" · ")}</div>}
        {doc.titreChantier&&<div style={{color:"#1B3A5C",fontSize:11,fontWeight:600,marginTop:5,fontStyle:"italic"}}>Objet : {doc.titreChantier}</div>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}>
        <thead><tr style={{background:"#1B3A5C",color:"#fff"}}>{["Désignation","Qté","U","P.U. HT","Total HT"].map(h=><th key={h} style={{padding:"6px 9px",fontSize:9,textAlign:"left",fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{(doc.lignes||[]).slice(0,8).map((l,i)=><tr key={l.id} style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"#fff":"#F8FAFC"}}><td style={{padding:"6px 9px",fontSize:11}}>{l.libelle}</td><td style={{padding:"6px 9px",textAlign:"right",color:"#64748B",fontSize:11}}>{l.qte}</td><td style={{padding:"6px 9px",color:"#64748B",fontSize:11}}>{l.unite}</td><td style={{padding:"6px 9px",textAlign:"right",fontSize:11,fontFamily:"monospace"}}>{fmt2(l.prixUnitHT)} €</td><td style={{padding:"6px 9px",textAlign:"right",fontWeight:600,fontSize:11,fontFamily:"monospace"}}>{fmt2(l.qte*l.prixUnitHT)} €</td></tr>)}</tbody>
      </table>
      {(doc.lignes||[]).length>8&&<div style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginBottom:8}}>... et {doc.lignes.length-8} lignes supplémentaires</div>}
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <div style={{minWidth:200}}>{[["Montant HT",ht],["TVA",tva],["TOTAL TTC",ttc]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #E2E8F0"}}><span style={{color:"#475569",fontSize:12}}>{l}</span><span style={{fontWeight:l==="TOTAL TTC"?800:500,color:l==="TOTAL TTC"?"#1B3A5C":"#374151",fontFamily:"monospace",fontSize:l==="TOTAL TTC"?13:12}}>{fmt2(v)} €</span></div>)}</div>
      </div>
      <div style={{fontSize:10,color:"#94A3B8",marginTop:10}}>{doc.conditionsReglement} · {doc.notes}</div>
    </div>
  );
}

// ─── FEUILLE DE CHANTIER (sans prix) ─────────────────────────────────────────
// Document imprimable destiné aux équipes terrain : titres / sous-titres / lignes
// avec qté, unité, et une colonne Observations vide pour annoter sur place.
function FeuilleChantier({doc,entreprise}){
  const items=doc.lignes||[];
  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",color:"#1E293B",fontSize:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:"2px solid #1B3A5C",gap:16}}>
        <div style={{flex:"0 0 auto",minWidth:120,display:"flex",alignItems:"center"}}>
          {entreprise?.logo
            ? <img src={entreprise.logo} alt={entreprise.nom||"logo"} style={{maxHeight:60,maxWidth:180,objectFit:"contain"}}/>
            : <div style={{fontSize:16,fontWeight:900,color:"#1B3A5C"}}>{entreprise?.nomCourt||entreprise?.nom||""}</div>}
        </div>
        <div style={{textAlign:"right",fontSize:10,color:"#64748B",lineHeight:1.6}}>
          <div style={{fontSize:12,fontWeight:800,color:"#1B3A5C"}}>{entreprise?.nom||""}</div>
          {entreprise?.adresse&&<>{entreprise.adresse}<br/></>}
          {(entreprise?.tel||entreprise?.email)&&<>{[entreprise.tel,entreprise.email].filter(Boolean).join(" · ")}<br/></>}
          {entreprise?.siret&&<>SIRET : {entreprise.siret}</>}
        </div>
      </div>
      <div style={{background:"#1B3A5C",color:"#fff",padding:"10px 14px",borderRadius:6,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>📋 Feuille de chantier</div>
        <div style={{fontSize:11,fontWeight:600,opacity:0.9}}>Réf. {doc.numero} · {doc.date}</div>
      </div>
      <div style={{background:"#F8FAFC",borderRadius:7,padding:"10px 12px",marginBottom:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
        <div><span style={{color:"#64748B",fontWeight:600}}>Client : </span><span style={{color:"#0F172A",fontWeight:700}}>{doc.client||"—"}</span></div>
        <div><span style={{color:"#64748B",fontWeight:600}}>Téléphone : </span><span>{doc.telClient||"—"}</span></div>
        <div style={{gridColumn:"span 2"}}><span style={{color:"#64748B",fontWeight:600}}>Adresse chantier : </span><span>{doc.adresseClient||"—"}</span></div>
        {doc.titreChantier&&<div style={{gridColumn:"span 2"}}><span style={{color:"#64748B",fontWeight:600}}>Objet : </span><span style={{fontStyle:"italic",color:"#1B3A5C",fontWeight:600}}>{doc.titreChantier}</span></div>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <colgroup>
          <col style={{width:"45%"}}/>
          <col style={{width:"10%"}}/>
          <col style={{width:"10%"}}/>
          <col style={{width:"35%"}}/>
        </colgroup>
        <thead>
          <tr style={{background:"#1B3A5C",color:"#fff"}}>
            {["Désignation","Qté","Unité","Observations / Notes terrain"].map(h=>
              <th key={h} style={{padding:"7px 9px",fontSize:10,textAlign:"left",fontWeight:700,textTransform:"uppercase",letterSpacing:0.4}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it,i)=>{
            if(it.type==="titre"){
              return(
                <tr key={it.id||i}>
                  <td colSpan={4} style={{padding:"8px 10px",background:"#1B3A5C",color:"#fff",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:0.5}}>{it.libelle||"Titre"}</td>
                </tr>
              );
            }
            if(it.type==="soustitre"){
              return(
                <tr key={it.id||i}>
                  <td colSpan={4} style={{padding:"6px 10px 6px 22px",background:"#EEF3F8",color:"#1B3A5C",fontSize:11,fontWeight:700,borderTop:"1px solid #E2E8F0"}}>{it.libelle||"Sous-titre"}</td>
                </tr>
              );
            }
            return(
              <tr key={it.id||i} style={{borderBottom:"1px solid #E2E8F0",verticalAlign:"top"}}>
                <td style={{padding:"8px 10px",fontSize:11,whiteSpace:"pre-wrap"}}>{it.libelle||""}</td>
                <td style={{padding:"8px 10px",fontSize:11,fontFamily:"monospace"}}>{(+it.qte||0)}</td>
                <td style={{padding:"8px 10px",fontSize:11,color:"#475569"}}>{it.unite||""}</td>
                <td style={{padding:"8px 10px",fontSize:11,borderLeft:"1px dashed #CBD5E1",height:30}}>&nbsp;</td>
              </tr>
            );
          })}
          {items.length===0&&(
            <tr><td colSpan={4} style={{padding:"40px 12px",textAlign:"center",color:"#94A3B8",fontSize:12}}>Aucune ligne dans ce devis</td></tr>
          )}
        </tbody>
      </table>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginTop:30,fontSize:10,color:"#64748B"}}>
        <div style={{borderTop:"1px solid #94A3B8",paddingTop:6}}><strong style={{color:"#1B3A5C"}}>Chef de chantier</strong> — Date · Signature</div>
        <div style={{borderTop:"1px solid #94A3B8",paddingTop:6}}><strong style={{color:"#1B3A5C"}}>Client</strong> — Date · Signature « bon pour exécution »</div>
      </div>
    </div>
  );
}

// ─── ENVOI EMAIL (mailto:) ────────────────────────────────────────────────────
// ─── IMPORT DE LIGNES DEPUIS UN DEVIS EXISTANT ───────────────────────────────
function ImportDevisModal({docs,onImport,onClose}){
  const [selectedDocId,setSelectedDocId]=useState(null);
  const [checked,setChecked]=useState({}); // ligneId -> bool
  const liste=(docs||[]).filter(d=>(d.lignes||[]).length>0);
  const sel=liste.find(d=>d.id===selectedDocId);
  const items=sel?.lignes||[];
  const nbCheck=Object.values(checked).filter(Boolean).length;

  function toggle(id){setChecked(c=>({...c,[id]:!c[id]}));}
  function toggleAll(){
    if(items.length===0)return;
    const allOn=items.every(it=>checked[it.id]);
    const next={};
    if(!allOn)for(const it of items)next[it.id]=true;
    setChecked(next);
  }
  function importer(){
    const lignesAImporter=items.filter(it=>checked[it.id]).map(it=>({
      ...it,
      id:Date.now()+Math.floor(Math.random()*100000),
    }));
    if(lignesAImporter.length===0)return;
    onImport(lignesAImporter);
    onClose();
  }

  return(
    <Modal title="📥 Importer des lignes depuis un devis" onClose={onClose} maxWidth={780}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>1. Choisissez un devis source</div>
          {liste.length===0?(
            <div style={{padding:14,background:L.bg,borderRadius:8,fontSize:12,color:L.textXs,textAlign:"center"}}>Aucun devis avec lignes disponible</div>
          ):(
            <div style={{maxHeight:160,overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:8}}>
              {liste.map((d,i)=>{
                const ht=(d.lignes||[]).filter(isLigneDevis).reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0);
                const active=d.id===selectedDocId;
                return(
                  <div key={d.id} onClick={()=>{setSelectedDocId(d.id);setChecked({});}}
                    style={{padding:"9px 12px",borderBottom:i<liste.length-1?`1px solid ${L.border}`:"none",cursor:"pointer",background:active?L.accentBg:L.surface,borderLeft:active?`3px solid ${L.accent}`:"3px solid transparent",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.numero} — {d.client||"—"}</div>
                      <div style={{fontSize:10,color:L.textSm}}>{d.date} · {(d.lignes||[]).length} ligne(s){d.titreChantier?` · ${d.titreChantier}`:""}</div>
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:L.navy,fontFamily:"monospace",whiteSpace:"nowrap"}}>{euro(ht)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {sel&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd}}>2. Cochez les lignes à importer ({nbCheck} sélectionnée{nbCheck>1?"s":""})</div>
              <button onClick={toggleAll} style={{padding:"3px 9px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.textMd,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{items.every(it=>checked[it.id])?"Tout décocher":"Tout cocher"}</button>
            </div>
            <div style={{maxHeight:280,overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:8}}>
              {items.map((it,i)=>{
                const isHeader=it.type==="titre"||it.type==="soustitre";
                const ht=(+it.qte||0)*(+it.prixUnitHT||0);
                if(isHeader){
                  return(
                    <div key={it.id||i} style={{padding:"7px 12px",background:it.type==="titre"?L.navy:L.navyBg,color:it.type==="titre"?"#fff":L.navy,fontSize:11,fontWeight:700,textTransform:it.type==="titre"?"uppercase":"none",display:"flex",alignItems:"center",gap:8}}>
                      <input type="checkbox" checked={!!checked[it.id]} onChange={()=>toggle(it.id)}/>
                      <span>{it.libelle}</span>
                    </div>
                  );
                }
                return(
                  <label key={it.id||i} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"7px 12px",borderBottom:i<items.length-1?`1px solid ${L.border}`:"none",fontSize:12,cursor:"pointer",background:checked[it.id]?L.accentBg:L.surface}}>
                    <input type="checkbox" checked={!!checked[it.id]} onChange={()=>toggle(it.id)} style={{marginTop:3}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{whiteSpace:"pre-wrap",color:L.text}}>{it.libelle||"(sans libellé)"}</div>
                      <div style={{fontSize:10,color:L.textSm,marginTop:2,fontFamily:"monospace"}}>{(+it.qte||0)} {it.unite||""} × {(+it.prixUnitHT||0).toFixed(2)} € · TVA {(+it.tva||0)}%</div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace",whiteSpace:"nowrap"}}>{ht.toFixed(2)} €</div>
                  </label>
                );
              })}
              {items.length===0&&<div style={{padding:14,textAlign:"center",color:L.textXs,fontSize:12}}>Ce devis n'a pas de lignes</div>}
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${L.border}`}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={importer} variant="primary" icon="📥" disabled={nbCheck===0}>Importer {nbCheck>0?`(${nbCheck})`:""}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function EmailDevisModal({doc,entreprise,calcDocTotal,onClose}){
  const totals=calcDocTotal(doc);
  const labelType=(doc.type||"devis");
  const sujetDef=`${labelType.charAt(0).toUpperCase()+labelType.slice(1)} ${doc.numero}${doc.titreChantier?` — ${doc.titreChantier}`:""}`;
  const corpsDef=`Bonjour${doc.client?` ${doc.client}`:""},

Veuillez trouver notre ${labelType} n° ${doc.numero} du ${doc.date} d'un montant de ${fmt2(totals.ttc)} € TTC (${fmt2(totals.ht)} € HT).${doc.titreChantier?`

Objet : ${doc.titreChantier}`:""}

Restant à votre disposition pour toute question.

Cordialement,
${entreprise?.nom||""}${entreprise?.tel?` · ${entreprise.tel}`:""}`;
  const [to,setTo]=useState(doc.emailClient||"");
  const [cc,setCc]=useState("");
  const [sujet,setSujet]=useState(sujetDef);
  const [corps,setCorps]=useState(corpsDef);
  function envoyer(){
    if(!to)return;
    const params=new URLSearchParams();
    if(cc)params.set("cc",cc);
    params.set("subject",sujet);
    params.set("body",corps);
    window.location.href=`mailto:${encodeURIComponent(to)}?${params.toString()}`;
  }
  return(
    <Modal title={`📧 Envoyer ${doc.numero}`} onClose={onClose} maxWidth={620}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Input label="Destinataire" value={to} onChange={setTo} type="email" required/>
        <Input label="Cc (optionnel)" value={cc} onChange={setCc} type="email"/>
        <Input label="Sujet" value={sujet} onChange={setSujet}/>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Corps du message</div>
          <textarea value={corps} onChange={e=>setCorps(e.target.value)} rows={10}
            style={{width:"100%",padding:"10px 12px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",lineHeight:1.5,outline:"none",resize:"vertical",color:L.text}}/>
        </div>
        <div style={{fontSize:11,color:L.textMd,padding:"8px 10px",background:L.orangeBg,borderRadius:6,border:`1px solid ${L.orange}33`}}>
          ℹ️ Ouvre votre client mail. Le PDF n'est pas joint automatiquement (limitation mailto:) — utilisez le bouton 🖨 pour l'enregistrer en PDF puis joignez-le manuellement.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={envoyer} variant="primary" icon="📨" disabled={!to}>Ouvrir mon client mail</Btn>
        </div>
      </div>
    </Modal>
  );
}


// ─── ASSISTANT IA ─────────────────────────────────────────────────────────────
function VueAssistant({entreprise,statut,chantiers,salaries}){
  const [messages,setMessages]=useState([{role:"assistant",content:`Bonjour ! Je suis votre assistant BTP pour ${entreprise.nomCourt||entreprise.nom}.\n\nChantier principal : Djaouel (242 963€ HT)\nÉquipe : ${salaries.length} salariés\n\n⚠️ L'IA conversationnelle nécessite un backend (non disponible en direct sur Vercel).\n\nUtilisez plutôt le bouton 🤖 IA dans chaque ligne de devis — il fonctionne instantanément sans connexion et génère 4 versions de désignation professionnelle.\n\nJe reste disponible pour répondre à vos questions métier ici.`}]);
  const [input,setInput]=useState("");
  const endRef=useRef(null);
  const SUGG=["Comment calculer ma marge sur le chantier Djaouel ?","Quelles fournitures pour une dalle béton 50m² ?","Désignation pro pour pose carrelage 120x120","Conseils pour améliorer ma rentabilité","Comment utiliser l'IA désignation ?"];
  function envoyer(){
    if(!input.trim())return;
    const msg=input.trim();setInput("");
    setMessages(m=>[...m,{role:"user",content:msg}]);
    // Réponse locale simple
    setTimeout(()=>{
      const cc=rentaChantier(CHANTIER_DJAOUEL,salaries);
      let rep="";
      if(msg.toLowerCase().includes("marge")||msg.toLowerCase().includes("renta")){
        rep=`Rentabilité Djaouel :\n• Devis HT : 242 963€\n• Coût MO : ${euro(cc.coutMO)}\n• Fournitures : ${euro(cc.coutFourn)}\n• Marge brute : ${euro(cc.marge)} (${cc.tauxMarge}%)\n\n${cc.tauxMarge>=19.5?"✓ Au-dessus de la moyenne secteur (19,5%)":"⚠ Sous la moyenne secteur. Vérifiez vos coûts fournitures et MO."}`;
      } else if(msg.toLowerCase().includes("ia")||msg.toLowerCase().includes("désignation")){
        rep=`L'IA désignation est disponible directement dans Devis.\n\n👉 Allez dans "Devis" → cliquez "Nouveau devis"\n→ Sur chaque ligne, cliquez le bouton 🤖 IA\n→ 4 versions générées instantanément (sans connexion).\n\nL'IA utilise automatiquement les données du chantier associé : fournitures, ouvriers, heures, coût MO.`;
      } else if(msg.toLowerCase().includes("fourn")||msg.toLowerCase().includes("matéri")){
        rep=`Pour comparer les fournitures, allez dans :\nChantiers → Djaouel → onglet "Fournitures"\n\nVous pouvez filtrer par fournisseur (Point P, Gedimat, prix minimum) et voir le prix conseillé pour chaque référence.`;
      } else {
        rep=`Bonne question BTP ! Pour des réponses IA personnalisées, l'intégration backend est nécessaire.\n\nEn attendant, utilisez :\n• 🤖 IA dans Devis → désignations instantanées\n• Chantiers → onglet Rentabilité → analyse détaillée\n• Planning → calcul MO automatique`;
      }
      setMessages(m=>[...m,{role:"assistant",content:rep}]);
      setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
    },600);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
  }
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 60px)"}}>
      <PageH title="Assistant IA" subtitle="Questions BTP · IA désignation disponible dans Devis"/>
      <Card style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:11}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:L.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:2}}>🤖</div>}
              <div style={{maxWidth:"72%",padding:"10px 13px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.role==="user"?L.navy:L.bg,color:m.role==="user"?"#fff":L.text,fontSize:12,lineHeight:1.6,border:`1px solid ${m.role==="user"?L.navy:L.border}`,whiteSpace:"pre-wrap"}}>{m.content}</div>
            </div>
          ))}
          <div ref={endRef}/>
        </div>
        <div style={{padding:"6px 14px",borderTop:`1px solid ${L.border}`,display:"flex",gap:4,overflowX:"auto",background:L.bg}}>
          {SUGG.map(s=><button key={s} onClick={()=>setInput(s)} style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:10,padding:"3px 9px",cursor:"pointer",color:L.textSm,fontSize:10,whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit"}}>{s}</button>)}
        </div>
        <div style={{padding:"9px 13px",borderTop:`1px solid ${L.border}`,display:"flex",gap:7}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();envoyer();}}} placeholder="Tapez votre question BTP..." rows={2} style={{flex:1,padding:"7px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:12,color:L.text,outline:"none",resize:"none",fontFamily:"inherit"}}/>
          <button onClick={envoyer} disabled={!input.trim()} style={{background:input.trim()?L.navy:L.bg,border:`1px solid ${input.trim()?L.navy:L.border}`,borderRadius:8,padding:"7px 14px",cursor:input.trim()?"pointer":"not-allowed",color:input.trim()?"#fff":L.textXs,fontSize:12,fontWeight:700,fontFamily:"inherit",alignSelf:"flex-end"}}>➤</button>
        </div>
      </Card>
    </div>
  );
}

// ─── COMPTA ───────────────────────────────────────────────────────────────────
function VueCompta({chantiers,salaries}){
  const totCA=chantiers.reduce((a,c)=>a+c.devisHT,0);
  const totCouts=chantiers.reduce((a,c)=>a+rentaChantier(c,salaries).totalCouts,0);
  const benef=totCA-totCouts;const tb=pct(benef,totCA);const mc=tb>=25?L.green:tb>=15?L.orange:L.red;
  return(
    <div>
      <PageH title="Comptabilité" subtitle="Vue d'ensemble financière"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI label="CA total" value={euro(totCA)} icon="💰" color={L.navy}/>
        <KPI label="Coûts estimés" value={euro(totCouts)} icon="📉" color={L.orange}/>
        <KPI label="Bénéfice est." value={euro(benef)} icon="📈" color={mc}/>
        <KPI label="Taux marge" value={`${tb}%`} icon="📊" color={mc}/>
        <KPI label="Encaissé" value={euro(chantiers.reduce((a,c)=>a+(c.acompteEncaisse||0),0))} icon="✅" color={L.green}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"11px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text}}>Rentabilité par chantier</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Chantier","CA HT","MO chargée","Fournitures","Marge","Taux"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>{chantiers.map((c,i)=>{const cc=rentaChantier(c,salaries);const mc2=cc.tauxMarge>=25?L.green:cc.tauxMarge>=15?L.orange:L.red;return(
            <tr key={c.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
              <td style={{padding:"8px 12px",fontSize:12,fontWeight:600}}>{c.nom}<div style={{fontSize:10,color:L.textXs}}>{c.client}</div></td>
              <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11}}>{euro(c.devisHT)}</td>
              <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:L.blue}}>{euro(cc.coutMO)}</td>
              <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:L.accent}}>{euro(cc.coutFourn)}</td>
              <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,fontWeight:700,color:mc2}}>{euro(cc.marge)}</td>
              <td style={{padding:"8px 12px"}}><span style={{background:mc2+"22",color:mc2,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{cc.tauxMarge}%</span></td>
            </tr>
          );})}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function VueFrais(){
  const [frais,setFrais]=useState([
    {id:1,cat:"local",libelle:"Loyer local Marseille",montant:850,per:"mensuel",actif:true},
    {id:2,cat:"credit",libelle:"Crédit camionnette Renault",montant:420,per:"mensuel",actif:true},
    {id:3,cat:"credit",libelle:"Crédit camion benne",montant:680,per:"mensuel",actif:true},
    {id:4,cat:"assurance",libelle:"RC Pro + décennale",montant:2800,per:"annuel",actif:true},
    {id:5,cat:"salaire",libelle:"Secrétaire mi-temps",montant:1100,per:"mensuel",actif:true},
    {id:6,cat:"telecom",libelle:"Abonnements téléphone x3",montant:120,per:"mensuel",actif:true},
    {id:7,cat:"compta",libelle:"Expert-comptable",montant:250,per:"mensuel",actif:true},
    {id:8,cat:"carburant",libelle:"Carburant véhicules",montant:380,per:"mensuel",actif:true},
  ]);
  const [form,setForm]=useState({cat:"local",libelle:"",montant:"",per:"mensuel",actif:true});
  const [showF,setShowF]=useState(false);
  const CATS={local:"🏢 Local",credit:"🚛 Crédit",assurance:"🛡 Assurance",salaire:"👩‍💼 Salaire",telecom:"📱 Télécom",compta:"📊 Compta",carburant:"⛽ Carburant",autre:"📦 Autre"};
  const toM=f=>f.actif?(f.per==="mensuel"?f.montant:f.per==="annuel"?f.montant/12:f.montant/3):0;
  const total=frais.reduce((a,f)=>a+toM(f),0);
  function save(){if(!form.libelle||!form.montant)return;setFrais(fs=>[...fs,{...form,montant:parseFloat(form.montant),id:Date.now()}]);setForm({cat:"local",libelle:"",montant:"",per:"mensuel",actif:true});setShowF(false);}
  return(
    <div>
      <PageH title="Frais fixes" subtitle="Charges mensuelles de l'entreprise"
        actions={<Btn onClick={()=>setShowF(!showF)} variant="primary">{showF?"✕":"+ Ajouter"}</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:18}}>
        <KPI label="/ mois" value={euro(total)} color={L.orange}/>
        <KPI label="/ an" value={euro(total*12)} color={L.red}/>
        <KPI label="Postes actifs" value={frais.filter(f=>f.actif).length} color={L.navy}/>
      </div>
      {showF&&<Card style={{padding:14,marginBottom:16,border:`1px solid ${L.accent}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr 1fr",gap:10,marginBottom:10}}>
          <Sel label="Catégorie" value={form.cat} onChange={v=>setForm(f=>({...f,cat:v}))} options={Object.entries(CATS).map(([k,v])=>({value:k,label:v}))}/>
          <Input label="Libellé" value={form.libelle} onChange={v=>setForm(f=>({...f,libelle:v}))} required/>
          <Input label="Montant €" value={form.montant} onChange={v=>setForm(f=>({...f,montant:v}))} type="number" required/>
          <Sel label="Périodicité" value={form.per} onChange={v=>setForm(f=>({...f,per:v}))} options={[{value:"mensuel",label:"Mensuel"},{value:"annuel",label:"Annuel"},{value:"trimestr",label:"Trimestriel"}]}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={save} variant="success">✓ Enregistrer</Btn></div>
      </Card>}
      <Card style={{overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:L.bg}}>{["Catégorie","Libellé","Périodicité","Montant","/ mois",""].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
          <tbody>{frais.map((f,i)=>(
            <tr key={f.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg,opacity:f.actif?1:0.5}}>
              <td style={{padding:"8px 12px",fontSize:11}}>{CATS[f.cat]||f.cat}</td>
              <td style={{padding:"8px 12px",fontSize:12,fontWeight:600,color:L.text}}>{f.libelle}</td>
              <td style={{padding:"8px 12px",fontSize:11,color:L.textSm}}>{f.per}</td>
              <td style={{padding:"8px 12px",fontSize:11,fontFamily:"monospace"}}>{euro(f.montant)}</td>
              <td style={{padding:"8px 12px",fontSize:11,fontFamily:"monospace",fontWeight:700,color:L.orange}}>{euro(toM(f))}</td>
              <td style={{padding:"8px 12px"}}>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>setFrais(fs=>fs.map(x=>x.id!==f.id?x:{...x,actif:!x.actif}))} style={{padding:"2px 7px",border:`1px solid ${f.actif?L.green:L.border}`,borderRadius:5,background:f.actif?L.greenBg:L.surface,color:f.actif?L.green:L.textXs,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>{f.actif?"Actif":"Inactif"}</button>
                  <button onClick={()=>setFrais(fs=>fs.filter(x=>x.id!==f.id))} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:12}}>×</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{background:L.navyBg,borderTop:`2px solid ${L.navy}`}}><td colSpan={4} style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:L.navy}}>TOTAL / mois</td><td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:13,fontWeight:800,color:L.navy}}>{euro(total)}</td><td/></tr></tfoot>
        </table>
      </Card>
    </div>
  );
}

// ─── BIBLIOTHÈQUE BTP — VUE + MODAL DE RECHERCHE ─────────────────────────────
// Design system light (L.*) aligné sur la V13
// 81 ouvrages consultables, filtrables, ajoutables aux devis

const CORPS_META = {
  "Mes ouvrages":{icon:"⭐", color:L.accent, bg:L.accentBg},
  "Maçonnerie":  {icon:"🧱", color:L.blue,   bg:L.blueBg},
  "Carrelage":   {icon:"⬛", color:L.accent, bg:L.accentBg},
  "Peinture":    {icon:"🎨", color:L.purple, bg:"#F5F3FF"},
  "Plomberie":   {icon:"🔧", color:L.teal,   bg:"#F0FDFA"},
  "Électricité": {icon:"⚡", color:L.orange, bg:L.orangeBg},
  "Menuiserie":  {icon:"🪵", color:"#92400E",bg:"#FFFBEB"},
  "Isolation":   {icon:"🧊", color:L.green,  bg:L.greenBg},
  "Démolition":  {icon:"⛏", color:L.red,    bg:L.redBg},
};
const corpsMeta=(c)=>CORPS_META[c]||{icon:"📦",color:L.textSm,bg:L.bg};

// Fourni posé = MO + Fournitures
function fourniPose(o){
  const fpMin = (o.moMin||0)+(o.fournMin||0);
  const fpMoy = (o.moMoy||0)+(o.fournMoy||0);
  const fpMax = (o.moMax||0)+(o.fournMax||0);
  return {fpMin, fpMoy, fpMax};
}

// Normaliser recherche (enlever accents)
function norm(s){return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}

// ─── VUE BIBLIOTHÈQUE ────────────────────────────────────────────────────────
function VueBibliotheque({onAddToDevis}){
  const [recherche,setRecherche]=useState("");
  const [filtre,setFiltre]=useState("Tous");
  const [selected,setSelected]=useState(null);

  const corpsCounts = useMemo(()=>{
    const c={};
    (window.__BIBLIOTHEQUE_BTP__||BIBLIOTHEQUE_BTP).forEach(o=>{c[o.corps]=(c[o.corps]||0)+1;});
    return c;
  },[]);

  const filtered = useMemo(()=>{
    const q=norm(recherche);
    return (window.__BIBLIOTHEQUE_BTP__||BIBLIOTHEQUE_BTP).filter(o=>{
      if(filtre!=="Tous" && o.corps!==filtre) return false;
      if(!q) return true;
      return norm(o.libelle).includes(q) || norm(o.code).includes(q) || norm(o.detail).includes(q);
    });
  },[recherche,filtre]);

  return (
    <div>
      <PageH title="Bibliothèque BTP" subtitle={`${(window.__BIBLIOTHEQUE_BTP__||BIBLIOTHEQUE_BTP).length} ouvrages de référence · Artiprix + Batiprix 2025 · MO / Fournitures / Fourni-posé`}/>

      {/* Filtres corps */}
      <Card style={{padding:14,marginBottom:14}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={()=>setFiltre("Tous")} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${filtre==="Tous"?L.navy:L.border}`,background:filtre==="Tous"?L.navyBg:L.surface,color:filtre==="Tous"?L.navy:L.textSm,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:filtre==="Tous"?700:500}}>
            Tous <span style={{fontWeight:800,marginLeft:4,opacity:0.7}}>{(window.__BIBLIOTHEQUE_BTP__||BIBLIOTHEQUE_BTP).length}</span>
          </button>
          {Object.entries(corpsCounts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>{
            const m=corpsMeta(c);
            const active=filtre===c;
            return(
              <button key={c} onClick={()=>setFiltre(active?"Tous":c)} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${active?m.color:L.border}`,background:active?m.bg:L.surface,color:active?m.color:L.textSm,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:active?700:500,display:"inline-flex",alignItems:"center",gap:5}}>
                <span>{m.icon}</span>{c}<span style={{fontWeight:800,marginLeft:3,opacity:0.7}}>{n}</span>
              </button>
            );
          })}
        </div>
        <Input placeholder="🔍 Rechercher un ouvrage, un code (MAC-001...), une technique..." value={recherche} onChange={setRecherche}/>
        <div style={{fontSize:11,color:L.textXs,marginTop:6}}>{filtered.length} résultat{filtered.length>1?"s":""}</div>
      </Card>

      {/* Grille */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
        {filtered.map(o=>{
          const m=corpsMeta(o.corps);
          const fp=fourniPose(o);
          const expanded=selected===o.code;
          return(
            <Card key={o.code} style={{overflow:"hidden",border:`1px solid ${expanded?m.color:L.border}`}}>
              <div onClick={()=>setSelected(expanded?null:o.code)} style={{padding:"12px 14px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:15}}>{m.icon}</span>
                      <span style={{background:m.bg,color:m.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700,letterSpacing:0.5}}>{o.code}</span>
                      <span style={{fontSize:10,color:L.textXs}}>{o.unite}</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:L.text,lineHeight:1.3}}>{o.libelle}</div>
                    <div style={{fontSize:10,color:L.textXs,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.detail}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:9,color:L.textXs}}>Fourni-posé</div>
                    <div style={{fontSize:17,fontWeight:800,color:m.color,fontFamily:"monospace"}}>{fp.fpMoy?fp.fpMoy+"€":"—"}</div>
                    <div style={{fontSize:9,color:L.textXs}}>/{o.unite}</div>
                  </div>
                </div>
              </div>

              {expanded && (
                <div style={{borderTop:`1px solid ${L.border}`,padding:13,background:L.bg}}>
                  {/* 3 prix */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
                    {[
                      {l:"Main d'œuvre",min:o.moMin,moy:o.moMoy,max:o.moMax,c:L.blue},
                      {l:"Fournitures",min:o.fournMin,moy:o.fournMoy,max:o.fournMax,c:L.accent},
                      {l:"Fourni-posé",min:fp.fpMin,moy:fp.fpMoy,max:fp.fpMax,c:m.color},
                    ].map(p=>(
                      <div key={p.l} style={{background:L.surface,borderRadius:7,padding:"7px 9px",border:`1px solid ${L.border}`}}>
                        <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase",marginBottom:3}}>{p.l}</div>
                        <div style={{fontSize:14,fontWeight:800,color:p.c,fontFamily:"monospace"}}>{p.moy?p.moy+"€":"—"}</div>
                        <div style={{fontSize:9,color:L.textXs,marginTop:2}}>{p.min}€ – {p.max}€</div>
                      </div>
                    ))}
                  </div>

                  {/* Détail technique */}
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:10,color:L.textXs,textTransform:"uppercase",marginBottom:3}}>Comprenant</div>
                    <div style={{fontSize:12,color:L.textMd,lineHeight:1.4}}>{o.detail}</div>
                  </div>

                  {/* Composants */}
                  {o.composants&&o.composants.length>0 && (
                    <div style={{marginBottom:9}}>
                      <div style={{fontSize:10,color:L.textXs,textTransform:"uppercase",marginBottom:4}}>Fournitures ({o.composants.length})</div>
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {o.composants.map((c,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 7px",background:L.surface,borderRadius:5}}>
                            <span style={{color:L.textMd}}>{c.designation}</span>
                            <span style={{color:L.textSm,fontFamily:"monospace"}}>{c.qte} {c.unite} × {c.prixAchat}€</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Équipe type + MO */}
                  {(o.tempsMO>0||o.affectations?.length>0) && (
                    <div style={{marginBottom:9,padding:"7px 9px",background:L.blueBg,borderRadius:7,border:`1px solid ${L.blue}22`}}>
                      <div style={{fontSize:10,color:L.blue,fontWeight:700,marginBottom:3,textTransform:"uppercase"}}>Équipe type</div>
                      <div style={{fontSize:11,color:L.textMd}}>
                        {o.tempsMO>0 && <span>⏱ {o.tempsMO}h / {o.unite}</span>}
                        {o.affectations?.length>0 && <span style={{marginLeft:8}}>👷 {o.affectations.map(a=>`${a.nb} ${a.q}`).join(" + ")}</span>}
                      </div>
                    </div>
                  )}

                  <div style={{fontSize:10,color:L.textXs,marginBottom:9}}>Source : {o.source}</div>

                  {onAddToDevis && (
                    <Btn onClick={()=>onAddToDevis(o)} variant="primary" fullWidth icon="+">Ajouter à un devis</Btn>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length===0 && (
          <Card style={{padding:30,textAlign:"center",gridColumn:"1/-1"}}>
            <div style={{fontSize:30,marginBottom:6}}>🔍</div>
            <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:4}}>Aucun résultat</div>
            <div style={{fontSize:11,color:L.textSm}}>Essayez un autre mot-clé ou changez le filtre de corps de métier</div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── MODAL RECHERCHE INTÉGRÉE AU CRÉATEUR DE DEVIS ───────────────────────────
function BibliothequeSearchModal({onPick,onClose}){
  const [recherche,setRecherche]=useState("");
  const [filtre,setFiltre]=useState("Tous");
  const q=norm(recherche);
  const filtered=(window.__BIBLIOTHEQUE_BTP__||BIBLIOTHEQUE_BTP).filter(o=>{
    if(filtre!=="Tous" && o.corps!==filtre) return false;
    if(!q) return true;
    return norm(o.libelle).includes(q)||norm(o.code).includes(q)||norm(o.detail).includes(q);
  }).slice(0,60);

  const corpsList=["Tous",...Object.keys(CORPS_META)];

  return(
    <Modal title="📖 Catalogue Bibliothèque BTP — Ajouter à ce devis" onClose={onClose} maxWidth={900}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {/* Filtres */}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {corpsList.map(c=>{
            const m=c==="Tous"?{icon:"📦",color:L.navy,bg:L.navyBg}:corpsMeta(c);
            const active=filtre===c;
            return(
              <button key={c} onClick={()=>setFiltre(c)} style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${active?m.color:L.border}`,background:active?m.bg:L.surface,color:active?m.color:L.textSm,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:active?700:500,display:"inline-flex",alignItems:"center",gap:4}}>
                <span>{m.icon}</span>{c}
              </button>
            );
          })}
        </div>

        <Input placeholder="🔍 Dalle béton, carrelage 60x60, peinture..." value={recherche} onChange={setRecherche}/>

        <div style={{fontSize:11,color:L.textXs}}>{filtered.length} ouvrage{filtered.length>1?"s":""} trouvé{filtered.length>1?"s":""}{filtered.length===60?" (60 max affichés)":""}</div>

        {/* Liste compacte */}
        <div style={{maxHeight:"55vh",overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:8}}>
          {filtered.map((o,i)=>{
            const m=corpsMeta(o.corps);
            const fp=fourniPose(o);
            return(
              <div key={o.code} onClick={()=>onPick(o)} style={{display:"grid",gridTemplateColumns:"60px 60px 1fr 80px 80px 80px 70px",gap:8,padding:"8px 12px",borderBottom:i<filtered.length-1?`1px solid ${L.border}`:"none",cursor:"pointer",alignItems:"center",background:i%2===0?L.surface:L.bg}} onMouseEnter={e=>e.currentTarget.style.background=m.bg} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?L.surface:L.bg}>
                <span style={{fontSize:16,textAlign:"center"}}>{m.icon}</span>
                <span style={{background:m.bg,color:m.color,borderRadius:4,padding:"2px 5px",fontSize:9,fontWeight:700,textAlign:"center"}}>{o.code}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.libelle}</div>
                  <div style={{fontSize:10,color:L.textXs,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.detail}</div>
                </div>
                <div style={{textAlign:"right",fontSize:11,fontFamily:"monospace"}}>
                  <div style={{color:L.blue,fontWeight:600}}>{o.moMoy?o.moMoy+"€":"—"}</div>
                  <div style={{fontSize:9,color:L.textXs}}>MO</div>
                </div>
                <div style={{textAlign:"right",fontSize:11,fontFamily:"monospace"}}>
                  <div style={{color:L.accent,fontWeight:600}}>{o.fournMoy?o.fournMoy+"€":"—"}</div>
                  <div style={{fontSize:9,color:L.textXs}}>Fourn</div>
                </div>
                <div style={{textAlign:"right",fontSize:12,fontFamily:"monospace"}}>
                  <div style={{color:m.color,fontWeight:800}}>{fp.fpMoy?fp.fpMoy+"€":"—"}</div>
                  <div style={{fontSize:9,color:L.textXs}}>/ {o.unite}</div>
                </div>
                <Btn onClick={(e)=>{e.stopPropagation();onPick(o);}} variant="primary" size="sm">+ Ajouter</Btn>
              </div>
            );
          })}
          {filtered.length===0 && (
            <div style={{padding:25,textAlign:"center",color:L.textXs,fontSize:12}}>Aucun ouvrage trouvé</div>
          )}
        </div>
      </div>
    </Modal>
  );
}


function VueParametres({entreprise,setEntreprise,statut,setStatut,onClose}){
  const [form,setForm]=useState({...entreprise});const [stat,setStat]=useState(statut);
  const [logoErr,setLogoErr]=useState(null);
  function save(){setEntreprise({...form,nomCourt:form.nomCourt||form.nom.split(" ").slice(0,2).join(" ")});setStatut(stat);onClose();}
  function onLogoChange(e){
    const file=e.target.files?.[0];
    e.target.value="";
    if(!file)return;
    if(!file.type.startsWith("image/")){setLogoErr("Format invalide (PNG/JPG/SVG)");return;}
    if(file.size>500_000){setLogoErr("Logo trop volumineux (max 500 Ko)");return;}
    setLogoErr(null);
    const reader=new FileReader();
    reader.onload=()=>setForm(f=>({...f,logo:reader.result}));
    reader.onerror=()=>setLogoErr("Lecture du fichier impossible");
    reader.readAsDataURL(file);
  }
  return(
    <Modal title="⚙️ Paramètres entreprise" onClose={onClose} maxWidth={540}>
      <div style={{display:"flex",flexDirection:"column",gap:13}}>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>Logo (apparaît en en-tête des devis)</div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {form.logo
              ? <img src={form.logo} alt="logo" style={{maxHeight:64,maxWidth:160,objectFit:"contain",border:`1px solid ${L.border}`,borderRadius:6,padding:4,background:L.surface}}/>
              : <div style={{height:64,width:160,border:`1px dashed ${L.borderMd}`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:L.textXs,fontSize:11,background:L.bg}}>Aucun logo</div>}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label style={{padding:"6px 12px",background:L.navy,color:"#fff",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",textAlign:"center"}}>
                📁 Charger
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoChange} style={{display:"none"}}/>
              </label>
              {form.logo&&<button onClick={()=>setForm(f=>({...f,logo:null}))} style={{padding:"5px 11px",background:L.surface,color:L.red,border:`1px solid ${L.border}`,borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Supprimer</button>}
            </div>
          </div>
          <div style={{fontSize:10,color:logoErr?L.red:L.textXs,marginTop:5}}>{logoErr||"PNG / JPG / SVG · max 500 Ko · stocké en base64 dans le profil"}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{gridColumn:"span 2"}}><Input label="Nom complet" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))} required/></div>
          <Input label="Nom court" value={form.nomCourt||""} onChange={v=>setForm(f=>({...f,nomCourt:v}))}/>
          <Input label="SIRET" value={form.siret} onChange={v=>setForm(f=>({...f,siret:v}))}/>
          <Input label="Téléphone" value={form.tel||""} onChange={v=>setForm(f=>({...f,tel:v}))}/>
          <Input label="Email" value={form.email||""} onChange={v=>setForm(f=>({...f,email:v}))} type="email"/>
          <div style={{gridColumn:"span 2"}}><Input label="Adresse" value={form.adresse||""} onChange={v=>setForm(f=>({...f,adresse:v}))}/></div>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:8}}>Statut juridique</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {Object.entries(STATUTS).map(([key,s])=>(
              <div key={key} onClick={()=>setStat(key)} style={{padding:"8px 12px",borderRadius:8,border:`2px solid ${stat===key?s.color:L.border}`,background:stat===key?s.bg:L.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
                <span>{s.icon}</span><span style={{fontSize:12,fontWeight:stat===key?700:400,color:stat===key?s.color:L.textMd}}>{s.short}</span>
                <span style={{fontSize:10,color:L.textXs,flex:1}}>{s.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${L.border}`}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={save} variant="success">✓ Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

function VuePlaceholder({title,icon,desc}){
  return <div><PageH title={title}/><Card style={{padding:32,textAlign:"center",border:`2px dashed ${L.border}`}}><div style={{fontSize:36,marginBottom:8}}>{icon}</div><div style={{fontSize:14,fontWeight:700,color:L.text,marginBottom:5}}>{title}</div><div style={{fontSize:12,color:L.textSm,maxWidth:380,margin:"0 auto",lineHeight:1.6}}>{desc}</div><div style={{marginTop:12,display:"inline-block",background:L.orangeBg,color:L.orange,borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:700}}>Prochainement</div></Card></div>;
}

// ─── APP PRINCIPALE ────────────────────────────────────────────────────────────
export default function App(){
  const [onboardingDone,setOnboardingDone]=useState(false);
  const [entreprise,setEntreprise]=useState(ENTREPRISE_INIT);
  const [statut,setStatut]=useState("sarl");
  const [salaries,setSalaries]=useState(SALARIES_EXEMPLE);
  const [chantiers,setChantiers]=useState([CHANTIER_DJAOUEL,...CHANTIERS_DEMO]);
  const [docs,setDocs]=useState(DOCS_INIT);
  const [selectedChantier,setSelectedChantier]=useState(1);
  const [view,setView]=useState("accueil");
  const [showSettings,setShowSettings]=useState(false);
  const [notif,setNotif]=useState(null);
  // ─── BIBLIOTHÈQUE BTP DEPUIS SUPABASE (Phase 6) ──────
    const { ouvrages: bibliotheque, source: bibliothequeSource, addOuvrage } = useOuvragesBibliotheque(BIBLIOTHEQUE_BTP);
    // Astuce : on remplace dynamiquement la variable globale BIBLIOTHEQUE_BTP
    // pour que VueBibliotheque et BibliothequeSearchModal utilisent les ouvrages
    // a jour, sans avoir a modifier ces composants.
    if (typeof window !== "undefined") {
      window.__BIBLIOTHEQUE_BTP__ = bibliotheque;
    }
    // ─────────────────────────────────────────────────────
  // ─── AUTH SUPABASE (Phase 5) ─────────────────────────
  const [authUser,setAuthUser] = useState(null);
  const [showLogin,setShowLogin] = useState(false);

  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>{
      if(data?.session?.user) setAuthUser(data.session.user);
    });
    const {data:sub} = supabase.auth.onAuthStateChange((_evt, session)=>{
      setAuthUser(session?.user || null);
    });
    return ()=>sub?.subscription?.unsubscribe();
  },[]);

  // Charge le profil entreprise depuis Supabase quand l'utilisateur est authentifié
  useEffect(()=>{
    if(!supabase || !authUser) return;
    let cancelled=false;
    supabase.from("entreprises").select("*").eq("user_id",authUser.id).maybeSingle()
      .then(({data,error})=>{
        if(cancelled) return;
        if(error){console.warn("[entreprises] load error:",error.message);return;}
        if(!data) return;
        setEntreprise({
          nom:data.nom||ENTREPRISE_INIT.nom,
          nomCourt:data.nom_court||data.nom?.split(" ").slice(0,2).join(" ")||ENTREPRISE_INIT.nomCourt,
          siret:data.siret||"",
          adresse:data.adresse||"",
          tel:data.tel||"",
          email:data.email||authUser.email||"",
          activite:data.activite||ENTREPRISE_INIT.activite,
          tva:data.tva??true,
        });
        if(data.statut) setStatut(data.statut);
        setOnboardingDone(true);
      });
    return ()=>{cancelled=true;};
  },[authUser]);

  async function handleLogout(){
    if(supabase) await supabase.auth.signOut();
    setAuthUser(null);
  }
  // ─────────────────────────────────────────────────────

  const s=STATUTS[statut];
  const modules=s?.modules||STATUTS.sarl.modules;
  const activeView=modules.includes(view)?view:"accueil";

  function handleOnboarding(data){
    setEntreprise({nom:data.nom||"Mon Entreprise",nomCourt:data.nom?.split(" ").slice(0,2).join(" ")||"Mon Entreprise",siret:data.siret||"",adresse:"",tel:data.tel||"",email:data.email||"",activite:data.activite||"Rénovation générale"});
    setStatut(data.statut||"sarl");setOnboardingDone(true);
  }

  // Conversion devis -> chantier : confirme, crée, redirige, back-link sur le doc
  function convertirDevisEnChantier(doc){
    const items=doc.lignes||[];
    const lignesChiffrees=items.filter(isLigneDevis);
    const ht=lignesChiffrees.reduce((a,l)=>a+(+l.qte||0)*(+l.prixUnitHT||0),0);
    const nbTitres=items.filter(it=>it.type==="titre").length;
    const nbLignes=lignesChiffrees.length;
    const dejaConverti=doc.chantierId&&chantiers.some(c=>c.id===doc.chantierId);
    const msg=`Convertir le ${doc.type||"devis"} ${doc.numero} en chantier ?\n\nClient : ${doc.client||"—"}\nMontant HT : ${euro(ht)}\nPostes : ${nbLignes} ligne(s)\nPlanning : ${nbTitres} phase(s) générée(s) depuis les titres\n${dejaConverti?"\n⚠ Ce devis a déjà été converti — un nouveau chantier sera créé en doublon.":""}`;
    if(!window.confirm(msg))return;
    const chantier=devisVersChantier(doc);
    setChantiers(cs=>[...cs,chantier]);
    setSelectedChantier(chantier.id);
    setDocs(ds=>ds.map(d=>d.id===doc.id?{...d,chantierId:chantier.id,statut:"accepté"}:d));
    setView("chantiers");
  }

  if(!onboardingDone)return <Onboarding onComplete={handleOnboarding}/>;

  return(
    <div style={{minHeight:"100vh",background:L.bg,color:L.text,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",display:"flex",height:"100vh",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        input:focus,select:focus,textarea:focus{border-color:${L.accent}!important;outline:none;box-shadow:0 0 0 3px ${L.accent}18;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${L.borderMd};border-radius:10px;}
        button,input,select,textarea{font-family:inherit;}
        @media print{
          @page{size:A4;margin:14mm;}
          body{background:#fff!important;}
          body *{visibility:hidden!important;box-shadow:none!important;}
          #printable-apercu,#printable-apercu *{visibility:visible!important;}
          #printable-apercu{position:absolute!important;left:0!important;top:0!important;width:100%!important;padding:0!important;background:#fff!important;border:none!important;}
          .no-print{display:none!important;}
        }
      `}</style>
      {notif&&<Notif msg={notif.msg} type={notif.type} onClose={()=>setNotif(null)}/>}
      <div className="no-print"><Sidebar modules={modules} active={activeView} onNav={v=>setView(v)} entreprise={entreprise} statut={statut} onSettings={()=>setShowSettings(true)}/></div>
      <div style={{flex:1,overflowY:activeView==="chantiers"||activeView==="planning"?"hidden":"auto",padding:activeView==="chantiers"?0:24,display:"flex",flexDirection:"column",minWidth:0}}>
        {activeView==="accueil"&&<Accueil chantiers={chantiers} docs={docs} entreprise={entreprise} statut={statut} salaries={salaries} onNav={v=>setView(v)}/>}
        {activeView==="chantiers"&&<VueChantiers chantiers={chantiers} setChantiers={setChantiers} selected={selectedChantier} setSelected={setSelectedChantier} salaries={salaries} statut={statut}/>}
        {activeView==="devis"&&<VueDevis chantiers={chantiers} salaries={salaries} statut={statut} entreprise={entreprise} docs={docs} setDocs={setDocs} onConvertirChantier={convertirDevisEnChantier} onSaveOuvrage={addOuvrage}/>}
        {activeView==="equipe"&&<VueEquipe salaries={salaries} setSalaries={setSalaries}/>}
        {activeView==="planning"&&<div style={{overflowY:"auto",padding:24,height:"100%"}}><VuePlanning chantiers={chantiers} setChantiers={setChantiers} salaries={salaries}/></div>}
        {activeView==="compta"&&<VueCompta chantiers={chantiers} salaries={salaries}/>}
        {activeView==="frais"&&<VueFrais/>}
        {activeView==="assistant"&&<VueAssistant entreprise={entreprise} statut={statut} chantiers={chantiers} salaries={salaries}/>}
        {activeView==="coefficients"&&<VuePlaceholder title="Coefficients" icon="🧮" desc="Calculez votre coefficient de frais généraux depuis vos charges fixes."/>}
        {activeView==="connecteurs"&&<VuePlaceholder title="Qonto & Pennylane" icon="🔗" desc="Synchronisez vos transactions et votre comptabilité."/>}
        {activeView==="bibliotheque"&&<VueBibliotheque/>}
        {activeView==="import"&&<VuePlaceholder title="Import PDF" icon="📤" desc="L'IA analyse vos devis PDF et crée le chantier automatiquement."/>}
      </div>
      {showSettings&&<VueParametres entreprise={entreprise} setEntreprise={setEntreprise} statut={statut} setStatut={setStatut} onClose={()=>setShowSettings(false)}/>}
      {/* Bouton Login flottant (Phase 5) */}
      <div style={{position:"fixed",bottom:14,right:14,zIndex:100}}>
        {authUser ? (
          <div style={{display:"flex",gap:6,alignItems:"center",background:"#fff",padding:"8px 12px",borderRadius:10,boxShadow:"0 2px 12px rgba(0,0,0,0.12)",border:"1px solid #E5E7EB",fontSize:12}}>
            <span style={{color:"#059669"}}>●</span>
            <span style={{color:"#0F172A",fontWeight:600}}>{authUser.email}</span>
            <button onClick={handleLogout} style={{marginLeft:8,padding:"4px 10px",background:"#FEF2F2",color:"#DC2626",border:"1px solid #DC262633",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Déconnexion</button>
          </div>
        ) : (
          <button onClick={()=>setShowLogin(true)} style={{padding:"10px 16px",background:"#E8620A",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 12px rgba(232,98,10,0.35)"}}>🔐 Se connecter</button>
        )}
      </div>

      {showLogin && <LoginModal onClose={()=>setShowLogin(false)} onLogin={(u)=>setAuthUser(u)} />}
    </div>
  );
}
