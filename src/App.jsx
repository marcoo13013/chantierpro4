import React, { useState, useRef, useMemo } from "react";
import { useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginModal from "./components/LoginModal";
import { useOuvragesBibliotheque } from "./lib/ouvrages";
import { useDevis } from "./lib/useDevis";
import TrancheCard from "./components/TrancheCard";
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
  sarl:{label:"SARL",short:"SARL",icon:"🏗",mode:"avance",color:L.navy,bg:L.navyBg,description:"Société à responsabilité limitée",tauxCharges:0.45,tvaSoumis:true,modules:["accueil","chantiers","devis","bibliotheque","equipe","planning","compta","frais","connecteurs","assistant","import"]},
  sas:{label:"SAS / SASU",short:"SAS",icon:"🏛",mode:"avance",color:L.purple,bg:"#F5F3FF",description:"Société par actions simplifiée",tauxCharges:0.42,tvaSoumis:true,modules:["accueil","chantiers","devis","bibliotheque","equipe","planning","compta","frais","connecteurs","assistant","import"]},
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
  connecteurs:{label:"Qonto / PL",icon:"🔗",group:"outils"},
  assistant:{label:"Assistant IA",icon:"🤖",group:"ia"},
  import:{label:"Import PDF",icon:"📤",group:"outils"},
};
const NAV_GROUPS={principal:"Principal",documents:"Documents",gestion:"Gestion",outils:"Outils",ia:"Intelligence"};

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



// Profil entreprise vide par défaut : rempli via l'onboarding ou le chargement Supabase.
const ENTREPRISE_INIT = {
  nom:"",nomCourt:"",
  siret:"",statut:"sarl",tva:true,
  adresse:"",
  tel:"",email:"",
  activite:"",
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
//
// Marge = (devisHT − coûtRéel) / devisHT × 100
// coûtRéel = MO (heures × ouvriers × tauxChargé) + fournitures + dépenses
//
// Préférence à postes[].tempsMO (issu de l'estimation IA, par unité × qte).
// Fallback sur planning[] (dureeJours × 8 × salariésAffectés) pour les
// chantiers manuels sans poste détaillé.
function rentaChantier(ch, salaries){
  // Taux horaire moyen chargé de l'équipe
  const tauxMoyen=(salaries&&salaries.length>0)
    ?salaries.reduce((a,s)=>a+(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0)),0)/salaries.length
    :35;

  // Heures totales estimées via les postes (heures sont par unité → × qte)
  const heuresPostes=(ch.postes||[]).reduce((a,p)=>{
    const h=+p.tempsMO?.heures||0;
    const ouv=+p.tempsMO?.nbOuvriers||1;
    const qte=+p.qte||1;
    return a+h*qte*ouv;
  },0);
  const coutMOPostes=heuresPostes*tauxMoyen;

  // Fallback si aucun poste détaillé : on calcule depuis le planning
  const coutMOPlanning=(ch.planning||[]).reduce((a,t)=>a+coutTache(t,salaries),0);
  const coutMO=heuresPostes>0?coutMOPostes:coutMOPlanning;

  // Fournitures : prix d'achat × qte (prixRetenuFourn = min des prix dispo)
  const coutFourn=(ch.postes||[]).reduce((a,p)=>
    a+(p.fournitures||[]).reduce((b,f)=>{
      const q=+f.qte||1;
      const pr=+f.prixAchat||prixRetenuFourn(f)||0;
      return b+q*pr;
    },0),0);

  const depR=(ch.depensesReelles||[]).reduce((a,x)=>a+(+x.montant||0),0);
  const totalCouts=coutMO+coutFourn+depR;
  const marge=(+ch.devisHT||0)-totalCouts;
  const tauxMarge=pct(marge,+ch.devisHT||0);
  const totalH=heuresPostes>0
    ?heuresPostes
    :(ch.planning||[]).reduce((a,t)=>a+t.dureeJours*8*(t.salariesIds||[]).length,0);
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

  // Postes (un par ligne) + agrégation salariés / heures totales / ouvriers max par titre
  let curTitreLib=null,curTitreId=null;
  const postes=[];
  const salariesParTitre=new Map(); // titreId -> Set<salarieId>
  const heuresParTitre=new Map();   // titreId -> heures totales (somme par ligne, formule calcLigneDevis)
  const ouvriersMaxParTitre=new Map(); // titreId -> max nbOuvriers parmi les lignes
  let posteId=1;
  for(const it of items){
    if(it.type==="titre"){
      curTitreLib=it.libelle||"Lot";
      curTitreId=it.id;
      if(!salariesParTitre.has(it.id))salariesParTitre.set(it.id,new Set());
      if(!heuresParTitre.has(it.id))heuresParTitre.set(it.id,0);
      if(!ouvriersMaxParTitre.has(it.id))ouvriersMaxParTitre.set(it.id,0);
      continue;
    }
    if(it.type==="soustitre")continue;
    const qte=+it.qte||1;
    // Même formule que calcLigneDevis l.657 :
    //   hTotal = heuresPrevues > 0 ? heuresPrevues * qte : rend.h * qte * rend.nb
    const rend=detectRendement(it.libelle||"");
    const heuresLigne=(+it.heuresPrevues||0)>0
      ?(+it.heuresPrevues)*qte
      :rend.h*qte*rend.nb;
    // nbOuvriers : priorité salariesAssignes.length > nbOuvriers déclaré > rendement par défaut
    const nbAssignes=Array.isArray(it.salariesAssignes)?it.salariesAssignes.length:0;
    const ouvLigne=nbAssignes>0?nbAssignes:(+it.nbOuvriers||rend.nb||1);
    postes.push({
      id:posteId++,
      lot:curTitreLib||"Lot principal",
      libelle:it.libelle||"",
      montantHT:+((+it.qte||0)*(+it.prixUnitHT||0)).toFixed(2),
      qte,
      unite:it.unite||"",
      tempsMO:{heures:+it.heuresPrevues||0,nbOuvriers:ouvLigne,detail:""},
      fournitures:it.fournitures||[],
    });
    if(curTitreId!=null){
      heuresParTitre.set(curTitreId,(heuresParTitre.get(curTitreId)||0)+heuresLigne);
      ouvriersMaxParTitre.set(curTitreId,Math.max(ouvriersMaxParTitre.get(curTitreId)||0,ouvLigne));
      if(Array.isArray(it.salariesAssignes)){
        const set=salariesParTitre.get(curTitreId);
        for(const sid of it.salariesAssignes)set.add(sid);
      }
    }
  }

  // Planning : un par titre, dureeJours auto-calculée depuis les heures
  // estimées, dates espacées de la durée précédente (séquentiel), heures
  // et nbOuvriers propagés sur la phase pour permettre le recalcul.
  const titres=items.filter(it=>it.type==="titre");
  let cursor=new Date(today);
  const planning=titres.map((t,i)=>{
    const heures=+(heuresParTitre.get(t.id)||0);
    const ouvriers=ouvriersMaxParTitre.get(t.id)||1;
    // dureeJours = ceil(heures / (ouvriers * 8)), minimum 1 jour
    // Fallback 7j si aucune heure estimée
    const dureeJours=heures>0
      ?Math.max(1,Math.ceil(heures/(ouvriers*8)))
      :7;
    const dateDebut=cursor.toISOString().slice(0,10);
    cursor=new Date(cursor);cursor.setDate(cursor.getDate()+dureeJours);
    return{
      id:Date.now()+i,
      tache:t.libelle||`Phase ${i+1}`,
      dateDebut,
      dureeJours,
      heuresPrevues:+heures.toFixed(1),
      nbOuvriers:ouvriers,
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

// Mini renderer Markdown : bold **x**, italic *x*, listes "- ", titres "## ".
// Conserve les sauts de ligne. Évite XSS en construisant des nœuds React
// (pas de dangerouslySetInnerHTML).
function MdInline({text}){
  if(!text)return null;
  const out=[];let key=0;
  // 1) Découpe par **bold**
  const parts=String(text).split(/(\*\*[^*]+\*\*)/g);
  for(const seg of parts){
    if(/^\*\*[^*]+\*\*$/.test(seg)){
      out.push(<strong key={key++}>{seg.slice(2,-2)}</strong>);
      continue;
    }
    // 2) Sur le reste, découpe par *italic* (pas de * en début)
    const subs=seg.split(/(\*[^*\s][^*]*\*)/g);
    for(const s of subs){
      if(/^\*[^*\s][^*]*\*$/.test(s)){
        out.push(<em key={key++}>{s.slice(1,-1)}</em>);
      } else if(s){
        out.push(<React.Fragment key={key++}>{s}</React.Fragment>);
      }
    }
  }
  return out;
}

function MarkdownText({text}){
  if(!text)return null;
  const lines=String(text).split("\n");
  const blocks=[];
  let listBuf=[];
  function flushList(){
    if(listBuf.length){
      blocks.push(<ul key={`ul-${blocks.length}`} style={{margin:"4px 0",paddingLeft:18,listStyleType:"disc"}}>
        {listBuf.map((l,i)=><li key={i} style={{margin:"2px 0"}}><MdInline text={l}/></li>)}
      </ul>);
      listBuf=[];
    }
  }
  lines.forEach((ln,i)=>{
    const trimmed=ln.replace(/^\s+/,"");
    const m=trimmed.match(/^[-*•]\s+(.*)$/);
    if(m){listBuf.push(m[1]);return;}
    flushList();
    if(/^###\s+/.test(trimmed)){
      blocks.push(<div key={i} style={{fontSize:13,fontWeight:700,marginTop:6,marginBottom:3}}><MdInline text={trimmed.replace(/^###\s+/,"")}/></div>);
    } else if(/^##\s+/.test(trimmed)){
      blocks.push(<div key={i} style={{fontSize:14,fontWeight:800,marginTop:8,marginBottom:4}}><MdInline text={trimmed.replace(/^##\s+/,"")}/></div>);
    } else if(/^#\s+/.test(trimmed)){
      blocks.push(<div key={i} style={{fontSize:15,fontWeight:800,marginTop:8,marginBottom:4}}><MdInline text={trimmed.replace(/^#\s+/,"")}/></div>);
    } else if(trimmed===""){
      blocks.push(<div key={i} style={{height:6}}/>);
    } else {
      blocks.push(<div key={i}><MdInline text={ln}/></div>);
    }
  });
  flushList();
  return <div>{blocks}</div>;
}

// Hook viewport : on lit window.innerWidth/Height directement à chaque
// render (pas via un state, pour éviter une valeur stale au 1er render
// sur iOS Safari avant que le viewport meta soit pris en compte).
// Un dummy state forcé sur resize/orientationchange ré-exécute le composant.
function useViewportSize(){
  const [,force]=useState(0);
  useEffect(()=>{
    function on(){force(x=>x+1);}
    window.addEventListener("resize",on);
    window.addEventListener("orientationchange",on);
    // iOS Safari : window.innerWidth peut être incorrect au tout premier
    // render. On force un re-read après que le layout est posé.
    const t1=setTimeout(on,50);
    const t2=setTimeout(on,300);
    return ()=>{
      window.removeEventListener("resize",on);
      window.removeEventListener("orientationchange",on);
      clearTimeout(t1);clearTimeout(t2);
    };
  },[]);
  return{
    w:typeof window!=="undefined"?window.innerWidth:1200,
    h:typeof window!=="undefined"?window.innerHeight:800,
  };
}

// Custom hook : synchronise un tableau JS avec une table Supabase scopée par
// user_id. Debounce 800ms. Skip ref pour éviter le save juste après un load.
function useSupaSync(table,items,supaReady,authUser,supaSkipRef){
  useEffect(()=>{
    if(!supaReady||!supabase||!authUser)return;
    if(supaSkipRef.current[table]>0){supaSkipRef.current[table]--;return;}
    const t=setTimeout(async()=>{
      try{
        const ids=items.map(it=>it.id).filter(x=>x!=null);
        if(items.length>0){
          const rows=items.map(it=>{
            const id=it.id??(Date.now()+Math.floor(Math.random()*1000));
            return{id,user_id:authUser.id,data:{...it,id}};
          });
          const{error:upErr}=await supabase.from(table).upsert(rows,{onConflict:"user_id,id"});
          if(upErr){console.warn(`[supa ${table} upsert]`,upErr.message);return;}
        }
        let q=supabase.from(table).delete().eq("user_id",authUser.id);
        if(ids.length>0)q=q.not("id","in",`(${ids.join(",")})`);
        const{error:delErr}=await q;
        if(delErr)console.warn(`[supa ${table} delete]`,delErr.message);
      }catch(e){console.warn(`[supa ${table} save]`,e);}
    },800);
    return ()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[items,supaReady,authUser?.id]);
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
    <div className="cp-modal-bg" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowX:"hidden"}} onClick={closeOnOverlay?onClose:undefined}>
      <div className="cp-modal" style={{background:L.surface,borderRadius:16,width:"100%",maxWidth:`min(${typeof maxWidth==="number"?maxWidth+"px":maxWidth},100vw)`,maxHeight:"92vh",overflowY:"auto",overflowX:"hidden",boxShadow:L.shadowLg}} onClick={e=>e.stopPropagation()}>
        <div className="cp-modal-head" style={{padding:"16px 22px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:L.surface,zIndex:1,gap:10}}>
          <div style={{fontSize:14,fontWeight:700,color:L.text,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${L.border}`,borderRadius:8,width:30,height:30,minWidth:30,cursor:"pointer",color:L.textSm,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0}}>×</button>
        </div>
        <div className="cp-modal-body" style={{padding:22}}>{children}</div>
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
function Sidebar({modules,active,onNav,entreprise,statut,onSettings,onDevisRapide,compact}){
  const [drawerOpen,setDrawerOpen]=useState(false);
  const grouped={};
  modules.forEach(m=>{const cfg=NAV_CONFIG[m];if(!cfg)return;if(!grouped[cfg.group])grouped[cfg.group]=[];grouped[cfg.group].push({id:m,...cfg});});
  const s=STATUTS[statut];

  // Rendu commun de la liste de navigation. `withLabels`=true pour le drawer
  // ou desktop ; false pour la mini-barre d'icônes.
  function renderNav(withLabels){
    return Object.entries(grouped).map(([group,items])=>(
      <div key={group}>
        {withLabels&&<div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.2,padding:"7px 13px 2px"}}>{NAV_GROUPS[group]}</div>}
        {items.map(item=>(
          <button key={item.id} onClick={()=>{onNav(item.id);if(compact)setDrawerOpen(false);}} title={!withLabels?item.label:undefined}
            style={{width:"100%",background:active===item.id?"rgba(255,255,255,0.13)":"transparent",border:"none",cursor:"pointer",padding:withLabels?"7px 13px":"10px 0",display:"flex",alignItems:"center",justifyContent:withLabels?"flex-start":"center",gap:7,color:active===item.id?"#fff":"rgba(255,255,255,0.58)",fontSize:12,fontWeight:active===item.id?600:400,textAlign:"left",borderLeft:active===item.id?`3px solid ${L.accent}`:"3px solid transparent",fontFamily:"inherit"}}>
            <span style={{fontSize:withLabels?13:16}}>{item.icon}</span>{withLabels&&item.label}
          </button>
        ))}
      </div>
    ));
  }

  // Bandeau "marque + entreprise + statut" (drawer ou desktop)
  function renderHeader(){
    return(
      <>
        <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entreprise.nomCourt||entreprise.nom}</div>
        </div>
        <div style={{padding:"7px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{background:s?.bg,borderRadius:7,padding:"5px 9px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12}}>{s?.icon}</span>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:s?.color}}>{s?.short} · {s?.mode==="simple"?"Simple":"Avancé"}</div>
              <div style={{fontSize:9,color:L.textSm,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entreprise.activite}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Bouton CTA "Devis Rapide IA" — variante compact/expanded
  function renderDevisRapideBtn(withLabel){
    if(!onDevisRapide)return null;
    return(
      <div style={{padding:withLabel?"10px 11px":"8px 6px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <button onClick={()=>{onDevisRapide();if(compact)setDrawerOpen(false);}} title={!withLabel?"Devis Rapide IA":undefined}
          style={{width:"100%",background:`linear-gradient(135deg,${L.accent},${L.purple})`,border:"none",borderRadius:8,padding:withLabel?"8px 12px":"8px 0",cursor:"pointer",color:"#fff",fontSize:withLabel?12:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit",boxShadow:"0 2px 8px rgba(232,98,10,0.35)"}}>
          ⚡{withLabel&&" Devis Rapide IA"}
        </button>
      </div>
    );
  }

  if(compact){
    // Mobile : barre fine 52px icônes seuls + drawer overlay au tap hamburger
    return(
      <>
        <div style={{width:52,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0,overflowY:"auto",overflowX:"hidden"}}>
          <button onClick={()=>setDrawerOpen(true)} title="Menu" aria-label="Ouvrir le menu"
            style={{background:"rgba(255,255,255,0.06)",border:"none",borderBottom:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",color:"#fff",padding:"14px 0",fontSize:18,fontFamily:"inherit"}}>☰</button>
          <div style={{padding:"10px 0",textAlign:"center",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>C<span style={{color:L.accent}}>P</span></div>
          </div>
          {renderDevisRapideBtn(false)}
          <div style={{flex:1,padding:"5px 0"}}>{renderNav(false)}</div>
          <div style={{padding:"9px 6px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
            <button onClick={onSettings} title="Paramètres" aria-label="Paramètres"
              style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 0",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>⚙️</button>
          </div>
        </div>
        {drawerOpen&&(
          <div onClick={()=>setDrawerOpen(false)}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1100,display:"flex"}}>
            <div onClick={e=>e.stopPropagation()}
              style={{width:240,maxWidth:"85vw",height:"100vh",background:L.navy,display:"flex",flexDirection:"column",overflowY:"auto",overflowX:"hidden",boxShadow:"2px 0 14px rgba(0,0,0,0.4)"}}>
              <div style={{display:"flex",justifyContent:"flex-end",padding:"6px 8px"}}>
                <button onClick={()=>setDrawerOpen(false)} aria-label="Fermer le menu"
                  style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",padding:"4px 8px",fontFamily:"inherit"}}>✕</button>
              </div>
              {renderHeader()}
              {renderDevisRapideBtn(true)}
              <div style={{flex:1,padding:"5px 0"}}>{renderNav(true)}</div>
              <div style={{padding:"9px 11px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
                <button onClick={()=>{setDrawerOpen(false);onSettings&&onSettings();}}
                  style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 11px",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}>⚙️ Paramètres</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop
  return(
    <div style={{width:205,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0,overflowY:"auto",overflowX:"hidden"}}>
      {renderHeader()}
      {renderDevisRapideBtn(true)}
      <div style={{flex:1,padding:"5px 0"}}>{renderNav(true)}</div>
      <div style={{padding:"9px 11px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
        <button onClick={onSettings} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 11px",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}>⚙️ Paramètres</button>
      </div>
    </div>
  );
}


// ─── ACCUEIL ──────────────────────────────────────────────────────────────────
function Accueil({chantiers,docs,entreprise,statut,salaries,onNav,onSettings,onDevisRapide}){
  const s=STATUTS[statut];
  // Écran de bienvenue si aucun chantier ni devis : 4 actions rapides
  if((chantiers||[]).length===0&&(docs||[]).length===0){
    const actions=[
      {icon:"⚡",label:"Devis Rapide IA",sub:"Décrivez vos travaux, l'IA génère le devis structuré",color:L.purple,bg:"#F5F3FF",onClick:()=>onDevisRapide&&onDevisRapide()},
      {icon:"📄",label:"Créer mon premier devis",sub:"Modèle hiérarchisé titre/sous-titre/lignes",color:L.accent,bg:L.accentBg,onClick:()=>onNav("devis")},
      {icon:"🏗",label:"Ajouter un chantier",sub:"Suivre un chantier sans passer par un devis",color:L.navy,bg:L.navyBg,onClick:()=>onNav("chantiers")},
      {icon:"⚙️",label:"Configurer mon profil",sub:"Logo, SIRET, coordonnées entreprise",color:L.textSm,bg:L.bg,onClick:()=>onSettings&&onSettings()},
    ];
    return(
      <div style={{maxWidth:720,margin:"40px auto",padding:"0 16px"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,marginBottom:8}}>👋</div>
          <h1 style={{fontSize:24,fontWeight:800,color:L.text,margin:"0 0 6px",letterSpacing:-0.4}}>Bienvenue sur ChantierPro</h1>
          <p style={{fontSize:14,color:L.textSm,margin:0,lineHeight:1.5}}>
            {entreprise?.nom?`Bonjour ${entreprise.nom},`:"Bonjour,"} commencez par une de ces actions pour démarrer.
          </p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {actions.map(a=>(
            <button key={a.label} onClick={a.onClick}
              style={{textAlign:"left",background:L.surface,border:`1px solid ${L.border}`,borderRadius:14,padding:"18px 22px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,fontFamily:"inherit",transition:"border-color .15s, transform .12s, box-shadow .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.boxShadow=L.shadowMd;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=L.border;e.currentTarget.style.boxShadow=L.shadow;}}>
              <div style={{width:48,height:48,borderRadius:12,background:a.bg,color:a.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{a.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:L.text,marginBottom:3}}>{a.label}</div>
                <div style={{fontSize:12,color:L.textSm}}>{a.sub}</div>
              </div>
              <div style={{color:a.color,fontSize:18,fontWeight:700}}>→</div>
            </button>
          ))}
        </div>
        <div style={{marginTop:36,padding:"14px 18px",background:L.bg,border:`1px dashed ${L.borderMd}`,borderRadius:10,fontSize:12,color:L.textSm,textAlign:"center"}}>
          💡 Astuce : utilisez le bouton 🤖 IA dans chaque ligne de devis pour générer des estimations BTP réalistes (heures de MO, fournitures, prix de vente).
        </div>
      </div>
    );
  }
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
// Génère une couleur stable depuis l'id du salarié (HSL distribué)
function couleurSalarie(sal){
  if(sal?.couleur)return sal.couleur;
  const id=+sal?.id||0;
  return `hsl(${(id*137)%360},65%,52%)`;
}

function VueEquipe({salaries,setSalaries}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const EMPTY={nom:"",poste:"",qualification:"qualifie",tauxHoraire:"",chargesPatron:"0.42",disponible:true,competences:"",couleur:"#2563EB"};
  const [form,setForm]=useState(EMPTY);
  const QUALS=[{v:"chef",l:"Chef chantier",c:L.accent},{v:"qualifie",l:"Qualifié",c:L.blue},{v:"manoeuvre",l:"Manœuvre",c:L.green}];
  function save(){if(!form.nom||!form.tauxHoraire)return;const sal={...form,id:editId||Date.now(),tauxHoraire:parseFloat(form.tauxHoraire)||0,chargesPatron:parseFloat(form.chargesPatron)||0.42,competences:form.competences?form.competences.split(",").map(x=>x.trim()).filter(Boolean):[],couleur:form.couleur||"#2563EB"};if(editId)setSalaries(ss=>ss.map(s=>s.id===editId?sal:s));else setSalaries(ss=>[...ss,sal]);setForm(EMPTY);setEditId(null);setShowForm(false);}
  function edit(s){setForm({...s,tauxHoraire:String(s.tauxHoraire),chargesPatron:String(s.chargesPatron),competences:(s.competences||[]).join(", "),couleur:s.couleur||couleurSalarie(s)});setEditId(s.id);setShowForm(true);}
  function setCouleurInline(id,couleur){setSalaries(ss=>ss.map(s=>s.id===id?{...s,couleur}:s));}
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
            <div>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Couleur (Gantt)</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={form.couleur||"#2563EB"} onChange={e=>setForm(f=>({...f,couleur:e.target.value}))} style={{width:40,height:32,border:"none",background:"transparent",cursor:"pointer",padding:0}}/>
                <div style={{width:36,height:18,borderRadius:9,background:form.couleur||"#2563EB",border:`1px solid ${L.border}`}}/>
              </div>
            </div>
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
                  <div style={{width:38,height:38,borderRadius:"50%",background:q.c+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:q.c,fontWeight:800,border:`2px solid ${couleurSalarie(sal)}`}}>{sal.nom.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
                  <div><div style={{fontSize:13,fontWeight:700,color:L.text}}>{sal.nom}</div><div style={{fontSize:11,color:L.textSm}}>{sal.poste}</div></div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input type="color" title="Couleur Gantt" value={couleurSalarie(sal)} onChange={e=>setCouleurInline(sal.id,e.target.value)} style={{width:22,height:22,padding:0,border:"none",background:"transparent",cursor:"pointer"}}/>
                  <div style={{width:7,height:7,borderRadius:"50%",background:sal.disponible?L.green:L.textXs,marginTop:4}}/>
                </div>
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


// ─── PLANNING : VUE GANTT SVG ─────────────────────────────────────────────────
// Lignes = salariés (+ "Non assigné"). Barres = phases coloriées par ouvrier.
// Click sur une barre → editor inline date+durée. Tooltip au survol.
function GanttView({chantiers,setChantiers,salaries}){
  const [hover,setHover]=useState(null); // {phase, x, y, chantierNom}
  const [edit,setEdit]=useState(null); // {chId, p}

  const allPhases=chantiers.flatMap(c=>(c.planning||[]).map(p=>({...p,chantierId:c.id,chantierNom:c.nom||"Chantier"})));
  if(allPhases.length===0)return <div style={{padding:30,textAlign:"center",color:L.textXs,fontSize:13}}>Aucune phase planifiée. Créez un chantier ou des tâches.</div>;

  const datedPhases=allPhases.filter(p=>p.dateDebut);
  if(datedPhases.length===0)return <div style={{padding:30,textAlign:"center",color:L.textXs,fontSize:13}}>Aucune phase avec date.</div>;
  const minDate=new Date(Math.min(...datedPhases.map(p=>+new Date(p.dateDebut))));
  const maxDate=new Date(Math.max(...datedPhases.map(p=>{
    const d=new Date(p.dateDebut);d.setDate(d.getDate()+(p.dureeJours||1));return +d;
  })));
  minDate.setDate(minDate.getDate()-1);
  maxDate.setDate(maxDate.getDate()+1);
  const totalDays=Math.max(7,Math.ceil((+maxDate-+minDate)/86400000));

  const rows=[...salaries,{id:"_unassigned",nom:"Non assigné",poste:"",couleur:"#94A3B8"}];
  const phasesPerRow=new Map(rows.map(r=>[r.id,[]]));
  for(const p of allPhases){
    const ids=Array.isArray(p.salariesIds)?p.salariesIds.filter(id=>phasesPerRow.has(id)):[];
    if(ids.length===0)phasesPerRow.get("_unassigned").push(p);
    else for(const id of ids)phasesPerRow.get(id).push(p);
  }

  const colWidth=22;
  const labelWidth=120;
  const rowHeight=34;
  const headerHeight=44;
  const svgWidth=labelWidth+totalDays*colWidth;
  const svgHeight=headerHeight+rows.length*rowHeight;

  function dayOffset(d){return Math.round((+new Date(d)-+minDate)/86400000);}
  function updPhase(chId,phaseId,patch){
    setChantiers(cs=>cs.map(c=>c.id!==chId?c:{...c,planning:(c.planning||[]).map(p=>p.id===phaseId?{...p,...patch}:p)}));
    setEdit(prev=>prev&&prev.p.id===phaseId?{...prev,p:{...prev.p,...patch}}:prev);
  }

  return(
    <div style={{position:"relative"}}>
      <div style={{overflowX:"auto",border:`1px solid ${L.border}`,borderRadius:8,background:L.surface}}>
        <svg width={svgWidth} height={svgHeight} style={{display:"block",fontFamily:"inherit"}}>
          {/* Background grid (jours) */}
          <g transform={`translate(${labelWidth},0)`}>
            {Array.from({length:totalDays},(_,i)=>{
              const d=new Date(minDate);d.setDate(d.getDate()+i);
              const isWE=d.getDay()===0||d.getDay()===6;
              const isFirst=d.getDate()===1;
              return(
                <g key={i}>
                  <rect x={i*colWidth} y={0} width={colWidth} height={svgHeight} fill={isWE?"#F8FAFC":"#fff"} stroke="#E2E8F0" strokeWidth={0.5}/>
                  {isFirst&&<line x1={i*colWidth} y1={0} x2={i*colWidth} y2={svgHeight} stroke={L.navy} strokeWidth={1.2} opacity={0.4}/>}
                  {(i%7===0||isFirst)&&(
                    <text x={i*colWidth+colWidth/2} y={16} fontSize={9} textAnchor="middle" fill="#475569" fontWeight={isFirst?700:400}>
                      {d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Today marker */}
            {(()=>{const tod=dayOffset(new Date().toISOString().slice(0,10));if(tod<0||tod>totalDays)return null;return <line x1={tod*colWidth+colWidth/2} y1={headerHeight} x2={tod*colWidth+colWidth/2} y2={svgHeight} stroke={L.accent} strokeWidth={1.5} strokeDasharray="3,3"/>;})()}
          </g>

          {/* Lignes par ouvrier */}
          {rows.map((row,idx)=>{
            const y=headerHeight+idx*rowHeight;
            const color=couleurSalarie(row);
            return(
              <g key={row.id}>
                <rect x={0} y={y} width={labelWidth} height={rowHeight} fill={idx%2===0?L.bg:"#FFF"} stroke="#E2E8F0" strokeWidth={0.5}/>
                <rect x={4} y={y+8} width={4} height={rowHeight-16} fill={color} rx={2}/>
                <text x={14} y={y+rowHeight/2+4} fontSize={11} fontWeight={600} fill={row.id==="_unassigned"?"#94A3B8":"#1B3A5C"}>
                  {row.nom?row.nom.split(" ")[0]:row.id}
                </text>
                {row.poste&&<text x={14} y={y+rowHeight/2+15} fontSize={8} fill={L.textXs}>{row.poste.slice(0,16)}</text>}
                <line x1={0} y1={y+rowHeight} x2={svgWidth} y2={y+rowHeight} stroke="#E2E8F0" strokeWidth={0.5}/>
                {(phasesPerRow.get(row.id)||[]).map(p=>{
                  const startOff=dayOffset(p.dateDebut);
                  const dur=p.dureeJours||1;
                  const x=labelWidth+startOff*colWidth+1;
                  const w=Math.max(8,dur*colWidth-2);
                  return(
                    <g key={`${p.id}-${row.id}`}
                      onMouseEnter={e=>setHover({phase:p,x:x,y:y,chantierNom:p.chantierNom})}
                      onMouseLeave={()=>setHover(null)}
                      onClick={()=>setEdit({chId:p.chantierId,p})}
                      style={{cursor:"pointer"}}>
                      <rect x={x} y={y+5} width={w} height={rowHeight-10}
                        fill={color} fillOpacity={row.id==="_unassigned"?0.4:0.85}
                        stroke={color} strokeWidth={1} rx={4}/>
                      {w>50&&(
                        <text x={x+6} y={y+rowHeight/2+4} fontSize={10} fill="#fff" fontWeight={600} style={{pointerEvents:"none"}}>
                          {(p.tache||"").slice(0,Math.floor(w/6))}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {hover&&(
        <div style={{position:"absolute",top:hover.y+headerHeight+10,left:Math.min(hover.x+labelWidth+8,svgWidth-220),background:L.navy,color:"#fff",padding:"8px 11px",borderRadius:7,fontSize:11,pointerEvents:"none",zIndex:10,boxShadow:L.shadowMd,maxWidth:240}}>
          <div style={{fontWeight:700,marginBottom:3}}>{hover.phase.tache}</div>
          <div style={{opacity:0.85,fontSize:10}}>{hover.chantierNom}</div>
          <div style={{opacity:0.85,fontSize:10,marginTop:3}}>{hover.phase.dateDebut} · {hover.phase.dureeJours}j</div>
          {hover.phase.heuresPrevues>0&&<div style={{opacity:0.85,fontSize:10}}>{hover.phase.heuresPrevues}h estimées</div>}
          {hover.phase.budgetHT>0&&<div style={{opacity:0.85,fontSize:10}}>Budget : {euro(hover.phase.budgetHT)}</div>}
        </div>
      )}

      {edit&&(
        <div onClick={()=>setEdit(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:L.surface,borderRadius:12,padding:18,width:"94%",maxWidth:340,boxShadow:L.shadowLg}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{edit.p.tache}</div>
            <div style={{fontSize:11,color:L.textSm,marginBottom:12}}>{chantiers.find(c=>c.id===edit.chId)?.nom}</div>
            <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:12}}>
              <label style={{fontSize:11,color:L.textMd,fontWeight:600}}>Date début
                <input type="date" value={edit.p.dateDebut||""} onChange={e=>updPhase(edit.chId,edit.p.id,{dateDebut:e.target.value})} style={{width:"100%",padding:"6px 9px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,marginTop:3,fontFamily:"inherit"}}/>
              </label>
              <label style={{fontSize:11,color:L.textMd,fontWeight:600}}>Durée (jours)
                <input type="number" min={1} value={edit.p.dureeJours||1} onChange={e=>updPhase(edit.chId,edit.p.id,{dureeJours:parseInt(e.target.value)||1})} style={{width:"100%",padding:"6px 9px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,marginTop:3,fontFamily:"inherit"}}/>
              </label>
            </div>
            <Btn onClick={()=>setEdit(null)} variant="primary" fullWidth>✓ Fermer</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PLANNING ─────────────────────────────────────────────────────────────────
function VuePlanning({chantiers,setChantiers,salaries}){
  const [selId,setSelId]=useState(chantiers[0]?.id||null);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [vue,setVue]=useState("liste"); // "liste" | "gantt"
  const EMPTY={tache:"",dateDebut:new Date().toISOString().slice(0,10),dureeJours:1,salariesIds:[],posteId:null};
  const [form,setForm]=useState(EMPTY);
  const ch=chantiers.find(c=>c.id===selId);
  function updCh(p){setChantiers(cs=>cs.map(c=>c.id===selId?{...c,...p}:c));}
  function save(){if(!form.tache||!ch)return;const t={...form,id:editId||Date.now(),dureeJours:parseInt(form.dureeJours)||1};const pl=editId?ch.planning.map(p=>p.id===editId?t:p):[...(ch.planning||[]),t];updCh({planning:pl});setForm(EMPTY);setEditId(null);setShowForm(false);}
  function del(id){if(!ch)return;updCh({planning:ch.planning.filter(t=>t.id!==id)});}
  function togSal(sid){setForm(f=>{const has=f.salariesIds.includes(sid);return{...f,salariesIds:has?f.salariesIds.filter(s=>s!==sid):[...f.salariesIds,sid]};});}
  const totalMO=(ch?.planning||[]).reduce((a,t)=>a+coutTache(t,salaries),0);
  const totalH=(ch?.planning||[]).reduce((a,t)=>a+t.dureeJours*8*(t.salariesIds||[]).length,0);
  return(
    <div>
      <PageH title="Planning" subtitle="Organisez les tâches et affectez votre équipe"
        actions={
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"inline-flex",border:`1px solid ${L.border}`,borderRadius:8,overflow:"hidden"}}>
              {[{id:"liste",label:"📋 Liste"},{id:"gantt",label:"📊 Gantt"}].map(v=>(
                <button key={v.id} onClick={()=>setVue(v.id)}
                  style={{padding:"6px 12px",border:"none",background:vue===v.id?L.navy:L.surface,color:vue===v.id?"#fff":L.textMd,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  {v.label}
                </button>
              ))}
            </div>
            {vue==="liste"&&<Btn onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} variant="primary" icon="+">Nouvelle tâche</Btn>}
          </div>
        }/>
      {vue==="gantt"
        ?<GanttView chantiers={chantiers} setChantiers={setChantiers} salaries={salaries}/>
        :!ch?<div style={{padding:30,textAlign:"center",color:L.textSm,fontSize:13}}>Sélectionnez un chantier (ou passez à la vue Gantt pour voir tous les chantiers)</div>
        :<>
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
                  <div key={t.id} style={{display:"grid",gridTemplateColumns:"160px 1fr 110px 70px",gap:12,padding:"12px 16px",borderBottom:i<ch.planning.length-1?`1px solid ${L.border}`:"none",alignItems:"start"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      <input type="date" value={t.dateDebut||""} onChange={e=>updCh({planning:ch.planning.map(p=>p.id===t.id?{...p,dateDebut:e.target.value}:p)})} style={{padding:"4px 6px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:11,outline:"none",fontFamily:"inherit",background:L.surface,color:L.text}}/>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <input type="number" min={1} value={t.dureeJours||1} onChange={e=>updCh({planning:ch.planning.map(p=>p.id===t.id?{...p,dureeJours:parseInt(e.target.value)||1}:p)})} style={{width:48,padding:"4px 5px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:11,textAlign:"center",outline:"none",fontFamily:"inherit",background:L.surface}}/>
                        <span style={{fontSize:10,color:L.textSm,fontWeight:600}}>jours</span>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:L.text,marginBottom:4}}>{t.tache}</div>
                      {poste&&<div style={{fontSize:10,color:L.textXs,marginBottom:4}}>📋 {poste.libelle.slice(0,50)}</div>}
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4,fontSize:10,color:L.textSm}}>
                        {t.heuresPrevues>0&&<span title="Heures estimées depuis le devis"><strong style={{color:L.blue}}>{t.heuresPrevues}h</strong> estimées</span>}
                        {t.nbOuvriers>0&&<span>· <strong style={{color:L.navy}}>{t.nbOuvriers} ouvrier{t.nbOuvriers>1?"s":""}</strong></span>}
                        {t.budgetHT>0&&<span>· budget <strong style={{color:L.navy,fontFamily:"monospace"}}>{euro(t.budgetHT)}</strong></span>}
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{tSals.map(s=><span key={s.id} style={{background:L.blueBg,color:L.blue,borderRadius:8,padding:"1px 7px",fontSize:10,fontWeight:600}}>{s.nom.split(" ")[0]}</span>)}{tSals.length===0&&<span style={{fontSize:10,color:L.textXs}}>Aucun ouvrier affecté</span>}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      {cout>0&&<div style={{fontSize:12,fontWeight:700,color:L.orange}}>{euro(cout)}</div>}
                      <div style={{fontSize:10,color:L.textXs}}>capacité {t.dureeJours*8*(t.salariesIds||[]).length}h</div>
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
        </>
      }
    </div>
  );
}


// ─── VUE CHANTIERS ────────────────────────────────────────────────────────────
function VueChantiers({chantiers,setChantiers,selected,setSelected,salaries,statut,entreprise}){
  const [tab,setTab]=useState("detail");
  const [showNew,setShowNew]=useState(false);
  const vp=useViewportSize();
  const compact=vp.w<768;
  const [nf,setNf]=useState({nom:"",client:"",adresse:"",statut:"planifié",devisHT:"",tva:"20",notes:""});
  const [bilanCh,setBilanCh]=useState(null);
  const s=STATUTS[statut];
  const ch=chantiers.find(c=>c.id===selected);
  function creer(){if(!nf.nom||!nf.client)return;const n={id:Date.now(),postes:[],planning:[],depensesReelles:[],checklist:{},photos:[],facturesFournisseurs:[],acompteEncaisse:0,soldeEncaisse:0,...nf,devisHT:parseFloat(nf.devisHT)||0,devisTTC:(parseFloat(nf.devisHT)||0)*1.2};setChantiers(cs=>[...cs,n]);setSelected(n.id);setShowNew(false);}
  const TABS_S=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"renta",label:"Rentabilité",icon:"📊"},{id:"suivi",label:"Suivi",icon:"✅"}];
  const TABS_A=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"renta",label:"Rentabilité",icon:"📊"},{id:"planning",label:"Planning",icon:"📅"},{id:"fourn",label:"Fournitures",icon:"🔧"},{id:"suivi",label:"Suivi",icon:"✅"},{id:"bilan",label:"Bilan",icon:"💹"}];
  const tabs=s?.mode==="simple"?TABS_S:TABS_A;
  return(
    <div style={{display:"flex",height:"100%",minHeight:0}}>
      <div style={{width:compact?160:225,borderRight:`1px solid ${L.border}`,flexShrink:0,overflowY:"auto",overflowX:"hidden",background:L.bg}}>
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
              <Btn onClick={()=>setBilanCh(ch)} variant="secondary" size="sm" icon="📊">Bilan PDF</Btn>
              <StatutSelect value={ch.statut} options={STATUTS_CHANTIER} onChange={s2=>setChantiers(cs=>cs.map(c=>c.id===ch.id?{...c,statut:s2}:c))}/>
            </div>
          </div>
          <Tabs tabs={tabs} active={tab} onChange={setTab}/>
          {tab==="detail"&&<ChantierDetail ch={ch} salaries={salaries} statut={statut}/>}
          {tab==="renta"&&<ChantierRenta ch={ch} salaries={salaries} statut={statut}/>}
          {tab==="planning"&&<ChantierPlanningTab ch={ch} salaries={salaries} setChantiers={setChantiers}/>}
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
      {bilanCh&&<Modal title={`Bilan — ${bilanCh.nom}`} onClose={()=>setBilanCh(null)} maxWidth={900}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setBilanCh(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <FeuilleBilan chantier={bilanCh} entreprise={entreprise}/>
        </div>
      </Modal>}
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

function ChantierPlanningTab({ch,salaries,setChantiers}){
  const totalMO=(ch.planning||[]).reduce((a,t)=>a+coutTache(t,salaries),0);
  function updPhase(phaseId,patch){
    if(!setChantiers)return;
    setChantiers(cs=>cs.map(c=>c.id!==ch.id?c:{...c,planning:(c.planning||[]).map(p=>p.id===phaseId?{...p,...patch}:p)}));
  }
  const inp={padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:11,outline:"none",fontFamily:"inherit",background:L.surface,color:L.text};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
        <KPI label="Tâches" value={ch.planning?.length||0} color={L.navy}/>
        <KPI label="Heures" value={`${(ch.planning||[]).reduce((a,t)=>a+t.dureeJours*8*(t.salariesIds||[]).length,0)}h`} color={L.blue}/>
        <KPI label="Coût MO" value={euro(totalMO)} color={L.orange}/>
      </div>
      <Card style={{overflow:"hidden"}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text}}>Planning chantier <span style={{fontSize:10,fontWeight:500,color:L.textSm,marginLeft:6}}>· dates et durées éditables</span></div>
        {(ch.planning||[]).length===0?<div style={{padding:18,textAlign:"center",color:L.textXs,fontSize:12}}>Aucune phase. Convertis un devis accepté en chantier ou utilise l'onglet "Planning".</div>:(
          (ch.planning||[]).map((t,i)=>{
            const tSals=salaries.filter(s=>(t.salariesIds||[]).includes(s.id));
            return <div key={t.id} style={{display:"grid",gridTemplateColumns:"170px 1fr 100px",gap:10,padding:"10px 14px",borderBottom:i<ch.planning.length-1?`1px solid ${L.border}`:"none",alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <input type="date" value={t.dateDebut||""} onChange={e=>updPhase(t.id,{dateDebut:e.target.value})} style={{...inp,width:"100%"}}/>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <input type="number" min={1} value={t.dureeJours||0} onChange={e=>updPhase(t.id,{dureeJours:parseInt(e.target.value)||1})} style={{...inp,width:50,textAlign:"center"}}/>
                  <span style={{fontSize:10,color:L.textSm,fontWeight:600}}>jours</span>
                </div>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:L.text,marginBottom:3}}>{t.tache}</div>
                {t.budgetHT>0&&<div style={{fontSize:10,color:L.textSm,marginBottom:3}}>Budget : <span style={{color:L.navy,fontWeight:700,fontFamily:"monospace"}}>{euro(t.budgetHT)}</span></div>}
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{tSals.length>0?tSals.map(s=><span key={s.id} style={{background:L.blueBg,color:L.blue,borderRadius:7,padding:"1px 6px",fontSize:10,fontWeight:600}}>{s.nom.split(" ")[0]}</span>):<span style={{fontSize:10,color:L.textXs,fontStyle:"italic"}}>aucun ouvrier affecté</span>}</div>
              </div>
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
// Liste devis vide : nouvel utilisateur démarre sans données démo.
const DOCS_INIT = [];

function VueDevis({chantiers,salaries,statut,entreprise,docs,setDocs,onConvertirChantier,onSaveOuvrage,pendingEditDocId,onPendingEditHandled}){
  const [apercu,setApercu]=useState(null);
  const [devisDetail,setDevisDetail]=useState(null);
  const [showCreer,setShowCreer]=useState(false);
  const [editDoc,setEditDoc]=useState(null); // doc en cours d'édition (null = création)
  const [emailDoc,setEmailDoc]=useState(null);
  const [feuilleDoc,setFeuilleDoc]=useState(null);
  // Quand App nous signale un doc à ouvrir en édition (ex: après "Devis Rapide IA")
  useEffect(()=>{
    if(!pendingEditDocId)return;
    const doc=docs.find(d=>d.id===pendingEditDocId);
    if(doc){setEditDoc(doc);onPendingEditHandled?.();}
  },[pendingEditDocId,docs,onPendingEditHandled]);
  // Garde-fou fermeture CreateurDevis : on demande confirmation si données non sauvegardées
  const creerDirtyRef=useRef(false);
  const handleCreerDirty=useRef(v=>{creerDirtyRef.current=!!v;}).current;
  const closeCreer=useRef(()=>{
    if(creerDirtyRef.current&&!window.confirm("Vous avez des données non sauvegardées dans ce devis. Fermer sans enregistrer ?"))return;
    creerDirtyRef.current=false;
    setShowCreer(false);
    setEditDoc(null);
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
                    <button onClick={()=>setEditDoc(doc)} title="Modifier le devis" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
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
      {editDoc&&<Modal title={`Modifier ${editDoc.numero}`} onClose={closeCreer} maxWidth={960} closeOnOverlay={false}><CreateurDevis chantiers={chantiers} salaries={salaries} statut={statut} docs={docs} initialDoc={editDoc} onSave={doc=>{creerDirtyRef.current=false;setDocs(ds=>ds.map(d=>d.id===editDoc.id?{...editDoc,...doc,id:editDoc.id}:d));setEditDoc(null);}} onClose={closeCreer} onDirtyChange={handleCreerDirty} onSaveOuvrage={onSaveOuvrage}/></Modal>}
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

function CreateurDevis({chantiers,salaries,statut,docs,onSave,onClose,onDirtyChange,onSaveOuvrage,initialDoc}){
  const [form,setForm]=useState(()=>{
    const base={type:"devis",numero:`DEV-${Date.now().toString().slice(-5)}`,date:new Date().toISOString().slice(0,10),client:"",titreChantier:"",emailClient:"",telClient:"",adresseClient:"",statut:"brouillon",chantierId:null,conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:0,
      lignes:[{id:1,libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10}]};
    if(!initialDoc)return base;
    return{...base,...initialDoc,lignes:Array.isArray(initialDoc.lignes)&&initialDoc.lignes.length>0?initialDoc.lignes.map(l=>({...l})):base.lignes};
  });
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
  // Insère un nouvel item (ligne / titre / soustitre) à la position `index`
  function insertItemAt(index,type){
    setForm(f=>{
      const id=Date.now()+Math.floor(Math.random()*1000);
      let item;
      if(type==="titre")item={id,type:"titre",libelle:"NOUVEAU TITRE"};
      else if(type==="soustitre")item={id,type:"soustitre",libelle:"Nouveau sous-titre"};
      else item={id,type:"ligne",libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10};
      const lignes=[...f.lignes];
      lignes.splice(Math.max(0,Math.min(index,lignes.length)),0,item);
      return{...f,lignes};
    });
  }
  // Déplace un item d'un cran (delta -1 = vers le haut, +1 = vers le bas)
  function moveItem(index,delta){
    setForm(f=>{
      const newIdx=index+delta;
      if(newIdx<0||newIdx>=f.lignes.length)return f;
      const lignes=[...f.lignes];
      [lignes[index],lignes[newIdx]]=[lignes[newIdx],lignes[index]];
      return{...f,lignes};
    });
  }
  // Drag & drop reorder
  const [dragIdx,setDragIdx]=useState(null);
  function onDragStartItem(i){setDragIdx(i);}
  function onDragEndItem(){setDragIdx(null);}
  function onDragOverItem(e){e.preventDefault();e.dataTransfer.dropEffect="move";}
  function onDropItem(targetIdx){
    if(dragIdx===null||dragIdx===targetIdx){setDragIdx(null);return;}
    setForm(f=>{
      const lignes=[...f.lignes];
      const [moved]=lignes.splice(dragIdx,1);
      lignes.splice(targetIdx,0,moved);
      return{...f,lignes};
    });
    setDragIdx(null);
  }
  function togCalc(id){setShowCalc(s=>({...s,[id]:!s[id]}));}

  // Ajout d'un ouvrage depuis la bibliothèque → crée une ligne pré-remplie
  // avec prix fourni-posé moyen + champs MO/fournitures si l'ouvrage en a
  // (cas "Mes ouvrages" sauvegardés depuis l'IA).
  function addFromBiblio(o){
    const prix=(o.moMoy||0)+(o.fournMoy||0);
    // Convertir unité biblio → unité V13 (M2, ML, U, etc.)
    const uMap={"m²":"M2","ml":"ML","m³":"M3","U":"U","kg":"KG","L":"L"};
    const unite=uMap[o.unite]||(o.unite||"U").toUpperCase();
    // Heures de MO par unité : prend tempsMO en priorité, fallback heuresPrevues
    const heuresPrevues=+o.heuresPrevues||+o.tempsMO||0;
    // Fournitures complètes (avec fournisseur + prixVente) si dispo, sinon
    // on convertit composants (per-unit, sans prix de vente)
    const fournitures=Array.isArray(o.fournitures)&&o.fournitures.length>0
      ? o.fournitures.map(f=>({
          fournisseur:f.fournisseur||"Point P",
          designation:f.designation||"",
          qte:+f.qte||1,
          unite:f.unite||"U",
          prixAchat:+f.prixAchat||0,
          prixVente:+f.prixVente||+((+f.prixAchat||0)*1.3).toFixed(2),
        }))
      : Array.isArray(o.composants)&&o.composants.length>0
        ? o.composants.map(c=>({
            fournisseur:c.fournisseur||"Point P",
            designation:c.designation||"",
            qte:+c.qte||1,
            unite:c.unite||"U",
            prixAchat:+c.prixAchat||0,
            prixVente:+c.prixVente||+((+c.prixAchat||0)*1.3).toFixed(2),
          }))
        : [];
    setForm(f=>{
      // Si la dernière ligne est vide, on la remplace, sinon on ajoute
      const last=f.lignes[f.lignes.length-1];
      const emptyLast=last&&!last.libelle&&last.prixUnitHT===0;
      const newLigne={
        id:Date.now(),type:"ligne",
        libelle:o.libelle,
        qte:1,unite,
        prixUnitHT:prix,tva:10,
        heuresPrevues,
        fournitures,
        ...(o.nbOuvriers&&{nbOuvriers:+o.nbOuvriers}),
        ...(o.tauxHoraireMoyen&&{tauxHoraireMoyen:+o.tauxHoraireMoyen}),
        salariesAssignes:Array.isArray(o.salariesAssignes)?[...o.salariesAssignes]:[],
        _biblio:o.code,
      };
      const lignes=emptyLast?[...f.lignes.slice(0,-1),newLigne]:[...f.lignes,newLigne];
      return{...f,lignes};
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
              {["","Désignation","Qté","U","P.U. HT","TVA","Total HT","🤖 IA","📊",""].map((h,i)=><th key={i} style={{textAlign:"left",padding:"7px 9px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {/* Helper: barre d'insertion entre items + au début + à la fin */}
              {form.lignes.map((l,i)=>{
                const isHeader=l.type==="titre"||l.type==="soustitre";
                const isDragging=dragIdx===i;
                // Cellule handle/move : drag + flèches haut/bas
                const handleCell=(
                  <td style={{padding:"4px 4px",width:30,verticalAlign:"middle",textAlign:"center",cursor:"grab",color:l.type==="titre"?"#fff":L.textXs,opacity:isDragging?0.4:1}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,lineHeight:1}}>
                      <button onClick={()=>moveItem(i,-1)} disabled={i===0} title="Monter" style={{background:"none",border:"none",cursor:i===0?"not-allowed":"pointer",color:"inherit",opacity:i===0?0.3:0.7,padding:"0 2px",fontSize:10,fontFamily:"inherit"}}>▲</button>
                      <span title="Glisser pour déplacer" style={{cursor:"grab",fontSize:11,opacity:0.6,userSelect:"none"}}>⋮⋮</span>
                      <button onClick={()=>moveItem(i,1)} disabled={i===form.lignes.length-1} title="Descendre" style={{background:"none",border:"none",cursor:i===form.lignes.length-1?"not-allowed":"pointer",color:"inherit",opacity:i===form.lignes.length-1?0.3:0.7,padding:"0 2px",fontSize:10,fontFamily:"inherit"}}>▼</button>
                    </div>
                  </td>
                );
                const dragProps={
                  draggable:true,
                  onDragStart:()=>onDragStartItem(i),
                  onDragOver:onDragOverItem,
                  onDrop:()=>onDropItem(i),
                  onDragEnd:onDragEndItem,
                };
                const insertBar=(
                  <tr key={`ins-${l.id}`} style={{height:6}}>
                    <td colSpan={10} style={{padding:0,position:"relative",height:6}}>
                      <div className="cp-insert-bar" style={{display:"flex",justifyContent:"center",alignItems:"center",gap:5,height:6,opacity:0,transition:"opacity .12s, height .12s"}}
                        onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.height="22px";}}
                        onMouseLeave={e=>{e.currentTarget.style.opacity="0";e.currentTarget.style.height="6px";}}>
                        <button onClick={()=>insertItemAt(i,"ligne")} title="Insérer une ligne ici" style={{background:L.surface,border:`1px solid ${L.accent}`,color:L.accent,borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Ligne</button>
                        <button onClick={()=>insertItemAt(i,"soustitre")} title="Insérer un sous-titre" style={{background:L.surface,border:`1px solid ${L.borderMd}`,color:L.navy,borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Sous-titre</button>
                        <button onClick={()=>insertItemAt(i,"titre")} title="Insérer un titre" style={{background:L.surface,border:`1px solid ${L.navy}`,color:L.navy,borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Titre</button>
                      </div>
                    </td>
                  </tr>
                );
                if(l.type==="titre"){
                  const sub=titreSubs.get(l.id)||0;
                  return(
                    <React.Fragment key={l.id}>
                      {insertBar}
                      <tr {...dragProps} style={{background:L.navy,opacity:isDragging?0.5:1}}>
                        {handleCell}
                        <td colSpan={6} style={{padding:"9px 10px"}}>
                          <input value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="TITRE DE SECTION" style={{width:"100%",padding:"6px 10px",border:"none",background:"transparent",color:"#fff",fontSize:13,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase",outline:"none",fontFamily:"inherit"}}/>
                        </td>
                        <td colSpan={2} style={{padding:"9px 9px",fontSize:13,fontWeight:800,color:"#fff",fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{euro(sub)}</td>
                        <td style={{padding:"9px 5px"}}><button onClick={()=>delItem(l.id)} title="Supprimer le titre" style={{background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:14,opacity:0.85}}>×</button></td>
                      </tr>
                    </React.Fragment>
                  );
                }
                if(l.type==="soustitre"){
                  const sub=sousTitreSubs.get(l.id)||0;
                  return(
                    <React.Fragment key={l.id}>
                      {insertBar}
                      <tr {...dragProps} style={{background:L.navyBg,borderBottom:`1px solid ${L.border}`,opacity:isDragging?0.5:1}}>
                        {handleCell}
                        <td colSpan={6} style={{padding:"7px 10px 7px 14px"}}>
                          <input value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="Sous-titre" style={{width:"100%",padding:"5px 8px",border:`1px dashed ${L.borderMd}`,background:"transparent",color:L.navy,fontSize:12,fontWeight:700,outline:"none",fontFamily:"inherit"}}/>
                        </td>
                        <td colSpan={2} style={{padding:"7px 9px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>{euro(sub)}</td>
                        <td style={{padding:"7px 5px"}}><button onClick={()=>delItem(l.id)} title="Supprimer le sous-titre" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button></td>
                      </tr>
                    </React.Fragment>
                  );
                }
                const calc=calcLigneDevis(l,statut);
                const show=showCalc[l.id];
                const mc2=calc&&calc.tauxMarge>=20?L.green:calc&&calc.tauxMarge>=10?L.orange:L.red;
                return(
                  <React.Fragment key={l.id}>
                    {insertBar}
                    <tr {...dragProps} style={{borderBottom:show?`none`:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg,verticalAlign:"top",opacity:isDragging?0.5:1}}>
                      {handleCell}
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
                        <td colSpan={10} style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`}}>
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
              {/* Barre d'insertion finale (après la dernière ligne) */}
              <tr style={{height:6}}>
                <td colSpan={10} style={{padding:0,position:"relative",height:6}}>
                  <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:5,height:6,opacity:0,transition:"opacity .12s, height .12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.height="22px";}}
                    onMouseLeave={e=>{e.currentTarget.style.opacity="0";e.currentTarget.style.height="6px";}}>
                    <button onClick={()=>insertItemAt(form.lignes.length,"ligne")} style={{background:L.surface,border:`1px solid ${L.accent}`,color:L.accent,borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Ligne</button>
                    <button onClick={()=>insertItemAt(form.lignes.length,"soustitre")} style={{background:L.surface,border:`1px solid ${L.borderMd}`,color:L.navy,borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Sous-titre</button>
                    <button onClick={()=>insertItemAt(form.lignes.length,"titre")} style={{background:L.surface,border:`1px solid ${L.navy}`,color:L.navy,borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Titre</button>
                  </div>
                </td>
              </tr>
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

// ─── FEUILLE BILAN CHANTIER (budget vs réel) ─────────────────────────────────
// Tableau récap par lot/phase : budget prévu vs dépenses réelles, écart et %.
// Les dépenses sans `lot` sont regroupées en "Dépenses non affectées".
function FeuilleBilan({chantier,entreprise}){
  const ch=chantier||{};
  const postes=ch.postes||[];
  const planning=ch.planning||[];
  const depenses=ch.depensesReelles||[];

  // Budget par lot = somme des montantHT des postes regroupés par lot
  const budgetParLot=new Map();
  for(const p of postes){
    const k=p.lot||"Lot principal";
    budgetParLot.set(k,(budgetParLot.get(k)||0)+(+p.montantHT||0));
  }
  // Si pas de postes, fallback sur le planning (1 phase = 1 ligne avec budgetHT)
  if(budgetParLot.size===0&&planning.length>0){
    for(const t of planning){
      const k=t.tache||`Phase ${t.id}`;
      budgetParLot.set(k,(budgetParLot.get(k)||0)+(+t.budgetHT||0));
    }
  }

  // Dépenses réelles par lot via `depense.lot`. Sinon, "Non affectées"
  const reelParLot=new Map();
  let reelNonAffecte=0;
  const depensesNonAffectees=[];
  for(const d of depenses){
    const m=+d.montant||0;
    if(d.lot&&budgetParLot.has(d.lot)){
      reelParLot.set(d.lot,(reelParLot.get(d.lot)||0)+m);
    } else {
      reelNonAffecte+=m;
      depensesNonAffectees.push(d);
    }
  }

  const lots=Array.from(budgetParLot.keys());
  const totalBudget=Array.from(budgetParLot.values()).reduce((a,b)=>a+b,0);
  const totalReel=depenses.reduce((a,d)=>a+(+d.montant||0),0);
  const ecartGlobal=totalBudget-totalReel;
  const pctGlobal=totalBudget>0?Math.round((totalReel/totalBudget)*100):0;
  const colorEcart=ecartGlobal>=0?"#16A34A":"#DC2626";

  function fmtPct(p){return `${p}%`;}
  function rowColor(p){return p<=80?"#16A34A":p<=100?"#D97706":"#DC2626";}

  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",color:"#1E293B",fontSize:12}}>
      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:"2px solid #1B3A5C",gap:16}}>
        <div style={{flex:"0 0 auto",minWidth:120,display:"flex",alignItems:"center"}}>
          {entreprise?.logo
            ? <img src={entreprise.logo} alt={entreprise.nom||"logo"} style={{maxHeight:60,maxWidth:180,objectFit:"contain"}}/>
            : <div style={{fontSize:16,fontWeight:900,color:"#1B3A5C"}}>{entreprise?.nomCourt||entreprise?.nom||""}</div>}
        </div>
        <div style={{textAlign:"right",fontSize:10,color:"#64748B",lineHeight:1.6}}>
          <div style={{fontSize:12,fontWeight:800,color:"#1B3A5C"}}>{entreprise?.nom||""}</div>
          {entreprise?.adresse&&<>{entreprise.adresse}<br/></>}
          {entreprise?.siret&&<>SIRET : {entreprise.siret}</>}
        </div>
      </div>
      {/* Bandeau titre + chantier */}
      <div style={{background:"#1B3A5C",color:"#fff",padding:"10px 14px",borderRadius:6,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:16,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>📊 Bilan chantier</div>
        <div style={{fontSize:11,fontWeight:600,opacity:0.9}}>{ch.nom||"—"} · {new Date().toLocaleDateString("fr-FR")}</div>
      </div>
      <div style={{background:"#F8FAFC",borderRadius:7,padding:"10px 12px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
        <div><span style={{color:"#64748B",fontWeight:600}}>Client : </span><span style={{fontWeight:700}}>{ch.client||"—"}</span></div>
        <div><span style={{color:"#64748B",fontWeight:600}}>Statut : </span><span style={{fontWeight:700}}>{ch.statut||"—"}</span></div>
        <div style={{gridColumn:"span 2"}}><span style={{color:"#64748B",fontWeight:600}}>Adresse : </span>{ch.adresse||"—"}</div>
        <div><span style={{color:"#64748B",fontWeight:600}}>Date début : </span>{ch.dateDebut||"—"}</div>
        <div><span style={{color:"#64748B",fontWeight:600}}>Date fin : </span>{ch.dateFin||"—"}</div>
      </div>

      {/* KPIs globaux */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Budget total HT",v:fmt2(totalBudget)+" €",c:"#1B3A5C"},
          {l:"Dépenses réelles",v:fmt2(totalReel)+" €",c:"#D97706"},
          {l:"Écart",v:fmt2(ecartGlobal)+" €",c:colorEcart},
          {l:"% consommé",v:fmtPct(pctGlobal),c:rowColor(pctGlobal)},
        ].map(k=>(
          <div key={k.l} style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:7,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",fontWeight:600,letterSpacing:0.5}}>{k.l}</div>
            <div style={{fontSize:14,fontWeight:800,color:k.c,fontFamily:"monospace",marginTop:3}}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tableau par lot */}
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:14}}>
        <thead>
          <tr style={{background:"#1B3A5C",color:"#fff"}}>
            {["Phase / Lot","Budget HT","Dépensé","Écart","% conso."].map(h=>
              <th key={h} style={{padding:"7px 9px",fontSize:10,textAlign:h==="Phase / Lot"?"left":"right",fontWeight:700,textTransform:"uppercase"}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {lots.length===0&&(
            <tr><td colSpan={5} style={{padding:"24px 12px",textAlign:"center",color:"#94A3B8",fontSize:12}}>Aucun lot ni planning sur ce chantier</td></tr>
          )}
          {lots.map((lot,i)=>{
            const budget=budgetParLot.get(lot)||0;
            const reel=reelParLot.get(lot)||0;
            const ecart=budget-reel;
            const pct=budget>0?Math.round((reel/budget)*100):0;
            return(
              <tr key={lot} style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"#fff":"#F8FAFC"}}>
                <td style={{padding:"7px 9px",fontSize:11,fontWeight:600}}>{lot}</td>
                <td style={{padding:"7px 9px",fontSize:11,fontFamily:"monospace",textAlign:"right",color:"#1B3A5C"}}>{fmt2(budget)} €</td>
                <td style={{padding:"7px 9px",fontSize:11,fontFamily:"monospace",textAlign:"right",color:"#D97706"}}>{fmt2(reel)} €</td>
                <td style={{padding:"7px 9px",fontSize:11,fontFamily:"monospace",textAlign:"right",color:ecart>=0?"#16A34A":"#DC2626",fontWeight:700}}>{fmt2(ecart)} €</td>
                <td style={{padding:"7px 9px",fontSize:11,fontFamily:"monospace",textAlign:"right",color:rowColor(pct),fontWeight:700}}>{fmtPct(pct)}</td>
              </tr>
            );
          })}
          {reelNonAffecte>0&&(
            <tr style={{borderBottom:"1px solid #E2E8F0",background:"#FFFBEB"}}>
              <td style={{padding:"7px 9px",fontSize:11,fontStyle:"italic",color:"#92400E"}}>Dépenses non affectées à un lot</td>
              <td style={{padding:"7px 9px",fontSize:11,textAlign:"right",color:"#94A3B8"}}>—</td>
              <td style={{padding:"7px 9px",fontSize:11,fontFamily:"monospace",textAlign:"right",color:"#D97706"}}>{fmt2(reelNonAffecte)} €</td>
              <td style={{padding:"7px 9px",fontSize:11,textAlign:"right",color:"#94A3B8"}}>—</td>
              <td style={{padding:"7px 9px",fontSize:11,textAlign:"right",color:"#94A3B8"}}>—</td>
            </tr>
          )}
          <tr style={{background:"#1B3A5C",color:"#fff",fontWeight:800}}>
            <td style={{padding:"9px 9px",fontSize:11,textTransform:"uppercase",letterSpacing:0.5}}>TOTAL CHANTIER</td>
            <td style={{padding:"9px 9px",fontSize:12,fontFamily:"monospace",textAlign:"right"}}>{fmt2(totalBudget)} €</td>
            <td style={{padding:"9px 9px",fontSize:12,fontFamily:"monospace",textAlign:"right"}}>{fmt2(totalReel)} €</td>
            <td style={{padding:"9px 9px",fontSize:12,fontFamily:"monospace",textAlign:"right"}}>{fmt2(ecartGlobal)} €</td>
            <td style={{padding:"9px 9px",fontSize:12,fontFamily:"monospace",textAlign:"right"}}>{fmtPct(pctGlobal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Détail dépenses non affectées */}
      {depensesNonAffectees.length>0&&(
        <div style={{marginTop:8}}>
          <div style={{fontSize:11,fontWeight:700,color:"#1B3A5C",marginBottom:4}}>Détail dépenses non affectées</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
            <thead>
              <tr style={{background:"#F8FAFC"}}>
                {["Date","Libellé","Catégorie","Montant"].map(h=>
                  <th key={h} style={{padding:"5px 8px",textAlign:h==="Montant"?"right":"left",fontSize:9,color:"#64748B",fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {depensesNonAffectees.map((d,i)=>(
                <tr key={d.id||i} style={{borderBottom:"1px solid #E2E8F0"}}>
                  <td style={{padding:"5px 8px"}}>{d.date||"—"}</td>
                  <td style={{padding:"5px 8px"}}>{d.libelle||"—"}</td>
                  <td style={{padding:"5px 8px",color:"#64748B"}}>{d.categorie||"—"}</td>
                  <td style={{padding:"5px 8px",fontFamily:"monospace",textAlign:"right",color:"#D97706"}}>{fmt2(+d.montant||0)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{marginTop:18,fontSize:9,color:"#94A3B8",fontStyle:"italic"}}>
        💡 Pour ventiler les dépenses par lot, ajoutez un champ <code>lot</code> aux entrées de <code>depensesReelles</code> correspondant au libellé du lot d'un poste.
      </div>
    </div>
  );
}

// ─── ENVOI EMAIL (mailto:) ────────────────────────────────────────────────────
// ─── IMPORT DE LIGNES DEPUIS UN DEVIS EXISTANT ───────────────────────────────
// ─── DEVIS RAPIDE IA ─────────────────────────────────────────────────────────
// Reçoit une description en langage naturel, appelle Claude via /api/estimer,
// parse le JSON et propose le devis structuré au parent (qui crée le doc et
// redirige en édition).
function DevisRapideIAModal({onSave,onClose}){
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState(null);

  async function generer(){
    if(!text.trim()||loading)return;
    setLoading(true);setErr(null);
    try{
      const sys=`Tu es un expert BTP français (Artiprix, Batiprix, Mediabat 2024, marché PACA).
À partir de la description fournie, génère un devis structuré au format JSON STRICT, sans aucun texte avant ou après. Schéma :
{
  "client": "<nom client si donné, sinon ''>",
  "titreChantier": "<court résumé du chantier>",
  "lignes": [
    {"type":"titre","libelle":"NOM DU LOT EN MAJUSCULES"},
    {"type":"soustitre","libelle":"<sous-section>"},
    {"type":"ligne","libelle":"<désignation détaillée>","qte":<number>,"unite":"m2|m3|ml|h|U|forfait|kg","prixUnitHT":<number>,"tva":10|20|5.5,"heuresPrevues":<heures par unité>,"nbOuvriers":<1-3>}
  ]
}

Règles :
- Pour chaque grand corps d'état, ajoute une ligne type:"titre" (ex : DÉPOSE & PRÉPARATION, PLOMBERIE, CARRELAGE, PEINTURE, ÉLECTRICITÉ).
- Donne 2 à 6 lignes chiffrées par titre selon la complexité.
- TVA : 10 par défaut (rénovation), 20 pour neuf, 5.5 pour logement social aidé.
- Prix de marché PACA 2024 réalistes (matériel + pose).
- heuresPrevues = heures de MO PAR UNITÉ (m², ml, U…) ; pour forfait, heures totales.
- nbOuvriers entre 1 et 3 selon le type de tâche.
- Si la description est trop floue, fais des hypothèses raisonnables.`;
      const r=await fetch("/api/estimer",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:3000,
          system:sys,
          messages:[{role:"user",content:text}],
        }),
      });
      const data=await r.json();
      if(data?.error)throw new Error(data.error.message||data.error);
      const responseText=data?.content?.[0]?.text||"";
      const clean=responseText.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      if(!parsed||!Array.isArray(parsed.lignes))throw new Error("Réponse IA mal formée");
      onSave?.(parsed);
    }catch(e){
      setErr(`Erreur génération : ${e.message}`);
      setLoading(false);
    }
  }

  return(
    <Modal title="⚡ Devis Rapide IA" onClose={loading?undefined:onClose} maxWidth={680} closeOnOverlay={!loading}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:12,color:L.textSm,lineHeight:1.5}}>
          Décrivez vos travaux en langage naturel. L'IA va générer un devis structuré (lots, lignes, quantités, prix marché, heures MO) que vous pourrez ajuster avant enregistrement.
        </div>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={8} disabled={loading}
          placeholder="Ex : Rénovation salle de bain 8m² — dépose ancienne salle de bain, nouveau carrelage sol 60x60, faïence murs, pose receveur extra-plat + colonne de douche, lavabo + meuble, WC suspendu, peinture plafond. Marseille."
          style={{width:"100%",padding:"11px 13px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.5,opacity:loading?0.7:1}}/>
        {err&&<div style={{padding:"8px 11px",background:L.redBg,color:L.red,borderRadius:7,fontSize:11,fontWeight:600,whiteSpace:"pre-wrap"}}>⚠ {err}</div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <Btn onClick={onClose} variant="secondary" disabled={loading}>Annuler</Btn>
          <Btn onClick={generer} variant="ai" icon={loading?"⏳":"⚡"} disabled={!text.trim()||loading}>{loading?"Génération en cours…":"Générer le devis"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

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
function VueAssistant({entreprise,statut,chantiers,salaries,docs}){
  // Construit le system prompt avec contexte entreprise injecté dynamiquement
  const systemPrompt=useMemo(()=>{
    const sLabel=STATUTS[statut]?.label||statut||"non renseigné";
    const ctxChantiers=(chantiers||[]).slice(0,5).map(c=>{
      const r=rentaChantier(c,salaries);
      return `  • ${c.nom} — client ${c.client||"?"} — devis ${euro(c.devisHT)} HT — marge ${r.tauxMarge}% — statut ${c.statut}`;
    }).join("\n")||"  (aucun chantier en cours)";
    const ctxDocs=(docs||[]).slice(0,5).map(d=>`  • ${d.numero} ${d.type} — ${d.client||"?"} — statut ${d.statut||"—"}`).join("\n")||"  (aucun document)";
    return `Tu es un assistant expert spécialisé dans deux domaines complémentaires :

1. EXPERT BTP / CONSTRUCTION :
- Chiffrage et estimation de travaux (MO, fournitures, marges)
- Normes DTU, réglementation construction France
- Lecture de plans, CCTP, DPGF
- Conseils techniques : gros œuvre, second œuvre, finitions, fluides
- Optimisation méthodes chantier et planification
- Prix unitaires marché BTP (zones géographiques France)

2. EXPERT COMPTABLE BTP :
- Fiscalité entreprise BTP (TVA 5,5 %, 10 %, 20 %, autoliquidation)
- Gestion de trésorerie chantier, situations de travaux
- Facturation électronique Chorus Pro, Factur-X
- Ratios financiers BTP (marge brute, EBE, BFR chantier)
- Sous-traitance : contrats, retenue de garantie, caution
- Régime micro-entrepreneur vs SARL vs SAS pour artisan

Contexte entreprise (à utiliser dans tes réponses) :
- Nom : ${entreprise?.nom||"(non renseigné)"}
- SIRET : ${entreprise?.siret||"(non renseigné)"}
- Statut juridique : ${sLabel}
- Activité : ${entreprise?.activite||"(non renseignée)"}
- Équipe : ${(salaries||[]).length} salarié(s)

Chantiers en base :
${ctxChantiers}

Devis / factures récents :
${ctxDocs}

Réponds toujours en français, de façon concise et actionnable. Quand l'utilisateur cite un de ses chantiers ou devis, exploite les chiffres ci-dessus.`;
  },[entreprise,statut,chantiers,salaries,docs]);

  const [messages,setMessages]=useState([{role:"assistant",content:`Bonjour ${entreprise?.nomCourt||entreprise?.nom||""}, je suis votre assistant double-expertise **BTP + comptabilité**.\n\nPosez-moi vos questions sur :\n• Chiffrage, normes DTU, méthodes chantier, marges\n• Fiscalité (TVA 5,5 / 10 / 20 %, autoliquidation), Chorus Pro, sous-traitance, régime juridique\n\nJe connais vos chantiers et devis et je peux les utiliser comme contexte.`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null);
  const SUGG=["Comment calculer ma marge sur un chantier ?","Différence TVA 5,5 % vs 10 % en rénovation ?","Délais de paiement loi LME en BTP","Régime micro vs SARL pour artisan","Caution bancaire sous-traitant 1799-1"];

  async function envoyer(){
    if(!input.trim()||loading)return;
    const msg=input.trim();setInput("");
    const next=[...messages,{role:"user",content:msg}];
    setMessages(next);
    setLoading(true);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),50);
    try{
      const r=await fetch("/api/estimer",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1500,
          system:systemPrompt,
          messages:next.map(m=>({role:m.role,content:m.content})),
        }),
      });
      const data=await r.json();
      if(data?.error)throw new Error(data.error.message||data.error);
      const text=data?.content?.[0]?.text||"(réponse vide)";
      setMessages(m=>[...m,{role:"assistant",content:text}]);
    }catch(e){
      setMessages(m=>[...m,{role:"assistant",content:`⚠ Erreur communication avec l'IA : ${e.message}.\n\nVérifie la clé ANTHROPIC_API_KEY côté Vercel et réessaie.`}]);
    }finally{
      setLoading(false);
      setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
    }
  }
  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 60px)"}}>
      <PageH title="Assistant IA" subtitle="Questions BTP · IA désignation disponible dans Devis"/>
      <Card style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:11}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:L.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:2}}>🤖</div>}
              <div style={{maxWidth:"72%",padding:"10px 13px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.role==="user"?L.navy:L.bg,color:m.role==="user"?"#fff":L.text,fontSize:12,lineHeight:1.6,border:`1px solid ${m.role==="user"?L.navy:L.border}`,whiteSpace:m.role==="user"?"pre-wrap":"normal",wordBreak:"break-word"}}>{m.role==="user"?m.content:<MarkdownText text={m.content}/>}</div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:8,justifyContent:"flex-start"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:L.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:2}}>🤖</div>
            <div style={{padding:"10px 13px",borderRadius:"12px 12px 12px 3px",background:L.bg,color:L.textSm,fontSize:12,border:`1px solid ${L.border}`,fontStyle:"italic"}}>⏳ Analyse en cours…</div>
          </div>}
          <div ref={endRef}/>
        </div>
        <div style={{padding:"6px 14px",borderTop:`1px solid ${L.border}`,display:"flex",gap:4,overflowX:"auto",background:L.bg}}>
          {SUGG.map(s=><button key={s} onClick={()=>setInput(s)} style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:10,padding:"3px 9px",cursor:"pointer",color:L.textSm,fontSize:10,whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit"}}>{s}</button>)}
        </div>
        <div style={{padding:"9px 13px",borderTop:`1px solid ${L.border}`,display:"flex",gap:7}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();envoyer();}}} placeholder="Question BTP ou comptable…" rows={2} disabled={loading} style={{flex:1,padding:"7px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:12,color:L.text,outline:"none",resize:"none",fontFamily:"inherit",opacity:loading?0.6:1}}/>
          <button onClick={envoyer} disabled={!input.trim()||loading} style={{background:(input.trim()&&!loading)?L.navy:L.bg,border:`1px solid ${(input.trim()&&!loading)?L.navy:L.border}`,borderRadius:8,padding:"7px 14px",cursor:(input.trim()&&!loading)?"pointer":"not-allowed",color:(input.trim()&&!loading)?"#fff":L.textXs,fontSize:12,fontWeight:700,fontFamily:"inherit",alignSelf:"flex-end"}}>{loading?"⏳":"➤"}</button>
        </div>
      </Card>
    </div>
  );
}

// ─── SCAN FACTURE FOURNISSEUR (Vision IA) ────────────────────────────────────
const CATS_DEPENSE=[
  {value:"materiaux",label:"📦 Matériaux"},
  {value:"sous-traitance",label:"🤝 Sous-traitance"},
  {value:"location",label:"🚛 Location matériel"},
  {value:"carburant",label:"⛽ Carburant"},
  {value:"autre",label:"📋 Autre"},
];

function ScanFactureModal({chantiers,onSave,onClose}){
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [err,setErr]=useState(null);
  const [extracted,setExtracted]=useState(null); // résultat IA
  const [form,setForm]=useState({
    fournisseur:"",montantHT:"",tva:"",montantTTC:"",date:new Date().toISOString().slice(0,10),
    numeroFacture:"",description:"",chantierId:"",categorie:"materiaux",
  });
  const [qontoFeedback,setQontoFeedback]=useState(null);

  function onFile(e){
    const f=e.target.files?.[0];
    e.target.value="";
    if(!f)return;
    if(!f.type.startsWith("image/")){setErr("Fichier image attendu (JPG/PNG/WebP/HEIC).");return;}
    if(f.size>5_000_000){setErr("Image trop lourde (max 5 Mo).");return;}
    setErr(null);setExtracted(null);setQontoFeedback(null);
    const reader=new FileReader();
    reader.onload=()=>{setFile(f);setPreview(reader.result);};
    reader.onerror=()=>setErr("Lecture du fichier impossible.");
    reader.readAsDataURL(f);
  }

  async function analyser(){
    if(!preview||!file)return;
    setAnalyzing(true);setErr(null);
    try{
      // Anthropic n'accepte que jpeg/png/gif/webp pour l'instant
      const allowed=["image/jpeg","image/png","image/gif","image/webp"];
      const mt=allowed.includes(file.type)?file.type:"image/jpeg";
      const base64=preview.split(",")[1]||"";
      const sys=`Tu es un OCR expert spécialisé dans les factures fournisseurs BTP français. Extrait les informations en JSON STRICT, sans aucun texte avant ou après. Schéma : {"fournisseur":<string|null>,"montantHT":<number|null>,"tva":<number|null>,"montantTTC":<number|null>,"date":"YYYY-MM-DD"|null,"numeroFacture":<string|null>,"description":<string|null>}. La description résume en une phrase ce que la facture concerne (matériaux, location, etc.). Si une info est absente ou illisible, mets null.`;
      const r=await fetch("/api/estimer",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:600,system:sys,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:mt,data:base64}},
            {type:"text",text:"Extrait les informations de cette facture en JSON conforme au schéma système."},
          ]}],
        }),
      });
      const data=await r.json();
      if(data?.error)throw new Error(data.error.message||data.error);
      const text=data?.content?.[0]?.text||"";
      const clean=text.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setExtracted(parsed);
      setForm(f=>({
        ...f,
        fournisseur:parsed.fournisseur||"",
        montantHT:parsed.montantHT??"",
        tva:parsed.tva??"",
        montantTTC:parsed.montantTTC??"",
        date:parsed.date||f.date,
        numeroFacture:parsed.numeroFacture||"",
        description:parsed.description||"",
      }));
    }catch(e){setErr(`Échec extraction : ${e.message}`);}
    setAnalyzing(false);
  }

  function enregistrer(){
    if(!form.chantierId){setErr("Choisis un chantier d'imputation.");return;}
    if(!form.montantTTC&&!form.montantHT){setErr("Renseigne au moins le montant TTC ou HT.");return;}
    setErr(null);
    const ttc=+form.montantTTC||(+form.montantHT||0)+(+form.tva||0);
    const depense={
      id:Date.now(),
      libelle:`${form.fournisseur||"Fournisseur"}${form.numeroFacture?` — ${form.numeroFacture}`:""}${form.description?` — ${form.description}`:""}`,
      montant:+ttc.toFixed(2),
      montantHT:+form.montantHT||null,
      tva:+form.tva||null,
      categorie:form.categorie,
      date:form.date,
      fournisseur:form.fournisseur||null,
      numeroFacture:form.numeroFacture||null,
      description:form.description||null,
      sourceFacture:preview||null,
    };
    onSave?.(form.chantierId,depense);
    onClose?.();
  }

  function envoyerQonto(){
    const payload={
      type:"supplier_invoice",
      supplier:{name:form.fournisseur||null},
      invoice_number:form.numeroFacture||null,
      issue_date:form.date||null,
      total_excluding_vat:+form.montantHT||null,
      vat_amount:+form.tva||null,
      total_including_vat:+form.montantTTC||null,
      description:form.description||null,
      attachment_base64:preview?preview.split(",")[1]:null,
      tags:[form.categorie],
    };
    setQontoFeedback({type:"info",msg:`Payload prêt — intégration Qonto non encore branchée.\n\n${JSON.stringify({...payload,attachment_base64:payload.attachment_base64?"[base64 image…]":null},null,2)}`});
  }

  const inp={width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,outline:"none",fontFamily:"inherit"};

  return(
    <Modal title="📸 Scanner une facture fournisseur" onClose={onClose} maxWidth={780} closeOnOverlay={false}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {/* Colonne gauche : image */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>1. Photo de la facture</div>
          {preview?(
            <div style={{position:"relative"}}>
              <img src={preview} alt="facture" style={{width:"100%",maxHeight:340,objectFit:"contain",border:`1px solid ${L.border}`,borderRadius:8,background:L.bg}}/>
              <button onClick={()=>{setFile(null);setPreview(null);setExtracted(null);}} style={{position:"absolute",top:6,right:6,background:L.red,color:"#fff",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>× Retirer</button>
            </div>
          ):(
            <label style={{display:"block",border:`2px dashed ${L.borderMd}`,borderRadius:10,padding:"34px 14px",textAlign:"center",cursor:"pointer",background:L.bg,color:L.textSm,fontSize:12}}>
              <div style={{fontSize:34,marginBottom:6}}>📸</div>
              Cliquez ou prenez une photo<br/>
              <span style={{fontSize:10,color:L.textXs}}>JPG / PNG / WebP · max 5 Mo</span>
              <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{display:"none"}}/>
            </label>
          )}
          {preview&&!extracted&&<Btn onClick={analyser} variant="primary" icon={analyzing?"⏳":"✨"} disabled={analyzing} fullWidth>{analyzing?"Analyse en cours…":"Extraire les données"}</Btn>}
          {extracted&&<div style={{marginTop:8,padding:"7px 10px",background:L.greenBg,color:L.green,borderRadius:7,fontSize:11,fontWeight:600}}>✓ Extraction OK — vérifie / corrige à droite</div>}
          {err&&<div style={{marginTop:8,padding:"7px 10px",background:L.redBg,color:L.red,borderRadius:7,fontSize:11,fontWeight:600,whiteSpace:"pre-wrap"}}>{err}</div>}
        </div>

        {/* Colonne droite : formulaire */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd}}>2. Données facture</div>
          <input value={form.fournisseur} onChange={e=>setForm(f=>({...f,fournisseur:e.target.value}))} placeholder="Fournisseur" style={inp}/>
          <input value={form.numeroFacture} onChange={e=>setForm(f=>({...f,numeroFacture:e.target.value}))} placeholder="N° facture" style={inp}/>
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={inp}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            <input type="number" value={form.montantHT} onChange={e=>setForm(f=>({...f,montantHT:e.target.value}))} placeholder="HT €" style={inp}/>
            <input type="number" value={form.tva} onChange={e=>setForm(f=>({...f,tva:e.target.value}))} placeholder="TVA €" style={inp}/>
            <input type="number" value={form.montantTTC} onChange={e=>setForm(f=>({...f,montantTTC:e.target.value}))} placeholder="TTC €" style={inp}/>
          </div>
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Description courte" rows={2} style={{...inp,resize:"vertical"}}/>

          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginTop:6}}>3. Imputation</div>
          <select value={form.chantierId} onChange={e=>setForm(f=>({...f,chantierId:e.target.value?+e.target.value:""}))} style={inp}>
            <option value="">— Choisir un chantier —</option>
            {(chantiers||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))} style={inp}>
            {CATS_DEPENSE.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            <Btn onClick={enregistrer} variant="success" icon="💾" disabled={!form.chantierId}>Enregistrer</Btn>
            <Btn onClick={envoyerQonto} variant="navy" icon="🏦">Envoyer vers Qonto</Btn>
            <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          </div>
          {qontoFeedback&&<div style={{marginTop:6,padding:"7px 10px",background:L.navyBg,color:L.navy,border:`1px solid ${L.navy}33`,borderRadius:7,fontSize:10,fontFamily:"monospace",whiteSpace:"pre-wrap",maxHeight:160,overflowY:"auto"}}>{qontoFeedback.msg}</div>}
        </div>
      </div>
    </Modal>
  );
}

// ─── COMPTA ───────────────────────────────────────────────────────────────────
function VueCompta({chantiers,setChantiers,salaries}){
  const [showScan,setShowScan]=useState(false);
  function onSaveDepense(chantierId,depense){
    setChantiers?.(cs=>cs.map(c=>c.id===chantierId?{...c,depensesReelles:[...(c.depensesReelles||[]),depense]}:c));
  }
  const totCA=chantiers.reduce((a,c)=>a+c.devisHT,0);
  const totCouts=chantiers.reduce((a,c)=>a+rentaChantier(c,salaries).totalCouts,0);
  const benef=totCA-totCouts;const tb=pct(benef,totCA);const mc=tb>=25?L.green:tb>=15?L.orange:L.red;
  const totDepenses=chantiers.reduce((a,c)=>a+(c.depensesReelles||[]).reduce((b,d)=>b+(+d.montant||0),0),0);
  return(
    <div>
      <PageH title="Comptabilité" subtitle="Vue d'ensemble financière"
        actions={<Btn onClick={()=>setShowScan(true)} variant="primary" icon="📸" disabled={!chantiers||chantiers.length===0}>Scanner facture</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI label="CA total" value={euro(totCA)} icon="💰" color={L.navy}/>
        <KPI label="Coûts estimés" value={euro(totCouts)} icon="📉" color={L.orange}/>
        <KPI label="Bénéfice est." value={euro(benef)} icon="📈" color={mc}/>
        <KPI label="Taux marge" value={`${tb}%`} icon="📊" color={mc}/>
        <KPI label="Encaissé" value={euro(chantiers.reduce((a,c)=>a+(c.acompteEncaisse||0),0))} icon="✅" color={L.green}/>
        <KPI label="Dépenses réelles" value={euro(totDepenses)} icon="🧾" color={L.red}/>
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
      {showScan&&<ScanFactureModal chantiers={chantiers} onSave={onSaveDepense} onClose={()=>setShowScan(false)}/>}
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


// Parse CSV simple : détecte séparateur (, ; \t), normalise les en-têtes
function parseCSV(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length<2)return[];
  const sep=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?";":(lines[0].includes("\t")?"\t":",");
  function splitRow(line){
    // gestion basique des guillemets
    const out=[];let cur="",inQ=false;
    for(const ch of line){
      if(ch==='"'){inQ=!inQ;continue;}
      if(ch===sep&&!inQ){out.push(cur);cur="";continue;}
      cur+=ch;
    }
    out.push(cur);
    return out.map(s=>s.trim());
  }
  function norm(s){return (s||"").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");}
  const headers=splitRow(lines[0]).map(norm);
  // alias colonnes Batappli/Batigest
  const alias={
    designation:"designation",description:"designation",libelle:"libelle",lib:"libelle",
    qte:"qte",quantite:"qte",qtt:"qte",
    unite:"unite",u:"unite",un:"unite",
    pu:"pu",prixunitaire:"pu",prix:"pu",puht:"pu",prixunitht:"pu",
    tva:"tva",tauxtva:"tva",
  };
  return lines.slice(1).map(line=>{
    const cells=splitRow(line);
    const row={};
    headers.forEach((h,i)=>{
      const k=alias[h]||h;
      let v=cells[i]||"";
      // numériques: virgule décimale FR → point
      if(["qte","pu","tva"].includes(k))v=v.replace(",",".").replace(/[^0-9.\-]/g,"");
      row[k]=v;
    });
    return row;
  });
}

function VueParametres({entreprise,setEntreprise,statut,setStatut,onClose,onExportJSON,onImportJSON,onImportCSV}){
  const [form,setForm]=useState({...entreprise});const [stat,setStat]=useState(statut);
  const [logoErr,setLogoErr]=useState(null);
  const [importStatus,setImportStatus]=useState(null);
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
  function onFileImport(e){
    const file=e.target.files?.[0];
    e.target.value="";
    if(!file)return;
    setImportStatus(null);
    const reader=new FileReader();
    reader.onload=()=>{
      const text=reader.result;
      const isJSON=file.name.toLowerCase().endsWith(".json")||/^\s*\{/.test(text);
      if(isJSON){
        try{
          const data=JSON.parse(text);
          const r=onImportJSON?.(data);
          setImportStatus(r?.ok?{type:"ok",msg:r.summary}:{type:"err",msg:r?.err||"Échec import JSON"});
        }catch(err){setImportStatus({type:"err",msg:"JSON illisible : "+err.message});}
      } else {
        try{
          const rows=parseCSV(text);
          if(rows.length===0){setImportStatus({type:"err",msg:"CSV vide ou non reconnu"});return;}
          const r=onImportCSV?.(rows,{titre:file.name.replace(/\.[^.]+$/,"")});
          setImportStatus(r?.ok?{type:"ok",msg:r.summary}:{type:"err",msg:r?.err||"Échec import CSV"});
        }catch(err){setImportStatus({type:"err",msg:"CSV illisible : "+err.message});}
      }
    };
    reader.onerror=()=>setImportStatus({type:"err",msg:"Lecture du fichier impossible"});
    reader.readAsText(file,"utf-8");
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

        {/* Import / Export */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:8}}>Import / Export des données</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <Btn onClick={onExportJSON} variant="navy" size="sm" icon="⬇">Exporter tout (JSON)</Btn>
            <label style={{padding:"5px 10px",background:L.surface,color:L.navy,border:`1px solid ${L.navy}`,borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5}}>
              ⬆ Importer (JSON / CSV)
              <input type="file" accept=".json,.csv,application/json,text/csv,text/plain" onChange={onFileImport} style={{display:"none"}}/>
            </label>
          </div>
          {importStatus&&<div style={{marginTop:8,padding:"7px 11px",borderRadius:7,fontSize:11,fontWeight:600,background:importStatus.type==="ok"?L.greenBg:L.redBg,color:importStatus.type==="ok"?L.green:L.red,border:`1px solid ${importStatus.type==="ok"?L.green:L.red}33`}}>{importStatus.msg}</div>}
          <div style={{fontSize:10,color:L.textXs,marginTop:6,lineHeight:1.5}}>
            <strong>JSON</strong> : sauvegarde / restauration complète (entreprise, chantiers, devis, équipe). Remplace l'état actuel après confirmation.<br/>
            <strong>CSV Batappli / Batigest</strong> : crée un nouveau devis. Colonnes attendues : <code>designation, qte, unite, pu, tva</code> (séparateur , ou ;).
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
  // 3 salariés "types" pour guider l'utilisateur (à renommer/dupliquer
  // dans Équipe). Tarif chargé approx. = tauxHoraire × (1 + chargesPatron).
  const [salaries,setSalaries]=useState([
    {id:1,nom:"Chef (à renommer)",poste:"Ouvrier qualifié N3P2",qualification:"chef",tauxHoraire:18,chargesPatron:0.94,coefficient:1.5,disponible:true,competences:[]},
    {id:2,nom:"Qualifié (à renommer)",poste:"Ouvrier qualifié N2P2",qualification:"qualifie",tauxHoraire:15,chargesPatron:0.94,coefficient:1.3,disponible:true,competences:[]},
    {id:3,nom:"Manœuvre (à renommer)",poste:"Manœuvre N1P1",qualification:"manoeuvre",tauxHoraire:12,chargesPatron:0.94,coefficient:1.1,disponible:true,competences:[]},
  ]);
  const [chantiers,setChantiers]=useState([]);
  const [docs,setDocs]=useState(DOCS_INIT);
  const [selectedChantier,setSelectedChantier]=useState(1);
  const [view,setView]=useState("accueil");
  const [showSettings,setShowSettings]=useState(false);
  const [showDevisRapide,setShowDevisRapide]=useState(false);
  const [pendingEditDocId,setPendingEditDocId]=useState(null);
  const [notif,setNotif]=useState(null);
  // Responsive : sidebar compacte (icônes seuls + drawer hamburger) UNIQUEMENT
  // sous 768px (mobile). Au-dessus → labels visibles (desktop).
  // Lecture directe de window.innerWidth à chaque render — useViewportSize
  // ne sert qu'à forcer le re-render sur resize/orientationchange.
  useViewportSize();
  const winW=typeof window!=="undefined"?window.innerWidth:1200;
  const sidebarCompact=winW<768;
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
  const entrepriseSkipRef=useRef(false);
  useEffect(()=>{
    if(!supabase || !authUser) return;
    let cancelled=false;
    supabase.from("entreprises").select("*").eq("user_id",authUser.id).maybeSingle()
      .then(({data,error})=>{
        if(cancelled) return;
        if(error){console.warn("[entreprises] load error:",error.message);return;}
        if(!data) return;
        // Skip le save déclenché par les setEntreprise/setStatut qui suivent
        entrepriseSkipRef.current=true;
        setEntreprise({
          nom:data.nom||ENTREPRISE_INIT.nom,
          nomCourt:data.nom_court||data.nom?.split(" ").slice(0,2).join(" ")||ENTREPRISE_INIT.nomCourt,
          siret:data.siret||"",
          adresse:data.adresse||"",
          tel:data.tel||"",
          email:data.email||authUser.email||"",
          activite:data.activite||ENTREPRISE_INIT.activite,
          tva:data.tva??true,
          logo:data.logo||null,
        });
        if(data.statut) setStatut(data.statut);
        setOnboardingDone(true);
      });
    return ()=>{cancelled=true;};
  },[authUser]);

  // Sauvegarde l'entreprise dans Supabase à chaque modification (debounce 800ms).
  // Gardée par onboardingDone+authUser pour éviter d'écraser avec ENTREPRISE_INIT
  // pendant les transitions logout/login.
  useEffect(()=>{
    if(!supabase||!authUser||!onboardingDone)return;
    if(entrepriseSkipRef.current){entrepriseSkipRef.current=false;return;}
    const t=setTimeout(async()=>{
      try{
        const row={
          user_id:authUser.id,
          nom:entreprise?.nom||null,
          nom_court:entreprise?.nomCourt||null,
          siret:entreprise?.siret||null,
          adresse:entreprise?.adresse||null,
          tel:entreprise?.tel||null,
          email:entreprise?.email||null,
          activite:entreprise?.activite||null,
          tva:entreprise?.tva??null,
          logo:entreprise?.logo||null,
          statut:statut||null,
        };
        const{error}=await supabase.from("entreprises").upsert(row,{onConflict:"user_id"});
        if(error)console.warn("[entreprises save]",error.message);
      }catch(e){console.warn("[entreprises save]",e);}
    },800);
    return ()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[entreprise,statut,authUser?.id,onboardingDone]);

  // ─── PERSISTENCE SUPABASE (devis, chantiers, salaries) ─────────────
  // Stratégie : à chaque login, on remplace le state local par les données
  // de l'utilisateur. Sur chaque modif (debounce 800ms) on synchronise par
  // upsert + delete des lignes orphelines.
  const [supaReady,setSupaReady]=useState(true);
  const supaSkipRef=useRef({devis:0,chantiers_v2:0,salaries:0});

  useEffect(()=>{
    if(!supabase||!authUser){setSupaReady(true);return;}
    let cancelled=false;
    setSupaReady(false);
    Promise.all([
      supabase.from("devis").select("*").eq("user_id",authUser.id),
      supabase.from("chantiers_v2").select("*").eq("user_id",authUser.id),
      supabase.from("salaries").select("*").eq("user_id",authUser.id),
    ]).then(([d,c,s])=>{
      if(cancelled)return;
      // Skip le save déclenché par le setX qui suit (un par table)
      supaSkipRef.current={devis:1,chantiers_v2:1,salaries:1};
      if(!d.error&&Array.isArray(d.data))setDocs(d.data.map(r=>r.data).filter(Boolean));
      else if(d.error)console.warn("[supa devis load]",d.error.message);
      if(!c.error&&Array.isArray(c.data))setChantiers(c.data.map(r=>r.data).filter(Boolean));
      else if(c.error)console.warn("[supa chantiers_v2 load]",c.error.message);
      // Salaries : si Supabase est vide (nouveau user), on garde les
      // 3 templates initiaux qui seront persistés au prochain save.
      if(!s.error&&Array.isArray(s.data)&&s.data.length>0)setSalaries(s.data.map(r=>r.data).filter(Boolean));
      else if(s.error)console.warn("[supa salaries load]",s.error.message);
      setSupaReady(true);
    }).catch(e=>{
      console.error("[supa load]",e);
      if(!cancelled)setSupaReady(true);
    });
    return ()=>{cancelled=true;};
  },[authUser?.id]);

  useSupaSync("devis",docs,supaReady,authUser,supaSkipRef);
  useSupaSync("chantiers_v2",chantiers,supaReady,authUser,supaSkipRef);
  useSupaSync("salaries",salaries,supaReady,authUser,supaSkipRef);

  async function handleLogout(){
    if(supabase) await supabase.auth.signOut();
    setAuthUser(null);
    // Reset local pour éviter le mélange entre comptes lors d'un re-login
    setDocs([]);setChantiers([]);setSalaries([]);
    setEntreprise(ENTREPRISE_INIT);
  }
  // ─────────────────────────────────────────────────────

  const s=STATUTS[statut];
  const modules=s?.modules||STATUTS.sarl.modules;
  const activeView=modules.includes(view)?view:"accueil";

  function handleOnboarding(data){
    setEntreprise({nom:data.nom||"Mon Entreprise",nomCourt:data.nom?.split(" ").slice(0,2).join(" ")||"Mon Entreprise",siret:data.siret||"",adresse:"",tel:data.tel||"",email:data.email||"",activite:data.activite||"Rénovation générale"});
    setStatut(data.statut||"sarl");setOnboardingDone(true);
  }

  // ─── EXPORT / IMPORT JSON ──────────────────────────────────────────
  function exporterToutJSON(){
    const payload={
      app:"ChantierPro",
      version:1,
      exportedAt:new Date().toISOString(),
      entreprise,statut,
      chantiers,docs,salaries,
    };
    const json=JSON.stringify(payload,null,2);
    const blob=new Blob([json],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`chantierpro-export-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();
    document.body.removeChild(a);URL.revokeObjectURL(url);
  }
  function importerJSON(payload){
    if(!payload||typeof payload!=="object")return{ok:false,err:"JSON invalide"};
    if(payload.app&&payload.app!=="ChantierPro")return{ok:false,err:"Fichier d'une autre application"};
    if(!window.confirm("Remplacer toutes les données actuelles par celles du fichier ? Cette action écrase l'état en cours."))return{ok:false,err:"Annulé"};
    if(payload.entreprise&&typeof payload.entreprise==="object")setEntreprise({...ENTREPRISE_INIT,...payload.entreprise});
    if(payload.statut&&STATUTS[payload.statut])setStatut(payload.statut);
    if(Array.isArray(payload.chantiers))setChantiers(payload.chantiers);
    if(Array.isArray(payload.docs))setDocs(payload.docs);
    if(Array.isArray(payload.salaries))setSalaries(payload.salaries);
    return{ok:true,
      summary:`Import OK: ${payload.chantiers?.length||0} chantier(s), ${payload.docs?.length||0} doc(s), ${payload.salaries?.length||0} salarié(s)`};
  }
  // Devis rapide IA : transforme la réponse LLM en doc et redirige vers
  // CreateurDevis en mode édition pour validation.
  function handleDevisRapide(generated){
    const newDoc={
      id:Date.now(),
      type:"devis",
      numero:`DEV-${Date.now().toString().slice(-5)}`,
      date:new Date().toISOString().slice(0,10),
      client:generated.client||"",
      titreChantier:generated.titreChantier||"",
      emailClient:"",telClient:"",adresseClient:"",
      statut:"brouillon",chantierId:null,
      conditionsReglement:"40% à la commande – 60% à l'achèvement",
      notes:"Devis généré par IA — vérifiez les prix, quantités et conditions.",
      acompteVerse:0,
      lignes:(Array.isArray(generated.lignes)?generated.lignes:[]).map((l,i)=>{
        const t=l.type==="titre"||l.type==="soustitre"?l.type:"ligne";
        const base={id:Date.now()+i+1,type:t,libelle:l.libelle||""};
        if(t==="ligne")return{
          ...base,
          qte:+l.qte||1,
          unite:l.unite||"U",
          prixUnitHT:+l.prixUnitHT||0,
          tva:+l.tva||10,
          heuresPrevues:+l.heuresPrevues||0,
          nbOuvriers:+l.nbOuvriers||1,
          fournitures:[],
          salariesAssignes:[],
        };
        return base;
      }),
    };
    setDocs(ds=>[newDoc,...ds]);
    setShowDevisRapide(false);
    setView("devis");
    setPendingEditDocId(newDoc.id);
  }

  function importerDevisCSV(rows,meta){
    if(!rows||rows.length===0)return{ok:false,err:"CSV vide"};
    const lignes=rows.map((r,i)=>({
      id:Date.now()+i,type:"ligne",
      libelle:r.designation||r.libelle||r.description||"",
      qte:+r.qte||+r.quantite||+r.quantité||1,
      unite:(r.unite||r.unité||r.u||""),
      prixUnitHT:+r.pu||+r.prix||+r.prixUnitHT||0,
      tva:+r.tva||10,
    }));
    const newDoc={
      id:Date.now(),type:"devis",
      numero:`IMP-${Date.now().toString().slice(-5)}`,
      date:new Date().toISOString().slice(0,10),
      client:meta?.client||"",titreChantier:meta?.titre||"Import CSV",
      emailClient:"",telClient:"",adresseClient:"",
      statut:"brouillon",chantierId:null,
      conditionsReglement:"40% à la commande – 60% à l'achèvement",
      notes:`Import CSV (${rows.length} ligne${rows.length>1?"s":""}) — vérifier les unités et TVA.`,
      acompteVerse:0,
      lignes,
    };
    setDocs(ds=>[newDoc,...ds]);
    return{ok:true,summary:`${lignes.length} ligne(s) importée(s) dans le devis ${newDoc.numero}`};
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
        html,body{margin:0;padding:0;overflow-x:hidden;-webkit-text-size-adjust:100%;}
        input:focus,select:focus,textarea:focus{border-color:${L.accent}!important;outline:none;box-shadow:0 0 0 3px ${L.accent}18;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${L.borderMd};border-radius:10px;}
        button,input,select,textarea{font-family:inherit;}
        img,svg{max-width:100%;height:auto;}
        /* Mobile portrait + landscape : modales et tables au cordeau */
        @media (max-width: 768px){
          /* Réduit le padding du fond modal pour gagner de l'espace */
          .cp-modal-bg{padding:6px!important;}
          /* Tables horizontales : scroll local plutôt que de pousser le layout */
          table{max-width:100%;}
          .cp-card-table{overflow-x:auto;-webkit-overflow-scrolling:touch;}
          /* Réduit les padding interne des modales */
          .cp-modal-body{padding:14px!important;}
          .cp-modal-head{padding:12px 14px!important;}
        }
        /* Très petit (mobile portrait) : on cache le sub-titre des KPI etc. */
        @media (max-width: 480px){
          .cp-modal-bg{padding:0!important;}
          .cp-modal{border-radius:0!important;max-height:100vh!important;}
        }
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
      <div className="no-print"><Sidebar modules={modules} active={activeView} onNav={v=>setView(v)} entreprise={entreprise} statut={statut} onSettings={()=>setShowSettings(true)} onDevisRapide={()=>setShowDevisRapide(true)} compact={sidebarCompact}/></div>
      <div style={{flex:1,overflowY:activeView==="chantiers"||activeView==="planning"?"hidden":"auto",padding:activeView==="chantiers"?0:24,display:"flex",flexDirection:"column",minWidth:0}}>
        {activeView==="accueil"&&<Accueil chantiers={chantiers} docs={docs} entreprise={entreprise} statut={statut} salaries={salaries} onNav={v=>setView(v)} onSettings={()=>setShowSettings(true)} onDevisRapide={()=>setShowDevisRapide(true)}/>}
        {activeView==="chantiers"&&<VueChantiers chantiers={chantiers} setChantiers={setChantiers} selected={selectedChantier} setSelected={setSelectedChantier} salaries={salaries} statut={statut} entreprise={entreprise}/>}
        {activeView==="devis"&&<VueDevis chantiers={chantiers} salaries={salaries} statut={statut} entreprise={entreprise} docs={docs} setDocs={setDocs} onConvertirChantier={convertirDevisEnChantier} onSaveOuvrage={addOuvrage} pendingEditDocId={pendingEditDocId} onPendingEditHandled={()=>setPendingEditDocId(null)}/>}
        {activeView==="equipe"&&<VueEquipe salaries={salaries} setSalaries={setSalaries}/>}
        {activeView==="planning"&&<div style={{overflowY:"auto",padding:24,height:"100%"}}><VuePlanning chantiers={chantiers} setChantiers={setChantiers} salaries={salaries}/></div>}
        {activeView==="compta"&&<VueCompta chantiers={chantiers} setChantiers={setChantiers} salaries={salaries}/>}
        {activeView==="frais"&&<VueFrais/>}
        {activeView==="assistant"&&<VueAssistant entreprise={entreprise} statut={statut} chantiers={chantiers} salaries={salaries} docs={docs}/>}
        {activeView==="connecteurs"&&<VuePlaceholder title="Qonto & Pennylane" icon="🔗" desc="Synchronisez vos transactions et votre comptabilité."/>}
        {activeView==="bibliotheque"&&<VueBibliotheque/>}
        {activeView==="import"&&<VuePlaceholder title="Import PDF" icon="📤" desc="L'IA analyse vos devis PDF et crée le chantier automatiquement."/>}
      </div>
      {showSettings&&<VueParametres entreprise={entreprise} setEntreprise={setEntreprise} statut={statut} setStatut={setStatut} onClose={()=>setShowSettings(false)} onExportJSON={exporterToutJSON} onImportJSON={importerJSON} onImportCSV={importerDevisCSV}/>}
      {showDevisRapide&&<DevisRapideIAModal onSave={handleDevisRapide} onClose={()=>setShowDevisRapide(false)}/>}
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
