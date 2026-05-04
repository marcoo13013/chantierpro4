import React, { useState, useRef, useMemo } from "react";
import { useEffect } from "react";
import { supabase } from "./lib/supabase";
import LoginModal from "./components/LoginModal";
import { useOuvragesBibliotheque } from "./lib/ouvrages";
import { useDevis } from "./lib/useDevis";
import TrancheCard from "./components/TrancheCard";
import VueDevisDetail from "./components/VueDevisDetail";
import { estimerLigne } from "./lib/iaDevis";
import { uploadChantierPhoto, listChantierPhotos, deleteChantierPhoto, PHOTO_LIMITS } from "./lib/chantierPhotos";
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
// Modules complets accessibles à TOUS les statuts (planning, compta, équipe, etc.).
// Pour micro/auto, l'onglet Équipe est restreint à "Moi-même + sous-traitants" (pas
// de salariés multiples possibles, contrainte juridique).
const MODULES_FULL=["accueil","clients","chantiers","devis","factures","bibliotheque","fournisseurs","equipe","planning","compta","assistant","support"];
// Email admin du module support — voir la migration 20260515_support.sql.
const SUPPORT_ADMIN_EMAIL="francehabitat.immo@gmail.com";
const STATUTS = {
  auto:{label:"Auto-entrepreneur",short:"Auto",icon:"👤",mode:"simple",color:L.green,bg:L.greenBg,description:"Statut individuel simplifié — pas de salariés",tauxCharges:0.22,tvaSoumis:false,plafondCA:77700,isSolo:true,modules:MODULES_FULL},
  micro:{label:"Micro-entreprise",short:"Micro",icon:"🧑",mode:"simple",color:L.green,bg:L.greenBg,description:"BTP — franchise TVA, comptabilité allégée",tauxCharges:0.22,tvaSoumis:false,plafondCA:188700,isSolo:true,modules:MODULES_FULL},
  ei:{label:"Entrepreneur Individuel",short:"EI",icon:"🧑‍💼",mode:"simple",color:L.blue,bg:L.blueBg,description:"TVA possible, structure légère",tauxCharges:0.40,tvaSoumis:true,modules:MODULES_FULL},
  eurl:{label:"EURL",short:"EURL",icon:"🏢",mode:"avance",color:L.orange,bg:L.orangeBg,description:"SARL unipersonnelle",tauxCharges:0.45,tvaSoumis:true,modules:MODULES_FULL},
  sarl:{label:"SARL",short:"SARL",icon:"🏗",mode:"avance",color:L.navy,bg:L.navyBg,description:"Société à responsabilité limitée",tauxCharges:0.45,tvaSoumis:true,modules:MODULES_FULL},
  sas:{label:"SAS / SASU",short:"SAS",icon:"🏛",mode:"avance",color:L.purple,bg:"#F5F3FF",description:"Société par actions simplifiée",tauxCharges:0.42,tvaSoumis:true,modules:MODULES_FULL},
};
// Helper : statut interdisant les salariés (micro / auto-entrepreneur).
function isSoloStatut(statut){return STATUTS[statut]?.isSolo===true;}

const NAV_CONFIG = {
  accueil:{label:"Accueil",icon:"🏠",group:"principal"},
  clients:{label:"Clients",icon:"👥",group:"principal"},
  chantiers:{label:"Chantiers",icon:"🏗",group:"principal"},
  devis:{label:"Devis",icon:"📄",group:"documents"},
  factures:{label:"Factures",icon:"🧾",group:"documents"},
  bibliotheque:{label:"Bibliothèque",icon:"📖",group:"documents"},
  fournisseurs:{label:"Fournisseurs",icon:"🏭",group:"gestion"},
  equipe:{label:"Équipe",icon:"👷",group:"gestion"},
  planning:{label:"Planning",icon:"📅",group:"gestion"},
  terrain:{label:"Terrain",icon:"🚧",group:"gestion"},
  compta:{label:"Comptabilité",icon:"💰",group:"gestion"},
  assistant:{label:"Assistant IA",icon:"🤖",group:"ia"},
  media:{label:"Média IA",icon:"📱",group:"ia"},
  support:{label:"Support",icon:"💬",group:"outils"},
};
// Modules accessibles selon le rôle. Override les modules du statut juridique.
// Modules accessibles à un ouvrier/sous-traitant invité — strict minimum.
// Pas de devis, compta, équipe, paramètres, assistant IA, devis rapide.
const MODULES_OUVRIER=["chantiers","terrain"];
const NAV_GROUPS={principal:"Principal",documents:"Documents",gestion:"Gestion",outils:"Outils",ia:"Intelligence"};

// ─── BIBLIOTHÈQUE BTP — 81 OUVRAGES (Artiprix/Batiprix 2025) ─────────────────
// Source : Bibliotheque-BTP.jsx + CalculateurMO-Fournitures.jsx fusionnés par code
const BIBLIOTHEQUE_BTP = [
  {code:"CAR-001",corps:"Carrelage",libelle:"Carrelage sol grès cérame ≤30x30 (fourniture + pose)",unite:"m²",moMin:18.0,moMoy:25.0,moMax:35.0,fournMin:15.0,fournMoy:22.0,fournMax:32.0,tempsMO:0.7,detail:"Carrelage grès cérame fourni + mortier-colle + joints + plinthes. Pose, calepinage, finitions.",source:"Artiprix 2025",composants:[{designation:"Carrelage grès cérame ≤30x30 (m²)",qte:1.05,unite:"m²",prixAchat:17.0},{designation:"Mortier-colle C2",qte:5.0,unite:"kg",prixAchat:0.65},{designation:"Joints ciment",qte:0.5,unite:"kg",prixAchat:1.2}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:0.5}]},
  {code:"CAR-002",corps:"Carrelage",libelle:"Carrelage sol 60x60 grès cérame (fourniture + pose)",unite:"m²",moMin:22.0,moMoy:30.0,moMax:42.0,fournMin:18.0,fournMoy:25.0,fournMax:35.0,tempsMO:1.1,detail:"Carrelage 60x60 fourni + ciment-colle flex C2S1 + joints époxy. Pose calepinée, plinthes assorties.",source:"Artiprix 2025",composants:[{designation:"Carrelage 60x60 grès cérame (m²)",qte:1.05,unite:"m²",prixAchat:15.5},{designation:"Ciment-colle flex C2S1",qte:6.0,unite:"kg",prixAchat:0.85},{designation:"Joints époxy",qte:0.8,unite:"kg",prixAchat:4.5}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"CAR-003",corps:"Carrelage",libelle:"Carrelage grand format 80x80 à 120x120 (fourniture + pose)",unite:"m²",moMin:30.0,moMoy:42.0,moMax:58.0,fournMin:22.0,fournMoy:32.0,fournMax:45.0,tempsMO:1.3,detail:"Carrelage grand format fourni + colle flex C2S1 + joints. Double encollage, calepinage soigné.",source:"Artiprix 2025",composants:[{designation:"Carrelage grand format 80x80 ou 120x120 (m²)",qte:1.05,unite:"m²",prixAchat:17.0},{designation:"Colle C2S1 immersion",qte:7.0,unite:"kg",prixAchat:1.1},{designation:"Joints hydrofuges",qte:1.0,unite:"kg",prixAchat:6.5}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"CAR-004",corps:"Carrelage",libelle:"Faïence murale ≤20x30 (fourniture + pose)",unite:"m²",moMin:20.0,moMoy:28.0,moMax:38.0,fournMin:12.0,fournMoy:18.0,fournMax:26.0,tempsMO:0.8,detail:"Faïence murale fournie + colle blanche carreleur + joints. Calepinage régulier, finitions soignées.",source:"Batiprix 2025",composants:[{designation:"Faïence murale ≤20x30 (m²)",qte:1.05,unite:"m²",prixAchat:13.0},{designation:"Colle blanche carreleur",qte:5.0,unite:"kg",prixAchat:0.7},{designation:"Joints ciment ou époxy",qte:0.3,unite:"kg",prixAchat:1.2}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"CAR-005",corps:"Carrelage",libelle:"Carrelage piscine immersion (fourniture + pose)",unite:"m²",moMin:35.0,moMoy:48.0,moMax:65.0,fournMin:28.0,fournMoy:38.0,fournMax:52.0,tempsMO:1.4,detail:"Carrelage spécial piscine fourni + colle C2S1 immersion + joints hydrofuges chlorés. Double encollage.",source:"Batiprix 2025",composants:[{designation:"Carrelage piscine grès cérame antidérapant",qte:1.05,unite:"m²",prixAchat:22.0},{designation:"Colle C2S1 immersion",qte:7.0,unite:"kg",prixAchat:1.1},{designation:"Joints hydrofuges chlorés",qte:1.0,unite:"kg",prixAchat:6.5}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"CAR-006",corps:"Carrelage",libelle:"Chape mortier ciment + cunette (fourniture + pose)",unite:"m²",moMin:10.0,moMoy:15.0,moMax:22.0,fournMin:8.0,fournMoy:12.0,fournMax:18.0,tempsMO:0.5,detail:"Ciment + sable + fibres fournis. Chape 5cm, règle, cunette évacuation, finition lissée.",source:"Artiprix 2025",composants:[{designation:"Ciment 32.5R sac 35kg",qte:0.8,unite:"sac",prixAchat:9.5},{designation:"Sable de chape 0/4",qte:0.06,unite:"m³",prixAchat:42.0},{designation:"Fibres polypropylène + treillis",qte:1,unite:"U",prixAchat:1.0}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"CAR-007",corps:"Carrelage",libelle:"Ragréage extérieur fibré P3 (fourniture + pose)",unite:"m²",moMin:6.0,moMoy:10.0,moMax:15.0,fournMin:6.0,fournMoy:10.0,fournMax:15.0,tempsMO:0.3,detail:"Ragréage P3 fibré + primaire d'accrochage + treillis fibre verre. Auto-lissant extérieur.",source:"Batiprix 2025",composants:[{designation:"Ragréage fibré P3 extérieur",qte:5.0,unite:"kg",prixAchat:1.5},{designation:"Primaire d'accrochage extérieur",qte:0.15,unite:"L",prixAchat:6.0},{designation:"Treillis fibre de verre",qte:1.05,unite:"m²",prixAchat:1.0}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"CAR-008",corps:"Carrelage",libelle:"Margelle piscine (fourniture + pose)",unite:"ml",moMin:18.0,moMoy:25.0,moMax:35.0,fournMin:18.0,fournMoy:24.0,fournMax:32.0,tempsMO:0.7,detail:"Margelle pierre reconstituée fournie + mortier de pose hydrofuge + joints. Mise à niveau, finitions.",source:"Artiprix 2025",composants:[{designation:"Margelle pierre reconstituée 30cm",qte:1.05,unite:"ml",prixAchat:18.0},{designation:"Mortier de pose hydrofuge",qte:3.0,unite:"kg",prixAchat:0.85},{designation:"Joints hydrofuges + bâton silicone",qte:1,unite:"U",prixAchat:2.5}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"CAR-009",corps:"Carrelage",libelle:"Revêtement PVC sol collé (fourniture + pose)",unite:"m²",moMin:8.0,moMoy:12.0,moMax:18.0,fournMin:10.0,fournMoy:15.0,fournMax:22.0,tempsMO:0.4,detail:"PVC 2mm fourni + colle acrylique + cordon de soudure à chaud. Ragréage si besoin (en sus).",source:"Batiprix 2025",composants:[{designation:"Sol PVC 2mm collé (m²)",qte:1.05,unite:"m²",prixAchat:11.0},{designation:"Colle acrylique sol PVC",qte:0.3,unite:"L",prixAchat:6.5},{designation:"Cordon de soudure PVC",qte:1.0,unite:"ml",prixAchat:1.5}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"CAR-010",corps:"Carrelage",libelle:"Parquet flottant collé (fourniture + pose)",unite:"m²",moMin:10.0,moMoy:15.0,moMax:22.0,fournMin:18.0,fournMoy:28.0,fournMax:40.0,tempsMO:0.5,detail:"Parquet flottant 12mm fourni + sous-couche acoustique + colle PU + plinthes. Pose collée intégrale.",source:"Artiprix 2025",composants:[{designation:"Parquet flottant chêne 12mm (m²)",qte:1.05,unite:"m²",prixAchat:22.0},{designation:"Sous-couche acoustique parquet",qte:1.05,unite:"m²",prixAchat:1.5},{designation:"Colle parquet PU",qte:0.4,unite:"L",prixAchat:7.0},{designation:"Plinthes assorties",qte:0.4,unite:"ml",prixAchat:4.5}],affectations:[{q:"qualifie",nb:1.0}]},
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
  {code:"PEI-003",corps:"Peinture",libelle:"Enduit façade soubassement + solin (fourniture + pose)",unite:"ml",moMin:18.0,moMoy:26.0,moMax:36.0,fournMin:18.0,fournMoy:28.0,fournMax:38.0,tempsMO:0.7,detail:"Baguette solin alu + primaire + enduit monocouche + mortier de scellement. Pose, nettoyage final.",source:"Batiprix 2025",composants:[{designation:"Baguette solin alu 50mm",qte:1.05,unite:"ml",prixAchat:12.0},{designation:"Primaire d'accrochage façade",qte:0.15,unite:"L",prixAchat:6.0},{designation:"Enduit monocouche grainé",qte:12.0,unite:"kg",prixAchat:0.55},{designation:"Mortier de scellement hydrofuge",qte:3.0,unite:"kg",prixAchat:1.0},{designation:"Filasse + bavette plomb",qte:1,unite:"U",prixAchat:5.0}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-004",corps:"Peinture",libelle:"ITE polystyrène 100mm + enduit silicate (fourniture + pose)",unite:"m²",moMin:20.0,moMoy:30.0,moMax:42.0,fournMin:40.0,fournMoy:58.0,fournMax:78.0,tempsMO:0.9,detail:"PSE graphite 100mm fourni + colle + chevilles + treillis fibre verre + enduit marouflage + finition silicate.",source:"Batiprix 2025",composants:[{designation:"PSE 100mm graphite ITE (m²)",qte:1.05,unite:"m²",prixAchat:22.0},{designation:"Colle PSE poudre",qte:6.0,unite:"kg",prixAchat:1.2},{designation:"Chevilles à vis ITE 110mm",qte:6,unite:"U",prixAchat:0.6},{designation:"Treillis fibre de verre 160g/m²",qte:1.1,unite:"m²",prixAchat:2.5},{designation:"Enduit de marouflage",qte:5.0,unite:"kg",prixAchat:1.4},{designation:"Enduit de finition silicate",qte:3.5,unite:"kg",prixAchat:2.5},{designation:"Profilé PVC angles + arrêts",qte:0.3,unite:"ml",prixAchat:4.0}],affectations:[{q:"qualifie",nb:1.0},{q:"manoeuvre",nb:1.0}]},
  {code:"PEI-005",corps:"Peinture",libelle:"Peinture intérieure murs 2 couches (fourniture + pose)",unite:"m²",moMin:6.0,moMoy:10.0,moMax:15.0,fournMin:4.0,fournMoy:8.0,fournMax:12.0,tempsMO:0.25,detail:"Peinture vinylique mate + sous-couche d'impression + enduit de rebouchage. Protection sol, ruban, ponçage.",source:"Artiprix 2025",composants:[{designation:"Peinture vinylique mate lessivable",qte:0.3,unite:"L",prixAchat:14.0},{designation:"Sous-couche d'impression",qte:0.12,unite:"L",prixAchat:9.0},{designation:"Enduit de rebouchage prêt à l'emploi",qte:0.1,unite:"kg",prixAchat:3.5},{designation:"Ruban + bâche + papier ponce",qte:1,unite:"U",prixAchat:1.5}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-006",corps:"Peinture",libelle:"Peinture intérieure plafond (fourniture + pose)",unite:"m²",moMin:8.0,moMoy:13.0,moMax:18.0,fournMin:4.0,fournMoy:8.0,fournMax:12.0,tempsMO:0.3,detail:"Peinture plafond blanche + sous-couche + protection. Impression + 2 couches sans trace.",source:"Artiprix 2025",composants:[{designation:"Peinture plafond blanche acrylique mate",qte:0.35,unite:"L",prixAchat:15.0},{designation:"Sous-couche d'impression plafond",qte:0.12,unite:"L",prixAchat:9.0},{designation:"Bâche de protection sol",qte:1.1,unite:"m²",prixAchat:0.5},{designation:"Ruban de masquage 50mm",qte:0.5,unite:"ml",prixAchat:0.8}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-007",corps:"Peinture",libelle:"Enduit de lissage intérieur (fourniture + pose)",unite:"m²",moMin:5.0,moMoy:8.0,moMax:12.0,fournMin:3.0,fournMoy:6.0,fournMax:10.0,tempsMO:0.2,detail:"Enduit de lissage prêt à l'emploi + apprêt léger + papier abrasif. Application + ponçage dépoussiérage.",source:"Batiprix 2025",composants:[{designation:"Enduit de lissage prêt à l'emploi",qte:1.5,unite:"kg",prixAchat:2.8},{designation:"Papier abrasif grain 120-180",qte:0.3,unite:"U",prixAchat:1.5},{designation:"Apprêt léger",qte:0.05,unite:"L",prixAchat:8.0},{designation:"Bâche + ruban masquage",qte:1,unite:"U",prixAchat:0.8}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-008",corps:"Peinture",libelle:"Enduit décoratif à la chaux (fourniture + pose)",unite:"m²",moMin:14.0,moMoy:20.0,moMax:30.0,fournMin:12.0,fournMoy:18.0,fournMax:26.0,tempsMO:0.6,detail:"Chaux aérienne CL90 + sable fin + pigments + apprêt fixateur + cire de finition. Gobetis + 2 passes talochées.",source:"Artiprix 2025",composants:[{designation:"Chaux aérienne CL90 sac 25kg",qte:0.4,unite:"sac",prixAchat:22.0},{designation:"Sable fin lavé 0/2",qte:0.015,unite:"m³",prixAchat:65.0},{designation:"Pigments terre naturels",qte:0.3,unite:"kg",prixAchat:14.0},{designation:"Apprêt fixateur chaux",qte:0.1,unite:"L",prixAchat:11.0},{designation:"Cire / finition à la chaux",qte:0.06,unite:"kg",prixAchat:32.0}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-009",corps:"Peinture",libelle:"Béton ciré murs / sols (fourniture + pose)",unite:"m²",moMin:18.0,moMoy:28.0,moMax:40.0,fournMin:20.0,fournMoy:30.0,fournMax:42.0,tempsMO:0.8,detail:"Béton ciré bi-composant + apprêt accroche + vernis PU bi-composant + tampons polish. 3 passes + finition.",source:"Artiprix 2025",composants:[{designation:"Béton ciré bi-composant kit",qte:1.2,unite:"kg",prixAchat:18.0},{designation:"Apprêt accroche",qte:0.15,unite:"L",prixAchat:14.0},{designation:"Vernis de protection PU bi-composant",qte:0.1,unite:"L",prixAchat:42.0},{designation:"Tampons polish + microfibre",qte:1,unite:"U",prixAchat:2.0}],affectations:[{q:"qualifie",nb:1.0}]},
  {code:"PEI-010",corps:"Peinture",libelle:"Peinture glycéro boiseries/fenêtres (fourniture + pose)",unite:"m²",moMin:12.0,moMoy:18.0,moMax:26.0,fournMin:6.0,fournMoy:10.0,fournMax:15.0,tempsMO:0.5,detail:"Glycéro satinée + impression universelle bois + papier abrasif + ruban haute tenue. Ponçage + 2 couches.",source:"Batiprix 2025",composants:[{designation:"Peinture glycéro satinée bois",qte:0.25,unite:"L",prixAchat:22.0},{designation:"Impression universelle bois",qte:0.12,unite:"L",prixAchat:14.0},{designation:"Papier abrasif + tampons",qte:0.5,unite:"U",prixAchat:2.0},{designation:"Ruban de masquage haute tenue",qte:0.5,unite:"ml",prixAchat:1.5}],affectations:[{q:"qualifie",nb:1.0}]},
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
  role:"patron", // "patron" | "ouvrier" — défini en base
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
// Une ligne est dans une OPTION si elle suit un header type:"option" et n'a
// pas été terminée par un titre suivant. Les options sont des prestations
// facultatives — exclues du total de base, ajoutées si acceptées.
function calcDocSubtotals(items){
  const titreSubs=new Map(),sousTitreSubs=new Map(),optionSubs=new Map();
  let curTitre=null,curSousTitre=null,curOption=null;
  for(const it of items||[]){
    if(it.type==="titre"){curTitre=it.id;curSousTitre=null;curOption=null;if(!titreSubs.has(it.id))titreSubs.set(it.id,0);}
    else if(it.type==="soustitre"){curSousTitre=it.id;if(!sousTitreSubs.has(it.id))sousTitreSubs.set(it.id,0);}
    else if(it.type==="option"){curOption=it.id;curSousTitre=null;if(!optionSubs.has(it.id))optionSubs.set(it.id,0);}
    else{
      const ht=(+it.qte||0)*(+it.prixUnitHT||0);
      if(curOption!=null){
        optionSubs.set(curOption,(optionSubs.get(curOption)||0)+ht);
      }else{
        if(curTitre!=null)titreSubs.set(curTitre,(titreSubs.get(curTitre)||0)+ht);
        if(curSousTitre!=null)sousTitreSubs.set(curSousTitre,(sousTitreSubs.get(curSousTitre)||0)+ht);
      }
    }
  }
  return{titreSubs,sousTitreSubs,optionSubs};
}
// Marque chaque ligne avec son option parente (si elle est dans un bloc OPTION).
// Renvoie une Map ligneId -> optionId. Les lignes hors option sont absentes.
function ligneToOptionMap(items){
  const m=new Map();
  let cur=null;
  for(const it of items||[]){
    if(it.type==="titre"){cur=null;continue;}
    if(it.type==="option"){cur=it.id;continue;}
    if(isLigneDevis(it)&&cur!=null)m.set(it.id,cur);
  }
  return m;
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
    if(heures<=0)console.warn(`[devisVersChantier] Titre "${t.libelle||t.id}" sans heuresPrevues sur ses lignes → durée fallback 7j. Vérifie l'estimation IA ou complète manuellement.`);
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
  const {qte,prixUnitHT,libelle}=ligne;
  const montantHT=qte*prixUnitHT;
  if(!montantHT||montantHT<0)return null;

  const rend=detectRendement(libelle||"");

  // MO : heures × taux moyen chargé. heuresPrevues est PAR UNITÉ (cf. prompt
  // IA), donc on multiplie par qte. Fallback rend.h aussi par unité.
  const hTotal=ligne.heuresPrevues>0?ligne.heuresPrevues*qte:rend.h*qte*rend.nb;
  const nbOuv=+ligne.nbOuvriers>0?+ligne.nbOuvriers:rend.nb;
  // Taux MO chargé : ligne.tauxHoraireMoyen si défini (pick salarié ou IA),
  // sinon défaut national.
  const tauxMOCharge=(+ligne.tauxHoraireMoyen)>0
    ?+ligne.tauxHoraireMoyen
    :TAUX_MO_MOYEN*(1+CHARGES_PATRON);
  const coutMO=hTotal*tauxMOCharge;
  // Fournitures : override € total prioritaire (cas user a saisi un montant
  // dans le panneau calc), sinon somme des fournitures détaillées × qte,
  // sinon ratio rendement × HT.
  let coutFourn,tauxFournPct;
  if(ligne.coutFournOverride!=null&&+ligne.coutFournOverride>=0){
    coutFourn=+ligne.coutFournOverride;
    tauxFournPct=montantHT>0?Math.round(coutFourn/montantHT*100):0;
  }else{
    const coutFournParUnite=ligne.fournitures?.length>0
      ? ligne.fournitures.reduce((a,f)=>a+(+(f.prixVente||f.prixAchat||0)*(+(f.qte||1))),0)
      : 0;
    coutFourn=ligne.fournitures?.length>0
      ? coutFournParUnite*qte
      : montantHT*rend.fourn_pct;
    tauxFournPct=montantHT>0?Math.round(coutFourn/montantHT*100):Math.round(rend.fourn_pct*100);
  }
  // Frais généraux : override % prioritaire, sinon tauxCharges du statut juridique
  const tauxFG=ligne.tauxFGOverride!=null?+ligne.tauxFGOverride/100:(s?.tauxCharges||0.45);
  const fraisGeneraux=coutMO*tauxFG;

  // Prix de revient
  const prixRevient = coutMO+coutFourn+fraisGeneraux;

  // Marge
  const marge = montantHT-prixRevient;
  const tauxMarge = montantHT>0?Math.round((marge/montantHT)*100):0;

  // Coefficient de vente
  const coeff = prixRevient>0?Math.round((montantHT/prixRevient)*100)/100:0;

  return{
    montantHT,coutMO,tauxMOCharge:+tauxMOCharge.toFixed(2),
    hTotal:Math.round(hTotal*10)/10,nbOuv,
    coutFourn,fraisGeneraux,prixRevient,marge,tauxMarge,coeff,
    tauxFournPct,tauxFGPct:Math.round(tauxFG*100),
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
const STATUTS_DEVIS=["brouillon","envoyé","en attente","en attente signature","accepté","signé","refusé"];
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
// Tables dont la colonne `id` est de type UUID côté Supabase. Pour celles-là
// on filtre toute entrée locale dont l'id n'est pas un UUID valide (ex.
// timestamp Date.now() hérité d'un ancien build). Sinon l'upsert plante avec
// 22P02 'invalid input syntax for type uuid'.
const UUID_TABLES=new Set(["salaries","soustraitants"]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function useSupaSync(table,items,supaReady,authUser,supaSkipRef,extraColumnsFn){
  useEffect(()=>{
    if(!supaReady||!supabase||!authUser)return;
    if(supaSkipRef.current[table]>0){supaSkipRef.current[table]--;return;}
    const t=setTimeout(async()=>{
      try{
        // Pour les tables UUID, on skip silencieusement les items aux ids
        // invalides (héritage local non migré). Refresh = heal automatique.
        let cleanItems=items;
        if(UUID_TABLES.has(table)){
          cleanItems=items.filter(it=>{
            const ok=UUID_RE.test(String(it?.id||""));
            if(!ok)console.warn(`[supa ${table}] skip non-UUID id:`,it?.id);
            return ok;
          });
        }
        const ids=cleanItems.map(it=>it.id).filter(x=>x!=null);
        if(cleanItems.length>0){
          // extraColumnsFn(item?) : renvoie les colonnes natives à injecter dans
          // le row à uploader. Appelée :
          //   - SANS arg → vérification globale (deps prêtes ?). Si null, skip.
          //   - AVEC arg → spécifique à chaque ligne (ex: hoister 'nom' NOT NULL
          //     depuis data.nom). Permet de gérer les schémas prod qui ont
          //     plusieurs colonnes NOT NULL au top-level (entreprise_id, nom…).
          const checkExtra=extraColumnsFn?extraColumnsFn():undefined;
          if(extraColumnsFn&&checkExtra==null){
            console.warn(`[supa ${table}] extraColumnsFn a renvoyé null — sync différé jusqu'à ce que les colonnes requises soient disponibles`);
            return;
          }
          const rows=cleanItems.map(it=>{
            const id=it.id??(Date.now()+Math.floor(Math.random()*1000));
            const extra=extraColumnsFn?extraColumnsFn(it):undefined;
            return{id,user_id:authUser.id,data:{...it,id},...(extra||{})};
          });
          // Diagnostic : log compact du payload activable manuellement
          // (window.__cp_debug_supa__ = true en console).
          if(typeof window!=="undefined"&&window.__cp_debug_supa__){
            console.info(`[supa ${table}] upsert payload (${rows.length} rows):`,rows.map(r=>{
              const{data:_d,...rest}=r;return rest;
            }));
          }
          const{error:upErr}=await supabase.from(table).upsert(rows,{onConflict:"user_id,id"});
          if(upErr){
            console.warn(`[supa ${table} upsert]`,upErr.message,"| code:",upErr.code);
            // Auto-diagnostic : sur 23502 (NOT NULL violation), on log le
            // payload qui a échoué pour que le dev voie quelle colonne est
            // attendue mais absente. Sans data jsonb pour rester lisible.
            if(upErr.code==="23502"){
              console.warn(`[supa ${table}] 23502 NOT NULL — payload envoyé :`,
                rows.slice(0,3).map(r=>{const{data:_d,...rest}=r;return rest;}),
                rows.length>3?`… (+${rows.length-3} autres rows)`:"");
            }
            try{window.dispatchEvent(new CustomEvent("cp-supa-error",{detail:{table,op:"upsert",msg:upErr.message,code:upErr.code}}));}catch{}
            return;
          }
        }
        // ⚠ DELETE défensif : si items=[] localement, on NE supprime PAS tout
        // côté Supabase. Risque sinon : un état transitoire (init, data load
        // race condition) avec items=[] déclencherait DELETE FROM table WHERE
        // user_id=auth.uid() SANS filtre — tous les devis du user perdus.
        // Trade-off : si l'user supprime véritablement tous ses items, ils
        // restent en DB jusqu'au prochain ajout (puis re-sync diff). Acceptable.
        if(ids.length>0){
          const{error:delErr}=await supabase.from(table)
            .delete().eq("user_id",authUser.id)
            .not("id","in",`(${ids.join(",")})`);
          if(delErr){
            console.warn(`[supa ${table} delete]`,delErr.message,"| code:",delErr.code);
            try{window.dispatchEvent(new CustomEvent("cp-supa-error",{detail:{table,op:"delete",msg:delErr.message,code:delErr.code}}));}catch{}
          }
        }
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
        <button key={t.id} onClick={()=>onChange(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:"9px 14px",fontSize:12,fontWeight:active===t.id?700:500,color:active===t.id?L.accent:L.textSm,borderBottom:active===t.id?`2px solid ${L.accent}`:"2px solid transparent",marginBottom:-1,transition:"all .15s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit",position:"relative"}}>
          {t.icon&&<span>{t.icon}</span>}{t.label}
          {t.badge&&<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:L.red,marginLeft:4}}/>}
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
function Onboarding({onComplete,onLogin}){
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
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:3}}>Configurez votre espace ou connectez-vous</div>
          {onLogin&&(
            <button onClick={onLogin} style={{marginTop:12,padding:"8px 18px",background:"rgba(255,255,255,0.12)",color:"#fff",border:"1px solid rgba(255,255,255,0.35)",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(4px)"}}>🔐 J'ai déjà un compte — me connecter</button>
          )}
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
// ─── Cloche notifications (mode discret — pas d'onglet dédié) ───────────────
// Affichée dans le header de la sidebar. Click → dropdown listant les notifs
// non lues, avec mark-as-read et archive. Polling 60s + refresh callback à
// chaque action utilisateur (geré côté App).
function NotifsBell({unreadCount,onChangeRead,compact=false}){
  const [open,setOpen]=useState(false);
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const containerRef=useRef(null);

  async function loadNotifs(){
    if(!supabase)return;
    setLoading(true);
    const{data}=await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(15);
    setItems(data||[]);
    setLoading(false);
  }
  // Charge à l'ouverture du dropdown
  useEffect(()=>{
    if(open)loadNotifs();
  },[open]);
  // Click outside fermeture
  useEffect(()=>{
    if(!open)return;
    function onClick(e){if(containerRef.current&&!containerRef.current.contains(e.target))setOpen(false);}
    document.addEventListener("mousedown",onClick);
    return()=>document.removeEventListener("mousedown",onClick);
  },[open]);

  async function markRead(id){
    if(!supabase)return;
    setItems(its=>its.map(n=>n.id===id?{...n,lu:true}:n));
    await supabase.from("notifications").update({lu:true}).eq("id",id);
    onChangeRead?.();
  }
  async function dismiss(id){
    if(!supabase)return;
    setItems(its=>its.filter(n=>n.id!==id));
    await supabase.from("notifications").delete().eq("id",id);
    onChangeRead?.();
  }
  async function markAllRead(){
    if(!supabase)return;
    const ids=items.filter(n=>!n.lu).map(n=>n.id);
    if(ids.length===0)return;
    setItems(its=>its.map(n=>({...n,lu:true})));
    await supabase.from("notifications").update({lu:true}).in("id",ids);
    onChangeRead?.();
  }

  const cfgByType={
    info:{color:"#2563EB",bg:"#DBEAFE",icon:"ℹ️"},
    warning:{color:"#D97706",bg:"#FEF3C7",icon:"⚠️"},
    urgent:{color:"#DC2626",bg:"#FEE2E2",icon:"🚨"},
    success:{color:"#16A34A",bg:"#D1FAE5",icon:"✅"},
  };

  return(
    <div ref={containerRef} style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setOpen(o=>!o)} title={`Notifications${unreadCount>0?` (${unreadCount} non lue${unreadCount>1?"s":""})`:""}`} aria-label="Notifications"
        style={{
          width:compact?32:34,height:compact?32:34,borderRadius:8,
          background:open?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.06)",
          border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",
          color:"#fff",fontSize:compact?15:16,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontFamily:"inherit",position:"relative",flexShrink:0,
        }}>
        🔔
        {unreadCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#DC2626",color:"#fff",fontSize:9,fontWeight:800,borderRadius:8,minWidth:16,height:16,padding:"0 4px",display:"inline-flex",alignItems:"center",justifyContent:"center",border:"1.5px solid #1B3A5C",lineHeight:1}}>{unreadCount>99?"99+":unreadCount}</span>}
      </button>
      {open&&(
        <div style={{
          position:"absolute",
          // En desktop la sidebar a un width fixe — on déborde à droite.
          // En mobile compact, l'icône est étroite, on ouvre vers la droite.
          top:"calc(100% + 6px)",
          left:compact?"100%":0,
          marginLeft:compact?6:0,
          width:340,
          maxWidth:"calc(100vw - 28px)",
          maxHeight:"min(70vh,500px)",
          background:"#fff",
          borderRadius:10,
          boxShadow:"0 12px 36px rgba(0,0,0,0.25)",
          border:"1px solid #E5E7EB",
          color:"#1E293B",
          zIndex:3000,
          display:"flex",flexDirection:"column",
          overflow:"hidden",
        }}>
          <div style={{padding:"10px 14px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
            <div style={{fontSize:13,fontWeight:700,color:"#1B3A5C"}}>🔔 Alertes {unreadCount>0&&<span style={{fontSize:10,fontWeight:600,color:"#DC2626",marginLeft:4}}>· {unreadCount} non lue{unreadCount>1?"s":""}</span>}</div>
            {unreadCount>0&&<button onClick={markAllRead} style={{background:"transparent",border:"none",color:"#16A34A",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Tout marquer lu</button>}
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {loading?(
              <div style={{padding:18,textAlign:"center",color:"#64748B",fontSize:12}}>Chargement…</div>
            ):items.length===0?(
              <div style={{padding:24,textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:6}}>✨</div>
                <div style={{fontSize:13,fontWeight:600,color:"#1E293B",marginBottom:2}}>Aucune alerte</div>
                <div style={{fontSize:11,color:"#64748B",lineHeight:1.4}}>Les agents IA tournent en arrière-plan et te préviendront ici en cas de besoin.</div>
              </div>
            ):items.map(n=>{
              const c=cfgByType[n.type]||cfgByType.info;
              return(
                <div key={n.id} style={{padding:"10px 14px",borderBottom:"1px solid #F1F5F9",borderLeft:`3px solid ${c.color}`,opacity:n.lu?0.55:1,background:n.lu?"#FAFBFC":"#fff"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap",marginBottom:3}}>
                    <span style={{fontSize:10,fontWeight:700,color:c.color,textTransform:"uppercase",letterSpacing:0.4}}>{c.icon} {n.agent_id||"agent"}</span>
                    {!n.lu&&<span style={{background:"#DC2626",color:"#fff",fontSize:8,fontWeight:800,borderRadius:6,padding:"1px 5px"}}>NEW</span>}
                    <span style={{fontSize:9,color:"#94A3B8",marginLeft:"auto"}}>{new Date(n.created_at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:"#1E293B",marginBottom:2}}>{n.titre}</div>
                  <div style={{fontSize:11,color:"#64748B",lineHeight:1.45,marginBottom:6}}>{n.message}</div>
                  <div style={{display:"flex",gap:5}}>
                    {!n.lu&&<button onClick={()=>markRead(n.id)} style={{padding:"3px 8px",border:"1px solid #E5E7EB",borderRadius:4,background:"#fff",color:"#475569",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓ Lu</button>}
                    <button onClick={()=>dismiss(n.id)} style={{padding:"3px 8px",border:"1px solid #DC262633",borderRadius:4,background:"transparent",color:"#DC2626",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✕ Archiver</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({modules,active,onNav,entreprise,statut,onSettings,onDevisRapide,compact,terrainUnread=0,wizardStep=5,onOpenWizard,agentsUnread=0,onChangeNotifsRead}){
  const grouped={};
  modules.forEach(m=>{const cfg=NAV_CONFIG[m];if(!cfg)return;if(!grouped[cfg.group])grouped[cfg.group]=[];grouped[cfg.group].push({id:m,...cfg});});
  const s=STATUTS[statut];
  // Mobile : sidebar 52px icônes seules + drawer overlay 240px ouvert par hamburger.
  // Desktop : sidebar 205px classique avec labels inline.
  const [drawerOpen,setDrawerOpen]=useState(false);
  const compactW=52,drawerW=240,desktopW=205;
  // Mode "tight" (iPhone paysage / écran < 500px de haut) : icônes plus petites
  // pour faire tenir tous les modules sans scroll. Lecture directe — re-render
  // déclenché par useViewportSize() côté App.
  const winH=typeof window!=="undefined"?window.innerHeight:800;
  const tight=compact&&winH<560;
  // Badge wizard : visible tant que wizard_step < 9 (sentinelle 'done').
  // Étape 1 = Bienvenue → label simple 'Guide'. Étapes 2..8 → 'Guide X/7'
  // où X = wizardStep-1 (1..7 actionnables).
  const showWizardBadge=onOpenWizard&&wizardStep<9;
  const wizardLabel=wizardStep<=1?"Guide":`Guide ${Math.min(7,wizardStep-1)}/7`;
  const navBtnH=tight?34:44;
  const sideIconSize=tight?16:18;
  const hamburgerH=tight?38:46;
  const topBtnSize=tight?30:36;

  // Nav rendue en mode "labels visibles" (desktop ou drawer ouvert)
  function renderFullNav(closeOnClick){
    return Object.entries(grouped).map(([group,items])=>(
      <div key={group}>
        <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.2,padding:"7px 13px 2px"}}>{NAV_GROUPS[group]}</div>
        {items.map(item=>{
          const badgeCount=item.id==="terrain"?terrainUnread:0;
          const showBadge=badgeCount>0;
          return(
            <button key={item.id} onClick={()=>{onNav(item.id);if(closeOnClick)setDrawerOpen(false);}} title={showBadge?`${item.label} · ${badgeCount} non lue${badgeCount>1?"s":""}`:item.label}
              style={{width:"100%",background:active===item.id?"rgba(255,255,255,0.13)":"transparent",border:"none",cursor:"pointer",padding:"8px 13px",display:"flex",alignItems:"center",gap:9,color:active===item.id?"#fff":"rgba(255,255,255,0.62)",fontSize:12,fontWeight:active===item.id?600:400,textAlign:"left",borderLeft:active===item.id?`3px solid ${L.accent}`:"3px solid transparent",fontFamily:"inherit",position:"relative"}}>
              <span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center",position:"relative"}}>
                {item.icon}
                {showBadge&&<span style={{position:"absolute",top:-3,right:-5,background:L.red,color:"#fff",fontSize:8,fontWeight:800,borderRadius:8,minWidth:14,height:14,padding:"0 3px",display:"inline-flex",alignItems:"center",justifyContent:"center",border:"1.5px solid "+L.navy,lineHeight:1}}>{badgeCount}</span>}
              </span>
              <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{item.label}</span>
            </button>
          );
        })}
      </div>
    ));
  }

  // Nav rendue en mode 52px (icônes seules, tooltips natifs)
  function renderCompactNav(){
    const allItems=Object.values(grouped).flat();
    return allItems.map(item=>{
      const badgeCount=item.id==="terrain"?terrainUnread:0;
      const showBadge=badgeCount>0;
      return(
        <button key={item.id} onClick={()=>onNav(item.id)} title={item.label}
          style={{width:compactW,height:navBtnH,background:active===item.id?"rgba(255,255,255,0.13)":"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:active===item.id?"#fff":"rgba(255,255,255,0.62)",borderLeft:active===item.id?`3px solid ${L.accent}`:"3px solid transparent",fontFamily:"inherit",position:"relative",flexShrink:0}}>
          <span style={{fontSize:sideIconSize,position:"relative"}}>
            {item.icon}
            {showBadge&&<span style={{position:"absolute",top:-5,right:-7,background:L.red,color:"#fff",fontSize:8,fontWeight:800,borderRadius:8,minWidth:14,height:14,padding:"0 3px",display:"inline-flex",alignItems:"center",justifyContent:"center",border:"1.5px solid "+L.navy,lineHeight:1}}>{badgeCount}</span>}
          </span>
        </button>
      );
    });
  }

  // ─── DESKTOP : sidebar classique 205px ─────────────
  if(!compact){
    return(
      <div style={{width:desktopW,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0,overflowY:"auto",overflowX:"hidden"}}>
        <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:-0.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entreprise.nomCourt||entreprise.nom}</div>
          </div>
          <NotifsBell unreadCount={agentsUnread} onChangeRead={onChangeNotifsRead}/>
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
        {onDevisRapide&&<div style={{padding:"10px 11px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <button onClick={onDevisRapide} title="Devis Rapide IA"
            style={{width:"100%",background:`linear-gradient(135deg,${L.accent},${L.purple})`,border:"none",borderRadius:8,padding:"8px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"inherit",boxShadow:"0 2px 6px rgba(232,98,10,0.3)"}}>
            <span style={{fontSize:14}}>⚡</span><span>Devis Rapide IA</span>
          </button>
        </div>}
        <div style={{flex:1,padding:"5px 0"}}>{renderFullNav(false)}</div>
        {showWizardBadge&&(
          <div style={{padding:"7px 11px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            <button onClick={onOpenWizard} title="Reprendre le guide d'introduction"
              style={{width:"100%",background:`linear-gradient(135deg,${L.accent}33,${L.purple}33)`,border:`1px solid ${L.accent}55`,borderRadius:8,padding:"7px 11px",cursor:"pointer",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"inherit"}}>
              <span style={{fontSize:13}}>🎯</span><span>{wizardLabel}</span>
            </button>
          </div>
        )}
        {onSettings&&<div style={{padding:"9px 11px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <button onClick={onSettings} title="Paramètres"
            style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 11px",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"inherit"}}>
            <span style={{fontSize:12}}>⚙️</span><span>Paramètres</span>
          </button>
        </div>}
      </div>
    );
  }

  // ─── MOBILE : sidebar 52px icônes + drawer overlay 240px ───
  // overflowY:auto garantit l'accès à tous les modules même si la barre dépasse
  // (iPhone paysage ≈ 390px). En mode "tight", on rétrécit aussi les boutons.
  return(<>
    <div style={{width:compactW,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",flexShrink:0,alignItems:"center",overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain"}}>
      {/* Hamburger en haut */}
      <button onClick={()=>setDrawerOpen(true)} title="Ouvrir le menu" aria-label="Ouvrir le menu"
        style={{width:compactW,height:hamburgerH,background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",color:"#fff",fontSize:tight?17:20,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0}}>☰</button>
      <div style={{margin:tight?"4px 0":"6px 0",flexShrink:0}}>
        <NotifsBell unreadCount={agentsUnread} onChangeRead={onChangeNotifsRead} compact/>
      </div>
      {onDevisRapide&&(
        <button onClick={onDevisRapide} title="Devis Rapide IA"
          style={{width:topBtnSize,height:topBtnSize,margin:tight?"5px 0":"8px 0",background:`linear-gradient(135deg,${L.accent},${L.purple})`,border:"none",borderRadius:8,cursor:"pointer",color:"#fff",fontSize:tight?13:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",boxShadow:"0 2px 6px rgba(232,98,10,0.3)",flexShrink:0}}>⚡</button>
      )}
      <div style={{flex:1,width:"100%",padding:tight?"2px 0":"4px 0",display:"flex",flexDirection:"column",alignItems:"center"}}>{renderCompactNav()}</div>
      {onSettings&&<button onClick={onSettings} title="Paramètres"
        style={{width:topBtnSize,height:topBtnSize,margin:tight?"5px 0":"8px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:tight?12:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0}}>⚙️</button>}
    </div>
    {/* Drawer overlay : backdrop + panneau coulissant 240px */}
    {drawerOpen&&(
      <div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1200,display:"flex"}}>
        <div onClick={e=>e.stopPropagation()} style={{width:drawerW,background:L.navy,display:"flex",flexDirection:"column",height:"100vh",overflowY:"auto",overflowX:"hidden",boxShadow:"4px 0 20px rgba(0,0,0,0.35)",animation:"cpDrawerSlide .18s ease-out"}}>
          <style>{`@keyframes cpDrawerSlide{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
          <div style={{padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:18,fontWeight:900,color:"#fff",letterSpacing:-0.4}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entreprise.nomCourt||entreprise.nom}</div>
            </div>
            <NotifsBell unreadCount={agentsUnread} onChangeRead={onChangeNotifsRead}/>
            <button onClick={()=>setDrawerOpen(false)} aria-label="Fermer le menu" style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:6,width:30,height:30,cursor:"pointer",color:"#fff",fontSize:16,fontFamily:"inherit"}}>✕</button>
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
          {onDevisRapide&&<div style={{padding:"10px 11px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
            <button onClick={()=>{onDevisRapide();setDrawerOpen(false);}} title="Devis Rapide IA"
              style={{width:"100%",background:`linear-gradient(135deg,${L.accent},${L.purple})`,border:"none",borderRadius:8,padding:"8px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"inherit",boxShadow:"0 2px 6px rgba(232,98,10,0.3)"}}>
              <span style={{fontSize:14}}>⚡</span><span>Devis Rapide IA</span>
            </button>
          </div>}
          <div style={{flex:1,padding:"5px 0"}}>{renderFullNav(true)}</div>
          {onSettings&&<div style={{padding:"9px 11px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
            <button onClick={()=>{onSettings();setDrawerOpen(false);}} title="Paramètres"
              style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 11px",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"inherit"}}>
              <span style={{fontSize:12}}>⚙️</span><span>Paramètres</span>
            </button>
          </div>}
        </div>
      </div>
    )}
  </>);
}


// ─── ACCUEIL ──────────────────────────────────────────────────────────────────
function Accueil({chantiers,docs,entreprise,statut,salaries,onNav,onSettings,onDevisRapide,terrainVisits={}}){
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
  // Activité terrain non lue (notifications patron)
  const terrainUnreadList=(chantiers||[]).filter(c=>chantierTerrainUnread(c,terrainVisits));
  return(
    <div>
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:20,fontWeight:800,color:L.text,margin:"0 0 4px",letterSpacing:-0.3}}>Tableau de bord 👋</h1>
        <p style={{fontSize:13,color:L.textSm,margin:0}}>{entreprise.nom} · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
      </div>
      {terrainUnreadList.length>0&&(
        <Card onClick={()=>onNav("terrain")} style={{padding:"12px 16px",marginBottom:18,background:L.redBg,border:`1px solid ${L.red}33`,cursor:"pointer",display:"flex",alignItems:"center",gap:11}}>
          <div style={{fontSize:24}}>🔔</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:L.red}}>Activité terrain : {terrainUnreadList.length} chantier{terrainUnreadList.length>1?"s":""} avec mises à jour récentes</div>
            <div style={{fontSize:11,color:L.textMd,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {terrainUnreadList.slice(0,3).map(c=>c.nom).join(" · ")}{terrainUnreadList.length>3?` · +${terrainUnreadList.length-3}`:""}
            </div>
          </div>
          <div style={{color:L.red,fontWeight:700,fontSize:18}}>→</div>
        </Card>
      )}
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
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:L.textMd,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}>{((c.nom||"").split("–")[0]||"").trim()}</span><span style={{fontWeight:700,color:mc2}}>{cc.tauxMarge}%</span></div>
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
              {[{icon:"🏗",label:(chantiers||[]).length>0?"Mes chantiers":"Ajouter un chantier",view:"chantiers",color:L.navy},{icon:"📄",label:"Nouveau devis",view:"devis",color:L.accent},{icon:"👷",label:"Équipe",view:"equipe",color:L.purple},{icon:"📅",label:"Planning",view:"planning",color:L.blue},{icon:"🤖",label:"Assistant IA",view:"assistant",color:L.teal},{icon:"💰",label:"Comptabilité",view:"compta",color:L.green}].filter(a=>s?.modules?.includes(a.view)).map(a=>(
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

function VueEquipe({salaries,setSalaries,sousTraitants,setSousTraitants,statut,chantiers=[],authUser}){
  const solo=isSoloStatut(statut);
  const [tab,setTab]=useState(solo?"soustraitants":"equipe");
  return(
    <div>
      <Tabs tabs={[
        {id:"equipe",icon:solo?"👤":"👷",label:solo?`Moi-même`:`Équipe (${salaries.length})`},
        {id:"soustraitants",icon:"🤝",label:`Sous-traitants (${(sousTraitants||[]).length})`}
      ]} active={tab} onChange={setTab}/>
      {tab==="equipe" && (solo
        ? <VueMoiMeme salaries={salaries} setSalaries={setSalaries}/>
        : <VueEquipeSalaries salaries={salaries} setSalaries={setSalaries} chantiers={chantiers} authUser={authUser}/>)}
      {tab==="soustraitants" && <VueSousTraitants sousTraitants={sousTraitants||[]} setSousTraitants={setSousTraitants}/>}
    </div>
  );
}

// ─── DASHBOARD PERFORMANCE OUVRIERS ─────────────────────────────────────────
// CA généré : pour chaque phase où l'ouvrier est assigné, sa quote-part =
// budgetHT phase / nb ouvriers sur la phase. Heures = dureeJours × 8h cumulées.
// Coût réel = heures × taux horaire chargé. Ratio = (CA − coût) / CA.
// Alertes : "prime" si ratio ≥ 35 %, "attention" si < 10 % (avec heures > 0).
function perfOuvrier(salId,salarie,chantiers){
  let totalHeures=0,totalCA=0;
  const chSet=new Set();
  for(const c of (chantiers||[])){
    let touched=false;
    for(const p of (c.planning||[])){
      if(!Array.isArray(p.salariesIds)||!p.salariesIds.includes(salId))continue;
      touched=true;
      totalHeures+=(+p.dureeJours||0)*8;
      const nbOuv=(p.salariesIds||[]).length||1;
      totalCA+=(+p.budgetHT||0)/nbOuv;
    }
    if(touched)chSet.add(c.nom||`#${c.id}`);
  }
  const tauxCharge=(+salarie.tauxHoraire||0)*(1+(+salarie.chargesPatron||0));
  const coutReel=totalHeures*tauxCharge;
  const marge=totalCA-coutReel;
  const ratio=totalCA>0?Math.round((marge/totalCA)*100):0;
  let alerte=null;
  if(totalHeures>0){
    if(ratio>=35)alerte="prime";
    else if(ratio<10)alerte="attention";
  }
  return{totalHeures,totalCA,coutReel,marge,ratio,alerte,chantiers:Array.from(chSet)};
}

// Mode solo (auto-entrepreneur / micro) : un seul "Moi-même" éditable, pas
// d'ajout de salariés possible. Affiche un message explicatif + le champ
// taux horaire + nom modifiables. Le profil "Moi-même" alimente Gantt et
// CreateurDevis comme un salarié interne classique.
function VueMoiMeme({salaries,setSalaries}){
  const moi=salaries.find(s=>s.isMoi)||salaries[0]||{id:1,nom:"Moi-même",poste:"Auto-entrepreneur",tauxHoraire:35,chargesPatron:0.22,couleur:"#16A34A",isMoi:true};
  const [form,setForm]=useState({...moi,tauxHoraire:String(moi.tauxHoraire||35),chargesPatron:String(moi.chargesPatron??0.22)});
  const [edit,setEdit]=useState(false);
  function save(){
    const updated={...moi,...form,id:moi.id,isMoi:true,tauxHoraire:parseFloat(form.tauxHoraire)||35,chargesPatron:parseFloat(form.chargesPatron)||0.22};
    setSalaries(ss=>{
      const idx=ss.findIndex(s=>s.isMoi||s.id===moi.id);
      if(idx<0)return [updated,...ss];
      const next=[...ss];next[idx]=updated;return next;
    });
    setEdit(false);
  }
  const tauxCharge=(parseFloat(form.tauxHoraire)||35)*(1+(parseFloat(form.chargesPatron)||0));
  return(
    <div>
      <PageH title="Moi-même" subtitle="Profil unique pour les statuts auto-entrepreneur / micro-entreprise"/>
      <Card style={{padding:14,marginBottom:14,background:L.greenBg,border:`1px solid ${L.green}33`}}>
        <div style={{display:"flex",gap:9,alignItems:"flex-start"}}>
          <span style={{fontSize:22}}>ℹ️</span>
          <div style={{fontSize:12,color:L.textMd,lineHeight:1.5}}>
            <strong style={{color:L.green}}>Statut auto-entrepreneur / micro-entreprise</strong> : vous ne pouvez pas embaucher de salariés. Vous pouvez en revanche collaborer avec autant de <strong>sous-traitants</strong> (entreprises externes) que nécessaire — onglet à côté.
          </div>
        </div>
      </Card>
      <Card style={{padding:18,maxWidth:540}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:(moi.couleur||"#16A34A")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:moi.couleur||"#16A34A",fontWeight:800,border:`2px solid ${moi.couleur||"#16A34A"}`}}>👤</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:L.text}}>{moi.nom||"Moi-même"}</div>
            <div style={{fontSize:11,color:L.textSm}}>{moi.poste||"Auto-entrepreneur"}</div>
          </div>
          {!edit&&<Btn onClick={()=>setEdit(true)} variant="primary" size="sm" icon="✏️">Modifier</Btn>}
        </div>
        {edit?(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div style={{gridColumn:"span 2"}}><Input label="Nom complet" value={form.nom||""} onChange={v=>setForm(f=>({...f,nom:v}))}/></div>
              <Input label="Spécialité / poste" value={form.poste||""} onChange={v=>setForm(f=>({...f,poste:v}))} placeholder="Maçon, plombier…"/>
              <Input label="Taux horaire" value={form.tauxHoraire} onChange={v=>setForm(f=>({...f,tauxHoraire:v}))} type="number" suffix="€/h"/>
              <Input label="Charges (% RSI/URSSAF)" value={form.chargesPatron} onChange={v=>setForm(f=>({...f,chargesPatron:v}))} type="number" hint="Ex: 0.22 = 22%"/>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Couleur (Gantt)</div>
                <input type="color" value={form.couleur||"#16A34A"} onChange={e=>setForm(f=>({...f,couleur:e.target.value}))} style={{width:42,height:32,border:"none",background:"transparent",cursor:"pointer",padding:0}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn onClick={()=>setEdit(false)} variant="secondary">Annuler</Btn>
              <Btn onClick={save} variant="success">✓ Enregistrer</Btn>
            </div>
          </>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {[
              ["Taux horaire",`${moi.tauxHoraire||35}€/h`,L.navy],
              ["Taux chargé",`${tauxCharge.toFixed(2)}€/h`,L.orange],
              ["Coût/jour (8h)",`${(tauxCharge*8).toFixed(2)}€`,L.accent],
              ["Charges",`${Math.round((moi.chargesPatron||0.22)*100)}%`,L.green],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:L.bg,borderRadius:6,padding:"8px 11px"}}><div style={{fontSize:9,color:L.textXs,marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div></div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function VueEquipeSalaries({salaries,setSalaries,chantiers=[],authUser}){
  const [showForm,setShowForm]=useState(false);
  const [showPerf,setShowPerf]=useState(true);
  const [editId,setEditId]=useState(null);
  const EMPTY={nom:"",poste:"",qualification:"qualifie",tauxHoraire:"",chargesPatron:"0.42",disponible:true,competences:"",couleur:"#2563EB",tel:"",email:"",adresse:""};
  const [form,setForm]=useState(EMPTY);
  const QUALS=[{v:"chef",l:"Chef chantier",c:L.accent},{v:"qualifie",l:"Qualifié",c:L.blue},{v:"manoeuvre",l:"Manœuvre",c:L.green}];
  function save(){if(!form.nom||!form.tauxHoraire)return;const newId=editId||(typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2));const sal={...form,id:newId,tauxHoraire:parseFloat(form.tauxHoraire)||0,chargesPatron:parseFloat(form.chargesPatron)||0.42,competences:form.competences?form.competences.split(",").map(x=>x.trim()).filter(Boolean):[],couleur:form.couleur||"#2563EB",tel:form.tel||"",email:form.email||"",adresse:form.adresse||""};if(editId)setSalaries(ss=>ss.map(s=>s.id===editId?sal:s));else setSalaries(ss=>[...ss,sal]);setForm(EMPTY);setEditId(null);setShowForm(false);}
  function edit(s){setForm({...s,tauxHoraire:String(s.tauxHoraire),chargesPatron:String(s.chargesPatron),competences:(s.competences||[]).join(", "),couleur:s.couleur||couleurSalarie(s),tel:s.tel||"",email:s.email||"",adresse:s.adresse||""});setEditId(s.id);setShowForm(true);}
  function setCouleurInline(id,couleur){setSalaries(ss=>ss.map(s=>s.id===id?{...s,couleur}:s));}
  // Invite l'ouvrier via /api/invite-ouvrier (Supabase Admin API). Si la
  // service_role n'est pas configurée côté Vercel (503), on bascule sur
  // un mailto pré-rempli pour ne pas bloquer l'utilisateur.
  async function inviterOuvrier(sal){
    if(!sal.email){alert("Cet ouvrier n'a pas d'email — modifie sa fiche pour l'ajouter.");return;}
    // ⚠ FIX race condition : on force-flush l'email du salarié en DB AVANT
    // d'envoyer l'invitation. Sinon useSupaSync attend 800ms de debounce et
    // l'ouvrier qui clique le lien tout de suite ne match pas (RPC retourne
    // null car la ligne salaries n'a pas encore l'email synchronisé).
    if(supabase&&authUser?.id){
      try{
        await supabase.from("salaries").upsert({
          user_id:authUser.id,
          id:sal.id,
          data:{...sal},
        },{onConflict:"user_id,id"});
        console.info("[CP] Salarié flushé en DB avant invitation :",sal.email);
      }catch(e){
        console.warn("[CP] Flush salarié échoué (l'invitation peut foirer) :",e.message);
      }
    }
    try{
      // redirectTo : Supabase ajoutera #access_token=...&type=invite au hash.
      // On part de window.location.origin (sans path/hash) pour que la nav
      // arrive sur la racine de l'app, où main.jsx capte le type=invite.
      const redirectTo=window.location.origin+"/";
      const r=await fetch("/api/invite-ouvrier",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email:sal.email,
          nom:sal.nom,
          redirectTo,
          patronUserId:authUser?.id||null,  // pour pré-créer la ligne entreprises ouvrier
          role:"ouvrier",
        }),
      });
      const data=await r.json().catch(()=>({}));
      console.log("[invite] response:",data);
      if(r.ok){
        // Distingue les 3 cas : invitation seule envoyée, pré-création OK, pré-création échouée
        if(data.entreprise_inserted){
          alert(`✓ Invitation envoyée + profil pré-créé\n\n${sal.nom||sal.email} va recevoir un email Supabase. À sa 1ʳᵉ connexion, son espace ouvrier s'ouvre automatiquement (role='ouvrier' pré-attribué).\n\nnewUserId : ${data.newUserId||"?"}\nrole : ${data.role||"?"}`);
        }else if(data.warning){
          // patronUserId manquant ou newUserId pas récupéré
          alert(`⚠ Invitation partielle\n\nL'email a été envoyé MAIS la ligne entreprises n'a pas été pré-créée :\n${data.warning}\n\nL'auto-match RPC tentera de basculer le rôle à la 1ʳᵉ connexion. Si ça échoue côté ouvrier, vérifier que la fiche salarié contient bien l'email exact.`);
        }else if(data.entreprise_error){
          // Upsert entreprises a planté
          const e=data.entreprise_error;
          alert(`⚠ Email d'invitation envoyé MAIS pré-création du profil ouvrier ÉCHOUÉE\n\nStatus : ${e.status}\nMessage : ${e.body}\n${e.hint?"\nHint : "+e.hint:""}\n\nnewUserId : ${data.newUserId||"?"}\npatron_user_id : ${data.patron_user_id||"?"}\npatron_profile_loaded : ${data.patron_profile_loaded?"oui":"non"}\n\nL'ouvrier verra "Aucune équipe trouvée" à sa connexion. Corrige l'erreur ci-dessus puis ré-invite.`);
        }else{
          alert(`✓ Invitation envoyée à ${sal.email}.\n\nRéponse partielle : ${JSON.stringify(data).slice(0,300)}`);
        }
        return;
      }
      // 503 = env vars manquantes côté Vercel
      if(r.status===503){
        const ok=window.confirm(
          `⚠️ Service d'invitation NON configuré côté serveur.\n\n`+
          `${data.hint||"Ajoute SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans Vercel → Settings → Environment Variables, puis redéploie."}\n\n`+
          `Diagnostic : SUPABASE_URL ${data.diagnostic?.supabaseUrl_present?"✓":"✗"} · SERVICE_ROLE_KEY ${data.diagnostic?.serviceKey_present?"✓":"✗"}\n\n`+
          `Veux-tu envoyer un email manuel à ${sal.email} en attendant ?`
        );
        if(ok){
          const subject=`Invitation ChantierPro`;
          const body=`Bonjour ${sal.nom},\n\nJe vous invite à utiliser ChantierPro.\n\nConnectez-vous sur ${window.location.origin}\nUtilisez cet email : ${sal.email}`;
          window.location.href=`mailto:${sal.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
        return;
      }
      // Autres erreurs : Supabase a répondu mais a refusé
      const errLines=[
        `❌ Échec invitation Supabase`,
        ``,
        `Status HTTP : ${r.status}`,
        `Erreur : ${data.error||data.msg||"(aucun message)"}`,
      ];
      if(data.supabase_status)errLines.push(`Supabase Auth : ${data.supabase_status}`);
      if(data.hint)errLines.push(``,`💡 ${data.hint}`);
      if(data.supabase_body)errLines.push(``,`Détails : ${JSON.stringify(data.supabase_body).slice(0,300)}`);
      alert(errLines.join("\n"));
    }catch(e){
      console.error("[invite] network error:",e);
      alert(`❌ Erreur réseau : ${e.message}`);
    }
  }
  const totalJ=salaries.reduce((a,s)=>a+s.tauxHoraire*(1+s.chargesPatron)*8,0);
  // Calcul performance par ouvrier
  const perfRows=salaries.map(s=>({sal:s,perf:perfOuvrier(s.id,s,chantiers)}));
  const totalCAEquipe=perfRows.reduce((a,r)=>a+r.perf.totalCA,0);
  const totalCoutEquipe=perfRows.reduce((a,r)=>a+r.perf.coutReel,0);
  const totalMargeEquipe=totalCAEquipe-totalCoutEquipe;
  const ratioEquipe=totalCAEquipe>0?Math.round((totalMargeEquipe/totalCAEquipe)*100):0;
  const nbPrimes=perfRows.filter(r=>r.perf.alerte==="prime").length;
  const nbAttention=perfRows.filter(r=>r.perf.alerte==="attention").length;
  return(
    <div>
      <PageH title="Équipe" subtitle={`${salaries.length} salarié${salaries.length>1?"s":""} · Coût journalier total : ${euro(totalJ)}`}
        actions={<Btn onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} variant="primary" icon="+">Ajouter</Btn>}/>

      {/* ─── DASHBOARD PERFORMANCE ──────────────────────────────────── */}
      {salaries.length>0&&(
        <Card style={{overflow:"hidden",marginBottom:18}}>
          <div style={{padding:"11px 14px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,cursor:"pointer"}} onClick={()=>setShowPerf(s=>!s)}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,fontWeight:700,color:L.text}}>📊 Performance par ouvrier</span>
              {nbPrimes>0&&<span style={{background:L.greenBg,color:L.green,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4}}>🏆 {nbPrimes} prime{nbPrimes>1?"s":""}</span>}
              {nbAttention>0&&<span style={{background:L.redBg,color:L.red,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4}}>⚠ {nbAttention} attention</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:11,color:L.textSm}}>CA équipe : <strong style={{color:L.navy,fontFamily:"monospace"}}>{euro(totalCAEquipe)}</strong></span>
              <span style={{fontSize:11,color:L.textSm}}>Coût : <strong style={{color:L.orange,fontFamily:"monospace"}}>{euro(totalCoutEquipe)}</strong></span>
              <span style={{fontSize:11,color:L.textSm}}>Marge : <strong style={{color:totalMargeEquipe>=0?L.green:L.red,fontFamily:"monospace"}}>{euro(totalMargeEquipe)} ({ratioEquipe}%)</strong></span>
              <span style={{fontSize:14,color:L.textXs}}>{showPerf?"▾":"▸"}</span>
            </div>
          </div>
          {showPerf&&(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:780}}>
                <thead><tr style={{background:L.bg}}>{["Ouvrier","Heures","Coût/h chargé","Coût total","CA généré","Marge","Ratio","Chantiers","Statut"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 11px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {perfRows.map(({sal,perf},i)=>{
                    const ratioC=perf.totalHeures===0?L.textXs:perf.ratio>=35?L.green:perf.ratio>=20?L.navy:perf.ratio>=10?L.orange:L.red;
                    const tauxCharge=(+sal.tauxHoraire||0)*(1+(+sal.chargesPatron||0));
                    return(
                      <tr key={sal.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                        <td style={{padding:"8px 11px",fontWeight:700,whiteSpace:"nowrap",fontSize:11}}>
                          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:couleurSalarie(sal),marginRight:6,verticalAlign:"middle"}}/>
                          {sal.nom}
                          <div style={{fontSize:9,color:L.textXs,fontWeight:400,marginTop:1}}>{sal.poste||"—"}</div>
                        </td>
                        <td style={{padding:"8px 11px",fontFamily:"monospace",fontSize:11,color:L.blue,fontWeight:700}}>{perf.totalHeures}h</td>
                        <td style={{padding:"8px 11px",fontFamily:"monospace",fontSize:11,color:L.textSm}}>{tauxCharge.toFixed(2)} €</td>
                        <td style={{padding:"8px 11px",fontFamily:"monospace",fontSize:11,color:L.orange,fontWeight:700}}>{euro(perf.coutReel)}</td>
                        <td style={{padding:"8px 11px",fontFamily:"monospace",fontSize:11,color:L.navy,fontWeight:700}}>{euro(perf.totalCA)}</td>
                        <td style={{padding:"8px 11px",fontFamily:"monospace",fontSize:11,fontWeight:800,color:perf.marge>=0?L.green:L.red}}>{euro(perf.marge)}</td>
                        <td style={{padding:"8px 11px"}}>
                          {perf.totalHeures>0?<span style={{background:ratioC+"22",color:ratioC,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{perf.ratio}%</span>:<span style={{color:L.textXs,fontSize:10}}>—</span>}
                        </td>
                        <td style={{padding:"8px 11px",fontSize:10,color:L.textSm,maxWidth:150}}>{perf.chantiers.length===0?"—":perf.chantiers.slice(0,2).join(", ")+(perf.chantiers.length>2?` +${perf.chantiers.length-2}`:"")}</td>
                        <td style={{padding:"8px 11px",whiteSpace:"nowrap"}}>
                          {perf.alerte==="prime"&&<span title="Ratio rentabilité ≥ 35 % : ouvrier très productif" style={{background:L.greenBg,color:L.green,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5}}>🏆 Prime</span>}
                          {perf.alerte==="attention"&&<span title="Ratio rentabilité < 10 % : à vérifier (sous-tarification, surplanning, ou inactivité partielle)" style={{background:L.redBg,color:L.red,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:5}}>⚠ Attention</span>}
                          {!perf.alerte&&perf.totalHeures>0&&<span style={{background:L.navyBg,color:L.navy,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:5}}>OK</span>}
                          {perf.totalHeures===0&&<span style={{color:L.textXs,fontSize:10,fontStyle:"italic"}}>Non assigné</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{background:L.navyBg,borderTop:`2px solid ${L.navy}33`}}>
                    <td style={{padding:"9px 11px",fontWeight:800,fontSize:11,color:L.navy}}>TOTAL ÉQUIPE</td>
                    <td style={{padding:"9px 11px",fontFamily:"monospace",fontWeight:800,color:L.blue,fontSize:11}}>{perfRows.reduce((a,r)=>a+r.perf.totalHeures,0)}h</td>
                    <td/>
                    <td style={{padding:"9px 11px",fontFamily:"monospace",fontWeight:800,color:L.orange,fontSize:11}}>{euro(totalCoutEquipe)}</td>
                    <td style={{padding:"9px 11px",fontFamily:"monospace",fontWeight:800,color:L.navy,fontSize:11}}>{euro(totalCAEquipe)}</td>
                    <td style={{padding:"9px 11px",fontFamily:"monospace",fontWeight:900,color:totalMargeEquipe>=0?L.green:L.red,fontSize:12}}>{euro(totalMargeEquipe)}</td>
                    <td style={{padding:"9px 11px"}}><span style={{background:(totalMargeEquipe>=0?L.green:L.red)+"22",color:totalMargeEquipe>=0?L.green:L.red,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{ratioEquipe}%</span></td>
                    <td colSpan={2}/>
                  </tr>
                </tbody>
              </table>
              <div style={{padding:"8px 14px",fontSize:10,color:L.textXs,background:L.bg,lineHeight:1.5,borderTop:`1px solid ${L.border}`}}>
                <strong>CA généré</strong> = somme des budgetHT des phases planning où l'ouvrier est assigné, divisé par le nombre d'ouvriers sur la phase. <strong>Coût</strong> = heures planifiées × taux horaire chargé. <strong>Ratio</strong> ≥ 35 % → 🏆 prime · ≥ 20 % → bon · ≥ 10 % → moyen · &lt; 10 % → ⚠ attention.
              </div>
            </div>
          )}
        </Card>
      )}

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
            <Input label="Téléphone" value={form.tel||""} onChange={v=>setForm(f=>({...f,tel:v}))} placeholder="06 12 34 56 78"/>
            <Input label="Email" value={form.email||""} onChange={v=>setForm(f=>({...f,email:v}))} type="email" placeholder="prenom@example.com"/>
            <div style={{gridColumn:"span 3"}}><Input label="Adresse" value={form.adresse||""} onChange={v=>setForm(f=>({...f,adresse:v}))} placeholder="12 rue de l'Exemple, 13000 Marseille"/></div>
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
                  <div style={{width:38,height:38,borderRadius:"50%",background:q.c+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:q.c,fontWeight:800,border:`2px solid ${couleurSalarie(sal)}`}}>{(sal.nom||"?").split(" ").map(n=>n[0]||"").join("").slice(0,2)||"?"}</div>
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
              {(sal.tel||sal.email||sal.adresse)&&(
                <div style={{display:"flex",flexDirection:"column",gap:3,padding:"6px 9px",background:L.bg,borderRadius:6,marginBottom:9,fontSize:10}}>
                  {sal.tel&&<a href={`tel:${sal.tel.replace(/\s/g,"")}`} style={{color:L.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>📞 {sal.tel}</a>}
                  {sal.email&&<a href={`mailto:${sal.email}`} style={{color:L.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✉ {sal.email}</a>}
                  {sal.adresse&&<div style={{color:L.textSm,display:"flex",alignItems:"center",gap:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📍 {sal.adresse}</div>}
                </div>
              )}
              {(sal.competences||[]).length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:9}}>{sal.competences.slice(0,4).map(c=><span key={c} style={{background:q.c+"15",color:q.c,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:600}}>{c}</span>)}</div>}
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <button onClick={()=>edit(sal)} style={{flex:1,minWidth:90,padding:"5px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✏️ Modifier</button>
                {sal.email&&<button onClick={()=>inviterOuvrier(sal)} title="Envoyer une invitation pour qu'il accède à son espace ouvrier" style={{flex:1,minWidth:90,padding:"5px",border:`1px solid ${L.green}`,borderRadius:6,background:L.greenBg,color:L.green,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>✉ Inviter</button>}
                <button onClick={()=>setSalaries(ss=>ss.filter(s=>s.id!==sal.id))} style={{padding:"5px 9px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── SOUS-TRAITANTS : fiches entreprises externes ──────────────────────────
// Distinct de salaries (interne) : facturation au taux journalier, spécialité,
// SIRET. Couleur dédiée pour le Gantt. Pas de chargesPatron (facture HT).
const SPECIALITES_ST=["Maçonnerie","Plomberie","Électricité","Charpente","Couverture","Menuiserie","Carrelage","Peinture","Plâtrerie","Isolation","Étanchéité","Démolition","Terrassement","VRD","Climatisation","Autre"];
function VueSousTraitants({sousTraitants,setSousTraitants}){
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const EMPTY={nom:"",contact:"",tel:"",email:"",siret:"",specialite:"Maçonnerie",tauxJournalier:"",couleur:"#7C3AED",adresse:"",notes:""};
  const [form,setForm]=useState(EMPTY);
  function save(){
    if(!form.nom||!form.tauxJournalier)return;
    const st={...form,id:editId||Date.now(),tauxJournalier:parseFloat(form.tauxJournalier)||0,couleur:form.couleur||"#7C3AED"};
    if(editId)setSousTraitants(ss=>ss.map(s=>s.id===editId?st:s));
    else setSousTraitants(ss=>[...ss,st]);
    setForm(EMPTY);setEditId(null);setShowForm(false);
  }
  function edit(s){setForm({...EMPTY,...s,tauxJournalier:String(s.tauxJournalier||"")});setEditId(s.id);setShowForm(true);}
  function setCouleurInline(id,couleur){setSousTraitants(ss=>ss.map(s=>s.id===id?{...s,couleur}:s));}
  const totalJ=sousTraitants.reduce((a,s)=>a+(+s.tauxJournalier||0),0);
  return(
    <div>
      <PageH title="Sous-traitants" subtitle={`${sousTraitants.length} entreprise${sousTraitants.length>1?"s":""} · Coût journalier cumulé : ${euro(totalJ)}`}
        actions={<Btn onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} variant="primary" icon="+">Ajouter</Btn>}/>
      {showForm&&(
        <Card style={{padding:18,marginBottom:18,border:`1px solid ${L.accent}`}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:14}}>{editId?"✏️ Modifier le sous-traitant":"+ Nouveau sous-traitant"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"span 2"}}><Input label="Nom de l'entreprise" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))} required placeholder="SARL Maçonnerie Dupont"/></div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Spécialité</div>
              <select value={form.specialite} onChange={e=>setForm(f=>({...f,specialite:e.target.value}))} style={{width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,background:L.surface,outline:"none",fontFamily:"inherit"}}>
                {SPECIALITES_ST.map(sp=><option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>
            <Input label="Contact (nom)" value={form.contact} onChange={v=>setForm(f=>({...f,contact:v}))} placeholder="Marc Dupont"/>
            <Input label="Téléphone" value={form.tel} onChange={v=>setForm(f=>({...f,tel:v}))} placeholder="06 12 34 56 78"/>
            <Input label="Email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} type="email" placeholder="contact@entreprise.fr"/>
            <Input label="SIRET" value={form.siret} onChange={v=>setForm(f=>({...f,siret:v}))} placeholder="12345678900012"/>
            <Input label="Taux journalier" value={form.tauxJournalier} onChange={v=>setForm(f=>({...f,tauxJournalier:v}))} type="number" required suffix="€/j"/>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Couleur (Gantt)</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={form.couleur||"#7C3AED"} onChange={e=>setForm(f=>({...f,couleur:e.target.value}))} style={{width:40,height:32,border:"none",background:"transparent",cursor:"pointer",padding:0}}/>
                <div style={{width:36,height:18,borderRadius:9,background:form.couleur||"#7C3AED",border:`1px solid ${L.border}`}}/>
              </div>
            </div>
            <div style={{gridColumn:"span 3"}}><Input label="Adresse" value={form.adresse} onChange={v=>setForm(f=>({...f,adresse:v}))} placeholder="12 rue de l'Exemple, 13000 Marseille"/></div>
            <div style={{gridColumn:"span 3"}}>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Notes</div>
              <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Conditions de paiement, qualité, remarques…" style={{width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,outline:"none",fontFamily:"inherit",background:L.surface,resize:"vertical",lineHeight:1.4}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setShowForm(false);setEditId(null);}} variant="secondary">Annuler</Btn>
            <Btn onClick={save} variant="success">✓ {editId?"Modifier":"Enregistrer"}</Btn>
          </div>
        </Card>
      )}
      {sousTraitants.length===0&&!showForm&&(
        <Card style={{padding:32,textAlign:"center",border:`2px dashed ${L.border}`}}>
          <div style={{fontSize:36,marginBottom:8}}>🤝</div>
          <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:5}}>Aucun sous-traitant</div>
          <div style={{fontSize:11,color:L.textSm,maxWidth:380,margin:"0 auto",lineHeight:1.6}}>Ajoutez vos partenaires (maçons, plombiers, électriciens…) pour les assigner sur les lignes de devis et les visualiser sur le Gantt.</div>
        </Card>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
        {sousTraitants.map(st=>(
          <Card key={st.id} style={{padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                <div style={{width:38,height:38,borderRadius:8,background:(st.couleur||"#7C3AED")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:st.couleur||"#7C3AED",fontWeight:800,border:`2px solid ${st.couleur||"#7C3AED"}`,flexShrink:0}}>🤝</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{st.nom}</div>
                  <div style={{fontSize:11,color:L.textSm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{st.specialite||"—"}</div>
                </div>
              </div>
              <input type="color" title="Couleur Gantt" value={st.couleur||"#7C3AED"} onChange={e=>setCouleurInline(st.id,e.target.value)} style={{width:22,height:22,padding:0,border:"none",background:"transparent",cursor:"pointer",flexShrink:0}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:9}}>
              <div style={{background:L.bg,borderRadius:6,padding:"6px 9px"}}><div style={{fontSize:9,color:L.textXs,marginBottom:2}}>Taux/jour</div><div style={{fontSize:11,fontWeight:700,color:L.accent}}>{euro(st.tauxJournalier)}</div></div>
              <div style={{background:L.bg,borderRadius:6,padding:"6px 9px"}}><div style={{fontSize:9,color:L.textXs,marginBottom:2}}>SIRET</div><div style={{fontSize:11,fontWeight:700,color:L.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{st.siret||"—"}</div></div>
            </div>
            {(st.contact||st.tel||st.email||st.adresse)&&(
              <div style={{display:"flex",flexDirection:"column",gap:3,padding:"6px 9px",background:L.bg,borderRadius:6,marginBottom:9,fontSize:10}}>
                {st.contact&&<div style={{color:L.textSm,display:"flex",alignItems:"center",gap:5}}>👤 {st.contact}</div>}
                {st.tel&&<a href={`tel:${st.tel.replace(/\s/g,"")}`} style={{color:L.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>📞 {st.tel}</a>}
                {st.email&&<a href={`mailto:${st.email}`} style={{color:L.blue,textDecoration:"none",display:"flex",alignItems:"center",gap:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✉ {st.email}</a>}
                {st.adresse&&<div style={{color:L.textSm,display:"flex",alignItems:"center",gap:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📍 {st.adresse}</div>}
              </div>
            )}
            {st.notes&&<div style={{fontSize:10,color:L.textSm,marginBottom:9,padding:"5px 9px",background:L.bg,borderRadius:6,lineHeight:1.4,whiteSpace:"pre-wrap"}}>{st.notes}</div>}
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>edit(st)} style={{flex:1,padding:"5px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>✏️ Modifier</button>
              <button onClick={()=>{if(window.confirm(`Supprimer le sous-traitant "${st.nom}" ?`))setSousTraitants(ss=>ss.filter(x=>x.id!==st.id));}} style={{padding:"5px 9px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}


// ─── Helper : conflits planning pour un salarie sur une phase candidate ────
// Retourne la liste des phases d'autres chantiers qui chevauchent la période
// candidate ET où le salarie est déjà assigné. Sert à l'avertissement inline
// dans PhaseEditPanel et le formulaire de création de phase.
function findSalarieConflicts(salId,candidate,candidateChantierId,allChantiers){
  if(!candidate?.dateDebut)return[];
  const cs=new Date(candidate.dateDebut+"T00:00:00");
  if(isNaN(cs))return[];
  const ce=new Date(cs);ce.setDate(ce.getDate()+(+candidate.dureeJours||1)-1);
  const out=[];
  for(const c of (allChantiers||[])){
    for(const p of (c.planning||[])){
      // Skip soi-même (édition de la même phase)
      if(c.id===candidateChantierId&&candidate.id&&p.id===candidate.id)continue;
      if(!Array.isArray(p.salariesIds)||!p.salariesIds.includes(salId))continue;
      if(!p.dateDebut)continue;
      const ps=new Date(p.dateDebut+"T00:00:00");
      if(isNaN(ps))continue;
      const pe=new Date(ps);pe.setDate(pe.getDate()+(+p.dureeJours||1)-1);
      if(cs<=pe&&ps<=ce){
        out.push({chantierId:c.id,chantierNom:c.nom||`#${c.id}`,phaseLib:p.tache||"phase",dateDebut:p.dateDebut,dureeJours:+p.dureeJours||1});
      }
    }
  }
  return out;
}

// ─── PLANNING : PANNEAU LATÉRAL D'ÉDITION DE PHASE ──────────────────────────
// Ouvert par click sur une barre Gantt. Permet d'éditer tous les champs
// (tache, chantier, ouvriers, dates, durée, budget, avancement, notes).
function PhaseEditPanel({phase,chantierId,chantiers,setChantiers,salaries,sousTraitants=[],onClose}){
  const ch=chantiers.find(c=>c.id===chantierId);
  function upd(patch){
    setChantiers(cs=>cs.map(c=>c.id!==chantierId?c:{...c,planning:(c.planning||[]).map(p=>p.id===phase.id?{...p,...patch}:p)}));
  }
  function moveToChantier(newChId){
    if(!newChId||newChId===chantierId)return;
    setChantiers(cs=>cs.map(c=>{
      if(c.id===chantierId)return{...c,planning:(c.planning||[]).filter(p=>p.id!==phase.id)};
      if(c.id===newChId)return{...c,planning:[...(c.planning||[]),{...phase}]};
      return c;
    }));
    onClose?.();
  }
  function toggleSal(sid){
    const ids=phase.salariesIds||[];
    const next=ids.includes(sid)?ids.filter(x=>x!==sid):[...ids,sid];
    upd({salariesIds:next});
  }
  function toggleST(stid){
    const ids=phase.sousTraitantsIds||[];
    const next=ids.includes(stid)?ids.filter(x=>x!==stid):[...ids,stid];
    upd({sousTraitantsIds:next});
  }
  function computedDateFin(){
    if(!phase.dateDebut)return"";
    const d=new Date(phase.dateDebut);
    d.setDate(d.getDate()+(phase.dureeJours||1)-1);
    return d.toISOString().slice(0,10);
  }
  function setDateFin(val){
    if(!val||!phase.dateDebut)return;
    const start=new Date(phase.dateDebut);
    const end=new Date(val);
    const days=Math.max(1,Math.round((+end-+start)/86400000)+1);
    upd({dureeJours:days});
  }
  const inp={width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit",background:L.surface};
  const lbl={fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4,display:"block"};
  return(
    <div className="no-print" style={{position:"fixed",top:0,right:0,width:360,maxWidth:"95vw",height:"100vh",background:L.surface,boxShadow:"-4px 0 16px rgba(0,0,0,0.18)",zIndex:1100,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,fontWeight:700,color:L.text}}>📅 Modifier la phase</div>
        <button onClick={onClose} aria-label="Fermer" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:6,width:28,height:28,cursor:"pointer",color:L.textSm,fontSize:14,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:11}}>
        <div>
          <label style={lbl}>Nom de la tâche</label>
          <input value={phase.tache||""} onChange={e=>upd({tache:e.target.value})} style={inp}/>
        </div>
        <div>
          <label style={lbl}>Chantier associé</label>
          <select value={chantierId} onChange={e=>moveToChantier(+e.target.value)} style={inp}>
            {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <div style={{fontSize:9,color:L.textXs,marginTop:3,fontStyle:"italic"}}>Changer de chantier déplace la phase dans son planning.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={lbl}>Date début</label>
            <input type="date" value={phase.dateDebut||""} onChange={e=>upd({dateDebut:e.target.value})} style={inp}/></div>
          <div><label style={lbl}>Date fin</label>
            <input type="date" value={computedDateFin()} onChange={e=>setDateFin(e.target.value)} style={inp}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={lbl}>Durée (jours)</label>
            <input type="number" min={1} value={phase.dureeJours||1} onChange={e=>upd({dureeJours:parseInt(e.target.value)||1})} style={inp}/></div>
          <div><label style={lbl}>Budget HT</label>
            <input type="number" value={phase.budgetHT||0} onChange={e=>upd({budgetHT:+e.target.value||0})} style={inp}/></div>
        </div>
        <div>
          <label style={lbl}>Avancement : <span style={{color:L.accent,fontWeight:700}}>{phase.avancement||0}%</span></label>
          <input type="range" min={0} max={100} step={5} value={phase.avancement||0} onChange={e=>upd({avancement:+e.target.value})} style={{width:"100%",accentColor:L.accent}}/>
        </div>
        <div>
          <label style={lbl}>Ouvriers assignés ({(phase.salariesIds||[]).length})</label>
          <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:180,overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:6,padding:5}}>
            {salaries.length===0&&<div style={{padding:8,color:L.textXs,fontSize:11,textAlign:"center"}}>Aucun salarié dans l'équipe</div>}
            {salaries.map(sal=>{
              const sel=(phase.salariesIds||[]).includes(sal.id);
              // Conflits temps-réel : autres phases qui chevauchent la période
              // ET où ce salarie est déjà assigné. On affiche même si pas
              // sélectionné (preview avant clic).
              const conflicts=findSalarieConflicts(sal.id,phase,chantierId,chantiers);
              return(
                <div key={sal.id}>
                  <label style={{display:"flex",alignItems:"center",gap:6,padding:"5px 7px",borderRadius:5,background:sel?L.blueBg:"transparent",cursor:"pointer",fontSize:11,border:conflicts.length>0&&sel?`1px solid ${L.red}55`:"1px solid transparent"}}>
                    <input type="checkbox" checked={sel} onChange={()=>toggleSal(sal.id)}/>
                    <div style={{width:10,height:10,borderRadius:"50%",background:couleurSalarie(sal),flexShrink:0}}/>
                    <span style={{flex:1,fontWeight:600,color:sel?L.blue:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sal.nom}</span>
                    <span style={{fontSize:9,color:L.textXs,whiteSpace:"nowrap"}}>{sal.poste?.slice(0,14)}</span>
                  </label>
                  {conflicts.length>0&&(
                    <div style={{marginLeft:24,marginTop:2,marginBottom:3,padding:"4px 8px",fontSize:10,color:L.red,background:"#FEE2E2",borderRadius:4,border:`1px solid ${L.red}33`,lineHeight:1.4}}>
                      ⚠️ Déjà sur <strong>{conflicts[0].chantierNom}</strong> — « {conflicts[0].phaseLib} » du {conflicts[0].dateDebut} ({conflicts[0].dureeJours}j){conflicts.length>1?` · +${conflicts.length-1} autre${conflicts.length>2?"s":""}`:""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {sousTraitants.length>0&&(
          <div>
            <label style={lbl}>🤝 Sous-traitants assignés ({(phase.sousTraitantsIds||[]).length})</label>
            <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:140,overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:6,padding:5}}>
              {sousTraitants.map(st=>{
                const sel=(phase.sousTraitantsIds||[]).includes(st.id);
                return(
                  <label key={st.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 7px",borderRadius:5,background:sel?(st.couleur||"#7C3AED")+"15":"transparent",cursor:"pointer",fontSize:11}}>
                    <input type="checkbox" checked={sel} onChange={()=>toggleST(st.id)}/>
                    <div style={{width:10,height:10,borderRadius:3,background:st.couleur||"#7C3AED",flexShrink:0}}/>
                    <span style={{flex:1,fontWeight:600,color:sel?(st.couleur||"#7C3AED"):L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{st.nom}</span>
                    <span style={{fontSize:9,color:L.textXs,whiteSpace:"nowrap"}}>{st.specialite?.slice(0,12)}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label style={lbl}>Notes</label>
          <textarea value={phase.notes||""} onChange={e=>upd({notes:e.target.value})} rows={3} placeholder="Remarques, points d'attention…" style={{...inp,resize:"vertical",lineHeight:1.4}}/>
        </div>
      </div>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${L.border}`,display:"flex",gap:8}}>
        <Btn onClick={onClose} variant="primary" fullWidth>✓ Fermer</Btn>
      </div>
    </div>
  );
}

// ─── PLANNING OUVRIER : modal d'export par ouvrier ─────────────────────────
// Tableau semaine par semaine pour chaque ouvrier (ou un seul filtré).
// Boutons : Imprimer/PDF (window.print A4 paysage isolé) + Partager
// (navigator.share si dispo, sinon fallback sur la fonction d'impression).
function PlanningOuvrierModal({chantiers,salaries,onClose}){
  const [filterSalId,setFilterSalId]=useState(null);
  const allPhases=(chantiers||[]).flatMap(c=>(c.planning||[]).map(p=>({...p,chantierId:c.id,chantierNom:c.nom||""})));

  function buildPourOuvrier(salId){
    const phases=allPhases.filter(p=>(p.salariesIds||[]).includes(salId)&&p.dateDebut);
    const weeksMap=new Map();
    for(const p of phases){
      const start=new Date(p.dateDebut);
      const dur=+p.dureeJours||1;
      const dayCount=new Map(); // weekKey -> nb jours dans cette semaine
      for(let i=0;i<dur;i++){
        const d=new Date(start);d.setDate(d.getDate()+i);
        if(d.getDay()===0||d.getDay()===6)continue; // skip weekend
        const wk=`${d.getFullYear()}-S${String(numeroSemaineISO(d)).padStart(2,"0")}`;
        dayCount.set(wk,(dayCount.get(wk)||0)+1);
      }
      for(const [wk,days] of dayCount){
        if(!weeksMap.has(wk))weeksMap.set(wk,[]);
        weeksMap.get(wk).push({...p,daysInWeek:days,hoursInWeek:days*8});
      }
    }
    return Array.from(weeksMap.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }
  function bornesSemaine(wk){
    const [yStr,sStr]=wk.split("-S");
    const y=+yStr,s=+sStr;
    // Lundi de la semaine ISO
    const jan4=new Date(y,0,4);
    const jan4Mon=new Date(jan4);jan4Mon.setDate(jan4.getDate()-((jan4.getDay()+6)%7));
    const lundi=new Date(jan4Mon);lundi.setDate(lundi.getDate()+(s-1)*7);
    const vendredi=new Date(lundi);vendredi.setDate(lundi.getDate()+4);
    const fmt=d=>d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
    return `${fmt(lundi)}–${fmt(vendredi)}`;
  }

  function imprimer(){window.print();}
  async function partager(){
    const lignes=visibleSalaries.map(sal=>{
      const wks=buildPourOuvrier(sal.id);
      const total=wks.reduce((a,[,ps])=>a+ps.reduce((b,p)=>b+p.hoursInWeek,0),0);
      return `${sal.nom} (${total}h) :\n`+wks.map(([wk,ps])=>`  ${wk} ${bornesSemaine(wk)} — ${ps.map(p=>`${p.chantierNom} · ${p.tache} (${p.hoursInWeek}h)`).join(" · ")}`).join("\n");
    }).join("\n\n");
    if(navigator.share){
      try{await navigator.share({title:"Planning ouvrier",text:lignes});}catch{}
    } else {
      try{await navigator.clipboard.writeText(lignes);alert("📋 Planning copié dans le presse-papier (partage non supporté par ce navigateur).");}
      catch{alert("Partage non supporté. Utilisez 'Imprimer / PDF' à la place.");}
    }
  }

  const visibleSalaries=filterSalId?(salaries||[]).filter(s=>s.id===filterSalId):(salaries||[]);
  const cell={padding:"6px 10px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",textAlign:"left"};

  return(
    <Modal title="📅 Planning ouvrier" onClose={onClose} maxWidth={920}>
      <div className="no-print" style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filterSalId??"all"} onChange={e=>setFilterSalId(e.target.value==="all"?null:+e.target.value)}
          style={{padding:"6px 10px",border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.textMd,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",outline:"none"}}>
          <option value="all">👥 Tous les ouvriers</option>
          {salaries.map(s=><option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
        <Btn onClick={imprimer} variant="primary" icon="🖨" size="sm">Imprimer / PDF</Btn>
        <Btn onClick={partager} variant="navy" icon="📤" size="sm">Partager</Btn>
        <span style={{marginLeft:"auto",fontSize:10,color:L.textXs}}>{visibleSalaries.length} ouvrier{visibleSalaries.length>1?"s":""}</span>
      </div>

      <div id="printable-planning-ouvrier">
        {visibleSalaries.map(sal=>{
          const wks=buildPourOuvrier(sal.id);
          const totalHeures=wks.reduce((a,[,ps])=>a+ps.reduce((b,p)=>b+p.hoursInWeek,0),0);
          const couleur=couleurSalarie(sal);
          return(
            <div key={sal.id} style={{marginBottom:22,breakInside:"avoid",pageBreakInside:"avoid"}}>
              <div style={{borderTop:`5px solid ${couleur}`,padding:"12px 16px",background:"#F8FAFC",borderRadius:"8px 8px 0 0",borderLeft:`1px solid ${L.border}`,borderRight:`1px solid ${L.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:L.text}}>{sal.nom}</div>
                    <div style={{fontSize:11,color:L.textSm,marginTop:2}}>{sal.poste||""}</div>
                  </div>
                  <div style={{textAlign:"right",fontSize:11,color:L.textSm,lineHeight:1.6}}>
                    {sal.tel&&<div>📞 {sal.tel}</div>}
                    {sal.email&&<div>✉ {sal.email}</div>}
                    <div style={{fontSize:13,fontWeight:800,color:couleur,marginTop:3}}>{totalHeures}h planifiées</div>
                  </div>
                </div>
              </div>
              {wks.length===0?(
                <div style={{padding:"20px 16px",border:`1px solid ${L.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",textAlign:"center",color:L.textXs,fontSize:12,fontStyle:"italic"}}>Aucune phase planifiée pour cet ouvrier</div>
              ):(
                <table style={{width:"100%",borderCollapse:"collapse",border:`1px solid ${L.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",overflow:"hidden"}}>
                  <thead>
                    <tr style={{background:L.bg}}>
                      <th style={cell}>Semaine</th>
                      <th style={cell}>Lun–Ven</th>
                      <th style={cell}>Chantier</th>
                      <th style={cell}>Phase</th>
                      <th style={{...cell,textAlign:"right"}}>Heures</th>
                      <th style={cell}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wks.map(([wk,ps])=>ps.map((p,i)=>(
                      <tr key={`${wk}-${p.id}-${i}`} style={{borderBottom:`1px solid ${L.border}`,verticalAlign:"top"}}>
                        {i===0&&<td rowSpan={ps.length} style={{padding:"7px 10px",fontSize:11,fontWeight:700,color:L.navy,borderRight:`1px solid ${L.border}`,background:"#FAFBFC"}}>{wk}</td>}
                        <td style={{padding:"7px 10px",fontSize:11,color:L.textSm,fontFamily:"monospace"}}>{bornesSemaine(wk)}</td>
                        <td style={{padding:"7px 10px",fontSize:11,fontWeight:600,color:L.text}}>{p.chantierNom}</td>
                        <td style={{padding:"7px 10px",fontSize:11,color:L.text}}>{p.tache}</td>
                        <td style={{padding:"7px 10px",fontSize:11,fontFamily:"monospace",textAlign:"right",fontWeight:600,color:L.orange}}>{p.hoursInWeek}h</td>
                        <td style={{padding:"7px 10px",fontSize:10,color:L.textSm}}>{p.notes||""}</td>
                      </tr>
                    )))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:L.navyBg,fontWeight:700}}>
                      <td colSpan={4} style={{padding:"8px 10px",fontSize:11,color:L.navy}}>Total semaines planifiées</td>
                      <td style={{padding:"8px 10px",fontSize:12,fontFamily:"monospace",textAlign:"right",color:L.navy}}>{totalHeures}h</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          );
        })}
        {visibleSalaries.length===0&&<div style={{padding:30,textAlign:"center",color:L.textXs,fontSize:13}}>Aucun ouvrier sélectionné.</div>}
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: #fff !important; }
          body * { visibility: hidden !important; box-shadow: none !important; }
          #printable-planning-ouvrier, #printable-planning-ouvrier * { visibility: visible !important; }
          #printable-planning-ouvrier { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </Modal>
  );
}

// ─── EXPORT PLANNING EXCEL (xlsx / SheetJS) ──────────────────────────────────
// 3 onglets : Planning · Charge par ouvrier (heures par semaine ISO) · Budget
// par chantier. Dynamic import pour permettre un fallback propre si la lib
// n'est pas encore installée (npm install xlsx).
async function exporterPlanningExcel(chantiers,salaries){
  let XLSX;
  try{XLSX=await import("xlsx");}catch(e){
    alert("Librairie xlsx non installée.\n\nLance dans le terminal :\n  npm install xlsx\npuis recharge l'application.");
    return;
  }
  const wb=XLSX.utils.book_new();

  // ─── Onglet 1 : Planning ─────────────────────────────────────
  const planningRows=[];
  for(const c of chantiers||[]){
    for(const p of (c.planning||[])){
      const ouvriers=(p.salariesIds||[]).map(id=>salaries.find(s=>s.id===id)?.nom).filter(Boolean).join(", ");
      let dateFin="";
      if(p.dateDebut){const d=new Date(p.dateDebut);d.setDate(d.getDate()+(p.dureeJours||1)-1);dateFin=d.toISOString().slice(0,10);}
      planningRows.push({
        Chantier:c.nom||"",
        Phase:p.tache||"",
        "Date début":p.dateDebut||"",
        "Date fin":dateFin,
        "Durée (j)":+p.dureeJours||1,
        "Heures":(+p.dureeJours||0)*8,
        Ouvriers:ouvriers,
        "Budget HT (€)":+p.budgetHT||0,
        "Avancement %":+p.avancement||0,
        Notes:p.notes||"",
      });
    }
  }
  const wsPlanning=XLSX.utils.json_to_sheet(planningRows.length>0?planningRows:[{Chantier:"(aucune phase)"}]);
  XLSX.utils.book_append_sheet(wb,wsPlanning,"Planning");

  // ─── Onglet 2 : Charge par ouvrier (heures par semaine) ─────
  function isoWeek(d){
    const date=new Date(d);date.setHours(0,0,0,0);
    date.setDate(date.getDate()+3-(date.getDay()+6)%7);
    const week1=new Date(date.getFullYear(),0,4);
    const num=1+Math.round(((+date-+week1)/86400000-3+(week1.getDay()+6)%7)/7);
    return `${date.getFullYear()}-S${String(num).padStart(2,"0")}`;
  }
  const allPhases=(chantiers||[]).flatMap(c=>(c.planning||[]).map(p=>({...p,chantierNom:c.nom||""})));
  const datedPhases=allPhases.filter(p=>p.dateDebut);
  if(datedPhases.length>0&&salaries.length>0){
    const minD=new Date(Math.min(...datedPhases.map(p=>+new Date(p.dateDebut))));
    const maxD=new Date(Math.max(...datedPhases.map(p=>{const d=new Date(p.dateDebut);d.setDate(d.getDate()+(+p.dureeJours||1));return +d;})));
    const weeks=new Set();
    let cur=new Date(minD);cur.setDate(cur.getDate()-((cur.getDay()+6)%7)); // lundi
    while(cur<=maxD){weeks.add(isoWeek(cur));cur.setDate(cur.getDate()+7);}
    const weekList=Array.from(weeks);
    const chargeRows=salaries.map(sal=>{
      const row={Ouvrier:sal.nom||"",Poste:sal.poste||"",Total:0};
      for(const wk of weekList)row[wk]=0;
      for(const p of allPhases){
        if(!p.dateDebut||!(p.salariesIds||[]).includes(sal.id))continue;
        const start=new Date(p.dateDebut);
        const dur=+p.dureeJours||1;
        for(let i=0;i<dur;i++){
          const day=new Date(start);day.setDate(day.getDate()+i);
          if(day.getDay()===0||day.getDay()===6)continue; // pas de weekend
          const wk=isoWeek(day);
          if(wk in row)row[wk]+=8;
        }
      }
      row.Total=weekList.reduce((a,w)=>a+(+row[w]||0),0);
      return row;
    });
    const wsCharge=XLSX.utils.json_to_sheet(chargeRows);
    XLSX.utils.book_append_sheet(wb,wsCharge,"Charge par ouvrier");
  }

  // ─── Onglet 3 : Budget par chantier ─────────────────────────
  const budgetRows=(chantiers||[]).map(c=>{
    const planningBudget=(c.planning||[]).reduce((a,p)=>a+(+p.budgetHT||0),0);
    const planningHeures=(c.planning||[]).reduce((a,p)=>a+(+p.dureeJours||0)*8,0);
    const depenses=(c.depensesReelles||[]).reduce((a,d)=>a+(+d.montant||0),0);
    return{
      Chantier:c.nom||"",
      Client:c.client||"",
      Statut:c.statut||"",
      "Devis HT (€)":+c.devisHT||0,
      "Budget planning HT (€)":+planningBudget.toFixed(2),
      "Heures planifiées":planningHeures,
      "Dépenses réelles (€)":+depenses.toFixed(2),
      "Marge théorique (€)":+((+c.devisHT||0)-planningBudget-depenses).toFixed(2),
    };
  });
  const wsBudget=XLSX.utils.json_to_sheet(budgetRows.length>0?budgetRows:[{Chantier:"(aucun chantier)"}]);
  XLSX.utils.book_append_sheet(wb,wsBudget,"Budget chantiers");

  const filename=`chantierpro-planning-${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,filename);
}

// Suivi visite Terrain par chantier (notifications patron). Stocké en
// localStorage par user pour ne pas saturer Supabase.
function terrainVisitsKey(userId){return `cp_terrain_visits_${userId||"guest"}`;}
function getTerrainVisits(userId){
  if(typeof window==="undefined")return{};
  try{return JSON.parse(localStorage.getItem(terrainVisitsKey(userId))||"{}");}catch{return{};}
}
function saveTerrainVisits(userId,map){
  if(typeof window==="undefined")return;
  try{localStorage.setItem(terrainVisitsKey(userId),JSON.stringify(map));}catch{}
}
function chantierTerrainUnread(ch,visitsMap){
  const upd=ch?.terrain?.lastUpdate;
  if(!upd)return false;
  return upd>(visitsMap[ch.id]||0);
}

// ─── MODULE TERRAIN : courses / photos / checklist / notes ──────────────────
// Stocké dans chantier.terrain = {courses, photos, checklist, notes, lastUpdate}.
// Sync auto via useSupaSync (chantiers_v2 jsonb data).
function TerrainSection({chantier,setChantiers,currentUserName,salaries,entreprise}){
  const t=chantier.terrain||{courses:[],photos:[],checklist:[],notes:[]};
  // Scan facture fournisseur — accessible aussi à l'ouvrier (cas le plus
  // fréquent : il achète sur chantier et photographie le ticket pour le
  // patron). La dépense est imputée automatiquement au chantier courant.
  const [showScan,setShowScan]=useState(false);
  function onSaveDepenseScan(chantierId,depense){
    setChantiers(cs=>cs.map(c=>c.id===chantierId?{...c,depensesReelles:[...(c.depensesReelles||[]),depense]}:c));
  }
  const nbDepenses=(chantier.depensesReelles||[]).length;
  const totDepensesChantier=(chantier.depensesReelles||[]).reduce((a,d)=>a+(+d.montant||0),0);
  function updTerrain(patch){
    setChantiers(cs=>cs.map(c=>c.id!==chantier.id?c:{...c,terrain:{...(c.terrain||{courses:[],photos:[],checklist:[],notes:[]}),...patch,lastUpdate:Date.now()}}));
  }
  // ─── Courses ─────────────────────────────────────────
  const [courseInput,setCourseInput]=useState({designation:"",qte:1,unite:"U",urgent:false});
  function addCourse(){
    if(!courseInput.designation.trim())return;
    const item={id:Date.now(),designation:courseInput.designation.trim(),qte:+courseInput.qte||1,unite:courseInput.unite,urgent:courseInput.urgent,commande:false,createdAt:Date.now(),createdBy:currentUserName};
    updTerrain({courses:[...(t.courses||[]),item]});
    setCourseInput({designation:"",qte:1,unite:"U",urgent:false});
  }
  function toggleCourse(id,field){updTerrain({courses:(t.courses||[]).map(c=>c.id===id?{...c,[field]:!c[field]}:c)});}
  function delCourse(id){updTerrain({courses:(t.courses||[]).filter(c=>c.id!==id)});}

  // ─── Photos ──────────────────────────────────────────
  const [photoErr,setPhotoErr]=useState(null);
  function onPhotoUpload(e){
    const files=Array.from(e.target.files||[]);
    e.target.value="";
    setPhotoErr(null);
    files.forEach(file=>{
      if(!file.type.startsWith("image/")){setPhotoErr("Format image requis (JPG/PNG/WebP).");return;}
      if(file.size>2_000_000){setPhotoErr(`"${file.name}" trop lourd (>2 Mo). Compressez avant upload.`);return;}
      const reader=new FileReader();
      reader.onload=()=>{
        const photo={id:Date.now()+Math.random(),image:reader.result,legende:"",createdAt:Date.now(),createdBy:currentUserName};
        updTerrain({photos:[...(t.photos||[]),photo]});
      };
      reader.readAsDataURL(file);
    });
  }
  function updPhoto(id,patch){updTerrain({photos:(t.photos||[]).map(p=>p.id===id?{...p,...patch}:p)});}
  function delPhoto(id){updTerrain({photos:(t.photos||[]).filter(p=>p.id!==id)});}
  const [photoZoom,setPhotoZoom]=useState(null);

  // ─── Checklist ───────────────────────────────────────
  const [taskInput,setTaskInput]=useState({texte:"",assignedTo:""});
  function addTask(){
    if(!taskInput.texte.trim())return;
    const task={id:Date.now(),texte:taskInput.texte.trim(),done:false,assignedTo:taskInput.assignedTo||currentUserName,createdAt:Date.now(),doneAt:null};
    updTerrain({checklist:[...(t.checklist||[]),task]});
    setTaskInput({texte:"",assignedTo:""});
  }
  function toggleTask(id){updTerrain({checklist:(t.checklist||[]).map(x=>x.id===id?{...x,done:!x.done,doneAt:!x.done?Date.now():null}:x)});}
  function delTask(id){updTerrain({checklist:(t.checklist||[]).filter(x=>x.id!==id)});}

  // ─── Notes ───────────────────────────────────────────
  const [noteInput,setNoteInput]=useState("");
  function addNote(){
    if(!noteInput.trim())return;
    const note={id:Date.now(),contenu:noteInput.trim(),createdAt:Date.now(),createdBy:currentUserName};
    updTerrain({notes:[note,...(t.notes||[])]});
    setNoteInput("");
  }
  function delNote(id){updTerrain({notes:(t.notes||[]).filter(n=>n.id!==id)});}

  function fmtDate(ts){if(!ts)return"";return new Date(ts).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
  const inp={padding:"6px 9px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* ─── COURSES / FOURNITURES ──────────────────────────── */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>🛒 Courses / fournitures à commander</div>
          <span style={{fontSize:11,color:L.textXs}}>{(t.courses||[]).length} item{(t.courses||[]).length>1?"s":""} · {(t.courses||[]).filter(c=>!c.commande).length} en attente</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 60px 70px auto auto",gap:6,marginBottom:10}}>
          <input value={courseInput.designation} onChange={e=>setCourseInput(f=>({...f,designation:e.target.value}))} placeholder="Designation (sac ciment, vis 5x60…)" style={inp} onKeyDown={e=>e.key==="Enter"&&addCourse()}/>
          <input type="number" value={courseInput.qte} onChange={e=>setCourseInput(f=>({...f,qte:e.target.value}))} placeholder="Qté" style={{...inp,textAlign:"center"}}/>
          <input list="unites-devis" value={courseInput.unite} onChange={e=>setCourseInput(f=>({...f,unite:e.target.value}))} placeholder="U" style={{...inp,textAlign:"center"}}/>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:courseInput.urgent?L.red:L.textSm,cursor:"pointer"}}>
            <input type="checkbox" checked={courseInput.urgent} onChange={e=>setCourseInput(f=>({...f,urgent:e.target.checked}))}/>
            🚨 Urgent
          </label>
          <Btn onClick={addCourse} variant="primary" size="sm" icon="+">Ajouter</Btn>
        </div>
        <datalist id="unites-devis">{["U","kg","sac","ml","m2","m3","L","pce","lot","forfait"].map(u=><option key={u} value={u}/>)}</datalist>
        {(t.courses||[]).length===0?(
          <div style={{padding:"16px 0",textAlign:"center",color:L.textXs,fontSize:11,fontStyle:"italic"}}>Aucune course pour l'instant.</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {(t.courses||[]).map(c=>(
              <div key={c.id} style={{display:"grid",gridTemplateColumns:"24px 1fr 70px auto 24px",gap:8,alignItems:"center",padding:"6px 8px",background:c.commande?L.greenBg:c.urgent?L.redBg:L.bg,borderRadius:6,opacity:c.commande?0.65:1}}>
                <input type="checkbox" checked={!!c.commande} onChange={()=>toggleCourse(c.id,"commande")} title="Commandé"/>
                <span style={{fontSize:12,fontWeight:600,textDecoration:c.commande?"line-through":"none",color:L.text}}>{c.designation}</span>
                <span style={{fontSize:11,color:L.textSm,textAlign:"right",fontFamily:"monospace"}}>{c.qte} {c.unite}</span>
                <button onClick={()=>toggleCourse(c.id,"urgent")} title="Urgent" style={{background:c.urgent?L.red:"transparent",color:c.urgent?"#fff":L.textXs,border:`1px solid ${c.urgent?L.red:L.border}`,borderRadius:5,padding:"2px 7px",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🚨</button>
                <button onClick={()=>delCourse(c.id)} title="Supprimer" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── PHOTOS CHANTIER ──────────────────────────────── */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>📷 Photos chantier</div>
          <label style={{padding:"6px 12px",background:L.navy,color:"#fff",borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>
            📁 Ajouter photo
            <input type="file" accept="image/*" multiple capture="environment" onChange={onPhotoUpload} style={{display:"none"}}/>
          </label>
        </div>
        {photoErr&&<div style={{padding:"6px 10px",background:L.redBg,color:L.red,borderRadius:6,fontSize:11,marginBottom:8}}>⚠ {photoErr}</div>}
        {(t.photos||[]).length===0?(
          <div style={{padding:"22px 0",textAlign:"center",color:L.textXs,fontSize:11,fontStyle:"italic"}}>Aucune photo. Prenez/ajoutez des images du chantier (max 2 Mo par fichier).</div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
            {(t.photos||[]).map(ph=>(
              <div key={ph.id} style={{border:`1px solid ${L.border}`,borderRadius:8,overflow:"hidden",background:L.surface,position:"relative"}}>
                <img src={ph.image} alt={ph.legende||"photo"} onClick={()=>setPhotoZoom(ph)} style={{width:"100%",height:110,objectFit:"cover",cursor:"pointer",display:"block"}}/>
                <input value={ph.legende||""} onChange={e=>updPhoto(ph.id,{legende:e.target.value})} placeholder="Légende" style={{width:"100%",padding:"5px 7px",border:"none",borderTop:`1px solid ${L.border}`,fontSize:10,outline:"none",fontFamily:"inherit"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 7px",background:L.bg,fontSize:9,color:L.textXs}}>
                  <span>{fmtDate(ph.createdAt)}</span>
                  <button onClick={()=>delPhoto(ph.id)} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:13}}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {photoZoom&&(
          <div onClick={()=>setPhotoZoom(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"zoom-out"}}>
            <img src={photoZoom.image} alt={photoZoom.legende} style={{maxWidth:"95%",maxHeight:"90%",objectFit:"contain"}}/>
            {photoZoom.legende&&<div style={{position:"absolute",bottom:30,left:0,right:0,textAlign:"center",color:"#fff",fontSize:13,fontWeight:600}}>{photoZoom.legende}</div>}
          </div>
        )}
      </Card>

      {/* ─── CHECKLIST ───────────────────────────────────── */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>✅ Checklist du jour</div>
          <span style={{fontSize:11,color:L.textXs}}>{(t.checklist||[]).filter(x=>x.done).length} / {(t.checklist||[]).length} terminée{(t.checklist||[]).filter(x=>x.done).length>1?"s":""}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"3fr 1fr auto",gap:6,marginBottom:10}}>
          <input value={taskInput.texte} onChange={e=>setTaskInput(f=>({...f,texte:e.target.value}))} placeholder="Tâche à faire (commander beton, monter echafaudage…)" style={inp} onKeyDown={e=>e.key==="Enter"&&addTask()}/>
          <select value={taskInput.assignedTo} onChange={e=>setTaskInput(f=>({...f,assignedTo:e.target.value}))} style={inp}>
            <option value="">Pour qui ?</option>
            {(salaries||[]).map(s=><option key={s.id} value={s.nom}>{s.nom}</option>)}
            <option value="Tous">Tous</option>
          </select>
          <Btn onClick={addTask} variant="primary" size="sm" icon="+">Ajouter</Btn>
        </div>
        {(t.checklist||[]).length===0?(
          <div style={{padding:"16px 0",textAlign:"center",color:L.textXs,fontSize:11,fontStyle:"italic"}}>Aucune tâche.</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {(t.checklist||[]).map(x=>(
              <div key={x.id} style={{display:"grid",gridTemplateColumns:"22px 1fr 110px 24px",gap:8,alignItems:"center",padding:"6px 8px",background:x.done?L.greenBg:L.bg,borderRadius:6,opacity:x.done?0.7:1}}>
                <input type="checkbox" checked={!!x.done} onChange={()=>toggleTask(x.id)}/>
                <span style={{fontSize:12,fontWeight:600,textDecoration:x.done?"line-through":"none",color:L.text}}>{x.texte}</span>
                <span style={{fontSize:10,color:L.textSm,textAlign:"right"}}>{x.assignedTo||"—"}{x.done&&x.doneAt?` · ${fmtDate(x.doneAt)}`:""}</span>
                <button onClick={()=>delTask(x.id)} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── NOTES TERRAIN ───────────────────────────────── */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>📝 Notes terrain</div>
          <span style={{fontSize:11,color:L.textXs}}>{(t.notes||[]).length} note{(t.notes||[]).length>1?"s":""}</span>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <textarea value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder="Note terrain (ex: livraison reportée, problème étanchéité, info client…)" rows={2}
            style={{...inp,flex:1,resize:"vertical",lineHeight:1.4}} onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();addNote();}}}/>
          <Btn onClick={addNote} variant="primary" size="sm" icon="+">Note</Btn>
        </div>
        {(t.notes||[]).length===0?(
          <div style={{padding:"16px 0",textAlign:"center",color:L.textXs,fontSize:11,fontStyle:"italic"}}>Aucune note.</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {(t.notes||[]).map(n=>(
              <div key={n.id} style={{padding:"8px 11px",background:L.bg,borderRadius:7,border:`1px solid ${L.border}`,position:"relative"}}>
                <div style={{fontSize:9,color:L.textXs,marginBottom:3,display:"flex",justifyContent:"space-between"}}>
                  <span>{n.createdBy||"—"} · {fmtDate(n.createdAt)}</span>
                  <button onClick={()=>delNote(n.id)} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:13,padding:0,fontFamily:"inherit"}}>×</button>
                </div>
                <div style={{fontSize:12,color:L.text,whiteSpace:"pre-wrap",lineHeight:1.45}}>{n.contenu}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {/* ─── Scan facture fournisseur (patron + ouvrier) ───────────────── */}
      <Card style={{padding:14,marginTop:12,border:`1px solid ${L.orange}33`,background:`linear-gradient(180deg,#FFF7ED,${L.surface})`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:L.text,display:"flex",alignItems:"center",gap:7}}>📸 Scanner facture fournisseur</div>
            <div style={{fontSize:10,color:L.textSm,marginTop:3}}>
              Photo du ticket → OCR IA → dépense ajoutée au chantier {chantier?.nom?`« ${chantier.nom} »`:"courant"}
              {nbDepenses>0&&<> · <strong style={{color:L.orange}}>{nbDepenses} facture{nbDepenses>1?"s":""} déjà scannée{nbDepenses>1?"s":""} ({euro(totDepensesChantier)} TTC)</strong></>}
            </div>
          </div>
          <Btn onClick={()=>setShowScan(true)} variant="primary" icon="📸">Scanner</Btn>
        </div>
      </Card>
      {showScan&&<ScanFactureModal chantiers={[chantier]} defaultChantierId={chantier.id} lockChantier entreprise={entreprise} onSave={onSaveDepenseScan} onClose={()=>setShowScan(false)}/>}
    </div>
  );
}

// Vue Terrain top-level (accessible via la sidebar) : picker chantier + section
function VueTerrain({chantiers,setChantiers,salaries,entreprise,terrainVisits={},onVisit}){
  const [selId,setSelId]=useState(chantiers[0]?.id||null);
  const ch=chantiers.find(c=>c.id===selId);
  // Marque la visite quand on regarde un chantier
  useEffect(()=>{if(ch?.id&&onVisit)onVisit(ch.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ch?.id]);
  return(
    <div>
      <PageH title="Terrain" subtitle="Courses, photos, checklist et notes par chantier"/>
      {chantiers.length===0?(
        <Card style={{padding:30,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>🚧</div>
          <div style={{fontSize:13,fontWeight:700,color:L.text}}>Aucun chantier en cours</div>
          <div style={{fontSize:11,color:L.textSm,marginTop:5}}>Créez ou ouvrez un chantier pour suivre les courses, photos et notes terrain.</div>
        </Card>
      ):(
        <>
          <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
            {chantiers.map(c=>{
              const unread=chantierTerrainUnread(c,terrainVisits);
              return(
                <button key={c.id} onClick={()=>setSelId(c.id)}
                  style={{padding:"6px 12px",borderRadius:8,border:`2px solid ${selId===c.id?L.accent:L.border}`,background:selId===c.id?L.accentBg:L.surface,color:selId===c.id?L.accent:L.textSm,fontSize:12,fontWeight:selId===c.id?700:400,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5}}>
                  {c.nom}{unread&&<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:L.red}}/>}
                </button>
              );
            })}
          </div>
          {ch&&<TerrainSection chantier={ch} setChantiers={setChantiers} salaries={salaries} currentUserName={entreprise?.nom||"Moi"} entreprise={entreprise}/>}
        </>
      )}
    </div>
  );
}

// ─── PLANNING : VUE GANTT SVG ─────────────────────────────────────────────────
// Lignes = salariés (+ "Non assigné"). Barres = phases coloriées par ouvrier.
// Toggle scale (Sem/Mois/Année), zoom +/-, drag/resize, % avancement, print.
// Calcule le dimanche de Pâques (Computus de Gauss-Knuth)
function dimanchePaques(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}
// Set des YYYY-MM-DD jours fériés FR pour les années passées en argument
function joursFeriesFR(years){
  const set=new Set();
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  for(const y of years){
    const p=dimanchePaques(y);
    const lp=new Date(p);lp.setDate(p.getDate()+1);
    const asc=new Date(p);asc.setDate(p.getDate()+39);
    const lpe=new Date(p);lpe.setDate(p.getDate()+50);
    set.add(`${y}-01-01`);
    set.add(fmt(lp));
    set.add(`${y}-05-01`);
    set.add(`${y}-05-08`);
    set.add(fmt(asc));
    set.add(fmt(lpe));
    set.add(`${y}-07-14`);
    set.add(`${y}-08-15`);
    set.add(`${y}-11-01`);
    set.add(`${y}-11-11`);
    set.add(`${y}-12-25`);
  }
  return set;
}
// Numéro de semaine ISO 8601
function numeroSemaineISO(d){
  const date=new Date(d);date.setHours(0,0,0,0);
  date.setDate(date.getDate()+3-(date.getDay()+6)%7);
  const week1=new Date(date.getFullYear(),0,4);
  return 1+Math.round(((+date-+week1)/86400000-3+(week1.getDay()+6)%7)/7);
}

function GanttView({chantiers,setChantiers,salaries,sousTraitants=[]}){
  const [hover,setHover]=useState(null);
  const [edit,setEdit]=useState(null);
  const [scale,setScale]=useState("week"); // "week" | "month" | "year"
  const [zoom,setZoom]=useState(1);
  const [drag,setDrag]=useState(null); // {phase, mode, daysDelta}
  const [filterSalId,setFilterSalId]=useState("all"); // "all" | "sal-<id>" | "st-<id>" | "_unassigned"

  const allPhases=chantiers.flatMap(c=>(c.planning||[]).map(p=>({...p,chantierId:c.id,chantierNom:c.nom||"Chantier"})));
  const datedPhases=allPhases.filter(p=>p.dateDebut);

  // Bornes dates
  const today=new Date().toISOString().slice(0,10);
  let minDate,maxDate,totalDays;
  if(datedPhases.length===0){
    minDate=new Date(today);maxDate=new Date(today);maxDate.setDate(maxDate.getDate()+30);
  } else {
    minDate=new Date(Math.min(...datedPhases.map(p=>+new Date(p.dateDebut))));
    maxDate=new Date(Math.max(...datedPhases.map(p=>{const d=new Date(p.dateDebut);d.setDate(d.getDate()+(p.dureeJours||1));return +d;})));
  }
  // Étend la plage selon l'échelle
  if(scale==="year"){
    minDate.setMonth(minDate.getMonth()-1);minDate.setDate(1);
    maxDate.setMonth(maxDate.getMonth()+1);maxDate.setDate(28);
  } else if(scale==="month"){
    minDate.setDate(minDate.getDate()-7);
    maxDate.setDate(maxDate.getDate()+7);
  } else {
    minDate.setDate(minDate.getDate()-1);
    maxDate.setDate(maxDate.getDate()+1);
  }
  totalDays=Math.max(7,Math.ceil((+maxDate-+minDate)/86400000));

  // Rows : salariés + sous-traitants + ligne "non assigné". rowKey préfixé pour
  // éviter toute collision d'id entre les deux populations.
  const allRows=[
    ...salaries.map(s=>({...s,kind:"salarie",rowKey:`sal-${s.id}`})),
    ...sousTraitants.map(st=>({...st,kind:"soustraitant",rowKey:`st-${st.id}`,poste:st.specialite||"Sous-traitant"})),
    {id:"_unassigned",rowKey:"_unassigned",kind:"unassigned",nom:"Non assigné",poste:"",couleur:"#94A3B8"}
  ];
  const salRowKeys=new Set(salaries.map(s=>`sal-${s.id}`));
  const stRowKeys=new Set(sousTraitants.map(s=>`st-${s.id}`));
  const phasesPerRow=new Map(allRows.map(r=>[r.rowKey,[]]));
  for(const p of allPhases){
    const salIds=Array.isArray(p.salariesIds)?p.salariesIds.filter(id=>salRowKeys.has(`sal-${id}`)):[];
    const stIds=Array.isArray(p.sousTraitantsIds)?p.sousTraitantsIds.filter(id=>stRowKeys.has(`st-${id}`)):[];
    if(salIds.length===0&&stIds.length===0)phasesPerRow.get("_unassigned").push(p);
    else {
      for(const id of salIds)phasesPerRow.get(`sal-${id}`).push(p);
      for(const id of stIds)phasesPerRow.get(`st-${id}`).push(p);
    }
  }
  // Filtre par ligne (salarié ou sous-traitant)
  const rows=filterSalId==="all"?allRows:allRows.filter(r=>r.rowKey===filterSalId);
  // Heures planifiées sur cette ligne (somme dureeJours × 8)
  function heuresPlanifiees(rowKey){
    return (phasesPerRow.get(rowKey)||[]).reduce((a,p)=>a+(+p.dureeJours||0)*8,0);
  }
  // Capacité = jours ouvrés sur la plage × 8h. Approx : 5/7 du span.
  const capaciteH=Math.round(totalDays*(5/7))*8;
  function chargeColor(h){
    if(capaciteH<=0)return L.textXs;
    const ratio=h/capaciteH;
    return ratio>1?L.red:ratio>0.85?L.orange:L.green;
  }

  const baseColWidth=scale==="year"?3:scale==="month"?9:22;
  const colWidth=Math.max(2,Math.round(baseColWidth*zoom));
  const labelWidth=160;
  const rowHeight=36;
  const headerHeight=58; // 2 niveaux : mois (haut) + jour (bas)
  const svgWidth=labelWidth+totalDays*colWidth;
  const svgHeight=headerHeight+rows.length*rowHeight;

  // Jours fériés sur la plage visible (1 ou 2 années couvertes)
  const yearsRange=new Set();
  for(let i=0;i<totalDays;i++){const d=new Date(minDate);d.setDate(d.getDate()+i);yearsRange.add(d.getFullYear());}
  const feriesSet=joursFeriesFR(yearsRange);
  const fmtDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // Pré-calcule les segments de mois pour l'axe haut
  const monthSegments=[];
  {
    let curStart=0,curMonth=null,curYear=null;
    for(let i=0;i<totalDays;i++){
      const d=new Date(minDate);d.setDate(d.getDate()+i);
      const m=d.getMonth(),y=d.getFullYear();
      if(curMonth===null){curMonth=m;curYear=y;curStart=i;}
      else if(m!==curMonth||y!==curYear){
        monthSegments.push({start:curStart,end:i-1,month:curMonth,year:curYear});
        curStart=i;curMonth=m;curYear=y;
      }
    }
    if(curMonth!==null)monthSegments.push({start:curStart,end:totalDays-1,month:curMonth,year:curYear});
  }
  const moisFR=["Jan","Fév","Mar","Avr","Mai","Jun","Jui","Aoû","Sep","Oct","Nov","Déc"];
  const dayInitialFR=["D","L","M","M","J","V","S"]; // index = getDay()

  function dayOffset(d){return Math.round((+new Date(d)-+minDate)/86400000);}
  function updPhase(chId,phaseId,patch){
    setChantiers(cs=>cs.map(c=>c.id!==chId?c:{...c,planning:(c.planning||[]).map(p=>p.id===phaseId?{...p,...patch}:p)}));
    setEdit(prev=>prev&&prev.p.id===phaseId?{...prev,p:{...prev.p,...patch}}:prev);
  }

  // Drag pour déplacer une barre. Distinction click vs drag : seuil 3px.
  function onBarMouseDown(e,p){
    if(e.button!==0)return;
    e.stopPropagation();
    const startX=e.clientX;
    let dragged=false;
    let lastDelta=0;
    function onMove(ev){
      const dx=ev.clientX-startX;
      if(!dragged&&Math.abs(dx)>3){
        dragged=true;
        setDrag({phase:p,mode:"move",daysDelta:0});
      }
      if(dragged){
        const days=Math.round(dx/colWidth);
        if(days!==lastDelta){lastDelta=days;setDrag(d=>d?{...d,daysDelta:days}:null);}
      }
    }
    function onUp(ev){
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      if(!dragged){
        setEdit({chId:p.chantierId,p});
      } else {
        const days=Math.round((ev.clientX-startX)/colWidth);
        if(days!==0){
          const d=new Date(p.dateDebut);d.setDate(d.getDate()+days);
          updPhase(p.chantierId,p.id,{dateDebut:d.toISOString().slice(0,10)});
        }
      }
      setDrag(null);
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  }

  // Drag du handle droit pour redimensionner.
  function onResizeMouseDown(e,p){
    if(e.button!==0)return;
    e.stopPropagation();e.preventDefault();
    const startX=e.clientX;
    let lastDelta=0;
    setDrag({phase:p,mode:"resize",daysDelta:0});
    function onMove(ev){
      const days=Math.round((ev.clientX-startX)/colWidth);
      if(days!==lastDelta){lastDelta=days;setDrag(d=>d?{...d,daysDelta:days}:null);}
    }
    function onUp(ev){
      window.removeEventListener("mousemove",onMove);
      window.removeEventListener("mouseup",onUp);
      const days=Math.round((ev.clientX-startX)/colWidth);
      if(days!==0)updPhase(p.chantierId,p.id,{dureeJours:Math.max(1,(p.dureeJours||1)+days)});
      setDrag(null);
    }
    window.addEventListener("mousemove",onMove);
    window.addEventListener("mouseup",onUp);
  }

  function imprimer(){window.print();}

  return(
    <div style={{position:"relative"}}>
      {/* Toolbar */}
      <div className="no-print" style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
        <div style={{display:"inline-flex",border:`1px solid ${L.border}`,borderRadius:7,overflow:"hidden"}}>
          {[{id:"week",l:"Semaine"},{id:"month",l:"Mois"},{id:"year",l:"Année"}].map(s=>(
            <button key={s.id} onClick={()=>setScale(s.id)} style={{padding:"5px 11px",border:"none",background:scale===s.id?L.navy:L.surface,color:scale===s.id?"#fff":L.textMd,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s.l}</button>
          ))}
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:4,border:`1px solid ${L.border}`,borderRadius:7,padding:"2px 5px",background:L.surface}}>
          <button onClick={()=>setZoom(z=>Math.max(0.5,+(z-0.25).toFixed(2)))} title="Zoom −" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:L.textMd,padding:"2px 7px",fontFamily:"inherit"}}>−</button>
          <span style={{fontSize:10,color:L.textSm,minWidth:34,textAlign:"center",fontFamily:"monospace"}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(3,+(z+0.25).toFixed(2)))} title="Zoom +" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:L.textMd,padding:"2px 7px",fontFamily:"inherit"}}>+</button>
        </div>
        <select value={filterSalId} onChange={e=>setFilterSalId(e.target.value)} title="Filtrer par ouvrier ou sous-traitant"
          style={{padding:"5px 9px",border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.textMd,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",outline:"none"}}>
          <option value="all">👥 Tout le monde</option>
          <optgroup label="Équipe interne">
            {salaries.map(sal=><option key={sal.id} value={`sal-${sal.id}`}>{sal.nom} ({heuresPlanifiees(`sal-${sal.id}`)}h)</option>)}
          </optgroup>
          {sousTraitants.length>0&&<optgroup label="Sous-traitants">
            {sousTraitants.map(st=><option key={st.id} value={`st-${st.id}`}>🤝 {st.nom} ({heuresPlanifiees(`st-${st.id}`)}h)</option>)}
          </optgroup>}
          <option value="_unassigned">⚠ Non assignées ({heuresPlanifiees("_unassigned")}h)</option>
        </select>
        <button onClick={imprimer} style={{padding:"5px 11px",border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.navy,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🖨 Imprimer</button>
        <span style={{fontSize:10,color:L.textXs,marginLeft:"auto"}}>{datedPhases.length} phase{datedPhases.length>1?"s":""} · capacité {capaciteH}h sur la période</span>
      </div>

      <div id="printable-gantt" style={{overflowX:"auto",border:`1px solid ${L.border}`,borderRadius:8,background:L.surface}}>
        <svg width={svgWidth} height={svgHeight} style={{display:"block",fontFamily:"inherit",userSelect:"none"}}>
          <g transform={`translate(${labelWidth},0)`}>
            {/* Bande de fond + colonnes individuelles : weekend gris, férié orange,
                alternance hebdo via léger tint */}
            {Array.from({length:totalDays},(_,i)=>{
              const d=new Date(minDate);d.setDate(d.getDate()+i);
              const isWE=d.getDay()===0||d.getDay()===6;
              const isFerie=feriesSet.has(fmtDay(d));
              const weekParity=Math.floor(numeroSemaineISO(d)/1)%2;
              const baseFill=isFerie?"#FFF1E6":(isWE?"#E8E8E8":(weekParity===0?"#FFFFFF":"#FAFBFC"));
              return(
                <rect key={i} x={i*colWidth} y={0} width={colWidth} height={svgHeight}
                  fill={baseFill} stroke={scale==="year"?"#fff":"#E2E8F0"} strokeWidth={0.5}/>
              );
            })}
            {/* Bande supérieure : nom du mois sur fond clair, header */}
            <rect x={0} y={0} width={totalDays*colWidth} height={28} fill="#F1F5F9"/>
            <line x1={0} y1={28} x2={totalDays*colWidth} y2={28} stroke="#CBD5E1" strokeWidth={0.5}/>
            {monthSegments.map((seg,i)=>{
              const segW=(seg.end-seg.start+1)*colWidth;
              const cx=seg.start*colWidth+segW/2;
              const lbl=`${moisFR[seg.month]} ${seg.year}`;
              return(
                <g key={i}>
                  {seg.start>0&&<line x1={seg.start*colWidth} y1={0} x2={seg.start*colWidth} y2={svgHeight} stroke={L.navy} strokeWidth={1.2} opacity={0.35}/>}
                  {segW>40&&<text x={cx} y={18} fontSize={11} textAnchor="middle" fill="#1B3A5C" fontWeight={700}>{lbl}</text>}
                </g>
              );
            })}
            {/* Bande inférieure : labels jour (initiale week / chiffre month / mois year) */}
            {Array.from({length:totalDays},(_,i)=>{
              const d=new Date(minDate);d.setDate(d.getDate()+i);
              const isWE=d.getDay()===0||d.getDay()===6;
              const isFerie=feriesSet.has(fmtDay(d));
              const isFirst=d.getDate()===1;
              const cx=i*colWidth+colWidth/2;
              const labelColor=isWE||isFerie?"#DC2626":"#475569";
              if(scale==="week"){
                return(
                  <g key={i}>
                    <text x={cx} y={42} fontSize={9} textAnchor="middle" fill={labelColor} fontWeight={isWE?700:600}>{dayInitialFR[d.getDay()]}</text>
                    {colWidth>=14&&<text x={cx} y={53} fontSize={8} textAnchor="middle" fill={labelColor}>{d.getDate()}</text>}
                  </g>
                );
              }
              if(scale==="month"){
                if(d.getDate()===1||d.getDate()===15){
                  return <text key={i} x={cx} y={48} fontSize={9} textAnchor="middle" fill={labelColor} fontWeight={isFirst?700:400}>{d.getDate()}</text>;
                }
                // numéro de semaine ISO sur les lundis
                if(d.getDay()===1&&colWidth>=8){
                  return <text key={i} x={cx} y={48} fontSize={7} textAnchor="middle" fill="#94A3B8" fontWeight={500}>S{numeroSemaineISO(d)}</text>;
                }
                return null;
              }
              // year
              if(d.getDate()===1)return <text key={i} x={cx} y={48} fontSize={9} textAnchor="middle" fill="#475569" fontWeight={500}>{moisFR[d.getMonth()].slice(0,1)}</text>;
              return null;
            })}
            {(()=>{const tod=dayOffset(today);if(tod<0||tod>totalDays)return null;return <line x1={tod*colWidth+colWidth/2} y1={headerHeight} x2={tod*colWidth+colWidth/2} y2={svgHeight} stroke={L.accent} strokeWidth={1.5} strokeDasharray="3,3"/>;})()}
          </g>

          {rows.map((row,idx)=>{
            const y=headerHeight+idx*rowHeight;
            // Couleur : sous-traitant a sa propre couleur (champ couleur), salarié via couleurSalarie helper
            const color=row.kind==="soustraitant"?(row.couleur||"#7C3AED"):couleurSalarie(row);
            const heures=heuresPlanifiees(row.rowKey);
            const cc=chargeColor(heures);
            const labelPrefix=row.kind==="soustraitant"?"🤝 ":"";
            const labelTxt=row.nom?(row.nom.length>14?row.nom.slice(0,13)+"…":row.nom):row.id;
            return(
              <g key={row.rowKey}>
                <rect x={0} y={y} width={labelWidth} height={rowHeight} fill={idx%2===0?L.bg:"#FFF"} stroke="#E2E8F0" strokeWidth={0.5}/>
                <rect x={4} y={y+8} width={4} height={rowHeight-16} fill={color} rx={2}/>
                <text x={14} y={y+rowHeight/2-2} fontSize={11} fontWeight={600} fill={row.kind==="unassigned"?"#94A3B8":(row.kind==="soustraitant"?color:"#1B3A5C")}>
                  {labelPrefix}{labelTxt}
                </text>
                <text x={14} y={y+rowHeight/2+11} fontSize={9} fill={cc} fontWeight={600}>
                  {heures>0?`${heures}h planifiées`:row.poste?row.poste.slice(0,18):""}
                </text>
                <line x1={0} y1={y+rowHeight} x2={svgWidth} y2={y+rowHeight} stroke="#E2E8F0" strokeWidth={0.5}/>
                {(phasesPerRow.get(row.rowKey)||[]).map(p=>{
                  const isMove=drag&&drag.phase.id===p.id&&drag.mode==="move";
                  const isResize=drag&&drag.phase.id===p.id&&drag.mode==="resize";
                  const dDelta=(isMove||isResize)?drag.daysDelta:0;
                  const startOff=dayOffset(p.dateDebut)+(isMove?dDelta:0);
                  const dur=Math.max(1,(p.dureeJours||1)+(isResize?dDelta:0));
                  const x=labelWidth+startOff*colWidth+1;
                  const w=Math.max(8,dur*colWidth-2);
                  const av=Math.max(0,Math.min(100,+p.avancement||0));
                  const fillW=w*av/100;
                  // Sous-traitant : tirets pour distinguer visuellement de l'équipe interne
                  const dashPattern=row.kind==="soustraitant"?"4,3":undefined;
                  return(
                    <g key={`${p.id}-${row.rowKey}`}
                      onMouseEnter={()=>{if(!drag)setHover({phase:p,x:x,y:y,chantierNom:p.chantierNom});}}
                      onMouseLeave={()=>setHover(null)}>
                      <rect x={x} y={y+6} width={w} height={rowHeight-12}
                        fill={color} fillOpacity={row.kind==="unassigned"?0.3:0.55}
                        stroke={color} strokeWidth={1.5} strokeDasharray={dashPattern} rx={3}
                        style={{cursor:isMove?"grabbing":"grab"}}
                        onMouseDown={e=>onBarMouseDown(e,p)}/>
                      {av>0&&<rect x={x} y={y+6} width={fillW} height={rowHeight-12} fill={color} fillOpacity={0.95} rx={3} style={{pointerEvents:"none"}}/>}
                      {w>50&&(
                        <text x={x+6} y={y+rowHeight/2+4} fontSize={10} fill="#fff" fontWeight={600} style={{pointerEvents:"none"}}>
                          {(p.tache||"").slice(0,Math.floor(w/6))}{av>0?` ${av}%`:""}
                        </text>
                      )}
                      {/* Handle de redimensionnement (bord droit) */}
                      <rect x={x+w-5} y={y+6} width={5} height={rowHeight-12}
                        fill="rgba(255,255,255,0.4)" rx={2}
                        style={{cursor:"col-resize"}}
                        onMouseDown={e=>onResizeMouseDown(e,p)}/>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {hover&&!drag&&(
        <div style={{position:"absolute",top:hover.y+headerHeight+10,left:Math.min(hover.x+labelWidth+8,svgWidth-220),background:L.navy,color:"#fff",padding:"8px 11px",borderRadius:7,fontSize:11,pointerEvents:"none",zIndex:10,boxShadow:L.shadowMd,maxWidth:240}}>
          <div style={{fontWeight:700,marginBottom:3}}>{hover.phase.tache}</div>
          <div style={{opacity:0.85,fontSize:10}}>{hover.chantierNom}</div>
          <div style={{opacity:0.85,fontSize:10,marginTop:3}}>{hover.phase.dateDebut} · {hover.phase.dureeJours}j</div>
          {hover.phase.heuresPrevues>0&&<div style={{opacity:0.85,fontSize:10}}>{hover.phase.heuresPrevues}h estimées</div>}
          {hover.phase.budgetHT>0&&<div style={{opacity:0.85,fontSize:10}}>Budget : {euro(hover.phase.budgetHT)}</div>}
          {(+hover.phase.avancement>0)&&<div style={{opacity:0.85,fontSize:10}}>Avancement : {hover.phase.avancement}%</div>}
        </div>
      )}

      {edit&&<PhaseEditPanel phase={edit.p} chantierId={edit.chId} chantiers={chantiers} setChantiers={setChantiers} salaries={salaries} sousTraitants={sousTraitants} onClose={()=>setEdit(null)}/>}

      {/* CSS d'impression : Gantt en paysage A4 */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body * { visibility: hidden !important; box-shadow: none !important; }
          #printable-gantt, #printable-gantt * { visibility: visible !important; }
          #printable-gantt { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; overflow: visible !important; border: none !important; }
          #printable-gantt svg { width: 100% !important; height: auto !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── PLANNING ─────────────────────────────────────────────────────────────────
function VuePlanning({chantiers,setChantiers,salaries,sousTraitants=[]}){
  const [selId,setSelId]=useState(chantiers[0]?.id||null);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [vue,setVue]=useState("liste"); // "liste" | "gantt"
  const [showPlanningOuvrier,setShowPlanningOuvrier]=useState(false);
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
            <Btn onClick={()=>setShowPlanningOuvrier(true)} variant="secondary" size="sm" icon="👷">Planning ouvrier</Btn>
            <Btn onClick={()=>exporterPlanningExcel(chantiers,salaries)} variant="navy" size="sm" icon="📊">Excel</Btn>
            {vue==="liste"&&<Btn onClick={()=>{setForm(EMPTY);setEditId(null);setShowForm(true);}} variant="primary" icon="+">Nouvelle tâche</Btn>}
          </div>
        }/>
      {vue==="gantt"
        ?<GanttView chantiers={chantiers} setChantiers={setChantiers} salaries={salaries} sousTraitants={sousTraitants}/>
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
                // Conflits temps-réel (édition d'une phase existante : on
                // skip soi-même via editId comme phase.id ; nouvelle phase :
                // pas de skip).
                const conflicts=findSalarieConflicts(sal.id,{id:editId,dateDebut:form.dateDebut,dureeJours:parseInt(form.dureeJours)||1},selId,chantiers);
                return(
                  <div key={sal.id} style={{display:"flex",flexDirection:"column",gap:0}}>
                    <div onClick={()=>togSal(sal.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 10px",borderRadius:8,border:`2px solid ${conflicts.length>0&&sel?L.red:sel?L.blue:L.border}`,background:sel?L.blueBg:L.surface,cursor:"pointer"}}>
                      <div style={{width:13,height:13,borderRadius:3,border:`2px solid ${sel?L.blue:L.borderMd}`,background:sel?L.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{color:"#fff",fontSize:7,fontWeight:900}}>✓</span>}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:sel?L.blue:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sal.nom}</div>
                        <div style={{fontSize:9,color:L.textXs}}>{sal.poste}</div>
                      </div>
                      {sel&&<div style={{fontSize:10,fontWeight:700,color:L.orange}}>{euro(cJ)}</div>}
                    </div>
                    {conflicts.length>0&&(
                      <div style={{marginTop:3,padding:"5px 9px",fontSize:10,color:L.red,background:"#FEE2E2",borderRadius:6,border:`1px solid ${L.red}33`,lineHeight:1.4}}>
                        ⚠️ Déjà sur <strong>{conflicts[0].chantierNom}</strong> — « {conflicts[0].phaseLib} » du {conflicts[0].dateDebut} ({conflicts[0].dureeJours}j){conflicts.length>1?` · +${conflicts.length-1} autre${conflicts.length>2?"s":""}`:""}
                      </div>
                    )}
                  </div>
                );
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
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{tSals.map(s=><span key={s.id} style={{background:L.blueBg,color:L.blue,borderRadius:8,padding:"1px 7px",fontSize:10,fontWeight:600}}>{(s.nom||"").split(" ")[0]||"—"}</span>)}{tSals.length===0&&<span style={{fontSize:10,color:L.textXs}}>Aucun ouvrier affecté</span>}</div>
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
      {showPlanningOuvrier&&<PlanningOuvrierModal chantiers={chantiers} salaries={salaries} onClose={()=>setShowPlanningOuvrier(false)}/>}
    </div>
  );
}


// ─── VUE OUVRIER TERRAIN (mobile-first) ─────────────────────────────────────
// Vue dédiée aux ouvriers/sous-traitants connectés via invitation : remplace
// VueChantiers pour ne montrer que ce qui les concerne aujourd'hui.
// - Pointage heures (clock in / out, stockage local)
// - Chantier du jour (auto-détecté depuis le planning)
// - Mes tâches (filtrées par assignedTo = mon nom)
// - Notes terrain rapides
// Bouton caméra ouvrier — photo du chantier en cours, upload Storage direct
function WorkerPhotoButton({chantierId,authUser}){
  const ref=useRef(null);
  const [status,setStatus]=useState(null); // null | "uploading" | "ok" | "err"
  const [errMsg,setErrMsg]=useState("");
  async function onFile(e){
    const file=e.target.files?.[0];
    e.target.value="";
    if(!file)return;
    setStatus("uploading");setErrMsg("");
    try{
      await uploadChantierPhoto({file,chantierId,authUser});
      setStatus("ok");
      setTimeout(()=>setStatus(null),2200);
    }catch(err){
      setStatus("err");setErrMsg(err.message||"Échec");
      setTimeout(()=>setStatus(null),3500);
    }
  }
  return(
    <>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onFile} style={{display:"none"}}/>
      <button onClick={()=>ref.current?.click()} disabled={status==="uploading"}
        style={{marginTop:8,width:"100%",padding:"10px 14px",
          background:status==="ok"?L.green:status==="err"?L.red:L.accent,
          color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,
          cursor:status==="uploading"?"wait":"pointer",fontFamily:"inherit",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          boxShadow:`0 2px 8px ${L.accent}55`,transition:"background 0.2s"}}>
        {status==="uploading"?"⏳ Envoi…":status==="ok"?"✅ Photo envoyée !":status==="err"?`⚠ ${errMsg.slice(0,30)}`:"📷 Photo chantier"}
      </button>
    </>
  );
}

function VueOuvrierTerrain({authUser,entreprise,chantiers,setChantiers,salaries}){
  // "Moi" = salarié dont l'email match auth.email (case insensitive)
  const monEmail=(authUser?.email||"").trim().toLowerCase();
  // Fetch direct du salarié dans la table salaries du patron : le prop
  // salaries peut être vide (RLS pas encore propagée, query failed silently,
  // etc.) → on charge directement avec patron_user_id pour avoir le prénom
  // dès le 1er render.
  const [monSalarieDb,setMonSalarieDb]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    const patronId=entreprise?.patron_user_id;
    if(!patronId||!monEmail)return;
    supabase.from("salaries").select("data").eq("user_id",patronId).then(({data,error})=>{
      if(cancelled||error||!Array.isArray(data))return;
      const found=data.map(r=>r.data).filter(Boolean).find(s=>(s?.email||"").trim().toLowerCase()===monEmail);
      if(found)setMonSalarieDb(found);
    });
    return()=>{cancelled=true;};
  },[entreprise?.patron_user_id,monEmail]);
  const monSalarie=monSalarieDb||(salaries||[]).find(s=>(s.email||"").trim().toLowerCase()===monEmail)||null;
  // Fallback gracieux : nom salarié → email (avant @) → "Ouvrier".
  // ⚠ on ne tombe PLUS sur entreprise.nom (nom du patron) qui était trompeur.
  const monNom=monSalarie?.nom||(monEmail?monEmail.split("@")[0]:"Ouvrier");
  // Date de référence
  const today=new Date();
  const todayKey=today.toISOString().slice(0,10);
  const fmtJour=today.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  // ─── Pointage Supabase (persisté multi-device) ────────────────────────
  // Migration depuis localStorage : on charge les pointages des 7 derniers
  // jours depuis la table pointages, puis on bascule chaque écriture vers
  // Supabase. localStorage gardé en lecture seule pour migrer les données
  // résiduelles d'anciens devices au prochain login (one-shot).
  const [pointages,setPointages]=useState({});
  const [pointagesLoaded,setPointagesLoaded]=useState(false);
  // Charge les 7 derniers jours au mount
  useEffect(()=>{
    let cancelled=false;
    if(!authUser?.id){setPointagesLoaded(true);return;}
    const since=new Date(today);since.setDate(today.getDate()-6);
    const sinceStr=since.toISOString().slice(0,10);
    supabase.from("pointages")
      .select("date,debut,fin,total_heures,chantier_id,notes")
      .eq("user_id",authUser.id)
      .gte("date",sinceStr)
      .then(({data,error})=>{
        if(cancelled)return;
        if(error){
          console.warn("[pointages load]",error.message);
          // Fallback localStorage si table absente (migration pas exécutée)
          try{
            const local=JSON.parse(localStorage.getItem(`cp_pointages_${authUser.id}`)||"{}");
            setPointages(local);
          }catch{setPointages({});}
        }else{
          const map={};
          for(const r of (data||[])){
            map[r.date]={
              debut:r.debut?new Date(r.debut).getTime():null,
              fin:r.fin?new Date(r.fin).getTime():null,
              total:+r.total_heures||0,
              chantierId:r.chantier_id||null,
            };
          }
          // Migration one-shot : merge avec localStorage si présent
          try{
            const local=JSON.parse(localStorage.getItem(`cp_pointages_${authUser.id}`)||"{}");
            for(const[date,pt]of Object.entries(local)){
              if(!map[date]&&pt?.debut)map[date]=pt;
            }
          }catch{}
          setPointages(map);
        }
        setPointagesLoaded(true);
      });
    return()=>{cancelled=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[authUser?.id]);
  // Sauvegarde un pointage (jour donné) en Supabase + state local
  async function savePointage(dateKey,pt){
    setPointages(prev=>({...prev,[dateKey]:pt}));
    if(!authUser?.id)return;
    try{
      const row={
        user_id:authUser.id,
        date:dateKey,
        debut:pt.debut?new Date(pt.debut).toISOString():null,
        fin:pt.fin?new Date(pt.fin).toISOString():null,
        total_heures:pt.total||null,
        patron_user_id:entreprise?.patron_user_id||null,
        chantier_id:pt.chantierId||null,
        updated_at:new Date().toISOString(),
      };
      const{error}=await supabase.from("pointages").upsert(row,{onConflict:"user_id,date"});
      if(error){
        console.warn("[pointages save]",error.message);
        // Fallback localStorage si Supabase fail (migration pas faite, offline, etc.)
        try{
          const local=JSON.parse(localStorage.getItem(`cp_pointages_${authUser.id}`)||"{}");
          local[dateKey]=pt;
          localStorage.setItem(`cp_pointages_${authUser.id}`,JSON.stringify(local));
        }catch{}
      }
    }catch(e){console.warn("[pointages save threw]",e?.message||e);}
  }
  const ptDuJour=pointages[todayKey]||null;
  function pointerDebut(){
    if(ptDuJour?.debut)return;
    savePointage(todayKey,{debut:Date.now(),fin:null});
  }
  function pointerFin(){
    if(!ptDuJour?.debut||ptDuJour?.fin)return;
    const fin=Date.now();
    const total=Math.round(((fin-ptDuJour.debut)/3600000)*100)/100; // heures
    savePointage(todayKey,{...ptDuJour,fin,total});
  }
  function fmtHeure(ts){
    if(!ts)return"";
    const d=new Date(ts);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function dureeEnCours(){
    if(!ptDuJour?.debut||ptDuJour?.fin)return null;
    const ms=Date.now()-ptDuJour.debut;
    const h=Math.floor(ms/3600000);
    const m=Math.floor((ms%3600000)/60000);
    return `${h}h${String(m).padStart(2,"0")}`;
  }
  // Re-render toutes les 30s pour rafraîchir le compteur en cours
  const [,setTick]=useState(0);
  useEffect(()=>{
    const i=setInterval(()=>setTick(x=>x+1),30000);
    return()=>clearInterval(i);
  },[]);
  // ─── Chantier(s) du jour : phases dont [dateDebut, +dureeJours[ ⊃ today
  // ET dont salariesIds inclut monSalarie?.id
  const chantiersDuJour=(()=>{
    if(!monSalarie)return[];
    const out=[];
    for(const c of (chantiers||[])){
      const phases=(c.planning||[]).filter(p=>{
        if(!p.dateDebut||!Array.isArray(p.salariesIds))return false;
        if(!p.salariesIds.includes(monSalarie.id))return false;
        const s=new Date(p.dateDebut);
        const e=new Date(s);e.setDate(s.getDate()+(+p.dureeJours||1));
        return today>=s&&today<e;
      });
      if(phases.length>0)out.push({chantier:c,phases});
    }
    return out;
  })();
  // ─── Mes tâches : agrégat checklist filtré par assignedTo = monNom ───
  const mesTaches=(()=>{
    const out=[];
    for(const c of (chantiers||[])){
      const t=c.terrain||{};
      for(const task of (t.checklist||[])){
        const assigned=(task.assignedTo||"").trim().toLowerCase();
        if(assigned&&assigned===monNom.toLowerCase()){
          out.push({...task,chantierId:c.id,chantierNom:c.nom||`#${c.id}`});
        }
      }
    }
    // Pas faits d'abord, puis terminés
    out.sort((a,b)=>(a.done?1:0)-(b.done?1:0)||(b.createdAt||0)-(a.createdAt||0));
    return out;
  })();
  function toggleTache(chantierId,taskId){
    setChantiers(cs=>cs.map(c=>{
      if(c.id!==chantierId)return c;
      const tr=c.terrain||{checklist:[]};
      return{...c,terrain:{...tr,checklist:(tr.checklist||[]).map(t=>t.id===taskId?{...t,done:!t.done,doneAt:!t.done?Date.now():null}:t),lastUpdate:Date.now()}};
    }));
  }
  // ─── Pointages des 7 derniers jours (récap) ──────────────────────────
  const last7=[];
  for(let i=6;i>=0;i--){
    const d=new Date(today);d.setDate(today.getDate()-i);
    const key=d.toISOString().slice(0,10);
    last7.push({key,date:d,pt:pointages[key]||null});
  }
  const totalSemaine=last7.reduce((a,x)=>a+(x.pt?.total||0),0);
  return(
    <div style={{maxWidth:600,margin:"0 auto"}}>
      {/* En-tête */}
      <div style={{padding:"14px 18px",background:`linear-gradient(135deg,${L.navy},#2a5298)`,color:"#fff",borderRadius:12,marginBottom:14}}>
        <div style={{fontSize:11,opacity:0.8,textTransform:"capitalize"}}>{fmtJour}</div>
        <div style={{fontSize:20,fontWeight:800,letterSpacing:-0.3,marginTop:2}}>👋 Bonjour {monNom.split(" ")[0]}</div>
        {entreprise?.nom&&<div style={{fontSize:11,opacity:0.85,marginTop:4}}>Équipe : {entreprise.nom}</div>}
      </div>

      {/* Pointage */}
      <Card style={{padding:18,marginBottom:14,border:`1px solid ${L.border}`}}>
        <div style={{fontSize:12,fontWeight:700,color:L.textMd,textTransform:"uppercase",letterSpacing:0.6,marginBottom:10}}>⏱ Pointage du jour</div>
        {!ptDuJour?.debut?(
          <button onClick={pointerDebut} style={{width:"100%",padding:"16px 14px",background:L.green,color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 2px 8px ${L.green}55`}}>▶️ Pointer mon arrivée</button>
        ):!ptDuJour.fin?(
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"10px 14px",background:L.greenBg,borderRadius:8,border:`1px solid ${L.green}33`}}>
              <div>
                <div style={{fontSize:11,color:L.textSm}}>Entrée à</div>
                <div style={{fontSize:20,fontWeight:800,color:L.green,fontFamily:"monospace"}}>{fmtHeure(ptDuJour.debut)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:L.textSm}}>En cours</div>
                <div style={{fontSize:20,fontWeight:800,color:L.navy,fontFamily:"monospace"}}>{dureeEnCours()}</div>
              </div>
            </div>
            <button onClick={pointerFin} style={{width:"100%",padding:"14px 14px",background:L.red,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>⏹ Pointer fin de journée</button>
          </>
        ):(
          <div style={{padding:"12px 14px",background:L.bg,borderRadius:8,border:`1px solid ${L.border}`}}>
            <div style={{fontSize:11,color:L.textSm,marginBottom:4}}>✓ Journée pointée</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:L.text}}>
              <span><strong>{fmtHeure(ptDuJour.debut)}</strong> → <strong>{fmtHeure(ptDuJour.fin)}</strong></span>
              <span style={{fontFamily:"monospace",fontWeight:700,color:L.green}}>{ptDuJour.total} h</span>
            </div>
          </div>
        )}
        {/* Mini récap semaine */}
        <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${L.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:L.textSm,marginBottom:6}}>
            <span>📊 7 derniers jours</span>
            <span style={{fontWeight:700,color:L.navy,fontFamily:"monospace"}}>Total : {totalSemaine.toFixed(1)} h</span>
          </div>
          <div style={{display:"flex",gap:3}}>
            {last7.map(d=>{
              const h=d.pt?.total||0;
              const isToday=d.key===todayKey;
              const dayLetter=["D","L","M","M","J","V","S"][d.date.getDay()];
              return(
                <div key={d.key} title={`${d.date.toLocaleDateString("fr-FR")} — ${h?h.toFixed(1)+"h":"—"}`} style={{flex:1,textAlign:"center"}}>
                  <div style={{height:30,display:"flex",alignItems:"flex-end",justifyContent:"center",marginBottom:3}}>
                    <div style={{width:"60%",height:`${Math.min(100,(h/8)*100)}%`,background:isToday?L.accent:(h>=7?L.green:h>=4?L.orange:h>0?L.textXs:"transparent"),borderRadius:2,minHeight:h>0?2:0}}/>
                  </div>
                  <div style={{fontSize:9,color:isToday?L.accent:L.textXs,fontWeight:isToday?700:500}}>{dayLetter}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Chantier(s) du jour */}
      <Card style={{padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:L.textMd,textTransform:"uppercase",letterSpacing:0.6,marginBottom:10}}>🏗 Chantier{chantiersDuJour.length>1?"s":""} du jour</div>
        {chantiersDuJour.length===0?(
          <div style={{padding:18,textAlign:"center",color:L.textSm,fontSize:12,fontStyle:"italic"}}>Aucun chantier planifié pour vous aujourd'hui.</div>
        ):chantiersDuJour.map(({chantier,phases})=>(
          <div key={chantier.id} style={{padding:"10px 12px",background:L.bg,borderRadius:8,marginBottom:8,border:`1px solid ${L.border}`}}>
            <div style={{fontSize:14,fontWeight:700,color:L.navy,marginBottom:3}}>{chantier.nom}</div>
            {chantier.client&&<div style={{fontSize:11,color:L.textSm,marginBottom:6}}>{chantier.client}{chantier.adresse?` · ${chantier.adresse}`:""}</div>}
            {phases.map(p=>{
              const av=Math.max(0,Math.min(100,+p.avancement||0));
              return(
                <div key={p.id} style={{padding:"6px 0",borderTop:`1px solid ${L.border}`,marginTop:6}}>
                  <div style={{fontSize:12,fontWeight:600,color:L.text,marginBottom:3}}>📍 {p.tache||"Phase"}</div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:L.textXs,marginBottom:4}}>
                    <span>📅 {p.dateDebut} · {p.dureeJours||1}j · {(p.salariesIds||[]).length} ouvrier{(p.salariesIds||[]).length>1?"s":""}</span>
                    <span style={{fontWeight:700,color:av>=80?L.green:av>=40?L.orange:L.textSm}}>{av}%</span>
                  </div>
                  <div style={{height:5,background:L.border,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${av}%`,background:av>=80?L.green:av>=40?L.orange:L.blue,transition:"width .25s"}}/>
                  </div>
                  {p.notes&&<div style={{fontSize:10,color:L.textSm,marginTop:5,fontStyle:"italic",lineHeight:1.4}}>📝 {p.notes}</div>}
                </div>
              );
            })}
            {/* Bouton caméra : photo du chantier → Storage + table chantier_photos
                → visible côté patron dans Média IA */}
            <WorkerPhotoButton chantierId={chantier.id} authUser={authUser}/>
          </div>
        ))}
      </Card>

      {/* Mes tâches */}
      <Card style={{padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:L.textMd,textTransform:"uppercase",letterSpacing:0.6,marginBottom:10,display:"flex",justifyContent:"space-between"}}>
          <span>✅ Mes tâches ({mesTaches.filter(t=>!t.done).length} à faire)</span>
        </div>
        {mesTaches.length===0?(
          <div style={{padding:14,textAlign:"center",color:L.textSm,fontSize:12,fontStyle:"italic"}}>Aucune tâche assignée. Le patron peut vous en attribuer dans le module Terrain → Checklist.</div>
        ):mesTaches.map(t=>(
          <label key={`${t.chantierId}-${t.id}`} style={{display:"flex",alignItems:"flex-start",gap:9,padding:"9px 11px",borderRadius:7,marginBottom:5,background:t.done?L.bg:L.surface,border:`1px solid ${t.done?L.border:L.borderMd}`,cursor:"pointer"}}>
            <input type="checkbox" checked={!!t.done} onChange={()=>toggleTache(t.chantierId,t.id)} style={{marginTop:2,width:18,height:18,accentColor:L.green,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:t.done?L.textXs:L.text,textDecoration:t.done?"line-through":"none",lineHeight:1.4}}>{t.texte}</div>
              <div style={{fontSize:9,color:L.textXs,marginTop:3}}>{t.chantierNom}{t.done&&t.doneAt?` · ✓ ${fmtDate(t.doneAt)}`:""}</div>
            </div>
          </label>
        ))}
      </Card>

      {/* Note de bas */}
      <div style={{padding:"10px 14px",background:L.navyBg,borderRadius:8,fontSize:11,color:L.navy,lineHeight:1.5,textAlign:"center"}}>
        ℹ️ Pour ajouter une photo, une note ou voir le détail d'un chantier, utilisez l'onglet <strong>Terrain</strong> dans la sidebar.
      </div>
    </div>
  );
}

// ─── VUE CHANTIERS ────────────────────────────────────────────────────────────
function VueChantiers({chantiers,setChantiers,selected,setSelected,salaries,statut,entreprise,terrainVisits={},onTerrainVisit}){
  const [tab,setTab]=useState("detail");
  const [showNew,setShowNew]=useState(false);
  const vp=useViewportSize();
  const compact=vp.w<768;
  const [nf,setNf]=useState({nom:"",client:"",adresse:"",statut:"planifié",devisHT:"",tva:"20",notes:""});
  const [bilanCh,setBilanCh]=useState(null);
  const s=STATUTS[statut];
  const ch=chantiers.find(c=>c.id===selected);
  function creer(){if(!nf.nom||!nf.client)return;const n={id:Date.now(),postes:[],planning:[],depensesReelles:[],checklist:{},photos:[],facturesFournisseurs:[],acompteEncaisse:0,soldeEncaisse:0,...nf,devisHT:parseFloat(nf.devisHT)||0,devisTTC:(parseFloat(nf.devisHT)||0)*1.2};setChantiers(cs=>[...cs,n]);setSelected(n.id);setShowNew(false);}
  const TABS_S=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"renta",label:"Rentabilité",icon:"📊"},{id:"suivi",label:"Suivi",icon:"✅"},{id:"terrain",label:"Terrain",icon:"🚧"}];
  const TABS_A=[{id:"detail",label:"Chantier",icon:"🏗"},{id:"renta",label:"Rentabilité",icon:"📊"},{id:"planning",label:"Planning",icon:"📅"},{id:"fourn",label:"Fournitures",icon:"🔧"},{id:"suivi",label:"Suivi",icon:"✅"},{id:"bilan",label:"Bilan",icon:"💹"},{id:"terrain",label:"Terrain",icon:"🚧"}];
  const baseTabs=s?.mode==="simple"?TABS_S:TABS_A;
  // Badge sur l'onglet Terrain si non lu pour le chantier sélectionné
  const tabs=baseTabs.map(t=>t.id==="terrain"&&ch&&chantierTerrainUnread(ch,terrainVisits)?{...t,badge:true}:t);
  // Marque la visite quand on entre sur l'onglet terrain
  useEffect(()=>{if(tab==="terrain"&&ch?.id&&onTerrainVisit)onTerrainVisit(ch.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab,ch?.id]);
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:10,flexWrap:"wrap"}}>
            <div><h1 style={{fontSize:18,fontWeight:800,color:L.text,margin:"0 0 3px"}}>{ch.nom}</h1><div style={{fontSize:11,color:L.textSm}}>{ch.client} · {ch.adresse}</div></div>
            <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
              <Btn onClick={()=>setBilanCh(ch)} variant="secondary" size="sm" icon="📊">Bilan PDF</Btn>
              <StatutSelect value={ch.statut} options={STATUTS_CHANTIER} onChange={s2=>setChantiers(cs=>cs.map(c=>c.id===ch.id?{...c,statut:s2}:c))}/>
              <button onClick={()=>{
                if(!window.confirm(`Supprimer le chantier "${ch.nom}" ? Cette action est irréversible.`))return;
                const restantes=chantiers.filter(c=>c.id!==ch.id);
                setChantiers(restantes);
                // Re-sélectionne le 1er chantier restant (ou aucun si liste vide)
                setSelected(restantes[0]?.id||null);
              }} title="Supprimer ce chantier" aria-label="Supprimer le chantier"
                style={{padding:"6px 12px",border:`1px solid ${L.red}55`,borderRadius:7,background:"transparent",color:L.red,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                🗑 Supprimer
              </button>
            </div>
          </div>
          <Tabs tabs={tabs} active={tab} onChange={setTab}/>
          {tab==="detail"&&<ChantierDetail ch={ch} salaries={salaries} statut={statut}/>}
          {tab==="renta"&&<ChantierRenta ch={ch} salaries={salaries} statut={statut}/>}
          {tab==="planning"&&<ChantierPlanningTab ch={ch} salaries={salaries} setChantiers={setChantiers}/>}
          {tab==="fourn"&&<ChantierFourn ch={ch}/>}
          {tab==="suivi"&&<ChantierSuivi ch={ch} setChantiers={setChantiers}/>}
          {tab==="bilan"&&<ChantierBilan ch={ch} salaries={salaries}/>}
          {tab==="terrain"&&<TerrainSection chantier={ch} setChantiers={setChantiers} salaries={salaries} currentUserName={entreprise?.nom||"Moi"}/>}
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
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{tSals.length>0?tSals.map(s=><span key={s.id} style={{background:L.blueBg,color:L.blue,borderRadius:7,padding:"1px 6px",fontSize:10,fontWeight:600}}>{(s.nom||"").split(" ")[0]||"—"}</span>):<span style={{fontSize:10,color:L.textXs,fontStyle:"italic"}}>aucun ouvrier affecté</span>}</div>
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
  // ─── Bilan par lot : budget devis vs dépenses réelles scannées ────────
  const budgetByLot=new Map();
  for(const p of (ch.postes||[])){
    const lot=p.lot||"Sans lot";
    const ht=(+p.qte||0)*(+p.prixUnitHT||0);
    budgetByLot.set(lot,(budgetByLot.get(lot)||0)+ht);
  }
  const depByLot=new Map();
  let depNonVentilees=0;
  for(const d of (ch.depensesReelles||[])){
    const m=+d.montantHT||+d.montant||0;
    if(d.lot){depByLot.set(d.lot,(depByLot.get(d.lot)||0)+m);}
    else{depNonVentilees+=m;}
  }
  const totDepensesReel=(ch.depensesReelles||[]).reduce((a,d)=>a+(+d.montantHT||+d.montant||0),0);
  const margeReelle=(+ch.devisHT||0)-totDepensesReel-cc.coutMO;
  const tauxMargeReel=ch.devisHT>0?Math.round((margeReelle/ch.devisHT)*100):0;
  const allLots=Array.from(new Set([...budgetByLot.keys(),...depByLot.keys()])).sort();
  // Couleur selon ratio dépense/budget : vert <70%, orange <90%, rouge >=90%
  function ratioColor(dep,bud){
    if(bud<=0)return dep>0?L.red:L.textXs;
    const r=dep/bud;
    if(r>=0.95)return L.red;
    if(r>=0.75)return L.orange;
    return L.green;
  }
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
      {/* ─── Bilan par lot : budget devis vs dépenses réelles scannées ──── */}
      {(allLots.length>0||depNonVentilees>0)&&(()=>{
        const reelColor=ratioColor(totDepensesReel,+ch.devisHT||0);
        const margeC=tauxMargeReel>=25?L.green:tauxMargeReel>=10?L.orange:L.red;
        return(
          <Card style={{overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
              <span>📊 Budget devis vs dépenses réelles par lot</span>
              <span style={{fontSize:10,color:L.textXs,fontWeight:500}}>Issues du scan facture (Terrain ou Compta)</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:L.bg}}>{["Lot","Budget HT","Dépensé réel HT","Écart","%"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
              <tbody>
                {allLots.map((lot,i)=>{
                  const bud=budgetByLot.get(lot)||0;
                  const dep=depByLot.get(lot)||0;
                  const ecart=bud-dep;
                  const ratioPct=bud>0?Math.round((dep/bud)*100):(dep>0?999:0);
                  const c=ratioColor(dep,bud);
                  const barW=Math.min(100,bud>0?(dep/bud)*100:(dep>0?100:0));
                  return(
                    <tr key={lot} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                      <td style={{padding:"8px 12px",fontSize:12,fontWeight:600}}>{lot}</td>
                      <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:L.navy}}>{euro(bud)}</td>
                      <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:c,fontWeight:700}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{minWidth:80}}>{euro(dep)}</span>
                          <div style={{flex:1,minWidth:60,height:5,background:L.bg,borderRadius:3,overflow:"hidden",border:`1px solid ${L.border}`}}>
                            <div style={{width:`${barW}%`,height:"100%",background:c,transition:"width .2s"}}/>
                          </div>
                        </div>
                      </td>
                      <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,fontWeight:700,color:ecart<0?L.red:ecart>0?L.green:L.textSm}}>{ecart>=0?"+":""}{euro(ecart)}</td>
                      <td style={{padding:"8px 12px"}}><span style={{background:c+"22",color:c,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{ratioPct}%</span></td>
                    </tr>
                  );
                })}
                {depNonVentilees>0&&(
                  <tr style={{borderBottom:`1px solid ${L.border}`,background:L.bg,fontStyle:"italic"}}>
                    <td style={{padding:"8px 12px",fontSize:11,color:L.textSm}}>⚠ Dépenses non ventilées (sans lot)</td>
                    <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:L.textXs}}>—</td>
                    <td style={{padding:"8px 12px",fontFamily:"monospace",fontSize:11,color:L.textSm}}>{euro(depNonVentilees)}</td>
                    <td colSpan={2} style={{padding:"8px 12px",fontSize:10,color:L.textXs}}>Sélectionnez un lot lors du scan pour ventilation</td>
                  </tr>
                )}
                <tr style={{background:reelColor+"08",borderTop:`2px solid ${reelColor}44`}}>
                  <td style={{...td,fontWeight:800}}>TOTAL</td>
                  <td style={{...tdr,fontWeight:800,fontSize:13,color:L.navy}}>{euro(ch.devisHT)}</td>
                  <td style={{...tdr,fontWeight:800,fontSize:13,color:reelColor}}>{euro(totDepensesReel)}</td>
                  <td style={{...tdr,fontWeight:800,fontSize:13,color:(+ch.devisHT||0)-totDepensesReel<0?L.red:L.green}}>{euro((+ch.devisHT||0)-totDepensesReel)}</td>
                  <td style={{padding:"8px 12px"}}><span style={{background:reelColor+"22",color:reelColor,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{ch.devisHT>0?Math.round((totDepensesReel/ch.devisHT)*100):0}%</span></td>
                </tr>
                <tr style={{background:margeC+"10",borderTop:`2px solid ${margeC}44`}}>
                  <td style={{...td,fontWeight:800,color:margeC}}>💎 MARGE RÉELLE (Devis HT − dépenses réelles − MO)</td>
                  <td colSpan={3} style={{...tdr,fontWeight:900,fontSize:14,color:margeC}}>{euro(margeReelle)}</td>
                  <td style={{padding:"8px 12px"}}><span style={{background:margeC+"22",color:margeC,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{tauxMargeReel}%</span></td>
                </tr>
              </tbody>
            </table>
            <div style={{padding:"8px 14px",fontSize:10,color:L.textXs,background:L.bg,lineHeight:1.5}}>
              🟢 vert &lt;75% du budget · 🟡 orange 75-95% · 🔴 rouge ≥95%. Marge réelle = Devis HT − dépenses fournisseurs scannées − MO chargée.
            </div>
          </Card>
        );
      })()}
    </div>
  );
}


// ─── VUE DEVIS avec IA LOCALE ─────────────────────────────────────────────────
// Liste devis vide : nouvel utilisateur démarre sans données démo.
const DOCS_INIT = [];

// ─── BILAN DEVIS : agrège calcLigneDevis sur toutes les lignes ──────────────
function calcBilanDevis(doc,statut){
  let ht=0,ttc=0,coutMO=0,coutFourn=0,fraisGeneraux=0,hTotal=0;
  for(const l of (doc?.lignes||[])){
    if(!isLigneDevis(l))continue;
    const r=calcLigneDevis(l,statut);
    if(!r)continue;
    ht+=r.montantHT;
    ttc+=r.montantHT*(1+(+l.tva||0)/100);
    coutMO+=r.coutMO;
    coutFourn+=r.coutFourn;
    fraisGeneraux+=r.fraisGeneraux;
    hTotal+=r.hTotal;
  }
  const prixRevient=coutMO+coutFourn+fraisGeneraux;
  const marge=ht-prixRevient;
  const tauxMarge=ht>0?Math.round((marge/ht)*100):0;
  return{ht:+ht.toFixed(2),ttc:+ttc.toFixed(2),coutMO:+coutMO.toFixed(2),coutFourn:+coutFourn.toFixed(2),fraisGeneraux:+fraisGeneraux.toFixed(2),prixRevient:+prixRevient.toFixed(2),marge:+marge.toFixed(2),tauxMarge,hTotal:+hTotal.toFixed(1)};
}
function BilanDevisModal({doc,statut,onClose}){
  const b=calcBilanDevis(doc,statut);
  // Seuils rentabilité : ≥20% vert · 10-20% orange · <10% rouge
  const couleur=b.tauxMarge>=20?L.green:b.tauxMarge>=10?L.orange:L.red;
  const couleurBg=b.tauxMarge>=20?(L.greenBg||"#D1FAE5"):b.tauxMarge>=10?(L.orangeBg||"#FEF3C7"):(L.redBg||"#FEE2E2");
  const label=b.tauxMarge>=20?"✓ Rentable":b.tauxMarge>=10?"⚠ Marge faible":"✗ Non rentable";
  const Row=({label,value,sub,strong,color})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"8px 0",borderBottom:`1px solid ${L.border}`}}>
      <div>
        <div style={{fontSize:12,fontWeight:strong?700:500,color:color||L.textMd}}>{label}</div>
        {sub&&<div style={{fontSize:10,color:L.textXs}}>{sub}</div>}
      </div>
      <div style={{fontSize:strong?15:13,fontWeight:strong?800:600,color:color||L.text,fontFamily:"monospace"}}>{value}</div>
    </div>
  );
  return(
    <Modal title={`📊 Bilan — ${doc.numero}`} onClose={onClose} maxWidth={460}>
      <div style={{padding:"4px 0 12px"}}>
        {/* Bandeau statut rentabilité */}
        <div style={{background:couleurBg,border:`2px solid ${couleur}`,borderRadius:10,padding:"14px 16px",marginBottom:14,textAlign:"center"}}>
          <div style={{fontSize:11,color:couleur,textTransform:"uppercase",letterSpacing:0.6,fontWeight:700}}>{label}</div>
          <div style={{fontSize:30,fontWeight:900,color:couleur,fontFamily:"monospace",marginTop:2}}>{b.tauxMarge}%</div>
          <div style={{fontSize:11,color:couleur,fontWeight:600,marginTop:2}}>de marge brute</div>
        </div>
        {/* Détail */}
        <Row label="Montant HT" value={euro(b.ht)} strong/>
        <Row label="Montant TTC" value={euro(b.ttc)}/>
        <Row label="Coût MO estimé" value={euro(b.coutMO)} sub={`${b.hTotal} h × taux moyen chargé`} color={L.navy}/>
        <Row label="Coût fournitures" value={euro(b.coutFourn)} color={L.navy}/>
        <Row label="Frais généraux" value={euro(b.fraisGeneraux)} sub="Charges sociales + structure" color={L.textSm}/>
        <Row label="Prix de revient total" value={euro(b.prixRevient)} strong color={L.text}/>
        <Row label="Marge brute" value={euro(b.marge)} strong color={couleur}/>
        <div style={{marginTop:12,padding:"10px 12px",background:L.bg,borderRadius:8,fontSize:10,color:L.textSm,lineHeight:1.5}}>
          Seuils : <strong style={{color:L.green}}>≥20% rentable</strong> · <strong style={{color:L.orange}}>10-20% faible</strong> · <strong style={{color:L.red}}>&lt;10% non rentable</strong>. Calculs basés sur le statut juridique <strong>{statut}</strong> (charges patronales + frais généraux).
        </div>
      </div>
    </Modal>
  );
}
function VueDevis({chantiers,salaries,sousTraitants,statut,entreprise,docs,setDocs,onConvertirChantier,onOpenChantier,onSaveOuvrage,pendingEditDocId,onPendingEditHandled,clients=[],setClients}){
  // Auto-création du client si saisi manuellement et pas encore dans la table.
  // Match sur nom (insensible casse) — si trouvé, lie clientId au doc.
  function autoCreateClientIfNeeded(doc){
    if(!setClients||!doc.client?.trim())return doc;
    const normNom=doc.client.trim().toLowerCase();
    const existing=(clients||[]).find(c=>{
      const fullName=(c.nom+(c.prenom?` ${c.prenom}`:"")).trim().toLowerCase();
      return c.nom.trim().toLowerCase()===normNom||fullName===normNom;
    });
    if(existing)return{...doc,clientId:existing.id};
    // Création auto
    const id=Date.now()+Math.floor(Math.random()*100);
    const newClient={
      id,
      nom:doc.client.trim(),
      prenom:"",
      email:doc.emailClient||"",
      telephone:doc.telClient||"",
      adresse:doc.adresseClient||"",
      type:"particulier",
      siret:"",
      notes:"Créé automatiquement depuis un devis",
      created_at:new Date().toISOString(),
    };
    setClients(cs=>[...cs,newClient]);
    return{...doc,clientId:id};
  }
  const [apercu,setApercu]=useState(null);
  const [bilanDoc,setBilanDoc]=useState(null);
  const [fournDoc,setFournDoc]=useState(null);
  const [signatureDoc,setSignatureDoc]=useState(null);
  const [acompteParent,setAcompteParent]=useState(null);
  const [devisDetail,setDevisDetail]=useState(null);
  const [showCreer,setShowCreer]=useState(false);
  const [editDoc,setEditDoc]=useState(null); // doc en cours d'édition (null = création)
  const [emailDoc,setEmailDoc]=useState(null);
  const [feuilleDoc,setFeuilleDoc]=useState(null);
  const [actionMenu,setActionMenu]=useState(null); // doc.id du menu d'actions ouvert (mobile)
  // Détection mobile : iPhone PORTRAIT (winW<768) MAIS aussi iPhone PAYSAGE
  // (844×390, 932×430…) où winW>768. On utilise la même règle que
  // sidebarCompact pour ne pas rater le cas paysage. useViewportSize force le
  // re-render sur resize/orientationchange.
  useViewportSize();
  const winW=typeof window!=="undefined"?window.innerWidth:1200;
  const winH=typeof window!=="undefined"?window.innerHeight:800;
  const isMobile=winW<768||winH<500||(winW<900&&winH<winW);
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
// ht/tva/ttc = total BASE (hors options). optionsHT/TVA/TTC = somme des
// blocs OPTION. acceptedOptions = sous-ensemble accepté (doc.optionsAccepted).
// totalAvecOptions = base + acceptées (montant facturable réel).
function calcDocTotal(d){
  if(!d)return{ht:0,tv:0,ttc:0,optionsHT:0,optionsTVA:0,optionsTTC:0,acceptedHT:0,acceptedTVA:0,acceptedTTC:0,optionsByid:new Map()};
  const items=d.lignes||[];
  const optionMap=ligneToOptionMap(items);
  const accepted=new Set((d.optionsAccepted||[]).map(x=>+x));
  let baseH=0,baseT=0,optH=0,optT=0,accH=0,accT=0;
  const optionsByid=new Map();
  for(const l of items){
    if(!isLigneDevis(l))continue;
    const ht=(+l.qte||0)*(+l.prixUnitHT||0);
    const tv=ht*((+l.tva||0)/100);
    const optId=optionMap.get(l.id);
    if(optId!=null){
      optH+=ht;optT+=tv;
      const cur=optionsByid.get(optId)||{ht:0,tv:0};
      cur.ht+=ht;cur.tv+=tv;
      optionsByid.set(optId,cur);
      if(accepted.has(+optId)){accH+=ht;accT+=tv;}
    }else{
      baseH+=ht;baseT+=tv;
    }
  }
  return{
    ht:+baseH.toFixed(2),tv:+baseT.toFixed(2),ttc:+(baseH+baseT).toFixed(2),
    optionsHT:+optH.toFixed(2),optionsTVA:+optT.toFixed(2),optionsTTC:+(optH+optT).toFixed(2),
    acceptedHT:+accH.toFixed(2),acceptedTVA:+accT.toFixed(2),acceptedTTC:+(accH+accT).toFixed(2),
    optionsByid,
  };
}
  // Création d'un avenant : nouveau devis lié au parent (devisOriginalId).
  // Numéro auto : <numero parent>-AV<n> où n = nb d'avenants existants + 1.
  // Lignes vidées (1 ligne vide), client/chantier copiés du parent.
  function creerAvenant(parent){
    const parentRoot=parent.devisOriginalId?docs.find(d=>d.id===parent.devisOriginalId)||parent:parent;
    const existants=docs.filter(d=>d.devisOriginalId===parentRoot.id);
    const num=existants.length+1;
    const avenant={
      id:Date.now(),
      type:"devis",
      numero:`${parentRoot.numero}-AV${num}`,
      date:new Date().toISOString().slice(0,10),
      client:parentRoot.client||"",
      titreChantier:parentRoot.titreChantier||"",
      emailClient:parentRoot.emailClient||"",
      telClient:parentRoot.telClient||"",
      adresseClient:parentRoot.adresseClient||"",
      statut:"brouillon",
      chantierId:parentRoot.chantierId||null,
      conditionsReglement:parentRoot.conditionsReglement||"40% à la commande – 60% à l'achèvement",
      notes:`Avenant n°${num} au devis ${parentRoot.numero}.`,
      acompteVerse:0,
      lignes:[{id:Date.now()+1,type:"ligne",libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10}],
      devisOriginalId:parentRoot.id,
      avenantNum:num,
    };
    setDocs(ds=>[avenant,...ds]);
    setEditDoc(avenant);
  }
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
        {isMobile?(
          /* MOBILE : liste de cartes empilées (3 lignes par devis) */
          <div>
            {docs.map((doc,i)=>{const t=calcDocTotal(doc);
              const parent=doc.devisOriginalId?docs.find(d=>d.id===doc.devisOriginalId):null;
              const chantierLie=doc.chantierId?(chantiers||[]).find(c=>c.id===doc.chantierId):null;
              const nomAffiche=chantierLie?.nom||doc.client||"—";
              const statutCfg=STATUT_CFG[doc.statut]||{c:L.textSm,b:L.bg};
              return(
                <div key={doc.id} style={{borderBottom:`1px solid ${L.border}`,padding:"12px 14px",background:i%2===0?L.surface:L.bg}}>
                  {/* Ligne 1 : N° + AV badge + date + nom chantier/client */}
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontFamily:"monospace",color:L.textSm,fontWeight:700}}>{doc.numero}</span>
                    {doc.devisOriginalId&&<span title={parent?`Avenant au devis ${parent.numero}`:"Avenant"} style={{background:"#FED7AA",color:"#9A3412",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:800,letterSpacing:0.3}}>AV{doc.avenantNum||1}</span>}
                    <span style={{fontSize:11,color:L.textXs,marginLeft:"auto"}}>{doc.date}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:L.text,marginBottom:6,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0,flex:"0 1 auto"}}>{nomAffiche}</span>
                    {chantierLie&&<span title={`Chantier #${chantierLie.id} lié`} style={{fontSize:11,color:L.green}}>🏗</span>}
                    {!chantierLie&&(doc.clientId||(clients||[]).some(c=>c.nom.trim().toLowerCase()===(doc.client||"").trim().toLowerCase()))&&<span title="Fiche client liée" style={{fontSize:11}}>👤</span>}
                    {doc.signature&&<span title={`Signé par ${doc.signerName||"client"}`} style={{padding:"1px 6px",borderRadius:5,background:L.greenBg||"#D1FAE5",color:L.green,fontSize:9,fontWeight:800,border:`1px solid ${L.green}55`,letterSpacing:0.3}}>✓ SIGNÉ</span>}
                    {doc.signatureToken&&!doc.signature&&doc.statut==="en attente signature"&&<span title="Lien de signature envoyé" style={{padding:"1px 6px",borderRadius:5,background:L.orangeBg||"#FEF3C7",color:L.orange||"#D97706",fontSize:9,fontWeight:800,border:`1px solid ${L.orange||"#D97706"}55`,letterSpacing:0.3}}>⏳</span>}
                  </div>
                  {chantierLie&&doc.client&&<div style={{fontSize:10,color:L.textXs,marginBottom:6,marginTop:-3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Client : {doc.client}</div>}
                  {/* Ligne 2 : statut éditable + montant HT */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,flexWrap:"wrap"}}>
                    <StatutSelect value={doc.statut} options={doc.type==="facture"?STATUTS_FACTURE:STATUTS_DEVIS} onChange={s=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,statut:s}))}/>
                    <span style={{fontSize:14,fontWeight:700,color:L.navy,fontFamily:"monospace",marginLeft:"auto"}}>{euro(t.ht)}</span>
                  </div>
                  {/* Ligne 3 : actions principales (Chantier / Avenant / Fact.) + ⋯ */}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {doc.chantierId&&<button onClick={()=>onOpenChantier?.(doc.chantierId)} title="Voir le chantier associé" style={{padding:"7px 11px",border:`1px solid ${L.green}`,borderRadius:7,background:L.greenBg,color:L.green,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Chantier</button>}
                    {doc.type==="devis"&&doc.statut==="accepté"&&!doc.chantierId&&<button onClick={()=>onConvertirChantier&&onConvertirChantier(doc)} title="Convertir en chantier" style={{padding:"7px 11px",border:`1px solid ${L.navy}`,borderRadius:7,background:L.navyBg,color:L.navy,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🏗 Chantier</button>}
                    {doc.type==="devis"&&<button onClick={()=>creerAvenant(doc)} title="Créer un avenant" style={{padding:"7px 11px",border:`1px solid #F59E0B`,borderRadius:7,background:"#FEF3C7",color:"#92400E",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📎 Avenant</button>}
                    {doc.type==="devis"&&<button onClick={()=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,type:"facture",statut:"en attente",numero:`FAC-${Date.now().toString().slice(-4)}`}))} title="Convertir en facture" style={{padding:"7px 11px",border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.green,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>→ Fact.</button>}
                    <button onClick={()=>setActionMenu(doc.id)} title="Plus d'actions" aria-label="Plus d'actions"
                      style={{marginLeft:"auto",width:38,height:36,border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.text,fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>⋯</button>
                  </div>
                </div>
              );
            })}
          </div>
        ):(
          /* DESKTOP : tableau classique avec toutes les colonnes */
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>{["N°","Date","Chantier / Client","HT","Statut","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {docs.map((doc,i)=>{const t=calcDocTotal(doc);
                const parent=doc.devisOriginalId?docs.find(d=>d.id===doc.devisOriginalId):null;
                const chantierLie=doc.chantierId?(chantiers||[]).find(c=>c.id===doc.chantierId):null;
                const nomAffiche=chantierLie?.nom||doc.client||"—";
                return(
                <tr key={doc.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"9px 12px",fontSize:12,color:L.textSm,fontFamily:"monospace"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span>{doc.numero}</span>
                      {doc.devisOriginalId&&<span title={parent?`Avenant au devis ${parent.numero}`:"Avenant"} style={{background:"#FED7AA",color:"#9A3412",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:800,fontFamily:"inherit",letterSpacing:0.3}}>AV{doc.avenantNum||1}</span>}
                      {parent&&<span title={`Voir le devis original ${parent.numero}`} style={{fontSize:9,color:L.textXs,fontFamily:"inherit"}}>↳ {parent.numero}</span>}
                    </div>
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12}}>{doc.date}</td>
                  <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0,flexWrap:"wrap"}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nomAffiche}</span>
                      {chantierLie&&<span title={`Chantier #${chantierLie.id} lié`} style={{fontSize:10,color:L.green}}>🏗</span>}
                      {!chantierLie&&(doc.clientId||(clients||[]).some(c=>c.nom.trim().toLowerCase()===(doc.client||"").trim().toLowerCase()))&&<span title="Fiche client liée" style={{fontSize:10}}>👤</span>}
                      {doc.signature&&<span title={`Signé électroniquement par ${doc.signerName||"client"}${doc.signedAt?` le ${new Date(doc.signedAt).toLocaleString("fr-FR")}`:""}`} style={{padding:"1px 7px",borderRadius:5,background:L.greenBg||"#D1FAE5",color:L.green,fontSize:9,fontWeight:800,border:`1px solid ${L.green}55`,letterSpacing:0.3}}>✓ SIGNÉ</span>}
                      {doc.signatureToken&&!doc.signature&&doc.statut==="en attente signature"&&<span title="Lien de signature envoyé — en attente du client" style={{padding:"1px 7px",borderRadius:5,background:L.orangeBg||"#FEF3C7",color:L.orange||"#D97706",fontSize:9,fontWeight:800,border:`1px solid ${L.orange||"#D97706"}55`,letterSpacing:0.3}}>⏳ ATTENTE</span>}
                    </div>
                    {chantierLie&&doc.client&&<div style={{fontSize:9,color:L.textXs,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Client : {doc.client}</div>}
                    {doc.signature&&doc.signedAt&&<div style={{fontSize:9,color:L.green,marginTop:1}}>Signé le {new Date(doc.signedAt).toLocaleDateString("fr-FR")} à {new Date(doc.signedAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>}
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace"}}>{euro(t.ht)}</td>
                  <td style={{padding:"9px 12px"}}><StatutSelect value={doc.statut} options={doc.type==="facture"?STATUTS_FACTURE:STATUTS_DEVIS} onChange={s=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,statut:s}))}/></td>
                  <td style={{padding:"9px 12px"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      {/* GROUPE GAUCHE — icônes (toujours visibles, tooltips au hover) */}
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>setDevisDetail(doc)} title="Voir le devis" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>👁</button>
                        {doc.type==="devis"&&<button onClick={()=>setBilanDoc(doc)} title="Bilan rentabilité du devis" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.green,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📊</button>}
                        {doc.type==="devis"&&<button onClick={()=>setFournDoc(doc)} title="Liste des fournitures (PDF — bon de commande interne)" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📦</button>}
                        <button onClick={()=>setEditDoc(doc)} title="Modifier le devis" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                        <button onClick={()=>setApercu(doc)} title="Aperçu impression" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🖨</button>
                        <button onClick={()=>setEmailDoc(doc)} title="Envoyer par email" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.purple,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📧</button>
                        <button onClick={()=>setFeuilleDoc(doc)} title="Feuille de chantier (sans prix)" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📋</button>
                      </div>
                      {/* GROUPE DROITE — boutons texte conditionnels selon statut */}
                      <div style={{display:"flex",gap:5,marginLeft:"auto",flexWrap:"wrap"}}>
                        {doc.type==="devis"&&doc.statut==="accepté"&&<button onClick={()=>{setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,bonPourAccord:true}));setApercu({...doc,bonPourAccord:true});}} title="PDF avec mention 'Bon pour accord' + zone signature" style={{padding:"4px 8px",border:`1px solid ${L.purple}`,borderRadius:6,background:"#F5F3FF",color:L.purple,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📝 Bon pour accord</button>}
                        {doc.type==="devis"&&!doc.signature&&(doc.statut==="accepté"||doc.statut==="en attente signature")&&<button onClick={()=>setSignatureDoc(doc)} title={doc.statut==="en attente signature"?"Renvoyer le lien de signature":"Envoyer un lien de signature électronique au client"} style={{padding:"4px 8px",border:`1px solid ${L.green}`,borderRadius:6,background:L.greenBg||"#D1FAE5",color:L.green,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✍️ {doc.statut==="en attente signature"?"Renvoyer":"Signature"}</button>}
                        {((doc.type==="devis"&&doc.statut==="accepté")||doc.type==="facture")&&<button onClick={()=>setAcompteParent(doc)} title="Créer une facture d'acompte" style={{padding:"4px 8px",border:`1px solid ${L.purple}`,borderRadius:6,background:L.surface,color:L.purple,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💰 Acompte</button>}
                        {/* Chantier — un seul bouton à la fois selon l'état :
                            - convertir si devis accepté sans chantier lié
                            - ouvrir si chantier déjà associé */}
                        {doc.type==="devis"&&doc.statut==="accepté"&&!doc.chantierId&&<button onClick={()=>onConvertirChantier&&onConvertirChantier(doc)} title="Convertir ce devis en chantier" style={{padding:"4px 8px",border:`1px solid ${L.navy}`,borderRadius:6,background:L.navyBg,color:L.navy,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>→ Chantier</button>}
                        {doc.chantierId&&<button onClick={()=>onOpenChantier?.(doc.chantierId)} title={`Voir le chantier #${doc.chantierId}`} style={{padding:"4px 8px",border:`1px solid ${L.green}`,borderRadius:6,background:L.greenBg,color:L.green,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ Chantier</button>}
                        {doc.type==="devis"&&<button onClick={()=>creerAvenant(doc)} title="Créer un avenant lié à ce devis" style={{padding:"4px 8px",border:`1px solid #F59E0B`,borderRadius:6,background:"#FEF3C7",color:"#92400E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔧 Avenant</button>}
                        {doc.type==="devis"&&<button onClick={()=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,type:"facture",statut:"en attente",numero:`FAC-${Date.now().toString().slice(-4)}`}))} title="Convertir en facture" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.green,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>→ Fact.</button>}
                        <button onClick={()=>{if(window.confirm(`Supprimer le devis ${doc.numero} ?`))setDocs(ds=>ds.filter(d=>d.id!==doc.id));}} title="Supprimer ce devis" style={{padding:"4px 8px",border:`1px solid ${L.red}55`,borderRadius:6,background:"transparent",color:L.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✕ Supprimer</button>
                      </div>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        )}
      </Card>

      {/* Mobile : feuille d'actions (bottom sheet) déclenchée par le bouton ⋯ */}
      {actionMenu&&(()=>{
        const doc=docs.find(d=>d.id===actionMenu);
        if(!doc)return null;
        const close=()=>setActionMenu(null);
        const wrap=(fn)=>()=>{fn();close();};
        const acts=[];
        acts.push({icon:"👁",label:"Voir le devis",onClick:wrap(()=>setDevisDetail(doc))});
        acts.push({icon:"✏️",label:"Modifier",onClick:wrap(()=>setEditDoc(doc))});
        if(doc.type==="devis")acts.push({icon:"📊",label:"Bilan rentabilité",onClick:wrap(()=>setBilanDoc(doc))});
        if(doc.type==="devis")acts.push({icon:"📦",label:"Fournitures (PDF)",onClick:wrap(()=>setFournDoc(doc))});
        if(doc.type==="devis"&&!doc.signature&&(doc.statut==="accepté"||doc.statut==="en attente signature"))acts.push({icon:"✍️",label:doc.statut==="en attente signature"?"Renvoyer signature électronique":"Signature électronique",onClick:wrap(()=>setSignatureDoc(doc)),color:L.green});
        if(doc.type==="devis"&&doc.statut!=="brouillon"&&doc.statut!=="refusé")acts.push({icon:"💰",label:"Acompte",onClick:wrap(()=>setAcompteParent(doc)),color:L.purple});
        acts.push({icon:"🖨",label:"Aperçu / Imprimer",onClick:wrap(()=>setApercu(doc))});
        acts.push({icon:"📋",label:"Feuille de chantier",onClick:wrap(()=>setFeuilleDoc(doc))});
        acts.push({icon:"📧",label:"Envoyer par email",onClick:wrap(()=>setEmailDoc(doc))});
        if(doc.type==="devis"&&(doc.statut==="accepté"||doc.statut==="signé"))acts.push({icon:"📝",label:"Bon pour accord",onClick:wrap(()=>{setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,bonPourAccord:true}));setApercu({...doc,bonPourAccord:true});})});
        // Note : Chantier / Avenant / Convertir en facture sont maintenant
        // accessibles directement sur la ligne mobile (pas dans cette feuille).
        const statuts=doc.type==="facture"?STATUTS_FACTURE:STATUTS_DEVIS;
        return(
          <div onClick={close} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:L.surface,borderRadius:"14px 14px 0 0",width:"100%",maxWidth:480,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 -4px 24px rgba(0,0,0,0.25)"}}>
              <div style={{padding:"12px 16px 10px",borderBottom:`1px solid ${L.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:L.text,fontFamily:"monospace"}}>{doc.numero}</div>
                  <div style={{fontSize:11,color:L.textSm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.client||"—"}</div>
                </div>
                <button onClick={close} aria-label="Fermer" style={{background:L.bg,border:"none",borderRadius:8,width:32,height:32,fontSize:16,cursor:"pointer",color:L.textSm,fontFamily:"inherit"}}>✕</button>
              </div>
              <div style={{padding:"10px 16px",borderBottom:`1px solid ${L.border}`,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:L.textSm,fontWeight:600}}>Statut</span>
                <StatutSelect value={doc.statut} options={statuts} onChange={s=>setDocs(ds=>ds.map(d=>d.id!==doc.id?d:{...d,statut:s}))}/>
              </div>
              <div style={{overflowY:"auto",flex:1}}>
                {acts.map((a,i)=>(
                  <button key={i} onClick={a.onClick} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",border:"none",borderBottom:`1px solid ${L.border}`,background:"transparent",fontSize:14,color:a.color||L.text,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
                    <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>{a.icon}</span>
                    <span style={{fontWeight:500}}>{a.label}</span>
                  </button>
                ))}
                <button onClick={wrap(()=>{if(window.confirm(`Supprimer définitivement le devis ${doc.numero} ?`))setDocs(ds=>ds.filter(d=>d.id!==doc.id));})} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 18px",border:"none",background:"transparent",fontSize:14,color:L.red,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
                  <span style={{fontSize:20,width:26,textAlign:"center",flexShrink:0}}>✕</span>
                  <span style={{fontWeight:500}}>Supprimer</span>
                </button>
              </div>
              <button onClick={close} style={{width:"100%",padding:"14px 16px",border:"none",borderTop:`2px solid ${L.border}`,background:L.bg,fontSize:14,fontWeight:700,color:L.textSm,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
            </div>
          </div>
        );
      })()}
      
      {devisDetail&&<VueDevisDetail devis={devisDetail} onClose={()=>setDevisDetail(null)} onSave={(d)=>{setDocs(docs.map(x=>x.id===d.id?d:x));setDevisDetail(null);}}/>}
      {showCreer&&<Modal title="Nouveau devis + IA désignation" onClose={closeCreer} maxWidth={960} closeOnOverlay={false}><CreateurDevis chantiers={chantiers} salaries={salaries} sousTraitants={sousTraitants} statut={statut} docs={docs} clients={clients} setClients={setClients} onSave={doc=>{creerDirtyRef.current=false;const docWithClient=autoCreateClientIfNeeded(doc);setDocs(ds=>[...ds,docWithClient]);setShowCreer(false);}} onClose={closeCreer} onDirtyChange={handleCreerDirty} onSaveOuvrage={onSaveOuvrage}/></Modal>}
      {editDoc&&<Modal title={`Modifier ${editDoc.numero}`} onClose={closeCreer} maxWidth={960} closeOnOverlay={false}><CreateurDevis chantiers={chantiers} salaries={salaries} sousTraitants={sousTraitants} statut={statut} docs={docs} clients={clients} setClients={setClients} initialDoc={editDoc} onSave={doc=>{creerDirtyRef.current=false;const docWithClient=autoCreateClientIfNeeded(doc);setDocs(ds=>ds.map(d=>d.id===editDoc.id?{...editDoc,...docWithClient,id:editDoc.id}:d));setEditDoc(null);}} onClose={closeCreer} onDirtyChange={handleCreerDirty} onSaveOuvrage={onSaveOuvrage}/></Modal>}
      {apercu&&<Modal title={`Aperçu — ${apercu.numero}`} onClose={()=>setApercu(null)} maxWidth={820}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setApercu(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <ApercuDevis doc={apercu} entreprise={entreprise} calcDocTotal={calcDocTotal} acomptes={docs.filter(d=>d.acompteParentId===apercu.id&&d.statut==="payé")}/>
        </div>
      </Modal>}
      {acompteParent&&<AcompteModal parent={acompteParent} parentTTC={calcDocTotal(acompteParent).ttc} allDocs={docs} onSave={fa=>{setDocs(ds=>[fa,...ds]);setAcompteParent(null);}} onClose={()=>setAcompteParent(null)}/>}
      {bilanDoc&&<BilanDevisModal doc={bilanDoc} statut={statut} onClose={()=>setBilanDoc(null)}/>}
      {signatureDoc&&<EnvoiSignatureModal doc={signatureDoc} entreprise={entreprise}
        onSent={patch=>{
          setDocs(ds=>ds.map(d=>d.id===signatureDoc.id?{...d,...patch}:d));
          setSignatureDoc(null);
        }}
        onClose={()=>setSignatureDoc(null)}/>}
      {fournDoc&&<Modal title={`📦 Liste des fournitures — ${fournDoc.numero}`} onClose={()=>setFournDoc(null)} maxWidth={900}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setFournDoc(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <ApercuListeFournitures doc={fournDoc} entreprise={entreprise} chantier={fournDoc.chantierId?(chantiers||[]).find(c=>c.id===fournDoc.chantierId):null}/>
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

// ─── VUE FACTURES (option A — filtre docs[type==="facture"]) ────────────────
// ─── PDF LISTE FOURNITURES (extrait d'un devis, regroupé par fournisseur) ──
// Bon de commande interne : pour transmettre au fournisseur ou utiliser comme
// liste d'achats. Agrège les fournitures de toutes les lignes du devis avec
// leur lot d'origine, prix d'achat HT, et totaux par fournisseur.
function ApercuListeFournitures({doc,entreprise,chantier}){
  // Extract toutes les fournitures avec leur contexte (lot + ligne parente)
  const items=[];
  let currentLot="(Sans lot)";
  for(const l of (doc?.lignes||[])){
    if(l.type==="titre"){currentLot=l.libelle||"(Sans titre)";continue;}
    if(!isLigneDevis(l))continue;
    const qteLigne=+l.qte||0;
    const tva=+l.tva||0;
    for(const f of (l.fournitures||[])){
      if(!f.designation)continue;
      const qteParUnit=+(f.qte||1);
      const qteTotal=+(qteParUnit*qteLigne).toFixed(3);
      const prix=+(f.prixAchat||f.prixVente||0);
      items.push({
        lot:currentLot,
        ligneLibelle:l.libelle||"",
        fournisseur:(f.fournisseur||"").trim()||"Non renseigné",
        designation:f.designation,
        qte:qteTotal,
        unite:f.unite||"U",
        prixHT:prix,
        totalHT:+(qteTotal*prix).toFixed(2),
        tva,
      });
    }
  }
  // Group by fournisseur
  const groupes={};
  for(const it of items){
    if(!groupes[it.fournisseur])groupes[it.fournisseur]=[];
    groupes[it.fournisseur].push(it);
  }
  const totalHT=+items.reduce((a,it)=>a+it.totalHT,0).toFixed(2);
  const totalTVA=+items.reduce((a,it)=>a+it.totalHT*it.tva/100,0).toFixed(2);
  const totalTTC=+(totalHT+totalTVA).toFixed(2);
  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",color:"#1E293B",fontSize:12}}>
      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:"2px solid #1B3A5C",gap:16}}>
        <div style={{flex:"0 0 auto",minWidth:120,display:"flex",alignItems:"center"}}>
          {entreprise?.logo
            ? <img src={entreprise.logo} alt={entreprise.nom||"logo"} style={{maxHeight:70,maxWidth:200,objectFit:"contain"}}/>
            : <div style={{fontSize:18,fontWeight:900,color:"#1B3A5C",letterSpacing:-0.3}}>{entreprise?.nomCourt||entreprise?.nom||""}</div>}
        </div>
        <div style={{textAlign:"right",fontSize:10,color:"#64748B",lineHeight:1.7}}>
          <div style={{fontSize:13,fontWeight:800,color:"#1B3A5C",marginBottom:2}}>{entreprise?.nom}</div>
          {entreprise?.adresse&&<>{entreprise.adresse}<br/></>}
          {(entreprise?.tel||entreprise?.email)&&<>{[entreprise.tel,entreprise.email].filter(Boolean).join(" · ")}<br/></>}
          {entreprise?.siret&&<>SIRET : {entreprise.siret}</>}
        </div>
      </div>
      {/* Titre */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
        <div style={{fontSize:16,fontWeight:900,color:"#1B3A5C",textTransform:"uppercase",letterSpacing:0.6}}>📦 Liste des fournitures</div>
        <div style={{color:"#475569",fontSize:11}}>{doc.date}</div>
      </div>
      {/* Contexte */}
      <div style={{background:"#F8FAFC",borderRadius:7,padding:"10px 12px",marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:11}}>
          <div><span style={{color:"#64748B",fontSize:9,textTransform:"uppercase",letterSpacing:0.4}}>Devis source</span><div style={{fontWeight:700,color:"#1B3A5C",fontFamily:"monospace",marginTop:2}}>{doc.numero}</div></div>
          <div><span style={{color:"#64748B",fontSize:9,textTransform:"uppercase",letterSpacing:0.4}}>{chantier?"Chantier":"Client"}</span><div style={{fontWeight:700,color:"#1B3A5C",marginTop:2}}>{chantier?.nom||doc.client||"—"}</div></div>
        </div>
        {chantier?.adresse&&<div style={{fontSize:11,color:"#475569",marginTop:5}}>📍 {chantier.adresse}</div>}
        {doc.titreChantier&&!chantier&&<div style={{fontSize:11,color:"#1B3A5C",marginTop:5,fontStyle:"italic"}}>Objet : {doc.titreChantier}</div>}
      </div>
      {items.length===0?(
        <div style={{padding:30,textAlign:"center",color:"#64748B",fontSize:12,background:"#F8FAFC",borderRadius:8}}>
          <div style={{fontSize:30,marginBottom:8}}>📦</div>
          <div style={{fontWeight:600,color:"#1E293B"}}>Aucune fourniture détaillée dans ce devis</div>
          <div style={{marginTop:6,fontSize:11}}>Les lignes du devis n'ont pas de fournitures saisies. Utilisez l'IA ou ajoutez-les manuellement.</div>
        </div>
      ):(
        Object.entries(groupes).sort(([a],[b])=>a.localeCompare(b)).map(([fourn,list])=>{
          const subHT=+list.reduce((a,it)=>a+it.totalHT,0).toFixed(2);
          return(
            <div key={fourn} style={{marginBottom:14,border:"1px solid #E2E8F0",borderRadius:7,overflow:"hidden"}}>
              <div style={{background:"#1B3A5C",color:"#fff",padding:"7px 11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:12,fontWeight:800,letterSpacing:0.4}}>🏭 {fourn} <span style={{fontWeight:500,opacity:0.8,fontSize:10,marginLeft:6}}>({list.length} référence{list.length>1?"s":""})</span></div>
                <div style={{fontSize:12,fontWeight:800,fontFamily:"monospace"}}>{fmt2(subHT)} € HT</div>
              </div>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#F8FAFC"}}>{["Lot","Désignation","Qté","U","P.U. HT","Total HT"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"5px 8px",fontSize:9,color:"#64748B",fontWeight:600,textTransform:"uppercase",borderBottom:"1px solid #E2E8F0"}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {list.map((it,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #F1F5F9",background:i%2===0?"#fff":"#FAFBFC"}}>
                      <td style={{padding:"5px 8px",fontSize:10,color:"#64748B",whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>{it.lot}</td>
                      <td style={{padding:"5px 8px",fontSize:11}}>{it.designation}</td>
                      <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"monospace"}}>{it.qte}</td>
                      <td style={{padding:"5px 8px",fontSize:11,color:"#64748B"}}>{it.unite}</td>
                      <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"monospace"}}>{fmt2(it.prixHT)} €</td>
                      <td style={{padding:"5px 8px",fontSize:11,textAlign:"right",fontFamily:"monospace",fontWeight:700}}>{fmt2(it.totalHT)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
      {/* Totaux */}
      {items.length>0&&(
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
          <div style={{minWidth:240,background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:7,padding:"10px 14px"}}>
            {[["Total HT",totalHT],["TVA",totalTVA],["TOTAL TTC",totalTTC]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:l!=="TOTAL TTC"?"1px solid #E2E8F0":"none"}}>
                <span style={{color:"#475569",fontSize:12}}>{l}</span>
                <span style={{fontWeight:l==="TOTAL TTC"?900:600,color:l==="TOTAL TTC"?"#1B3A5C":"#374151",fontFamily:"monospace",fontSize:l==="TOTAL TTC"?14:12}}>{fmt2(v)} €</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Mention */}
      <div style={{marginTop:18,paddingTop:10,borderTop:"1px solid #E2E8F0",fontSize:9,color:"#94A3B8",lineHeight:1.5,fontStyle:"italic"}}>
        ⚠ Bon de commande interne — Document généré automatiquement à partir du devis {doc.numero}. Les prix sont indicatifs (saisis dans le devis) et doivent être confirmés auprès de chaque fournisseur avant commande ferme.
      </div>
    </div>
  );
}

// ─── HELPERS COMMANDES FOURNISSEUR ──────────────────────────────────────────
function nextBCNumero(commandes){
  const year=new Date().getFullYear();
  const prefix=`BC-${year}-`;
  const max=(commandes||[]).reduce((m,c)=>{
    if(!(c.numero||"").startsWith(prefix))return m;
    const n=parseInt((c.numero||"").slice(prefix.length),10);
    return isNaN(n)?m:Math.max(m,n);
  },0);
  return `${prefix}${String(max+1).padStart(3,"0")}`;
}
function calcCommandeTotal(c){
  let ht=0,tv=0;
  for(const l of (c?.lignes||[])){
    const lh=(+l.qte||0)*(+l.prixUnitHT||0);
    ht+=lh;tv+=lh*((+l.tva||0)/100);
  }
  return{ht:+ht.toFixed(2),tv:+tv.toFixed(2),ttc:+(ht+tv).toFixed(2)};
}
const STATUTS_BC=["brouillon","envoyée","reçue","payée"];
const STATUTS_BC_COLORS={
  "brouillon":{bg:"#F1F5F9",fg:"#475569",border:"#CBD5E1"},
  "envoyée":{bg:"#DBEAFE",fg:"#1D4ED8",border:"#93C5FD"},
  "reçue":{bg:"#FEF3C7",fg:"#D97706",border:"#FCD34D"},
  "payée":{bg:"#D1FAE5",fg:"#059669",border:"#86EFAC"},
};

// ─── PDF BON DE COMMANDE ────────────────────────────────────────────────────
function ApercuCommandeFournisseur({commande,fournisseur,entreprise,chantier}){
  const t=calcCommandeTotal(commande);
  return(
    <div style={{fontFamily:"'Segoe UI',Arial,sans-serif",color:"#1E293B",fontSize:12}}>
      {/* En-tête */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:"2px solid #1B3A5C",gap:16}}>
        <div style={{flex:"0 0 auto",minWidth:120,display:"flex",alignItems:"center"}}>
          {entreprise?.logo
            ? <img src={entreprise.logo} alt={entreprise.nom||"logo"} style={{maxHeight:70,maxWidth:200,objectFit:"contain"}}/>
            : <div style={{fontSize:18,fontWeight:900,color:"#1B3A5C",letterSpacing:-0.3}}>{entreprise?.nomCourt||entreprise?.nom||""}</div>}
        </div>
        <div style={{textAlign:"right",fontSize:10,color:"#64748B",lineHeight:1.7}}>
          <div style={{fontSize:13,fontWeight:800,color:"#1B3A5C",marginBottom:2}}>{entreprise?.nom}</div>
          {entreprise?.adresse&&<>{entreprise.adresse}<br/></>}
          {(entreprise?.tel||entreprise?.email)&&<>{[entreprise.tel,entreprise.email].filter(Boolean).join(" · ")}<br/></>}
          {entreprise?.siret&&<>SIRET : {entreprise.siret}</>}
        </div>
      </div>
      {/* Titre BC */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:800,color:"#1B3A5C",textTransform:"uppercase",letterSpacing:0.5}}>BON DE COMMANDE N° {commande.numero}</div>
        <div style={{color:"#475569",fontSize:11}}>{commande.date}</div>
      </div>
      {/* Fournisseur destinataire */}
      <div style={{background:"#F8FAFC",borderRadius:7,padding:"10px 12px",marginBottom:12}}>
        <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>À l'attention de</div>
        <div style={{fontWeight:700,color:"#1B3A5C",fontSize:13}}>{fournisseur?.nom||commande.fournisseurNom||"Fournisseur"}</div>
        {fournisseur?.adresse&&<div style={{color:"#475569",fontSize:11,marginTop:2}}>{fournisseur.adresse}</div>}
        {(fournisseur?.tel||fournisseur?.email)&&<div style={{color:"#475569",fontSize:11,marginTop:2}}>{[fournisseur.tel,fournisseur.email].filter(Boolean).join(" · ")}</div>}
        {chantier&&<div style={{color:"#1B3A5C",fontSize:11,fontWeight:600,marginTop:5,fontStyle:"italic"}}>Pour le chantier : {chantier.nom||`#${chantier.id}`}{chantier.adresse?` — ${chantier.adresse}`:""}</div>}
        {commande.dateLivraisonSouhaitee&&<div style={{color:"#1B3A5C",fontSize:11,fontWeight:600,marginTop:3}}>Livraison souhaitée : {commande.dateLivraisonSouhaitee}</div>}
      </div>
      {/* Lignes */}
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}>
        <thead><tr style={{background:"#1B3A5C",color:"#fff"}}>{["Désignation","Qté","U","P.U. HT","Total HT"].map(h=><th key={h} style={{padding:"6px 9px",fontSize:9,textAlign:"left",fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{(commande.lignes||[]).map((l,i)=>(
          <tr key={l.id||i} style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"#fff":"#F8FAFC"}}>
            <td style={{padding:"6px 9px",fontSize:11,whiteSpace:"pre-wrap"}}>{l.libelle}</td>
            <td style={{padding:"6px 9px",textAlign:"right",color:"#64748B",fontSize:11}}>{l.qte}</td>
            <td style={{padding:"6px 9px",color:"#64748B",fontSize:11}}>{l.unite}</td>
            <td style={{padding:"6px 9px",textAlign:"right",fontSize:11,fontFamily:"monospace"}}>{fmt2(l.prixUnitHT)} €</td>
            <td style={{padding:"6px 9px",textAlign:"right",fontWeight:600,fontSize:11,fontFamily:"monospace"}}>{fmt2((+l.qte||0)*(+l.prixUnitHT||0))} €</td>
          </tr>
        ))}</tbody>
      </table>
      {/* Totaux */}
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <div style={{minWidth:200}}>{[["Montant HT",t.ht],["TVA",t.tv],["TOTAL TTC",t.ttc]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #E2E8F0"}}>
            <span style={{color:"#475569",fontSize:12}}>{l}</span>
            <span style={{fontWeight:l==="TOTAL TTC"?800:500,color:l==="TOTAL TTC"?"#1B3A5C":"#374151",fontFamily:"monospace",fontSize:l==="TOTAL TTC"?13:12}}>{fmt2(v)} €</span>
          </div>
        ))}</div>
      </div>
      {commande.notes&&<div style={{marginTop:14,padding:"10px 12px",background:"#FEF3C7",borderRadius:6,fontSize:11,color:"#92400E"}}>{commande.notes}</div>}
      {/* Mentions */}
      <div style={{marginTop:18,paddingTop:10,borderTop:"1px solid #E2E8F0",fontSize:9,color:"#94A3B8",lineHeight:1.5}}>
        Bon de commande émis par {entreprise?.nom||"l'entreprise"}. À retourner signé pour acceptation. Conditions standards de paiement : 30 jours fin de mois sauf accord contraire.
      </div>
    </div>
  );
}

// ─── CATALOGUES FOURNISSEURS (CSV import + recherche) ──────────────────────
// Liste indicative des fournisseurs BTP majeurs en France. Le user peut
// aussi enregistrer n'importe quel autre fournisseur dans ses fiches.
const CATALOGUES_BTP_SUPPORTES=[
  {key:"pointp",nom:"Point P",icon:"🏗",color:"#E30613",siret:"384241321"},
  {key:"gedimat",nom:"Gedimat",icon:"🧱",color:"#0066CC"},
  {key:"leroymerlinpro",nom:"Leroy Merlin Pro",icon:"🛠",color:"#78BE20"},
  {key:"saintgobain",nom:"Saint-Gobain Distribution",icon:"📐",color:"#003B7A"},
  {key:"kiloutou",nom:"Kiloutou",icon:"🚜",color:"#F7B500"},
  {key:"loxam",nom:"Loxam",icon:"🏭",color:"#0066B3"},
  {key:"brico",nom:"Brico Dépôt",icon:"🪛",color:"#E40521"},
  {key:"prolians",nom:"Prolians",icon:"⚙️",color:"#005CA9"},
];
// Parse un CSV (séparateur , ou ;) avec colonnes attendues :
// référence, désignation, unité, prix_ht. Tolère noms FR/EN, ordre libre.
function parseCatalogueCSV(text){
  const lines=String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(lines.length<2)return{produits:[],error:"Fichier vide ou sans données"};
  // Détecte le séparateur dominant sur la 1ère ligne
  const semi=(lines[0].match(/;/g)||[]).length;
  const comma=(lines[0].match(/,/g)||[]).length;
  const sep=semi>comma?";":",";
  // Headers normalisés
  const headers=lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/[\s_-]/g,""));
  const findCol=patterns=>headers.findIndex(h=>patterns.some(p=>h.includes(p)));
  const refIdx=findCol(["ref","reference","code","sku"]);
  const designIdx=findCol(["designation","libelle","nom","description","produit","article"]);
  const uniteIdx=findCol(["unite","unit","u"]);
  const prixIdx=findCol(["prixht","priceht","prix","price","tarif","pu"]);
  if(designIdx<0||prixIdx<0)return{produits:[],error:"Colonnes manquantes : il faut au minimum 'désignation' et 'prix_ht'"};
  const produits=[];
  for(const line of lines.slice(1)){
    const cells=line.split(sep);
    const desig=(cells[designIdx]||"").trim();
    if(!desig)continue;
    const prixRaw=(cells[prixIdx]||"0").replace(",",".").replace(/[^\d.-]/g,"");
    const prix=parseFloat(prixRaw)||0;
    produits.push({
      ref:refIdx>=0?(cells[refIdx]||"").trim():"",
      designation:desig,
      unite:uniteIdx>=0?(cells[uniteIdx]||"U").trim():"U",
      prixHT:+prix.toFixed(4),
    });
  }
  return{produits,error:null};
}
// Modale "Voir / rechercher dans le catalogue" d'un fournisseur
function CatalogueFournisseurModal({fournisseur,onClose,onAddToBC}){
  const [q,setQ]=useState("");
  const cat=fournisseur?.catalogue||[];
  const filtered=q.trim()
    ?cat.filter(p=>{
      const s=q.toLowerCase();
      return p.designation.toLowerCase().includes(s)||(p.ref||"").toLowerCase().includes(s);
    })
    :cat;
  return(
    <Modal title={`Catalogue ${fournisseur.nom} (${cat.length} produits)`} onClose={onClose} maxWidth={760}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Rechercher (référence ou désignation)…"
          style={{width:"100%",padding:"10px 12px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
        {cat.length===0?(
          <div style={{padding:24,textAlign:"center",color:L.textSm,fontSize:12}}>Aucun produit dans le catalogue. Importe un CSV depuis l'onglet Catalogues.</div>
        ):filtered.length===0?(
          <div style={{padding:24,textAlign:"center",color:L.textSm,fontSize:12}}>Aucun résultat pour « {q} ».</div>
        ):(
          <div style={{maxHeight:420,overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:8}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead style={{position:"sticky",top:0,background:L.bg,zIndex:1}}>
                <tr>{["Réf","Désignation","U","Prix HT",""].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.slice(0,200).map((p,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                    <td style={{padding:"6px 10px",fontFamily:"monospace",color:L.textSm}}>{p.ref||"—"}</td>
                    <td style={{padding:"6px 10px",fontSize:11}}>{p.designation}</td>
                    <td style={{padding:"6px 10px",color:L.textSm}}>{p.unite}</td>
                    <td style={{padding:"6px 10px",fontFamily:"monospace",fontWeight:600,whiteSpace:"nowrap"}}>{fmt2(p.prixHT)} €</td>
                    <td style={{padding:"6px 10px"}}><button onClick={()=>onAddToBC(p)} style={{padding:"4px 9px",border:`1px solid ${L.navy}`,borderRadius:5,background:L.navyBg,color:L.navy,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>+ BC</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length>200&&<div style={{padding:8,fontSize:10,color:L.textXs,textAlign:"center"}}>200 premiers résultats sur {filtered.length}. Affine ta recherche.</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── ONGLET CATALOGUES ─────────────────────────────────────────────────────
// Pour chaque fournisseur enregistré : importer un CSV catalogue, voir le
// nombre de produits, ouvrir une modale de recherche. La liste des grands
// fournisseurs BTP supportés s'affiche en haut comme indication — l'user
// crée ses fiches dans l'onglet Fiches.
function CataloguesTab({fournisseurs,setFournisseurs,setEditCmd,setShowCmdModal}){
  const [openCatalogueFournId,setOpenCatalogueFournId]=useState(null);
  const fileInputs=useRef({});
  function handleCSVUpload(fournId,file){
    if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const{produits,error}=parseCatalogueCSV(ev.target?.result||"");
      if(error){alert(`Erreur d'import : ${error}\n\nFormat attendu — CSV avec colonnes (séparateur , ou ;) :\nréférence;désignation;unité;prix_ht`);return;}
      if(produits.length===0){alert("Aucun produit valide trouvé dans le fichier.");return;}
      if(!window.confirm(`${produits.length} produits importés. ${(fournisseurs.find(f=>f.id===fournId)?.catalogue||[]).length>0?"Cela va REMPLACER le catalogue existant. ":""}Continuer ?`))return;
      setFournisseurs(fs=>fs.map(f=>f.id===fournId?{...f,catalogue:produits,catalogueImporteLe:new Date().toISOString().slice(0,10)}:f));
      alert(`✓ Catalogue importé : ${produits.length} produits ajoutés.`);
    };
    reader.readAsText(file,"UTF-8");
  }
  function handleAddToBC(fournId,produit){
    // Pré-remplit une nouvelle commande avec ce fournisseur + une ligne
    const cmdDraft={
      id:null, // sera assigné par submit
      fournisseurId:fournId,
      lignes:[{
        id:Date.now()+Math.random(),
        libelle:`${produit.ref?`[${produit.ref}] `:""}${produit.designation}`,
        qte:1,
        unite:produit.unite||"U",
        prixUnitHT:+produit.prixHT||0,
        tva:20,
      }],
    };
    setEditCmd(cmdDraft);
    setShowCmdModal(true);
    setOpenCatalogueFournId(null);
  }
  const fournOuvert=fournisseurs.find(f=>f.id===openCatalogueFournId);
  return(
    <>
      {/* Bandeau fournisseurs supportés */}
      <Card style={{padding:14,marginBottom:14,background:L.navyBg,border:`1px solid ${L.navy}33`}}>
        <div style={{fontSize:11,fontWeight:700,color:L.navy,textTransform:"uppercase",letterSpacing:0.5,marginBottom:8}}>📚 Fournisseurs BTP supportés</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {CATALOGUES_BTP_SUPPORTES.map(s=>{
            const connecte=fournisseurs.some(f=>f.nom.toLowerCase().includes(s.nom.toLowerCase().split(" ")[0].toLowerCase()));
            return(
              <span key={s.key} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,background:connecte?s.color+"20":L.surface,border:`1px solid ${connecte?s.color:L.border}`,fontSize:11,fontWeight:600,color:connecte?s.color:L.textSm}}>
                <span>{s.icon}</span><span>{s.nom}</span>{connecte&&<span style={{fontSize:9}}>✓</span>}
              </span>
            );
          })}
        </div>
        <div style={{fontSize:10,color:L.textSm,marginTop:8,lineHeight:1.5}}>
          Crée une fiche dans l'onglet <strong>Fiches</strong> pour chaque fournisseur dont tu veux importer le catalogue. L'import accepte le format CSV (séparateur , ou ;) avec colonnes : <code style={{background:L.surface,padding:"1px 4px",borderRadius:3}}>référence ; désignation ; unité ; prix_ht</code>. Une API directe (Point P, etc.) viendra dans une prochaine itération.
        </div>
      </Card>
      {/* Liste fournisseurs + état catalogue */}
      {fournisseurs.length===0?(
        <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
          <div style={{fontSize:38,marginBottom:10}}>📚</div>
          <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucun fournisseur enregistré</div>
          <div style={{fontSize:12,lineHeight:1.6}}>Crée d'abord une fiche fournisseur dans l'onglet Fiches.</div>
        </Card>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {fournisseurs.map(f=>{
            const cat=f.catalogue||[];
            return(
              <Card key={f.id} style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:L.text}}>{f.nom}</div>
                  <span style={{padding:"3px 8px",borderRadius:5,background:cat.length>0?(L.greenBg||"#D1FAE5"):L.bg,color:cat.length>0?L.green:L.textSm,fontSize:10,fontWeight:700}}>
                    {cat.length>0?`${cat.length} produits`:"vide"}
                  </span>
                </div>
                {f.catalogueImporteLe&&<div style={{fontSize:10,color:L.textXs,marginBottom:8}}>Importé le {f.catalogueImporteLe}</div>}
                <input ref={el=>{fileInputs.current[f.id]=el;}} type="file" accept=".csv,text/csv,text/plain" style={{display:"none"}}
                  onChange={e=>{handleCSVUpload(f.id,e.target.files?.[0]);e.target.value="";}}/>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>fileInputs.current[f.id]?.click()} style={{flex:1,padding:"7px 11px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📥 Importer CSV</button>
                  {cat.length>0&&<button onClick={()=>setOpenCatalogueFournId(f.id)} style={{flex:1,padding:"7px 11px",border:`1px solid ${L.navy}`,borderRadius:6,background:L.navyBg,color:L.navy,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔍 Rechercher</button>}
                  {cat.length>0&&<button onClick={()=>{if(window.confirm(`Vider le catalogue de ${f.nom} ?`))setFournisseurs(fs=>fs.map(x=>x.id===f.id?{...x,catalogue:[],catalogueImporteLe:null}:x));}} title="Vider le catalogue" style={{padding:"7px 9px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {fournOuvert&&<CatalogueFournisseurModal fournisseur={fournOuvert} onClose={()=>setOpenCatalogueFournId(null)} onAddToBC={p=>handleAddToBC(fournOuvert.id,p)}/>}
    </>
  );
}

// ─── HELPERS / MODALE FACTURES FOURNISSEUR ──────────────────────────────────
const STATUTS_FF=["à payer","payée","contestée"];
const STATUTS_FF_COLORS={
  "à payer":{bg:"#FEF3C7",fg:"#D97706",border:"#FCD34D"},
  "payée":{bg:"#D1FAE5",fg:"#059669",border:"#86EFAC"},
  "contestée":{bg:"#FEE2E2",fg:"#DC2626",border:"#FCA5A5"},
};
function FactureFournisseurModal({facture,fournisseurs,chantiers,onSave,onClose}){
  const isEdit=!!facture;
  const [fournisseurId,setFournisseurId]=useState(facture?.fournisseurId||fournisseurs[0]?.id||null);
  const [chantierId,setChantierId]=useState(facture?.chantierId||"");
  const [ref,setRef]=useState(facture?.ref||"");
  const [date,setDate]=useState(facture?.date||new Date().toISOString().slice(0,10));
  const [dateEcheance,setDateEcheance]=useState(facture?.dateEcheance||"");
  const [montantHT,setMontantHT]=useState(facture?.montantHT||"");
  const [tva,setTva]=useState(facture?.tva??20);
  const [montantTTC,setMontantTTC]=useState(facture?.montantTTC||"");
  const [statut,setStatut]=useState(facture?.statut||"à payer");
  const [notes,setNotes]=useState(facture?.notes||"");
  // Auto-calc TTC à partir de HT+TVA si l'un change
  function onHTChange(v){
    setMontantHT(v);
    const h=parseFloat(v)||0;const t=parseFloat(tva)||0;
    setMontantTTC(+(h*(1+t/100)).toFixed(2));
  }
  function onTTCChange(v){
    setMontantTTC(v);
    const tt=parseFloat(v)||0;const t=parseFloat(tva)||0;
    setMontantHT(+(tt/(1+t/100)).toFixed(2));
  }
  function onTVAChange(v){
    setTva(v);
    const h=parseFloat(montantHT)||0;const t=parseFloat(v)||0;
    setMontantTTC(+(h*(1+t/100)).toFixed(2));
  }
  function submit(){
    if(!fournisseurId){alert("Sélectionne un fournisseur.");return;}
    const ttc=parseFloat(montantTTC)||0;
    if(ttc<=0){alert("Saisis un montant TTC positif.");return;}
    const four=fournisseurs.find(f=>f.id===fournisseurId);
    const f={
      id:isEdit?facture.id:Date.now(),
      fournisseurId,
      fournisseurNom:four?.nom||"",
      chantierId:chantierId||null,
      ref:ref.trim(),
      date,
      dateEcheance:dateEcheance||"",
      montantHT:parseFloat(montantHT)||0,
      tva:parseFloat(tva)||0,
      montantTTC:ttc,
      statut,
      notes:notes.trim(),
    };
    onSave(f);
  }
  return(
    <Modal title={isEdit?`Modifier facture ${facture.ref||""}`:"Enregistrer une facture reçue"} onClose={onClose} maxWidth={560}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Fournisseur <span style={{color:L.red}}>*</span></label>
            <select value={fournisseurId||""} onChange={e=>setFournisseurId(+e.target.value||e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",background:L.surface}}>
              <option value="">— Sélectionner —</option>
              {fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Chantier (suivi coûts)</label>
            <select value={chantierId||""} onChange={e=>setChantierId(+e.target.value||"")} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",background:L.surface}}>
              <option value="">— Aucun —</option>
              {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom||`#${c.id}`}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Référence facture</label>
            <input value={ref} onChange={e=>setRef(e.target.value)} placeholder="F-2026-0432" style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"monospace"}}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Date facture</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Échéance</label>
            <input type="date" value={dateEcheance} onChange={e=>setDateEcheance(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",gap:10}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Montant HT</label>
            <input type="number" min={0} step={0.01} value={montantHT} onChange={e=>onHTChange(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"monospace",textAlign:"right"}}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>TVA %</label>
            <input type="number" min={0} max={30} step={1} value={tva} onChange={e=>onTVAChange(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"monospace",textAlign:"right"}}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Montant TTC <span style={{color:L.red}}>*</span></label>
            <input type="number" min={0} step={0.01} value={montantTTC} onChange={e=>onTTCChange(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`2px solid ${L.navy}`,borderRadius:8,fontSize:13,fontFamily:"monospace",textAlign:"right",fontWeight:700}}/>
          </div>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Statut</label>
          <div style={{display:"flex",gap:6}}>
            {STATUTS_FF.map(s=>{
              const c=STATUTS_FF_COLORS[s];
              return(
                <label key={s} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"7px 10px",border:`2px solid ${statut===s?c.fg:L.border}`,borderRadius:8,cursor:"pointer",background:statut===s?c.bg:L.surface,color:statut===s?c.fg:L.textMd,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4}}>
                  <input type="radio" checked={statut===s} onChange={()=>setStatut(s)} style={{display:"none"}}/>
                  {s}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Notes</label>
          <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={submit} variant="primary" icon={isEdit?"✓":"💾"}>{isEdit?"Enregistrer":"Ajouter la facture"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── MODALE CRÉATION / ÉDITION BON DE COMMANDE ──────────────────────────────
function CommandeFournisseurModal({commande,fournisseurs,chantiers,docs,allCommandes,onSave,onClose}){
  const isEdit=!!commande;
  const [fournisseurId,setFournisseurId]=useState(commande?.fournisseurId||fournisseurs[0]?.id||null);
  const [chantierId,setChantierId]=useState(commande?.chantierId||"");
  const [date,setDate]=useState(commande?.date||new Date().toISOString().slice(0,10));
  const [dateLivraisonSouhaitee,setDateLivraison]=useState(commande?.dateLivraisonSouhaitee||"");
  const [notes,setNotes]=useState(commande?.notes||"");
  const [lignes,setLignes]=useState(commande?.lignes?.length?commande.lignes:[{id:Date.now(),libelle:"",qte:1,unite:"U",prixUnitHT:0,tva:20}]);
  function addLigne(){setLignes(ls=>[...ls,{id:Date.now()+Math.random(),libelle:"",qte:1,unite:"U",prixUnitHT:0,tva:20}]);}
  function delLigne(id){setLignes(ls=>ls.filter(l=>l.id!==id));}
  function updL(id,patch){setLignes(ls=>ls.map(l=>l.id===id?{...l,...patch}:l));}
  // Import auto des fournitures du devis du chantier (si chantier sélectionné)
  function importerFournitures(){
    if(!chantierId){alert("Sélectionne d'abord un chantier.");return;}
    const ch=chantiers.find(c=>c.id===chantierId);
    const devis=docs.find(d=>d.id===ch?.devisId);
    if(!devis){alert("Pas de devis lié à ce chantier.");return;}
    const fournLignes=[];
    for(const l of (devis.lignes||[])){
      if(!l.fournitures?.length)continue;
      for(const f of l.fournitures){
        if(!f.designation)continue;
        fournLignes.push({
          id:Date.now()+Math.random(),
          libelle:f.designation+(l.libelle?` (${l.libelle})`:""),
          qte:+(f.qte||1)*(+l.qte||1),
          unite:f.unite||"U",
          prixUnitHT:+(f.prixAchat||f.prixVente||0),
          tva:l.tva||20,
        });
      }
    }
    if(fournLignes.length===0){alert("Aucune fourniture détaillée trouvée dans le devis de ce chantier.");return;}
    setLignes(prev=>{
      // Si seule une ligne vide → remplace ; sinon append
      const onlyEmpty=prev.length===1&&!prev[0].libelle;
      return onlyEmpty?fournLignes:[...prev,...fournLignes];
    });
  }
  const total=calcCommandeTotal({lignes});
  function submit(){
    if(!fournisseurId){alert("Sélectionne un fournisseur.");return;}
    const validLignes=lignes.filter(l=>l.libelle?.trim());
    if(validLignes.length===0){alert("Ajoute au moins une ligne avec une désignation.");return;}
    const four=fournisseurs.find(f=>f.id===fournisseurId);
    const c={
      id:isEdit?commande.id:Date.now(),
      numero:isEdit?commande.numero:nextBCNumero(allCommandes),
      date,
      fournisseurId,
      fournisseurNom:four?.nom||"",
      chantierId:chantierId||null,
      statut:isEdit?(commande.statut||"brouillon"):"brouillon",
      lignes:validLignes,
      notes:notes.trim(),
      dateLivraisonSouhaitee:dateLivraisonSouhaitee||"",
    };
    onSave(c);
  }
  return(
    <Modal title={isEdit?`Modifier ${commande.numero}`:"Nouvelle commande fournisseur"} onClose={onClose} maxWidth={780}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* En-tête : fournisseur + chantier + dates */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Fournisseur <span style={{color:L.red}}>*</span></label>
            <select value={fournisseurId||""} onChange={e=>setFournisseurId(+e.target.value||e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",background:L.surface}}>
              <option value="">— Sélectionner —</option>
              {fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Chantier (optionnel)</label>
            <select value={chantierId||""} onChange={e=>setChantierId(+e.target.value||"")} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",background:L.surface}}>
              <option value="">— Aucun —</option>
              {chantiers.map(c=><option key={c.id} value={c.id}>{c.nom||`#${c.id}`}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Livraison souhaitée</label>
            <input type="date" value={dateLivraisonSouhaitee} onChange={e=>setDateLivraison(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
        </div>
        {/* Bouton import fournitures */}
        {chantierId&&(
          <div style={{padding:"8px 12px",background:L.navyBg,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:11,color:L.navy,fontWeight:600}}>💡 Le chantier a un devis lié — importer ses fournitures ?</div>
            <Btn onClick={importerFournitures} variant="secondary" icon="📥">Importer fournitures</Btn>
          </div>
        )}
        {/* Lignes */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <div style={{fontSize:11,fontWeight:700,color:L.textMd,textTransform:"uppercase",letterSpacing:0.4}}>Lignes</div>
            <button onClick={addLigne} style={{padding:"4px 10px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Ligne</button>
          </div>
          <div style={{border:`1px solid ${L.border}`,borderRadius:8,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{background:L.bg}}>
                {["Désignation","Qté","U","P.U. HT","TVA%","Total HT",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lignes.map(l=>{
                  const tht=(+l.qte||0)*(+l.prixUnitHT||0);
                  return(
                    <tr key={l.id} style={{borderTop:`1px solid ${L.border}`}}>
                      <td style={{padding:"4px 6px"}}><input value={l.libelle} onChange={e=>updL(l.id,{libelle:e.target.value})} style={{width:"100%",padding:"5px 8px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:12,fontFamily:"inherit"}}/></td>
                      <td style={{padding:"4px 6px",width:60}}><input type="number" min={0} step={0.01} value={l.qte} onChange={e=>updL(l.id,{qte:+e.target.value})} style={{width:"100%",padding:"5px 8px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/></td>
                      <td style={{padding:"4px 6px",width:60}}><input value={l.unite} onChange={e=>updL(l.id,{unite:e.target.value})} style={{width:"100%",padding:"5px 8px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:12,fontFamily:"inherit"}}/></td>
                      <td style={{padding:"4px 6px",width:90}}><input type="number" min={0} step={0.01} value={l.prixUnitHT} onChange={e=>updL(l.id,{prixUnitHT:+e.target.value})} style={{width:"100%",padding:"5px 8px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/></td>
                      <td style={{padding:"4px 6px",width:55}}><input type="number" min={0} max={30} step={1} value={l.tva} onChange={e=>updL(l.id,{tva:+e.target.value})} style={{width:"100%",padding:"5px 8px",border:`1px solid ${L.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/></td>
                      <td style={{padding:"4px 6px",fontFamily:"monospace",fontWeight:600,whiteSpace:"nowrap"}}>{fmt2(tht)} €</td>
                      <td style={{padding:"4px 6px",width:30,textAlign:"center"}}><button onClick={()=>delLigne(l.id)} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {/* Totaux */}
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <div style={{minWidth:240,background:L.navyBg,borderRadius:8,padding:"10px 14px"}}>
            {[["Total HT",total.ht],["TVA",total.tv],["TOTAL TTC",total.ttc]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:l==="TOTAL TTC"?14:12,fontWeight:l==="TOTAL TTC"?800:500,color:L.navy}}>
                <span>{l}</span><span style={{fontFamily:"monospace"}}>{fmt2(v)} €</span>
              </div>
            ))}
          </div>
        </div>
        {/* Notes */}
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Notes (visibles sur le BC)</label>
          <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
        </div>
        {/* Actions */}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={submit} variant="primary" icon={isEdit?"✓":"📋"}>{isEdit?"Enregistrer":"Créer la commande"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── VUE CLIENTS (fiches + historique + CA par client) ────────────────────
// Schéma plat (cf. migration 20260513_clients.sql). CA calculé par match
// du nom client dans docs (devis acceptés/signés + factures payées).
function VueClients({clients,setClients,docs,onNav}){
  const [search,setSearch]=useState("");
  const [editId,setEditId]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [openHistorique,setOpenHistorique]=useState(null);
  const EMPTY={nom:"",prenom:"",email:"",telephone:"",adresse:"",type:"particulier",siret:"",notes:""};
  const [form,setForm]=useState(EMPTY);
  function openNew(){setForm(EMPTY);setEditId(null);setShowForm(true);}
  function openEdit(c){setForm({...EMPTY,...c});setEditId(c.id);setShowForm(true);}
  function save(){
    if(!form.nom.trim())return;
    const id=editId||Date.now();
    const c={...form,id,nom:form.nom.trim(),created_at:editId?clients.find(x=>x.id===editId)?.created_at:new Date().toISOString()};
    if(editId)setClients(cs=>cs.map(x=>x.id===editId?c:x));
    else setClients(cs=>[...cs,c]);
    setShowForm(false);
  }
  function supprimer(c){
    const docsLies=docs.filter(d=>(d.client||"").trim().toLowerCase()===(c.nom||"").trim().toLowerCase()).length;
    const msg=docsLies>0
      ?`${c.nom} a ${docsLies} document(s) lié(s). La fiche sera supprimée mais les devis/factures restent (le nom du client est stocké inline). Continuer ?`
      :`Supprimer ${c.nom} ?`;
    if(!window.confirm(msg))return;
    setClients(cs=>cs.filter(x=>x.id!==c.id));
  }
  // CA par client : match nom du client dans docs (insensible casse/espaces)
  function caParClient(client){
    const target=(client.nom||"").trim().toLowerCase();
    if(!target)return{total:0,nbDevis:0,nbFactures:0,facturesPayees:0};
    let total=0,nbDevis=0,nbFactures=0,facturesPayees=0;
    for(const d of docs){
      const dn=(d.client||"").trim().toLowerCase();
      if(dn!==target)continue;
      if(d.type==="devis"){nbDevis++;continue;}
      if(d.type==="facture"){
        nbFactures++;
        // Total CA = factures payées TTC
        if(d.statut==="payé"){
          let t=0;
          for(const l of (d.lignes||[])){
            if(!isLigneDevis(l))continue;
            const lh=(+l.qte||0)*(+l.prixUnitHT||0);
            t+=lh*(1+(+l.tva||0)/100);
          }
          total+=t;
          facturesPayees++;
        }
      }
    }
    return{total:+total.toFixed(2),nbDevis,nbFactures,facturesPayees};
  }
  // Filtre recherche
  const q=search.trim().toLowerCase();
  const filtered=q
    ?clients.filter(c=>{
      const blob=[c.nom,c.prenom,c.email,c.telephone,c.siret].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    })
    :clients;
  // KPIs
  const totalCA=clients.reduce((a,c)=>a+caParClient(c).total,0);
  const moyCA=clients.length>0?totalCA/clients.length:0;
  return(
    <div>
      <PageH title="Clients" subtitle="Fiches, historique devis/factures, CA par client"
        actions={<Btn onClick={openNew} variant="primary" icon="➕">Nouveau client</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        <KPI label="Clients" value={clients.length} color={L.blue}/>
        <KPI label="CA total" value={euro(totalCA)} sub="factures payées" color={L.green}/>
        <KPI label="CA moyen / client" value={clients.length?euro(moyCA):"—"} color={L.navy}/>
        <KPI label="Particuliers / Pros" value={`${clients.filter(c=>c.type==="particulier").length} · ${clients.filter(c=>c.type==="professionnel").length}`} color={L.purple}/>
      </div>
      {/* Recherche */}
      {clients.length>0&&(
        <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher (nom, email, téléphone, SIRET)…"
          style={{width:"100%",padding:"10px 14px",border:`1px solid ${L.border}`,borderRadius:10,fontSize:13,fontFamily:"inherit",marginBottom:14}}/>
      )}
      {clients.length===0?(
        <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
          <div style={{fontSize:38,marginBottom:10}}>👥</div>
          <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucun client enregistré</div>
          <div style={{fontSize:12,lineHeight:1.6}}>Crée tes fiches clients pour gagner du temps lors de la création de devis (auto-remplissage).</div>
        </Card>
      ):filtered.length===0?(
        <Card style={{padding:24,textAlign:"center",color:L.textSm,fontSize:12}}>Aucun client ne correspond à « {search} ».</Card>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {filtered.map(c=>{
            const ca=caParClient(c);
            const isPro=c.type==="professionnel";
            return(
              <Card key={c.id} style={{padding:14,position:"relative"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:L.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {c.nom}{c.prenom?` ${c.prenom}`:""}
                    </div>
                    <span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:isPro?"#F5F3FF":L.greenBg||"#D1FAE5",color:isPro?L.purple:L.green,fontSize:10,fontWeight:700}}>
                      {isPro?"🏢 Professionnel":"👤 Particulier"}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>openEdit(c)} title="Modifier" style={{padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                    <button onClick={()=>supprimer(c)} title="Supprimer" style={{padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>×</button>
                  </div>
                </div>
                <div style={{fontSize:11,color:L.textSm,lineHeight:1.6}}>
                  {c.email&&<div>📧 {c.email}</div>}
                  {c.telephone&&<div>📞 {c.telephone}</div>}
                  {c.adresse&&<div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📍 {c.adresse}</div>}
                  {isPro&&c.siret&&<div>SIRET : <span style={{fontFamily:"monospace"}}>{c.siret}</span></div>}
                </div>
                {/* Historique + CA */}
                <div style={{display:"flex",gap:6,marginTop:10,paddingTop:8,borderTop:`1px solid ${L.border}`,alignItems:"center"}}>
                  <button onClick={()=>setOpenHistorique(c)} style={{padding:"4px 9px",border:`1px solid ${L.navy}`,borderRadius:6,background:L.navyBg,color:L.navy,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",flex:1}}>📊 Historique ({ca.nbDevis+ca.nbFactures})</button>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase",letterSpacing:0.4}}>CA</div>
                    <div style={{fontSize:13,fontWeight:800,color:ca.total>0?L.green:L.textSm,fontFamily:"monospace"}}>{euro(ca.total)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {/* Modale Historique */}
      {openHistorique&&(()=>{
        const ca=caParClient(openHistorique);
        const target=(openHistorique.nom||"").trim().toLowerCase();
        const docsLies=docs.filter(d=>(d.client||"").trim().toLowerCase()===target).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
        return(
          <Modal title={`📊 Historique — ${openHistorique.nom}${openHistorique.prenom?` ${openHistorique.prenom}`:""}`} onClose={()=>setOpenHistorique(null)} maxWidth={760}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:14}}>
              <div style={{padding:"8px 12px",background:L.navyBg,borderRadius:8}}>
                <div style={{fontSize:10,color:L.textSm,textTransform:"uppercase",letterSpacing:0.4}}>Devis</div>
                <div style={{fontSize:18,fontWeight:800,color:L.navy}}>{ca.nbDevis}</div>
              </div>
              <div style={{padding:"8px 12px",background:L.greenBg||"#D1FAE5",borderRadius:8}}>
                <div style={{fontSize:10,color:L.green,textTransform:"uppercase",letterSpacing:0.4}}>Factures payées</div>
                <div style={{fontSize:18,fontWeight:800,color:L.green}}>{ca.facturesPayees}/{ca.nbFactures}</div>
              </div>
              <div style={{padding:"8px 12px",background:L.bg,borderRadius:8}}>
                <div style={{fontSize:10,color:L.textSm,textTransform:"uppercase",letterSpacing:0.4}}>CA généré</div>
                <div style={{fontSize:18,fontWeight:800,color:L.navy,fontFamily:"monospace"}}>{euro(ca.total)}</div>
              </div>
            </div>
            {docsLies.length===0?(
              <div style={{padding:20,textAlign:"center",color:L.textSm,fontSize:12}}>Aucun document lié à ce client. Crée un devis avec ce nom dans le champ "Client".</div>
            ):(
              <div style={{border:`1px solid ${L.border}`,borderRadius:8,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:L.bg}}>{["Type","N°","Date","Statut","TTC"].map(h=><th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {docsLies.map((d,i)=>{
                      let ttc=0;
                      for(const l of (d.lignes||[])){if(!isLigneDevis(l))continue;const lh=(+l.qte||0)*(+l.prixUnitHT||0);ttc+=lh*(1+(+l.tva||0)/100);}
                      return(
                        <tr key={d.id} style={{borderTop:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                          <td style={{padding:"7px 12px",fontSize:11}}>{d.type==="facture"?"🧾 Facture":"📄 Devis"}</td>
                          <td style={{padding:"7px 12px",fontFamily:"monospace",color:L.textSm}}>{d.numero}</td>
                          <td style={{padding:"7px 12px"}}>{d.date}</td>
                          <td style={{padding:"7px 12px",fontSize:10,fontWeight:700,textTransform:"uppercase",color:d.statut==="payé"||d.statut==="signé"?L.green:d.statut==="refusé"||d.statut==="annulé"?L.red:L.orange}}>{d.statut||"—"}</td>
                          <td style={{padding:"7px 12px",fontFamily:"monospace",fontWeight:700,color:L.navy}}>{euro(ttc)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Modal>
        );
      })()}
      {/* Modale Form */}
      {showForm&&<ClientFormModal form={form} setForm={setForm} editId={editId} onSave={save} onClose={()=>setShowForm(false)}/>}
    </div>
  );
}

// Modale création/édition fiche client (réutilisable depuis CreateurDevis)
function ClientFormModal({form,setForm,editId,onSave,onClose,title}){
  const isPro=form.type==="professionnel";
  return(
    <Modal title={title||(editId?`Modifier ${form.nom||"client"}`:"Nouveau client")} onClose={onClose} maxWidth={520}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:6}}>
          {[{v:"particulier",l:"👤 Particulier",c:L.green},{v:"professionnel",l:"🏢 Professionnel",c:L.purple}].map(t=>(
            <label key={t.v} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"8px 12px",border:`2px solid ${form.type===t.v?t.c:L.border}`,borderRadius:8,cursor:"pointer",background:form.type===t.v?t.c+"15":L.surface,fontSize:12,fontWeight:600,color:form.type===t.v?t.c:L.textMd}}>
              <input type="radio" checked={form.type===t.v} onChange={()=>setForm({...form,type:t.v})} style={{display:"none"}}/>
              {t.l}
            </label>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:isPro?"2fr 1fr":"1fr 1fr",gap:8}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>{isPro?"Raison sociale":"Nom"} <span style={{color:L.red}}>*</span></label>
            <input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
          {!isPro&&(
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Prénom</label>
              <input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
            </div>
          )}
          {isPro&&(
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>SIRET</label>
              <input value={form.siret} onChange={e=>setForm({...form,siret:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"monospace"}}/>
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Email</label>
            <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Téléphone</label>
            <input value={form.telephone} onChange={e=>setForm({...form,telephone:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Adresse</label>
          <input value={form.adresse} onChange={e=>setForm({...form,adresse:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Notes</label>
          <textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={onSave} variant="primary" disabled={!form.nom.trim()} icon="✓">Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── BLOC RENSEIGNEMENTS CLIENT (CreateurDevis) ─────────────────────────────
// Autocomplete sur clients enregistrés + bouton "Nouveau client" qui ouvre
// la modale standard et auto-remplit les champs après création.
function ClientFieldsBlock({form,setForm,clients,setClients}){
  const [showSearch,setShowSearch]=useState(false);
  const [showNew,setShowNew]=useState(false);
  const EMPTY={nom:"",prenom:"",email:"",telephone:"",adresse:"",type:"particulier",siret:"",notes:""};
  const [newForm,setNewForm]=useState(EMPTY);
  // Détecte si form.client correspond à une fiche existante (after IA, edit, etc.)
  const selectedClient=(clients||[]).find(c=>{
    const norm=(c.nom+(c.prenom?` ${c.prenom}`:"")).trim().toLowerCase();
    const just=c.nom.trim().toLowerCase();
    const cur=(form.client||"").trim().toLowerCase();
    return cur&&(norm===cur||just===cur);
  })||null;
  function pick(c){
    setForm(f=>({...f,
      client:c.nom+(c.prenom?` ${c.prenom}`:""),
      emailClient:c.email||"",
      telClient:c.telephone||"",
      adresseClient:c.adresse||"",
    }));
    setShowSearch(false);
  }
  function unpick(){
    setForm(f=>({...f,client:"",emailClient:"",telClient:"",adresseClient:""}));
  }
  function saveNew(){
    if(!newForm.nom.trim())return;
    const id=Date.now();
    const c={...newForm,id,nom:newForm.nom.trim(),created_at:new Date().toISOString()};
    if(setClients)setClients(cs=>[...cs,c]);
    pick(c);
    setShowNew(false);
    setNewForm(EMPTY);
  }
  return(
    <div>
      <div style={{fontSize:12,fontWeight:700,color:L.textMd,marginBottom:6}}>Renseignements client</div>
      {selectedClient?(
        // ─── Fiche résumé du client sélectionné ─────────────────────────
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"12px 16px",background:L.greenBg||"#D1FAE5",border:`1px solid ${L.green}55`,borderRadius:10,marginBottom:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:800,color:L.green,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span>{selectedClient.type==="professionnel"?"🏢":"👤"}</span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedClient.nom}{selectedClient.prenom?` ${selectedClient.prenom}`:""}</span>
              {selectedClient.type==="professionnel"&&selectedClient.siret&&<span style={{fontSize:9,fontWeight:600,color:L.green,opacity:0.8,fontFamily:"monospace"}}>SIRET {selectedClient.siret}</span>}
            </div>
            <div style={{fontSize:11,color:L.textMd,marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
              {selectedClient.email&&<span>📧 {selectedClient.email}</span>}
              {selectedClient.telephone&&<span>📞 {selectedClient.telephone}</span>}
              {selectedClient.adresse&&<span>📍 {selectedClient.adresse}</span>}
            </div>
          </div>
          <button type="button" onClick={unpick} title="Changer de client" style={{flexShrink:0,padding:"6px 10px",border:`1px solid ${L.green}55`,borderRadius:6,background:L.surface,color:L.green,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        </div>
      ):(
        // ─── 2 boutons : Rechercher / Nouveau ────────────────────────────
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <button type="button" onClick={()=>setShowSearch(true)} disabled={!(clients||[]).length}
            style={{padding:"14px 16px",border:`2px solid ${(clients||[]).length?L.navy:L.border}`,borderRadius:10,background:(clients||[]).length?L.navyBg:L.bg,color:(clients||[]).length?L.navy:L.textXs,fontSize:13,fontWeight:700,cursor:(clients||[]).length?"pointer":"not-allowed",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🔍 Rechercher client {(clients||[]).length>0&&<span style={{fontSize:10,fontWeight:500,opacity:0.7}}>({clients.length})</span>}
          </button>
          <button type="button" onClick={()=>{setNewForm(EMPTY);setShowNew(true);}}
            style={{padding:"14px 16px",border:`2px solid ${L.green}`,borderRadius:10,background:L.greenBg||"#D1FAE5",color:L.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            ➕ Nouveau client
          </button>
        </div>
      )}
      {/* Titre du chantier (toujours visible — info chantier, pas client) */}
      <Input label="Titre du chantier" value={form.titreChantier} onChange={v=>setForm(f=>({...f,titreChantier:v}))}/>
      {/* Modale recherche client */}
      {showSearch&&<ClientSearchModal clients={clients||[]} onPick={pick} onClose={()=>setShowSearch(false)} onCreateNew={()=>{setShowSearch(false);setNewForm(EMPTY);setShowNew(true);}}/>}
      {/* Modale nouveau client */}
      {showNew&&<ClientFormModal form={newForm} setForm={setNewForm} editId={null} onSave={saveNew} onClose={()=>setShowNew(false)} title="Nouveau client (création rapide)"/>}
    </div>
  );
}

// ─── MODALE RECHERCHE CLIENT (depuis CreateurDevis) ─────────────────────────
function ClientSearchModal({clients,onPick,onClose,onCreateNew}){
  const [q,setQ]=useState("");
  const query=q.trim().toLowerCase();
  const filtered=query
    ?clients.filter(c=>{
      const blob=[c.nom,c.prenom,c.email,c.telephone,c.siret].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(query);
    })
    :clients;
  return(
    <Modal title="🔍 Rechercher un client" onClose={onClose} maxWidth={560}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <input type="search" value={q} onChange={e=>setQ(e.target.value)} autoFocus
          placeholder="Rechercher (nom, email, téléphone, SIRET)…"
          style={{width:"100%",padding:"11px 14px",border:`1px solid ${L.border}`,borderRadius:10,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        {filtered.length===0?(
          <div style={{padding:24,textAlign:"center",color:L.textSm,fontSize:12,background:L.bg,borderRadius:8}}>
            {query?<>Aucun client trouvé pour « {q} ».</>:<>Aucun client enregistré pour le moment.</>}
          </div>
        ):(
          <div style={{maxHeight:380,overflowY:"auto",border:`1px solid ${L.border}`,borderRadius:8}}>
            {filtered.map((c,i)=>(
              <div key={c.id} onClick={()=>onPick(c)}
                style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<filtered.length-1?`1px solid ${L.border}`:"none",display:"flex",alignItems:"center",gap:10,background:i%2===0?L.surface:L.bg}}
                onMouseEnter={e=>e.currentTarget.style.background=L.navyBg}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?L.surface:L.bg}>
                <span style={{fontSize:18}}>{c.type==="professionnel"?"🏢":"👤"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:L.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}{c.prenom?` ${c.prenom}`:""}</div>
                  {(c.email||c.telephone)&&<div style={{fontSize:11,color:L.textSm,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{[c.email,c.telephone].filter(Boolean).join(" · ")}</div>}
                  {c.adresse&&<div style={{fontSize:10,color:L.textXs,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📍 {c.adresse}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",gap:8,paddingTop:8,borderTop:`1px solid ${L.border}`}}>
          <Btn onClick={onCreateNew} variant="secondary" icon="➕">Nouveau client</Btn>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── VUE FOURNISSEURS (CRUD fiches + onglets commandes/factures) ────────────
// 3 entités stockées dans Supabase : fournisseurs, commandes_fournisseur,
// factures_fournisseur. UI à onglets : Fiches | Commandes | Factures | Qonto.
const FOURN_CATEGORIES=[
  {v:"materiaux",l:"Matériaux",icon:"🧱",c:"#0EA5E9"},
  {v:"outillage",l:"Outillage",icon:"🔧",c:"#F59E0B"},
  {v:"soustraitance",l:"Sous-traitance",icon:"🤝",c:"#8B5CF6"},
  {v:"autre",l:"Autre",icon:"📦",c:"#64748B"},
];
function VueFournisseurs({fournisseurs,setFournisseurs,commandesFournisseur,setCommandesFournisseur,facturesFournisseur,setFacturesFournisseur,chantiers,docs,entreprise}){
  const [tab,setTab]=useState("fiches");
  const [editId,setEditId]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [showCmdModal,setShowCmdModal]=useState(false);
  const [editCmd,setEditCmd]=useState(null);
  const [apercuCmd,setApercuCmd]=useState(null);
  const [showFFModal,setShowFFModal]=useState(false);
  const [editFF,setEditFF]=useState(null);
  const EMPTY={nom:"",email:"",tel:"",adresse:"",siret:"",iban:"",categorie:"materiaux",notes:""};
  const [form,setForm]=useState(EMPTY);
  function openNew(){setForm(EMPTY);setEditId(null);setShowForm(true);}
  function openEdit(f){setForm({...EMPTY,...f});setEditId(f.id);setShowForm(true);}
  function save(){
    if(!form.nom.trim())return;
    const id=editId||Date.now();
    const f={...form,id,nom:form.nom.trim()};
    if(editId)setFournisseurs(fs=>fs.map(x=>x.id===editId?f:x));
    else setFournisseurs(fs=>[...fs,f]);
    setShowForm(false);
  }
  function supprimer(f){
    const nbCmd=(commandesFournisseur||[]).filter(c=>c.fournisseurId===f.id).length;
    const nbFac=(facturesFournisseur||[]).filter(c=>c.fournisseurId===f.id).length;
    if(nbCmd>0||nbFac>0){
      if(!window.confirm(`${f.nom} a ${nbCmd} commande(s) et ${nbFac} facture(s). Supprimer quand même ? Les documents liés resteront orphelins.`))return;
    }else if(!window.confirm(`Supprimer ${f.nom} ?`))return;
    setFournisseurs(fs=>fs.filter(x=>x.id!==f.id));
  }
  const cats=FOURN_CATEGORIES;
  const catBy=v=>cats.find(c=>c.v===v)||cats[3];
  // KPIs onglet fiches
  const totalDepensesAnnee=(facturesFournisseur||[]).reduce((a,f)=>a+(+f.montantTTC||0),0);
  const totalAPayer=(facturesFournisseur||[]).filter(f=>f.statut==="à payer").reduce((a,f)=>a+(+f.montantTTC||0),0);
  return(
    <div>
      <PageH title="Fournisseurs" subtitle="Fiches, bons de commande et factures reçues"
        actions={
          tab==="fiches"?<Btn onClick={openNew} variant="primary" icon="➕">Nouveau fournisseur</Btn>:
          tab==="commandes"?<Btn onClick={()=>{setEditCmd(null);setShowCmdModal(true);}} variant="primary" icon="📋" disabled={fournisseurs.length===0}>Nouvelle commande</Btn>:
          tab==="factures"?<Btn onClick={()=>{setEditFF(null);setShowFFModal(true);}} variant="primary" icon="🧾" disabled={fournisseurs.length===0}>Enregistrer facture</Btn>:
          null
        }/>
      <Tabs tabs={[
        {id:"fiches",label:`Fiches (${fournisseurs.length})`,icon:"📇"},
        {id:"commandes",label:`Commandes (${commandesFournisseur.length})`,icon:"📋"},
        {id:"factures",label:`Factures reçues (${facturesFournisseur.length})`,icon:"🧾"},
        {id:"catalogues",label:"Catalogues",icon:"📚"},
      ]} active={tab} onChange={setTab}/>
      {tab==="fiches"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:18}}>
            <KPI label="Fournisseurs" value={fournisseurs.length} color={L.blue}/>
            <KPI label="Dépenses totales" value={fournisseurs.length?euro(totalDepensesAnnee):"—"} color={L.navy}/>
            <KPI label="À payer" value={euro(totalAPayer)} color={L.orange}/>
          </div>
          {fournisseurs.length===0?(
            <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
              <div style={{fontSize:38,marginBottom:10}}>🏭</div>
              <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucun fournisseur enregistré</div>
              <div style={{fontSize:12,lineHeight:1.6}}>Ajoute tes fournisseurs récurrents pour gagner du temps lors des commandes.</div>
            </Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {fournisseurs.map(f=>{
                const cat=catBy(f.categorie);
                const cmdCount=(commandesFournisseur||[]).filter(c=>c.fournisseurId===f.id).length;
                const facCount=(facturesFournisseur||[]).filter(c=>c.fournisseurId===f.id).length;
                return(
                  <Card key={f.id} style={{padding:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,gap:8}}>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:14,fontWeight:700,color:L.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</div>
                        <span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:cat.c+"22",color:cat.c,fontSize:10,fontWeight:700}}>{cat.icon} {cat.l}</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>openEdit(f)} title="Modifier" style={{padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                        <button onClick={()=>supprimer(f)} title="Supprimer" style={{padding:"4px 7px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>×</button>
                      </div>
                    </div>
                    <div style={{fontSize:11,color:L.textSm,lineHeight:1.6}}>
                      {f.email&&<div>📧 {f.email}</div>}
                      {f.tel&&<div>📞 {f.tel}</div>}
                      {f.siret&&<div>SIRET : <span style={{fontFamily:"monospace"}}>{f.siret}</span></div>}
                      {f.iban&&<div>IBAN : <span style={{fontFamily:"monospace",fontSize:10}}>{f.iban.replace(/(.{4})/g," $1").trim()}</span></div>}
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:10,paddingTop:8,borderTop:`1px solid ${L.border}`}}>
                      <span style={{fontSize:10,color:L.textXs}}>📋 {cmdCount} commande{cmdCount>1?"s":""}</span>
                      <span style={{fontSize:10,color:L.textXs}}>·</span>
                      <span style={{fontSize:10,color:L.textXs}}>🧾 {facCount} facture{facCount>1?"s":""}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
      {tab==="commandes"&&(()=>{
        const totalBC=commandesFournisseur.reduce((a,c)=>a+calcCommandeTotal(c).ttc,0);
        const enAttente=commandesFournisseur.filter(c=>c.statut==="envoyée"||c.statut==="reçue").length;
        return(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:18}}>
              <KPI label="Commandes" value={commandesFournisseur.length} sub={euro(totalBC)} color={L.blue}/>
              <KPI label="En attente livraison" value={enAttente} color={L.orange}/>
              <KPI label="Payées" value={commandesFournisseur.filter(c=>c.statut==="payée").length} color={L.green}/>
            </div>
            {fournisseurs.length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
                <div style={{fontSize:38,marginBottom:10}}>🏭</div>
                <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Crée d'abord un fournisseur</div>
                <div style={{fontSize:12,lineHeight:1.6}}>Tu dois enregistrer au moins un fournisseur avant de pouvoir lui envoyer une commande. Va dans l'onglet Fiches.</div>
              </Card>
            ):commandesFournisseur.length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
                <div style={{fontSize:38,marginBottom:10}}>📋</div>
                <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucune commande</div>
                <div style={{fontSize:12,lineHeight:1.6}}>Clique sur <strong>Nouvelle commande</strong> pour créer un bon de commande.</div>
              </Card>
            ):(
              <Card style={{overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:L.bg}}>{["N° BC","Date","Fournisseur","Chantier","HT","TTC","Statut","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {commandesFournisseur.map((c,i)=>{
                      const t=calcCommandeTotal(c);
                      const f=fournisseurs.find(x=>x.id===c.fournisseurId);
                      const ch=chantiers.find(x=>x.id===c.chantierId);
                      const stColor=STATUTS_BC_COLORS[c.statut]||STATUTS_BC_COLORS.brouillon;
                      return(
                        <tr key={c.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                          <td style={{padding:"9px 12px",fontSize:12,color:L.textSm,fontFamily:"monospace"}}>{c.numero}</td>
                          <td style={{padding:"9px 12px",fontSize:12}}>{c.date}</td>
                          <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>{f?.nom||c.fournisseurNom||"—"}</td>
                          <td style={{padding:"9px 12px",fontSize:11,color:L.textSm}}>{ch?.nom||(c.chantierId?`#${c.chantierId}`:"—")}</td>
                          <td style={{padding:"9px 12px",fontSize:12,fontFamily:"monospace"}}>{euro(t.ht)}</td>
                          <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace"}}>{euro(t.ttc)}</td>
                          <td style={{padding:"9px 12px"}}>
                            <select value={c.statut||"brouillon"} onChange={e=>setCommandesFournisseur(cs=>cs.map(x=>x.id===c.id?{...x,statut:e.target.value}:x))}
                              style={{padding:"3px 8px",borderRadius:6,background:stColor.bg,color:stColor.fg,border:`1px solid ${stColor.border}`,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4,fontFamily:"inherit",cursor:"pointer"}}>
                              {STATUTS_BC.map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{padding:"9px 12px"}}>
                            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              <button onClick={()=>setApercuCmd(c)} title="Aperçu / PDF" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>👁 PDF</button>
                              <button onClick={()=>{setEditCmd(c);setShowCmdModal(true);}} title="Modifier" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                              <button onClick={()=>{if(window.confirm(`Supprimer la commande ${c.numero} ?`))setCommandesFournisseur(cs=>cs.filter(x=>x.id!==c.id));}} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:13}}>×</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        );
      })()}
      {tab==="factures"&&(()=>{
        const totalTTC=facturesFournisseur.reduce((a,f)=>a+(+f.montantTTC||0),0);
        const aPayer=facturesFournisseur.filter(f=>f.statut==="à payer").reduce((a,f)=>a+(+f.montantTTC||0),0);
        const payees=facturesFournisseur.filter(f=>f.statut==="payée").reduce((a,f)=>a+(+f.montantTTC||0),0);
        const today=new Date().toISOString().slice(0,10);
        return(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:18}}>
              <KPI label="Factures reçues" value={facturesFournisseur.length} sub={euro(totalTTC)} color={L.blue}/>
              <KPI label="À payer" value={facturesFournisseur.filter(f=>f.statut==="à payer").length} sub={euro(aPayer)} color={L.orange}/>
              <KPI label="Payées" value={facturesFournisseur.filter(f=>f.statut==="payée").length} sub={euro(payees)} color={L.green}/>
              <KPI label="Contestées" value={facturesFournisseur.filter(f=>f.statut==="contestée").length} color={L.red}/>
            </div>
            {fournisseurs.length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
                <div style={{fontSize:38,marginBottom:10}}>🏭</div>
                <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Crée d'abord un fournisseur</div>
                <div style={{fontSize:12,lineHeight:1.6}}>Va dans l'onglet Fiches pour ajouter au moins un fournisseur.</div>
              </Card>
            ):facturesFournisseur.length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
                <div style={{fontSize:38,marginBottom:10}}>🧾</div>
                <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucune facture enregistrée</div>
                <div style={{fontSize:12,lineHeight:1.6}}>Clique sur <strong>Enregistrer facture</strong> pour saisir une facture reçue d'un fournisseur.</div>
              </Card>
            ):(
              <Card style={{overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:L.bg}}>{["Réf","Date","Échéance","Fournisseur","Chantier","HT","TTC","Statut","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {facturesFournisseur.map((f,i)=>{
                      const four=fournisseurs.find(x=>x.id===f.fournisseurId);
                      const ch=chantiers.find(x=>x.id===f.chantierId);
                      const stColor=STATUTS_FF_COLORS[f.statut]||STATUTS_FF_COLORS["à payer"];
                      const enRetard=f.statut==="à payer"&&f.dateEcheance&&f.dateEcheance<today;
                      return(
                        <tr key={f.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                          <td style={{padding:"9px 12px",fontSize:12,color:L.textSm,fontFamily:"monospace"}}>{f.ref||"—"}</td>
                          <td style={{padding:"9px 12px",fontSize:12}}>{f.date}</td>
                          <td style={{padding:"9px 12px",fontSize:12,color:enRetard?L.red:L.textSm,fontWeight:enRetard?700:400}}>{f.dateEcheance||"—"}{enRetard&&" ⚠"}</td>
                          <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>{four?.nom||f.fournisseurNom||"—"}</td>
                          <td style={{padding:"9px 12px",fontSize:11,color:L.textSm}}>{ch?.nom||(f.chantierId?`#${f.chantierId}`:"—")}</td>
                          <td style={{padding:"9px 12px",fontSize:12,fontFamily:"monospace"}}>{euro(f.montantHT||0)}</td>
                          <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace"}}>{euro(f.montantTTC||0)}</td>
                          <td style={{padding:"9px 12px"}}>
                            <select value={f.statut||"à payer"} onChange={e=>setFacturesFournisseur(fs=>fs.map(x=>x.id===f.id?{...x,statut:e.target.value}:x))}
                              style={{padding:"3px 8px",borderRadius:6,background:stColor.bg,color:stColor.fg,border:`1px solid ${stColor.border}`,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4,fontFamily:"inherit",cursor:"pointer"}}>
                              {STATUTS_FF.map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{padding:"9px 12px"}}>
                            <div style={{display:"flex",gap:5}}>
                              <button onClick={()=>{setEditFF(f);setShowFFModal(true);}} title="Modifier" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                              <button onClick={()=>{if(window.confirm(`Supprimer la facture ${f.ref||""} ?`))setFacturesFournisseur(fs=>fs.filter(x=>x.id!==f.id));}} style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:13}}>×</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        );
      })()}
      {tab==="catalogues"&&<CataloguesTab fournisseurs={fournisseurs} setFournisseurs={setFournisseurs} setEditCmd={setEditCmd} setShowCmdModal={setShowCmdModal}/>}
      {showFFModal&&<FactureFournisseurModal facture={editFF} fournisseurs={fournisseurs} chantiers={chantiers}
        onSave={f=>{
          if(editFF)setFacturesFournisseur(fs=>fs.map(x=>x.id===editFF.id?f:x));
          else setFacturesFournisseur(fs=>[f,...fs]);
          setShowFFModal(false);setEditFF(null);
        }}
        onClose={()=>{setShowFFModal(false);setEditFF(null);}}/>}
      {showCmdModal&&<CommandeFournisseurModal commande={editCmd} fournisseurs={fournisseurs} chantiers={chantiers} docs={docs} allCommandes={commandesFournisseur}
        onSave={c=>{
          if(editCmd)setCommandesFournisseur(cs=>cs.map(x=>x.id===editCmd.id?c:x));
          else setCommandesFournisseur(cs=>[c,...cs]);
          setShowCmdModal(false);setEditCmd(null);
        }}
        onClose={()=>{setShowCmdModal(false);setEditCmd(null);}}/>}
      {apercuCmd&&<Modal title={`Aperçu — ${apercuCmd.numero}`} onClose={()=>setApercuCmd(null)} maxWidth={820}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setApercuCmd(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <ApercuCommandeFournisseur commande={apercuCmd} fournisseur={fournisseurs.find(f=>f.id===apercuCmd.fournisseurId)} chantier={chantiers.find(c=>c.id===apercuCmd.chantierId)} entreprise={entreprise}/>
        </div>
      </Modal>}
      {showForm&&(
        <Modal title={editId?`Modifier ${form.nom||"fournisseur"}`:"Nouveau fournisseur"} onClose={()=>setShowForm(false)} maxWidth={520}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Nom <span style={{color:L.red}}>*</span></label>
              <input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Catégorie</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
                {cats.map(c=>(
                  <label key={c.v} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",border:`2px solid ${form.categorie===c.v?c.c:L.border}`,borderRadius:8,cursor:"pointer",background:form.categorie===c.v?c.c+"15":L.surface}}>
                    <input type="radio" checked={form.categorie===c.v} onChange={()=>setForm({...form,categorie:c.v})}/>
                    <span style={{fontSize:12,fontWeight:600}}>{c.icon} {c.l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Email</label>
                <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Téléphone</label>
                <input value={form.tel} onChange={e=>setForm({...form,tel:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
              </div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Adresse</label>
              <input value={form.adresse} onChange={e=>setForm({...form,adresse:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>SIRET</label>
                <input value={form.siret} onChange={e=>setForm({...form,siret:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"monospace"}}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>IBAN</label>
                <input value={form.iban} onChange={e=>setForm({...form,iban:e.target.value.toUpperCase().replace(/\s/g,"")})} placeholder="FR76..." style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:12,fontFamily:"monospace"}}/>
              </div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
              <Btn onClick={()=>setShowForm(false)} variant="secondary">Annuler</Btn>
              <Btn onClick={save} variant="primary" disabled={!form.nom.trim()} icon="✓">Enregistrer</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Module léger : pas de table dédiée, on s'appuie sur l'existant. La conversion
// devis→facture se fait depuis le bouton "→ Fact." dans VueDevis (line 3639+).
// Ici on liste, change le statut, et imprime.
// Modes de paiement supportés. La date+mode sont stockés sur le doc à la
// validation du paiement (datePaiement + modePaiement). Ces champs alimentent
// l'onglet Encaissements.
const MODES_PAIEMENT=[
  {v:"virement",l:"Virement",icon:"🏦"},
  {v:"cheque",l:"Chèque",icon:"📄"},
  {v:"especes",l:"Espèces",icon:"💵"},
  {v:"cb",l:"Carte bancaire",icon:"💳"},
];
function PaiementModal({doc,onSave,onClose}){
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [mode,setMode]=useState("virement");
  return(
    <Modal title={`Encaissement — ${doc.numero}`} onClose={onClose} maxWidth={420}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{padding:"10px 12px",background:L.greenBg||"#D1FAE5",borderRadius:8,fontSize:12,color:L.green}}>
          Marquer comme {doc.estAcompte?"acompte reçu":"facture payée"} — saisis la date et le mode de règlement.
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Date du paiement</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",padding:"9px 11px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Mode de règlement</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {MODES_PAIEMENT.map(m=>(
              <label key={m.v} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",border:`2px solid ${mode===m.v?L.green:L.border}`,borderRadius:8,cursor:"pointer",background:mode===m.v?(L.greenBg||"#D1FAE5"):L.surface}}>
                <input type="radio" checked={mode===m.v} onChange={()=>setMode(m.v)} style={{display:"none"}}/>
                <span style={{fontSize:14}}>{m.icon}</span>
                <span style={{fontSize:12,fontWeight:600}}>{m.l}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={()=>onSave({datePaiement:date,modePaiement:mode})} variant="primary" icon="✓">Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

function VueFactures({entreprise,docs,setDocs}){
  const [tab,setTab]=useState("factures");
  const [apercu,setApercu]=useState(null);
  const [acompteParent,setAcompteParent]=useState(null);
  const [paiementDoc,setPaiementDoc]=useState(null);
  const factures=docs.filter(d=>d.type==="facture");
  // Total HT/TTC d'une facture (réplique le calc de VueDevis sans options).
  function calcFact(d){
    if(!d)return{ht:0,tv:0,ttc:0};
    let ht=0,tv=0;
    for(const l of (d.lignes||[])){
      if(!isLigneDevis(l))continue;
      const lh=(+l.qte||0)*(+l.prixUnitHT||0);
      ht+=lh;tv+=lh*((+l.tva||0)/100);
    }
    return{ht:+ht.toFixed(2),tv:+tv.toFixed(2),ttc:+(ht+tv).toFixed(2)};
  }
  // ApercuDevis attend calcDocTotal({ht,tv,ttc,optionsHT,optionsTVA,optionsTTC,optionsByid})
  function calcForApercu(d){
    const t=calcFact(d);
    return{...t,optionsHT:0,optionsTVA:0,optionsTTC:0,acceptedHT:0,acceptedTVA:0,acceptedTTC:0,optionsByid:new Map()};
  }
  function setStatut(id,statut){setDocs(ds=>ds.map(d=>d.id===id?{...d,statut}:d));}
  function annuler(f){
    if(!window.confirm(`Annuler la facture ${f.numero} ? Elle sera marquée comme annulée (statut "annulé").`))return;
    setStatut(f.id,"annulé");
  }
  function supprimer(f){
    if(!window.confirm(`Supprimer définitivement ${f.numero} ?`))return;
    setDocs(ds=>ds.filter(d=>d.id!==f.id));
  }
  const totalTTC=factures.reduce((a,d)=>a+calcFact(d).ttc,0);
  const totalPaye=factures.filter(d=>d.statut==="payé").reduce((a,d)=>a+calcFact(d).ttc,0);
  const totalAttente=factures.filter(d=>d.statut==="en attente").reduce((a,d)=>a+calcFact(d).ttc,0);
  // Couleur par statut
  const STATUT_COLORS={
    "en attente":{bg:L.orangeBg||"#FEF3C7",fg:L.orange||"#D97706",border:"#FCD34D"},
    "payé":{bg:L.greenBg||"#D1FAE5",fg:L.green||"#059669",border:"#86EFAC"},
    "annulé":{bg:L.redBg||"#FEE2E2",fg:L.red||"#DC2626",border:"#FCA5A5"},
  };
  function StatutBadge({statut}){
    const c=STATUT_COLORS[statut]||{bg:L.bg,fg:L.textSm,border:L.border};
    return <span style={{display:"inline-block",padding:"3px 8px",borderRadius:6,background:c.bg,color:c.fg,border:`1px solid ${c.border}`,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4}}>{statut||"—"}</span>;
  }
  // Encaissements = factures payées (avec datePaiement+modePaiement). Triés par date desc.
  const encaissements=factures.filter(d=>d.statut==="payé").sort((a,b)=>(b.datePaiement||b.date||"").localeCompare(a.datePaiement||a.date||""));
  const totalEncaisse=encaissements.reduce((a,d)=>a+calcFact(d).ttc,0);
  const enAttenteEnc=factures.filter(d=>d.statut==="en attente").reduce((a,d)=>a+calcFact(d).ttc,0);
  const tauxRecouvrement=(totalEncaisse+enAttenteEnc)>0?Math.round((totalEncaisse/(totalEncaisse+enAttenteEnc))*100):0;
  function exportEncaissementsCSV(){
    const rows=[["Date paiement","Mode","N° doc","Type","Client","Montant TTC"]];
    for(const e of encaissements){
      rows.push([
        e.datePaiement||e.date||"",
        e.modePaiement||"",
        e.numero||"",
        e.estAcompte?"Acompte":"Facture",
        (e.client||"").replace(/[";]/g," "),
        String(calcFact(e).ttc).replace(".",","),
      ]);
    }
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`encaissements-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  return(
    <div>
      <PageH title="Factures" subtitle="Suivi des factures émises et paiements clients"/>
      <Tabs tabs={[
        {id:"factures",label:`Factures (${factures.length})`,icon:"🧾"},
        {id:"encaissements",label:`Encaissements (${encaissements.length})`,icon:"💰"},
      ]} active={tab} onChange={setTab}/>
      {tab==="factures"&&(<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:18}}>
        <KPI label="Factures" value={factures.length} sub={euro(totalTTC)} color={L.blue}/>
        <KPI label="Payées" value={factures.filter(d=>d.statut==="payé").length} sub={euro(totalPaye)} color={L.green}/>
        <KPI label="En attente" value={factures.filter(d=>d.statut==="en attente").length} sub={euro(totalAttente)} color={L.orange}/>
        <KPI label="Annulées" value={factures.filter(d=>d.statut==="annulé").length} color={L.red}/>
      </div>
      {factures.length===0?(
        <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
          <div style={{fontSize:38,marginBottom:10}}>🧾</div>
          <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucune facture pour le moment</div>
          <div style={{fontSize:12,lineHeight:1.6}}>Crée un devis et clique sur le bouton <strong>→ Fact.</strong> pour le convertir.</div>
        </Card>
      ):(
        <Card style={{overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>{["N°","Date","Client","HT","TTC","Statut","Actions"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {factures.map((doc,i)=>{
                const t=calcFact(doc);
                const annulee=doc.statut==="annulé";
                return(
                <tr key={doc.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg,opacity:annulee?0.55:1}}>
                  <td style={{padding:"9px 12px",fontSize:12,color:L.textSm,fontFamily:"monospace"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span>{doc.numero}</span>
                      {doc.estAcompte&&<span title="Facture d'acompte" style={{background:"#F5F3FF",color:"#6D28D9",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:800,border:"1px solid #C4B5FD"}}>ACOMPTE</span>}
                    </div>
                  </td>
                  <td style={{padding:"9px 12px",fontSize:12}}>{doc.date}</td>
                  <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>{doc.client}</td>
                  <td style={{padding:"9px 12px",fontSize:12,fontFamily:"monospace"}}>{euro(t.ht)}</td>
                  <td style={{padding:"9px 12px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace"}}>{euro(t.ttc)}</td>
                  <td style={{padding:"9px 12px"}}><StatutBadge statut={doc.statut}/></td>
                  <td style={{padding:"9px 12px"}}>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      <button onClick={()=>setApercu(doc)} title="Aperçu / Imprimer / PDF" style={{padding:"4px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.navy,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>👁 PDF</button>
                      {doc.statut!=="payé"&&!annulee&&<button onClick={()=>setPaiementDoc(doc)} title="Marquer comme payée (date + mode règlement)" style={{padding:"4px 8px",border:`1px solid ${L.green}`,borderRadius:6,background:L.greenBg||"#D1FAE5",color:L.green,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✓ {doc.estAcompte?"Reçu":"Payée"}</button>}
                      {!doc.estAcompte&&!annulee&&doc.statut!=="payé"&&<button onClick={()=>setAcompteParent(doc)} title="Créer une facture d'acompte" style={{padding:"4px 8px",border:`1px solid ${L.purple}`,borderRadius:6,background:L.surface,color:L.purple,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💰 Acompte</button>}
                      {!annulee&&<button onClick={()=>annuler(doc)} title="Annuler la facture" style={{padding:"4px 8px",border:`1px solid ${L.red}33`,borderRadius:6,background:L.surface,color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⊘ Annuler</button>}
                      <button onClick={()=>supprimer(doc)} title="Supprimer définitivement" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:13}}>×</button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </Card>
      )}
      </>)}
      {tab==="encaissements"&&(<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,marginBottom:18}}>
          <KPI label="Total encaissé" value={euro(totalEncaisse)} sub={`${encaissements.length} règlements`} color={L.green}/>
          <KPI label="En attente" value={euro(enAttenteEnc)} sub={`${factures.filter(d=>d.statut==="en attente").length} factures`} color={L.orange}/>
          <KPI label="Taux de recouvrement" value={`${tauxRecouvrement}%`} color={tauxRecouvrement>=80?L.green:tauxRecouvrement>=50?L.orange:L.red}/>
          <KPI label="Acomptes reçus" value={encaissements.filter(d=>d.estAcompte).length} sub={euro(encaissements.filter(d=>d.estAcompte).reduce((a,d)=>a+calcFact(d).ttc,0))} color={L.purple}/>
        </div>
        {encaissements.length>0&&(
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
            <Btn onClick={exportEncaissementsCSV} variant="secondary" icon="📥">Exporter CSV (Compta)</Btn>
          </div>
        )}
        {encaissements.length===0?(
          <Card style={{padding:30,textAlign:"center",color:L.textSm}}>
            <div style={{fontSize:38,marginBottom:10}}>💰</div>
            <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:6}}>Aucun encaissement enregistré</div>
            <div style={{fontSize:12,lineHeight:1.6}}>Marque une facture comme payée depuis l'onglet Factures pour la voir apparaître ici.</div>
          </Card>
        ):(
          <Card style={{overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:L.bg}}>{["Date paiement","Mode","N° doc","Type","Client","Montant TTC",""].map(h=><th key={h} style={{textAlign:"left",padding:"9px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
              <tbody>
                {encaissements.map((e,i)=>{
                  const ttc=calcFact(e).ttc;
                  const mode=MODES_PAIEMENT.find(m=>m.v===e.modePaiement);
                  return(
                    <tr key={e.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                      <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>{e.datePaiement||e.date||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12}}>{mode?`${mode.icon} ${mode.l}`:e.modePaiement||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,fontFamily:"monospace",color:L.textSm}}>{e.numero}</td>
                      <td style={{padding:"9px 12px"}}>
                        {e.estAcompte
                          ?<span style={{background:"#F5F3FF",color:"#6D28D9",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700,border:"1px solid #C4B5FD"}}>ACOMPTE</span>
                          :<span style={{background:L.greenBg||"#D1FAE5",color:L.green,padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700,border:`1px solid ${L.green}33`}}>FACTURE</span>}
                      </td>
                      <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:L.text}}>{e.client}</td>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:800,color:L.green,fontFamily:"monospace"}}>+{euro(ttc)}</td>
                      <td style={{padding:"9px 12px"}}>
                        <button onClick={()=>{if(window.confirm(`Annuler l'encaissement de ${e.numero} ? La facture repassera en "en attente".`))setDocs(ds=>ds.map(x=>x.id===e.id?{...x,statut:"en attente",datePaiement:null,modePaiement:null}:x));}}
                          title="Annuler le paiement" style={{padding:"3px 8px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.red,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>↻ Annuler</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </>)}
      {apercu&&<Modal title={`Aperçu — ${apercu.numero}`} onClose={()=>setApercu(null)} maxWidth={820}>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}} className="no-print">
          <Btn onClick={()=>setApercu(null)} variant="secondary">Fermer</Btn>
          <Btn onClick={()=>window.print()} variant="primary" icon="🖨">Imprimer / PDF</Btn>
        </div>
        <div id="printable-apercu" style={{background:L.surface,border:`1px solid ${L.border}`,borderRadius:8,padding:24}}>
          <ApercuDevis doc={apercu} entreprise={entreprise} calcDocTotal={calcForApercu} acomptes={docs.filter(d=>d.acompteParentId===apercu.id&&d.statut==="payé")}/>
        </div>
      </Modal>}
      {acompteParent&&<AcompteModal parent={acompteParent} parentTTC={calcFact(acompteParent).ttc} allDocs={docs} onSave={fa=>{setDocs(ds=>[fa,...ds]);setAcompteParent(null);}} onClose={()=>setAcompteParent(null)}/>}
      {paiementDoc&&<PaiementModal doc={paiementDoc}
        onSave={infos=>{
          setDocs(ds=>ds.map(x=>x.id===paiementDoc.id?{...x,statut:"payé",datePaiement:infos.datePaiement,modePaiement:infos.modePaiement}:x));
          setPaiementDoc(null);
        }}
        onClose={()=>setPaiementDoc(null)}/>}
    </div>
  );
}

// ─── MODÈLES DE DEVIS PRÉ-DÉFINIS ───────────────────────────────────────────
// Squelettes structurés par corps de métier. Quantités et prix à 0 — l'user
// ajuste après import. Unités cohérentes avec le prompt IA (m2, ml, U, forfait).
const MODELES_DEVIS=[
  {id:"sdb",label:"Rénovation salle de bain complète",icon:"🛁",description:"Démolition, plomberie, carrelage, sanitaires, peinture",lignes:[
    {type:"titre",libelle:"DÉPOSE & DÉMOLITION"},
    {type:"ligne",libelle:"Dépose carrelage sol et mur existant",unite:"m2",tva:10},
    {type:"ligne",libelle:"Dépose sanitaires (WC, lavabo, douche/baignoire)",unite:"forfait",tva:10},
    {type:"ligne",libelle:"Évacuation gravats en déchetterie",unite:"forfait",tva:10},
    {type:"titre",libelle:"PLOMBERIE"},
    {type:"ligne",libelle:"Reprise alimentation eau froide/chaude PER Ø16",unite:"ml",tva:10},
    {type:"ligne",libelle:"Reprise évacuations PVC Ø40 et Ø100",unite:"ml",tva:10},
    {type:"ligne",libelle:"Pose receveur de douche extra-plat + bonde + colonne",unite:"U",tva:10},
    {type:"ligne",libelle:"Pose meuble vasque + mitigeur + siphon",unite:"U",tva:10},
    {type:"ligne",libelle:"Pose WC suspendu + bâti-support + plaque commande",unite:"U",tva:10},
    {type:"titre",libelle:"CARRELAGE & FAÏENCE"},
    {type:"ligne",libelle:"Étanchéité sous carrelage SEL 2 couches",unite:"m2",tva:10},
    {type:"ligne",libelle:"Fourniture et pose carrelage sol 60×60 grès cérame",unite:"m2",tva:10},
    {type:"ligne",libelle:"Fourniture et pose faïence murale H 2,10 m",unite:"m2",tva:10},
    {type:"ligne",libelle:"Joints + plinthes carrelage assorties",unite:"ml",tva:10},
    {type:"titre",libelle:"PEINTURE & FINITIONS"},
    {type:"ligne",libelle:"Préparation et peinture plafond 2 couches",unite:"m2",tva:10},
    {type:"ligne",libelle:"Joints silicone périphériques",unite:"ml",tva:10},
    {type:"ligne",libelle:"Nettoyage fin de chantier",unite:"forfait",tva:10},
  ]},
  {id:"cuisine",label:"Rénovation cuisine",icon:"🍳",description:"Démolition, électricité, plomberie, carrelage, peinture",lignes:[
    {type:"titre",libelle:"DÉPOSE & PRÉPARATION"},
    {type:"ligne",libelle:"Dépose ancienne cuisine et électroménager",unite:"forfait",tva:10},
    {type:"ligne",libelle:"Dépose revêtements mur et sol",unite:"m2",tva:10},
    {type:"ligne",libelle:"Évacuation gravats et anciens éléments",unite:"forfait",tva:10},
    {type:"titre",libelle:"ÉLECTRICITÉ"},
    {type:"ligne",libelle:"Création circuits dédiés (four, plaque, lave-vaisselle)",unite:"forfait",tva:10},
    {type:"ligne",libelle:"Pose prises spécialisées 32A et 16A",unite:"U",tva:10},
    {type:"ligne",libelle:"Pose éclairage plan de travail LED + interrupteur",unite:"ml",tva:10},
    {type:"titre",libelle:"PLOMBERIE"},
    {type:"ligne",libelle:"Reprise alimentation évier + lave-vaisselle PER",unite:"ml",tva:10},
    {type:"ligne",libelle:"Pose évier + mitigeur + siphon",unite:"U",tva:10},
    {type:"titre",libelle:"REVÊTEMENTS"},
    {type:"ligne",libelle:"Fourniture et pose carrelage sol 60×60",unite:"m2",tva:10},
    {type:"ligne",libelle:"Fourniture et pose crédence faïence ou verre",unite:"m2",tva:10},
    {type:"titre",libelle:"PEINTURE"},
    {type:"ligne",libelle:"Peinture murs et plafond cuisine 2 couches",unite:"m2",tva:10},
  ]},
  {id:"peinture_appt",label:"Peinture appartement",icon:"🎨",description:"Préparation murs, peinture plafond, peinture murs, finitions",lignes:[
    {type:"titre",libelle:"PRÉPARATION DES SUPPORTS"},
    {type:"ligne",libelle:"Protection sols et mobilier (bâches)",unite:"m2",tva:10},
    {type:"ligne",libelle:"Rebouchage trous et fissures à l'enduit",unite:"forfait",tva:10},
    {type:"ligne",libelle:"Ponçage et lessivage des supports",unite:"m2",tva:10},
    {type:"titre",libelle:"PEINTURE PLAFOND"},
    {type:"ligne",libelle:"Sous-couche d'accrochage plafond",unite:"m2",tva:10},
    {type:"ligne",libelle:"Peinture acrylique mate plafond 2 couches",unite:"m2",tva:10},
    {type:"titre",libelle:"PEINTURE MURS"},
    {type:"ligne",libelle:"Sous-couche pigmentée mur",unite:"m2",tva:10},
    {type:"ligne",libelle:"Peinture acrylique satinée mur 2 couches",unite:"m2",tva:10},
    {type:"titre",libelle:"FINITIONS"},
    {type:"ligne",libelle:"Peinture des huisseries (portes, plinthes)",unite:"ml",tva:10},
    {type:"ligne",libelle:"Nettoyage final et repli chantier",unite:"forfait",tva:10},
  ]},
  {id:"isolation",label:"Isolation combles",icon:"🏠",description:"Dépose ancienne, pose laine de verre, pare-vapeur",lignes:[
    {type:"titre",libelle:"DÉPOSE EXISTANT"},
    {type:"ligne",libelle:"Dépose ancienne isolation + évacuation",unite:"m2",tva:5.5},
    {type:"ligne",libelle:"Inspection et nettoyage charpente",unite:"forfait",tva:5.5},
    {type:"titre",libelle:"ISOLATION THERMIQUE"},
    {type:"ligne",libelle:"Fourniture et pose laine de verre 300 mm R=7,5",unite:"m2",tva:5.5},
    {type:"ligne",libelle:"Pose pare-vapeur + adhésif périphérique",unite:"m2",tva:5.5},
    {type:"ligne",libelle:"Calfeutrement périphérie et trappes",unite:"ml",tva:5.5},
    {type:"titre",libelle:"FINITIONS"},
    {type:"ligne",libelle:"Pose chemin de circulation OSB",unite:"m2",tva:5.5},
    {type:"ligne",libelle:"Attestation RGE et certificat travaux",unite:"forfait",tva:5.5},
  ]},
  {id:"carrelage",label:"Carrelage sol et mur",icon:"🟫",description:"Dépose ancien, fourniture+pose sol, fourniture+pose faïence, joints",lignes:[
    {type:"titre",libelle:"DÉPOSE & PRÉPARATION SUPPORT"},
    {type:"ligne",libelle:"Dépose carrelage existant",unite:"m2",tva:10},
    {type:"ligne",libelle:"Ragréage autolissant 5 mm",unite:"m2",tva:10},
    {type:"ligne",libelle:"Primaire d'accrochage",unite:"m2",tva:10},
    {type:"titre",libelle:"CARRELAGE SOL"},
    {type:"ligne",libelle:"Fourniture et pose carrelage grès cérame 60×60 (collé spatule crantée)",unite:"m2",tva:10},
    {type:"ligne",libelle:"Plinthes carrelage assorties (fourniture + pose)",unite:"ml",tva:10},
    {type:"titre",libelle:"FAÏENCE MUR"},
    {type:"ligne",libelle:"Fourniture et pose faïence 25×40 ou 30×60 (calepinage soigné)",unite:"m2",tva:10},
    {type:"titre",libelle:"JOINTS & FINITIONS"},
    {type:"ligne",libelle:"Joints ciment teinté",unite:"m2",tva:10},
    {type:"ligne",libelle:"Joints silicone périphériques",unite:"ml",tva:10},
  ]},
  {id:"elec",label:"Électricité mise aux normes",icon:"⚡",description:"Tableau, prises, interrupteurs, éclairage NF C 15-100",lignes:[
    {type:"titre",libelle:"TABLEAU ÉLECTRIQUE"},
    {type:"ligne",libelle:"Dépose ancien tableau + mise en sécurité",unite:"forfait",tva:10},
    {type:"ligne",libelle:"Pose tableau modulaire 13 modules + peignes",unite:"forfait",tva:10},
    {type:"ligne",libelle:"Disjoncteurs différentiels 30 mA type AC",unite:"U",tva:10},
    {type:"ligne",libelle:"Disjoncteurs divisionnaires (16A / 20A / 32A)",unite:"U",tva:10},
    {type:"titre",libelle:"DISTRIBUTION & RACCORDEMENTS"},
    {type:"ligne",libelle:"Câblage 2,5² circuits prises",unite:"ml",tva:10},
    {type:"ligne",libelle:"Câblage 1,5² circuits éclairage",unite:"ml",tva:10},
    {type:"ligne",libelle:"Gaine ICTA Ø20 sous moulures",unite:"ml",tva:10},
    {type:"titre",libelle:"APPAREILLAGE"},
    {type:"ligne",libelle:"Prise 16A + boîte d'encastrement",unite:"U",tva:10},
    {type:"ligne",libelle:"Interrupteur va-et-vient + boîte",unite:"U",tva:10},
    {type:"ligne",libelle:"Point lumineux DCL plafond",unite:"U",tva:10},
    {type:"ligne",libelle:"Spot encastré LED 7W blanc neutre",unite:"U",tva:10},
    {type:"titre",libelle:"CONFORMITÉ"},
    {type:"ligne",libelle:"Attestation Consuel et mise en service",unite:"forfait",tva:10},
  ]},
  {id:"plomb_sdb",label:"Plomberie salle de bain",icon:"🚿",description:"Alimentation, évacuation, sanitaires",lignes:[
    {type:"titre",libelle:"ALIMENTATION EAU"},
    {type:"ligne",libelle:"Tuyau PER Ø16 eau froide/chaude pré-isolé",unite:"ml",tva:10},
    {type:"ligne",libelle:"Vanne d'arrêt 1/4 tour",unite:"U",tva:10},
    {type:"titre",libelle:"ÉVACUATIONS"},
    {type:"ligne",libelle:"Tuyau PVC Ø40 sortie lavabo / douche",unite:"ml",tva:10},
    {type:"ligne",libelle:"Tuyau PVC Ø100 sortie WC",unite:"ml",tva:10},
    {type:"titre",libelle:"SANITAIRES"},
    {type:"ligne",libelle:"WC suspendu + bâti-support + plaque commande",unite:"U",tva:10},
    {type:"ligne",libelle:"Receveur douche extra-plat + bonde + colonne",unite:"U",tva:10},
    {type:"ligne",libelle:"Meuble vasque + mitigeur + siphon",unite:"U",tva:10},
    {type:"ligne",libelle:"Sèche-serviettes électrique 500W",unite:"U",tva:10},
  ]},
  {id:"facade",label:"Ravalement façade",icon:"🏛",description:"Nettoyage, rebouchage, enduit, peinture",lignes:[
    {type:"titre",libelle:"INSTALLATION DE CHANTIER"},
    {type:"ligne",libelle:"Montage échafaudage + bâche de protection",unite:"m2",tva:10},
    {type:"titre",libelle:"PRÉPARATION DU SUPPORT"},
    {type:"ligne",libelle:"Nettoyage haute pression façade",unite:"m2",tva:10},
    {type:"ligne",libelle:"Traitement anti-mousse / fongicide",unite:"m2",tva:10},
    {type:"ligne",libelle:"Rebouchage fissures et trous au mortier",unite:"ml",tva:10},
    {type:"titre",libelle:"ENDUIT"},
    {type:"ligne",libelle:"Application primaire d'accrochage",unite:"m2",tva:10},
    {type:"ligne",libelle:"Enduit minéral monocouche teinté projeté",unite:"m2",tva:10},
    {type:"titre",libelle:"PEINTURE FAÇADE"},
    {type:"ligne",libelle:"Peinture pliolite ou siloxane 2 couches",unite:"m2",tva:10},
    {type:"ligne",libelle:"Peinture éléments ferronnerie / huisseries",unite:"ml",tva:10},
    {type:"titre",libelle:"REPLI"},
    {type:"ligne",libelle:"Démontage échafaudage + nettoyage périphérie",unite:"forfait",tva:10},
  ]},
];
function loadModelesCustom(){try{return JSON.parse(localStorage.getItem("cp_modeles_custom")||"[]");}catch{return[];}}
function saveModelesCustom(arr){try{localStorage.setItem("cp_modeles_custom",JSON.stringify(arr));}catch(e){console.warn("[modeles save]",e);}}

// Modale de sélection / aperçu d'un modèle de devis
function ModelesDevisModal({onPick,onClose}){
  const [customs,setCustoms]=useState(loadModelesCustom());
  const all=[...MODELES_DEVIS,...customs];
  const [selId,setSelId]=useState(all[0]?.id||null);
  const sel=all.find(m=>m.id===selId)||all[0];
  function delCustom(id){
    if(!window.confirm("Supprimer ce modèle personnalisé ?"))return;
    const next=customs.filter(m=>m.id!==id);
    saveModelesCustom(next);setCustoms(next);
    if(selId===id)setSelId(MODELES_DEVIS[0]?.id||null);
  }
  const nbLignes=sel?(sel.lignes||[]).filter(l=>l.type!=="titre"&&l.type!=="soustitre").length:0;
  const nbTitres=sel?(sel.lignes||[]).filter(l=>l.type==="titre").length:0;
  return(
    <Modal title="📋 Modèles de devis" onClose={onClose} maxWidth={920}>
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:14,minHeight:380}}>
        {/* Liste à gauche */}
        <div style={{borderRight:`1px solid ${L.border}`,paddingRight:10,overflowY:"auto",maxHeight:520}}>
          <div style={{fontSize:10,fontWeight:700,color:L.textXs,textTransform:"uppercase",letterSpacing:0.6,marginBottom:6,padding:"0 6px"}}>Modèles types ({MODELES_DEVIS.length})</div>
          {MODELES_DEVIS.map(m=>(
            <button key={m.id} onClick={()=>setSelId(m.id)} style={{display:"flex",gap:8,alignItems:"flex-start",width:"100%",textAlign:"left",padding:"8px 10px",border:`1px solid ${selId===m.id?L.accent:"transparent"}`,background:selId===m.id?L.accentBg:"transparent",borderRadius:7,cursor:"pointer",marginBottom:3,fontFamily:"inherit"}}>
              <span style={{fontSize:18,flexShrink:0}}>{m.icon}</span>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:selId===m.id?L.accent:L.text,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.label}</div>
                <div style={{fontSize:10,color:L.textSm,lineHeight:1.4}}>{m.description}</div>
              </div>
            </button>
          ))}
          {customs.length>0&&<>
            <div style={{fontSize:10,fontWeight:700,color:L.textXs,textTransform:"uppercase",letterSpacing:0.6,margin:"12px 0 6px",padding:"0 6px"}}>Mes modèles ({customs.length})</div>
            {customs.map(m=>(
              <div key={m.id} style={{display:"flex",alignItems:"stretch",border:`1px solid ${selId===m.id?L.accent:"transparent"}`,background:selId===m.id?L.accentBg:"transparent",borderRadius:7,marginBottom:3}}>
                <button onClick={()=>setSelId(m.id)} style={{display:"flex",gap:8,alignItems:"flex-start",flex:1,textAlign:"left",padding:"8px 10px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{m.icon||"📋"}</span>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:selId===m.id?L.accent:L.text,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.label}</div>
                    <div style={{fontSize:10,color:L.textSm}}>{m.description||"Modèle personnalisé"}</div>
                  </div>
                </button>
                <button onClick={()=>delCustom(m.id)} title="Supprimer" style={{padding:"0 10px",background:"transparent",border:"none",color:L.red,cursor:"pointer",fontSize:14,fontFamily:"inherit"}}>🗑</button>
              </div>
            ))}
          </>}
        </div>
        {/* Aperçu à droite */}
        {sel?(
          <div style={{display:"flex",flexDirection:"column",minHeight:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:10}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:L.text,display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:22}}>{sel.icon||"📋"}</span>{sel.label}</div>
                <div style={{fontSize:11,color:L.textSm,marginTop:4}}>{sel.description}</div>
                <div style={{fontSize:10,color:L.textXs,marginTop:6}}>📑 {nbTitres} lot{nbTitres>1?"s":""} · {nbLignes} ligne{nbLignes>1?"s":""} type · qté & prix à compléter après import</div>
              </div>
              <Btn onClick={()=>onPick(sel)} variant="success" icon="✓">Importer ce modèle</Btn>
            </div>
            <Card style={{padding:0,overflow:"auto",maxHeight:380,border:`1px solid ${L.border}`}}>
              <div style={{padding:0}}>
                {(sel.lignes||[]).map((l,i)=>{
                  if(l.type==="titre")return <div key={i} style={{background:L.navy,color:"#fff",padding:"7px 12px",fontSize:12,fontWeight:800,letterSpacing:0.4,textTransform:"uppercase"}}>{l.libelle}</div>;
                  if(l.type==="soustitre")return <div key={i} style={{background:L.navyBg,padding:"5px 12px 5px 22px",fontSize:11,fontWeight:700,color:L.navy}}>{l.libelle}</div>;
                  return(
                    <div key={i} style={{padding:"5px 12px",fontSize:11,color:L.text,borderBottom:`1px solid ${L.border}`,display:"flex",justifyContent:"space-between",gap:8}}>
                      <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.libelle}</span>
                      <span style={{color:L.textXs,fontFamily:"monospace",fontSize:10,flexShrink:0}}>{l.unite||"U"}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div style={{fontSize:10,color:L.textXs,marginTop:8,fontStyle:"italic"}}>Les lignes seront ajoutées à votre devis. Si le devis est vide, elles le remplacent ; sinon elles sont ajoutées à la suite.</div>
          </div>
        ):(
          <div style={{padding:30,textAlign:"center",color:L.textSm,fontSize:12}}>Sélectionnez un modèle dans la liste.</div>
        )}
      </div>
    </Modal>
  );
}

function CreateurDevis({chantiers,salaries,sousTraitants=[],statut,docs,onSave,onClose,onDirtyChange,onSaveOuvrage,initialDoc,clients=[],setClients}){
  const [form,setForm]=useState(()=>{
    const base={type:"devis",numero:`DEV-${Date.now().toString().slice(-5)}`,date:new Date().toISOString().slice(0,10),client:"",titreChantier:"",emailClient:"",telClient:"",adresseClient:"",statut:"brouillon",chantierId:null,conditionsReglement:"40% à la commande – 60% à l'achèvement",notes:"Validité 15 jours.",acompteVerse:0,
      // Démarrage Mediabat : un titre puis une ligne vide — l'utilisateur
      // commence avec la structure attendue, sans avoir à supprimer de défaut.
      lignes:[{id:1,type:"titre",libelle:"NOUVEAU TITRE"},{id:2,type:"ligne",libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10}]};
    if(!initialDoc)return base;
    return{...base,...initialDoc,lignes:Array.isArray(initialDoc.lignes)&&initialDoc.lignes.length>0?initialDoc.lignes.map(l=>({...l})):base.lignes};
  });
  const [aiModal,setAiModal]=useState(null);
  const [showCalc,setShowCalc]=useState({}); // ligneId -> bool
  const [showBiblio,setShowBiblio]=useState(false);
  const [savedFlash,setSavedFlash]=useState({}); // ligneId -> timestamp pour feedback ✓ après sauvegarde biblio
  // ─── Feature 1 : Sauver une ligne (prix terrain) dans la bibliothèque ──
  function saveLigneToBiblio(l){
    if(!l.libelle?.trim()){alert("La ligne doit avoir un libellé pour être sauvegardée.");return;}
    if(!l.prixUnitHT||+l.prixUnitHT<=0){alert("La ligne doit avoir un prix unitaire HT > 0.");return;}
    if(!onSaveOuvrage){alert("Sauvegarde bibliothèque non disponible.");return;}
    const heuresUnit=+l.heuresPrevues||0;
    const fournLst=l.fournitures||[];
    const fournParUnit=fournLst.reduce((a,f)=>a+(+(f.prixAchat||0)*(+(f.qte||1))),0);
    const tauxTeam=(salaries||[]).length>0
      ?salaries.reduce((a,s)=>a+(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0.42)),0)/salaries.length
      :TAUX_MO_MOYEN*(1+CHARGES_PATRON);
    const moParUnit=+(heuresUnit*tauxTeam).toFixed(2);
    const ouvrage={
      code:`USR-${Date.now()}`,
      corps:"Mes ouvrages",
      libelle:l.libelle.trim(),
      unite:l.unite||"U",
      moMin:+(moParUnit*0.85).toFixed(2),
      moMoy:moParUnit,
      moMax:+(moParUnit*1.2).toFixed(2),
      fournMin:+(fournParUnit*0.85).toFixed(2),
      fournMoy:fournParUnit,
      fournMax:+(fournParUnit*1.2).toFixed(2),
      tempsMO:heuresUnit,
      detail:`Sauvegardé depuis devis le ${new Date().toLocaleDateString("fr-FR")} — prix terrain : ${(+l.prixUnitHT).toFixed(2)}€/${l.unite||"U"}`,
      source:"Mes ouvrages",
      composants:fournLst.map(f=>({designation:f.designation||"",qte:+(f.qte||1),unite:f.unite||"U",prixAchat:+(f.prixAchat||0)})),
      affectations:l.nbOuvriers?[{q:"manoeuvre",nb:+l.nbOuvriers}]:[],
      heuresPrevues:heuresUnit,
      nbOuvriers:+l.nbOuvriers||1,
      tauxHoraireMoyen:+tauxTeam.toFixed(2),
      prixUnitHTRef:+l.prixUnitHT,
      fournitures:fournLst.map(f=>({...f,fournisseur:f.fournisseur||"Autre"})),
    };
    onSaveOuvrage(ouvrage);
    setSavedFlash(prev=>({...prev,[l.id]:Date.now()}));
    setTimeout(()=>setSavedFlash(prev=>{const{[l.id]:_,...rest}=prev;return rest;}),2200);
  }
  // ─── Feature 2 : Recalculer MO avec les taux réels de l'équipe ────────
  // Met à jour prixUnitHT pour couvrir MO + fournitures avec marge 30% cible.
  function recalcLigneMOTeam(l){
    const tauxTeam=(salaries||[]).length>0
      ?salaries.reduce((a,s)=>a+(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0.42)),0)/salaries.length
      :TAUX_MO_MOYEN*(1+CHARGES_PATRON);
    const moParUnit=(+l.heuresPrevues||0)*tauxTeam;
    const fournParUnit=(l.fournitures||[]).reduce((a,f)=>a+(+(f.prixVente||f.prixAchat||0)*(+(f.qte||1))),0);
    if(moParUnit+fournParUnit<=0){alert("Pas d'heures MO ni de fournitures sur cette ligne — rien à recalculer.");return;}
    const newPrixUnit=+((moParUnit+fournParUnit)/0.7).toFixed(2); // 30% marge cible
    updL(l.id,"prixUnitHT",newPrixUnit);
  }
  // ─── Feature 3 : Ajuster le coefficient → recompute prixUnitHT ─────────
  function adjustCoeff(l,newCoeff,calc){
    const c=+newCoeff;
    if(!c||c<=0||!calc?.prixRevient)return;
    const qte=+l.qte||1;
    const newMontant=calc.prixRevient*c;
    const newPrixUnit=+(newMontant/qte).toFixed(2);
    updL(l.id,"prixUnitHT",newPrixUnit);
  }
  // ─── Cascade éditable : un changement coût → maintient le coeff actuel,
  //     recompute prixUnitHT en cascade. updLineAndReprice patch la ligne
  //     avec les nouvelles valeurs puis ajuste prixUnitHT pour conserver
  //     le markup (coefficient) que l'user avait avant l'édition.
  function updLineAndReprice(l,patch,calc){
    const newLine={...l,...patch};
    const newCalc=calcLigneDevis(newLine,statut);
    const coeff=calc?.coeff||1;
    if(!newCalc||newCalc.prixRevient<=0){
      // Pas de recalc possible — applique juste le patch
      setForm(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?newLine:x)}));
      return;
    }
    const qte=+l.qte||1;
    const newPrixUnit=+(newCalc.prixRevient*coeff/qte).toFixed(2);
    setForm(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...newLine,prixUnitHT:newPrixUnit}:x)}));
  }
  function onMOChange(l,field,value,calc){
    updLineAndReprice(l,{[field]:value},calc);
  }
  function onSalariePick(l,salarieIdRaw,calc){
    const sid=salarieIdRaw||null;
    const patch={salarieMOId:sid};
    if(sid){
      const sal=(salaries||[]).find(s=>String(s.id)===String(sid));
      if(sal){
        const taux=(+sal.tauxHoraire||0)*(1+(+sal.chargesPatron||0.42));
        patch.tauxHoraireMoyen=+taux.toFixed(2);
      }
    }else{
      patch.tauxHoraireMoyen=undefined; // retour auto
    }
    updLineAndReprice(l,patch,calc);
  }
  function onFournEur(l,eurValue,calc){
    const v=Math.max(0,+eurValue||0);
    updLineAndReprice(l,{coutFournOverride:v},calc);
  }
  function onFournPct(l,pctValue,calc){
    // Convertit % du HT actuel → € total (one-shot, l'user peut ajuster ensuite)
    const pct=Math.max(0,+pctValue||0)/100;
    const eurValue=+(calc.montantHT*pct).toFixed(2);
    onFournEur(l,eurValue,calc);
  }
  function onFGPct(l,pctValue,calc){
    const v=Math.max(0,Math.min(150,+pctValue||0));
    updLineAndReprice(l,{tauxFGOverride:v},calc);
  }
  function resetOverrides(l,calc){
    if(!window.confirm("Réinitialiser les surcharges (fournitures, frais généraux) à leurs valeurs par défaut ?"))return;
    updLineAndReprice(l,{coutFournOverride:undefined,tauxFGOverride:undefined,tauxHoraireMoyen:undefined,salarieMOId:undefined},calc);
  }
  const [showModeles,setShowModeles]=useState(false);
  function importerModele(modele){
    if(!modele||!Array.isArray(modele.lignes))return;
    setForm(f=>{
      // Devis vide (titre par défaut + 1 ligne sans libellé) → on remplace
      const isEmpty=f.lignes.length<=2&&!f.lignes.some(l=>l.libelle&&l.libelle.trim()&&l.libelle!=="NOUVEAU TITRE");
      const base=Date.now();
      const nouvelles=modele.lignes.map((l,i)=>{
        const id=base+i*10+Math.floor(Math.random()*9);
        if(l.type==="titre"||l.type==="soustitre")return{id,type:l.type,libelle:l.libelle};
        return{id,type:"ligne",libelle:l.libelle||"",qte:0,unite:l.unite||"U",prixUnitHT:0,tva:l.tva??10};
      });
      return{...f,lignes:isEmpty?nouvelles:[...f.lignes,...nouvelles]};
    });
    setShowModeles(false);
  }
  function sauverCommeModele(){
    const lignesUtiles=form.lignes.filter(l=>(l.type==="titre"||l.type==="soustitre")||(l.libelle&&l.libelle.trim()));
    if(lignesUtiles.length===0){alert("Le devis est vide — rien à sauvegarder.");return;}
    const nom=window.prompt("Nom du modèle (ex: « Rénovation studio 30m² »)",form.titreChantier||"Mon modèle");
    if(!nom||!nom.trim())return;
    const nouvellesLignes=lignesUtiles.map(l=>{
      if(l.type==="titre"||l.type==="soustitre")return{type:l.type,libelle:l.libelle||""};
      return{type:"ligne",libelle:l.libelle||"",unite:l.unite||"U",tva:+l.tva||10};
    });
    const customs=loadModelesCustom();
    customs.push({id:`custom-${Date.now()}`,label:nom.trim(),icon:"📋",description:"Modèle personnalisé",lignes:nouvellesLignes,createdAt:Date.now()});
    saveModelesCustom(customs);
    alert(`✓ Modèle « ${nom.trim()} » sauvegardé. Vous le retrouverez dans Modèles → Mes modèles.`);
  }
  const [showImport,setShowImport]=useState(false);

  // Détecte si l'utilisateur a saisi quelque chose (pour confirmer avant de fermer)
  const dirty=!!form.client?.trim()||!!form.titreChantier?.trim()||!!form.emailClient?.trim()||!!form.telClient?.trim()||!!form.adresseClient?.trim()
    ||form.lignes.some(l=>l.type==="titre"||l.type==="soustitre"||(l.libelle&&l.libelle.trim())||(+l.prixUnitHT||0)>0);
  useEffect(()=>{if(onDirtyChange)onDirtyChange(dirty);},[dirty,onDirtyChange]);

  // Distingue base (lignes hors options) et options (lignes dans un bloc OPTION)
  function calcDocTotal(doc){
    const items=doc.lignes||[];
    const optionMap=ligneToOptionMap(items);
    let baseH=0,baseT=0,optH=0,optT=0;
    for(const l of items){
      if(!isLigneDevis(l))continue;
      const ht=(+l.qte||0)*(+l.prixUnitHT||0);
      const tv=ht*((+l.tva||0)/100);
      if(optionMap.get(l.id)!=null){optH+=ht;optT+=tv;}
      else{baseH+=ht;baseT+=tv;}
    }
    return{ht:baseH,tva:baseT,ttc:baseH+baseT,optionsHT:optH,optionsTVA:optT,optionsTTC:optH+optT};
  }
  const {ht,tva,ttc,optionsHT,optionsTVA,optionsTTC}=calcDocTotal(form);
  const {titreSubs,sousTitreSubs,optionSubs}=calcDocSubtotals(form.lignes);

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
  function addOption(){setForm(f=>({...f,lignes:[...f.lignes,{id:Date.now(),type:"option",libelle:"OPTION (prestation facultative)"},{id:Date.now()+1,type:"ligne",libelle:"",qte:1,unite:"",prixUnitHT:0,tva:10}]}));}
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
      else if(type==="option")item={id,type:"option",libelle:"OPTION (prestation facultative)"};
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
      <ClientFieldsBlock form={form} setForm={setForm} clients={clients} setClients={setClients}/>

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
            <Btn onClick={()=>setShowModeles(true)} variant="navy" size="sm" icon="📋">Modèles</Btn>
            <Btn onClick={()=>setShowBiblio(true)} variant="navy" size="sm" icon="📖">Catalogue BTP</Btn>
            <Btn onClick={sauverCommeModele} variant="ghost" size="sm" icon="💾">Sauver modèle</Btn>
            <Btn onClick={addTitre} variant="primary" size="sm" icon="+">Titre</Btn>
            <Btn onClick={addSousTitre} variant="secondary" size="sm" icon="+">Sous-titre</Btn>
            <Btn onClick={addL} variant="secondary" size="sm" icon="+">Ligne</Btn>
            <button onClick={addOption} title="Ajouter un bloc OPTION (prestation facultative)" style={{padding:"5px 10px",border:`1px solid #F59E0B`,borderRadius:6,background:"#FEF3C7",color:"#92400E",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Option</button>
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
                        <button onClick={()=>insertItemAt(i,"option")} title="Insérer un bloc OPTION" style={{background:"#FEF3C7",border:`1px solid #F59E0B`,color:"#92400E",borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Option</button>
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
                if(l.type==="option"){
                  const sub=optionSubs.get(l.id)||0;
                  return(
                    <React.Fragment key={l.id}>
                      {insertBar}
                      <tr {...dragProps} style={{background:"linear-gradient(90deg,#FEF3C7,#FDE68A)",borderTop:`2px solid #F59E0B`,borderBottom:`1px solid #F59E0B`,opacity:isDragging?0.5:1}}>
                        {handleCell}
                        <td colSpan={6} style={{padding:"8px 10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{background:"#F59E0B",color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:0.6,whiteSpace:"nowrap"}}>📎 OPTION</span>
                            <input value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="Titre de l'option (prestation facultative)" style={{flex:1,padding:"5px 9px",border:`1px dashed #F59E0B`,background:"#FFFBEB",color:"#92400E",fontSize:12,fontWeight:700,outline:"none",fontFamily:"inherit",borderRadius:4}}/>
                          </div>
                        </td>
                        <td colSpan={2} style={{padding:"8px 9px",fontSize:13,fontWeight:800,color:"#92400E",fontFamily:"monospace",textAlign:"right",whiteSpace:"nowrap"}}>+{euro(sub)}</td>
                        <td style={{padding:"8px 5px"}}><button onClick={()=>delItem(l.id)} title="Supprimer le bloc option" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button></td>
                      </tr>
                    </React.Fragment>
                  );
                }
                const calc=calcLigneDevis(l,statut);
                // Lignes appartenant à un bloc option : fond jaune
                const inOption=(()=>{
                  for(let k=i-1;k>=0;k--){
                    const t=form.lignes[k]?.type;
                    if(t==="option")return true;
                    if(t==="titre")return false;
                  }
                  return false;
                })();
                const show=showCalc[l.id];
                const mc2=calc&&calc.tauxMarge>=20?L.green:calc&&calc.tauxMarge>=10?L.orange:L.red;
                return(
                  <React.Fragment key={l.id}>
                    {insertBar}
                    <tr {...dragProps} style={{borderBottom:show?`none`:`1px solid ${L.border}`,background:inOption?(i%2===0?"#FFFBEB":"#FEF3C7"):(i%2===0?L.surface:L.bg),verticalAlign:"top",opacity:isDragging?0.5:1}}>
                      {handleCell}
                      <td style={{padding:"6px 7px",minWidth:200}}>
                        <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                          {l.photo&&(
                            <div style={{position:"relative",flexShrink:0}}>
                              <img src={l.photo} alt="ligne" style={{width:40,height:40,objectFit:"cover",borderRadius:5,border:`1px solid ${L.border}`,display:"block"}}/>
                              <button onClick={()=>updL(l.id,"photo",null)} title="Supprimer la photo" style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",background:L.red,color:"#fff",border:"1.5px solid #fff",cursor:"pointer",fontSize:9,fontWeight:800,padding:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",lineHeight:1}}>×</button>
                            </div>
                          )}
                          <AutoTextarea value={l.libelle} onChange={e=>updL(l.id,"libelle",e.target.value)} placeholder="Ex: Carrelage 120x120, Dalle béton..." style={{width:"100%",padding:"5px 9px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                        </div>
                        {sousTraitants.length>0&&(()=>{
                          const st=l.sousTraitantId?sousTraitants.find(s=>s.id===l.sousTraitantId):null;
                          return(
                            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                              <span style={{fontSize:9,color:L.textXs,fontWeight:600}}>🤝</span>
                              <select value={l.sousTraitantId||""} onChange={e=>updL(l.id,"sousTraitantId",e.target.value?+e.target.value:null)}
                                title={st?`Sous-traitant : ${st.nom} · ${st.specialite}`:"Assigner un sous-traitant à cette ligne"}
                                style={{padding:"2px 5px",border:`1px solid ${st?(st.couleur||"#7C3AED"):L.border}`,borderRadius:4,fontSize:10,fontFamily:"inherit",background:st?(st.couleur||"#7C3AED")+"15":L.surface,color:st?(st.couleur||"#7C3AED"):L.textXs,fontWeight:st?700:500,cursor:"pointer",outline:"none",maxWidth:180}}>
                                <option value="">— Interne (équipe)</option>
                                {sousTraitants.map(s=><option key={s.id} value={s.id}>{s.nom} · {s.specialite}</option>)}
                              </select>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{padding:"6px 5px"}}><input value={l.qte} onChange={e=>updL(l.id,"qte",e.target.value)} type="number" style={{width:55,padding:"5px 6px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,textAlign:"center",outline:"none",fontFamily:"inherit"}}/></td>
                      <td style={{padding:"6px 5px"}}><input list="unites-devis" value={l.unite} onChange={e=>updL(l.id,"unite",e.target.value)} style={{width:62,padding:"5px 5px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}/></td>
                      <td style={{padding:"6px 5px"}}>
                        <div style={{display:"flex",gap:3,alignItems:"center"}}>
                          <input value={l.prixUnitHT} onChange={e=>updL(l.id,"prixUnitHT",e.target.value)} type="number" style={{width:85,padding:"5px 6px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,textAlign:"right",outline:"none",fontFamily:"inherit"}}/>
                          {l.libelle?.trim()&&onSaveOuvrage&&(
                            <button onClick={()=>saveLigneToBiblio(l)} title="Sauver ce prix dans ma bibliothèque (l'IA réutilisera ton prix terrain)"
                              style={{padding:"4px 6px",border:`1px solid ${savedFlash[l.id]?L.green:L.border}`,borderRadius:5,background:savedFlash[l.id]?(L.greenBg||"#D1FAE5"):L.surface,color:savedFlash[l.id]?L.green:L.textSm,fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                              {savedFlash[l.id]?"✓":"💾"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{padding:"6px 5px"}}><select value={l.tva} onChange={e=>updL(l.id,"tva",parseFloat(e.target.value))} style={{width:62,padding:"5px 4px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit"}}><option value={20}>20%</option><option value={10}>10%</option><option value={5.5}>5,5%</option><option value={0}>0%</option></select></td>
                      <td style={{padding:"6px 9px",fontSize:12,fontWeight:700,color:L.navy,fontFamily:"monospace",whiteSpace:"nowrap"}}>{euro(l.qte*l.prixUnitHT)}</td>
                      <td style={{padding:"6px 5px",whiteSpace:"nowrap"}}>
                        <BoutonIALigne ligne={{libelle:l.libelle,qte:l.qte,unite:l.unite||"U",puHT:l.prixUnitHT||0,salariesAssignes:l.salariesAssignes||[]}} salaries={salaries} onSaveOuvrage={onSaveOuvrage} onResult={r=>setForm(f=>({...f,lignes:f.lignes.map(x=>x.id===l.id?{...x,prixUnitHT:r.puHT||x.prixUnitHT,heuresPrevues:r.heuresMO,nbOuvriers:r.nbOuvriers,salariesAssignes:r.salariesAssignes||[],tauxHoraireMoyen:r.tauxHoraireMoyen,fournitures:r.fournitures}:x)}))}onLibelle={v=>updL(l.id,"libelle",v)}/>
                        <label title={l.photo?"Remplacer la photo de cette ligne":"Ajouter une photo (camera ou galerie)"} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",marginLeft:4,padding:"4px 8px",borderRadius:6,background:l.photo?L.green:L.surface,color:l.photo?"#fff":L.textMd,border:`1px solid ${l.photo?L.green:L.border}`,fontSize:12,cursor:"pointer",fontFamily:"inherit",verticalAlign:"middle"}}>
                          📷
                          <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{
                            const f=e.target.files?.[0];e.target.value="";
                            if(!f||!f.type.startsWith("image/"))return;
                            if(f.size>3_000_000){alert("Image trop volumineuse (max 3 Mo).");return;}
                            const reader=new FileReader();
                            reader.onload=()=>updL(l.id,"photo",reader.result);
                            reader.onerror=()=>alert("Lecture du fichier impossible");
                            reader.readAsDataURL(f);
                          }}/>
                        </label>
                      </td>
                      <td style={{padding:"6px 5px"}}>
                        {calc&&<button onClick={()=>togCalc(l.id)} title="Voir le calcul MO+fournitures" style={{padding:"3px 7px",border:`1px solid ${show?L.accent:L.border}`,borderRadius:6,background:show?L.accentBg:L.surface,color:show?L.accent:L.textXs,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                          {show?"▲":"▼"} <span style={{color:mc2}}>{calc.tauxMarge}%</span>
                        </button>}
                      </td>
                      <td style={{padding:"6px 5px",whiteSpace:"nowrap"}}>
                        {(+l.heuresPrevues>0||l.fournitures?.length>0)&&<button onClick={()=>recalcLigneMOTeam(l)} title={`Recalculer MO avec les taux de l'équipe (${(salaries||[]).length>0?Math.round(salaries.reduce((a,s)=>a+(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0.42)),0)/salaries.length)+"€/h chargé":"taux par défaut"}) — utile après changement de quantité`} style={{background:"none",border:"none",color:L.blue,cursor:"pointer",fontSize:12,marginRight:4}}>🔄</button>}
                        <button onClick={()=>dupItem(l.id)} title="Dupliquer la ligne" style={{background:"none",border:"none",color:L.textSm,cursor:"pointer",fontSize:13,marginRight:4}}>📋</button>
                        <button onClick={()=>delItem(l.id)} title="Supprimer la ligne" style={{background:"none",border:"none",color:L.red,cursor:"pointer",fontSize:14}}>×</button>
                      </td>
                    </tr>
                    {/* Panneau calcul automatique — éditable en cascade */}
                    {show&&calc&&(
                      <tr style={{background:i%2===0?"#FFFBF5":"#FFF7F0"}}>
                        <td colSpan={10} style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <div style={{fontSize:11,fontWeight:700,color:L.accent}}>📊 Calcul détaillé — {l.libelle||"cette prestation"} <span style={{color:L.textSm,fontWeight:500}}>(édition libre, prix HT recalculé en cascade)</span></div>
                            {(l.coutFournOverride!=null||l.tauxFGOverride!=null||l.tauxHoraireMoyen||l.salarieMOId)&&(
                              <button onClick={()=>resetOverrides(l,calc)} title="Revenir aux valeurs par défaut" style={{padding:"3px 9px",border:`1px solid ${L.border}`,borderRadius:5,background:L.surface,color:L.textSm,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>↻ Reset</button>
                            )}
                          </div>
                          {/* Section MO */}
                          <div style={{background:L.surface,borderRadius:7,padding:"9px 11px",border:`1px solid ${L.blue}22`,marginBottom:6}}>
                            <div style={{fontSize:10,color:L.blue,fontWeight:700,textTransform:"uppercase",marginBottom:5,letterSpacing:0.4}}>👷 Main d'œuvre</div>
                            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 2fr 1.5fr",gap:8,alignItems:"flex-end"}}>
                              <div>
                                <label style={{fontSize:9,color:L.textXs,display:"block",marginBottom:2}}>Heures par {l.unite||"U"}</label>
                                <input type="number" min={0} step={0.05} value={l.heuresPrevues||0} onChange={e=>onMOChange(l,"heuresPrevues",+e.target.value,calc)}
                                  style={{width:"100%",padding:"4px 6px",border:`1px solid ${L.border}`,borderRadius:4,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/>
                              </div>
                              <div>
                                <label style={{fontSize:9,color:L.textXs,display:"block",marginBottom:2}}>Nb ouvriers</label>
                                <input type="number" min={1} max={10} step={1} value={l.nbOuvriers||calc.nbOuv||2} onChange={e=>onMOChange(l,"nbOuvriers",+e.target.value,calc)}
                                  style={{width:"100%",padding:"4px 6px",border:`1px solid ${L.border}`,borderRadius:4,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/>
                              </div>
                              <div>
                                <label style={{fontSize:9,color:L.textXs,display:"block",marginBottom:2}}>Ouvrier (taux)</label>
                                <select value={l.salarieMOId||""} onChange={e=>onSalariePick(l,e.target.value,calc)}
                                  style={{width:"100%",padding:"4px 6px",border:`1px solid ${L.border}`,borderRadius:4,fontSize:11,fontFamily:"inherit",background:L.surface}}>
                                  <option value="">Auto ({(salaries||[]).length>0?"équipe":"défaut national"})</option>
                                  {(salaries||[]).map(sa=>{
                                    const tx=Math.round((+sa.tauxHoraire||0)*(1+(+sa.chargesPatron||0.42)));
                                    return <option key={sa.id} value={sa.id}>{sa.nom||"(sans nom)"} — {tx}€/h</option>;
                                  })}
                                </select>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase"}}>Total MO</div>
                                <div style={{fontSize:14,fontWeight:800,color:L.blue,fontFamily:"monospace"}}>{euro(calc.coutMO)}</div>
                                <div style={{fontSize:9,color:L.textXs,fontFamily:"monospace"}}>{calc.hTotal}h × {calc.tauxMOCharge}€/h</div>
                              </div>
                            </div>
                          </div>
                          {/* Section Fournitures */}
                          <div style={{background:L.surface,borderRadius:7,padding:"9px 11px",border:`1px solid ${L.accent}22`,marginBottom:6}}>
                            <div style={{fontSize:10,color:L.accent,fontWeight:700,textTransform:"uppercase",marginBottom:5,letterSpacing:0.4}}>📦 Fournitures</div>
                            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 2.5fr",gap:8,alignItems:"flex-end"}}>
                              <div>
                                <label style={{fontSize:9,color:L.textXs,display:"block",marginBottom:2}}>Montant total HT</label>
                                <input type="number" min={0} step={0.5} value={(+calc.coutFourn).toFixed(2)} onChange={e=>onFournEur(l,e.target.value,calc)}
                                  style={{width:"100%",padding:"4px 6px",border:`1px solid ${l.coutFournOverride!=null?L.orange:L.border}`,borderRadius:4,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/>
                              </div>
                              <div>
                                <label style={{fontSize:9,color:L.textXs,display:"block",marginBottom:2}}>% du HT</label>
                                <input type="number" min={0} max={100} step={1} value={calc.tauxFournPct} onChange={e=>onFournPct(l,e.target.value,calc)}
                                  style={{width:"100%",padding:"4px 6px",border:`1px solid ${L.border}`,borderRadius:4,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/>
                              </div>
                              <div style={{fontSize:10,color:L.textSm,paddingBottom:4}}>
                                {l.fournitures?.length>0
                                  ?<>📋 {l.fournitures.length} fourniture{l.fournitures.length>1?"s":""} détaillée{l.fournitures.length>1?"s":""} dans cette ligne</>
                                  :<>Aucune fourniture détaillée — % rendement BTP par défaut</>}
                                {l.coutFournOverride!=null&&<span style={{color:L.orange,fontWeight:700,marginLeft:6}}>· Override actif</span>}
                              </div>
                            </div>
                          </div>
                          {/* Section Frais généraux */}
                          <div style={{background:L.surface,borderRadius:7,padding:"9px 11px",border:`1px solid ${L.orange}22`,marginBottom:6}}>
                            <div style={{fontSize:10,color:L.orange,fontWeight:700,textTransform:"uppercase",marginBottom:5,letterSpacing:0.4}}>📊 Frais généraux</div>
                            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 2.5fr",gap:8,alignItems:"flex-end"}}>
                              <div>
                                <label style={{fontSize:9,color:L.textXs,display:"block",marginBottom:2}}>% sur MO</label>
                                <input type="number" min={0} max={150} step={1} value={calc.tauxFGPct} onChange={e=>onFGPct(l,e.target.value,calc)}
                                  style={{width:"100%",padding:"4px 6px",border:`1px solid ${l.tauxFGOverride!=null?L.orange:L.border}`,borderRadius:4,fontSize:12,fontFamily:"monospace",textAlign:"right"}}/>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase"}}>Total FG</div>
                                <div style={{fontSize:14,fontWeight:800,color:L.orange,fontFamily:"monospace"}}>{euro(calc.fraisGeneraux)}</div>
                              </div>
                              <div style={{fontSize:10,color:L.textSm,paddingBottom:4}}>
                                Charges patronales statut <strong>{statut||"sarl"}</strong> : {Math.round((STATUTS[statut]?.tauxCharges||0.45)*100)}% par défaut
                                {l.tauxFGOverride!=null&&<span style={{color:L.orange,fontWeight:700,marginLeft:6}}>· Override actif</span>}
                              </div>
                            </div>
                          </div>
                          {/* Cascade : revient → marge → coeff → prix HT final */}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                            <div style={{background:L.surface,borderRadius:7,padding:"8px 10px",border:`1px solid ${L.border}`}}>
                              <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase",marginBottom:2}}>Prix de revient</div>
                              <div style={{fontSize:13,fontWeight:800,color:L.navy,fontFamily:"monospace"}}>{euro(calc.prixRevient)}</div>
                              <div style={{fontSize:9,color:L.textXs}}>MO + fourn + FG</div>
                            </div>
                            <div style={{background:L.surface,borderRadius:7,padding:"8px 10px",border:`1px solid ${L.border}`}}>
                              <div style={{fontSize:9,color:L.textXs,textTransform:"uppercase",marginBottom:2}}>Marge brute</div>
                              <div style={{fontSize:13,fontWeight:800,color:mc2,fontFamily:"monospace"}}>{euro(calc.marge)}</div>
                              <div style={{fontSize:9,color:mc2,fontWeight:600}}>{calc.tauxMarge}% du HT</div>
                            </div>
                            <div style={{background:L.surface,borderRadius:7,padding:"8px 10px",border:`2px solid ${L.purple}33`}}>
                              <div style={{fontSize:9,color:L.purple,textTransform:"uppercase",marginBottom:2,fontWeight:700}}>Coefficient ✏️</div>
                              <div style={{display:"flex",alignItems:"center",gap:3}}>
                                <span style={{fontSize:12,fontWeight:800,color:L.purple}}>×</span>
                                <input type="number" min={1} step={0.01} value={calc.coeff} onChange={e=>adjustCoeff(l,e.target.value,calc)}
                                  style={{flex:1,padding:"2px 4px",border:`1px solid ${L.purple}55`,borderRadius:4,fontSize:12,fontWeight:800,color:L.purple,fontFamily:"monospace",textAlign:"center",outline:"none",minWidth:0}}/>
                              </div>
                              <div style={{fontSize:9,color:L.textXs}}>Prix HT / Revient</div>
                            </div>
                            <div style={{background:L.navyBg,borderRadius:7,padding:"8px 10px",border:`2px solid ${L.navy}`}}>
                              <div style={{fontSize:9,color:L.navy,textTransform:"uppercase",marginBottom:2,fontWeight:700}}>Prix HT final</div>
                              <div style={{fontSize:14,fontWeight:900,color:L.navy,fontFamily:"monospace"}}>{euro(calc.montantHT)}</div>
                              <div style={{fontSize:9,color:L.textXs,fontFamily:"monospace"}}>{euro(l.prixUnitHT)} × {l.qte}</div>
                            </div>
                          </div>
                          <div style={{marginTop:6,fontSize:10,color:L.textXs}}>
                            ℹ️ Édite n'importe quel champ → revient/marge/prix HT recalculent en cascade · le coefficient reste stable sauf si tu l'édites directement
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
                    <button onClick={()=>insertItemAt(form.lignes.length,"option")} style={{background:"#FEF3C7",border:`1px solid #F59E0B`,color:"#92400E",borderRadius:10,padding:"1px 9px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Option</button>
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
          {optionsHT>0&&(
            <div style={{background:"#FFFBEB",border:`1px solid #F59E0B`,borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontSize:11,fontWeight:800,color:"#92400E",letterSpacing:0.5,textTransform:"uppercase",marginBottom:6}}>📎 Options (facultatives)</div>
              {[["Options HT",euro(optionsHT)],["Options TVA",euro(optionsTVA)],["Options TTC",euro(optionsTTC)]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px dashed #FDE68A`}}>
                  <span style={{fontSize:11,color:"#92400E"}}>{l}</span>
                  <span style={{fontSize:l==="Options TTC"?13:11,color:"#92400E",fontWeight:l==="Options TTC"?800:500,fontFamily:"monospace"}}>+{v}</span>
                </div>
              ))}
              <div style={{marginTop:5,fontSize:9,color:"#A16207",fontStyle:"italic"}}>Si toutes les options sont acceptées : Total = {euro(ttc+optionsTTC)} TTC</div>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={onClose} variant="secondary">Annuler</Btn>
            <Btn onClick={()=>onSave({...form,id:Date.now()})} variant="success">✓ Enregistrer</Btn>
          </div>
        </div>
      </div>
      {aiModal&&<ModalIALocal {...aiModal} onApply={(text)=>{setForm(f=>({...f,lignes:f.lignes.map(l=>l.id!==aiModal.ligneId?l:{...l,libelle:text})}));setAiModal(null);}} onClose={()=>setAiModal(null)}/>}
      {showBiblio&&<BibliothequeSearchModal onPick={addFromBiblio} onClose={()=>setShowBiblio(false)}/>}
      {showModeles&&<ModelesDevisModal onPick={importerModele} onClose={()=>setShowModeles(false)}/>}
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

// ─── SIGNATURE ÉLECTRONIQUE — modale d'envoi pour signature ─────────────────
// Génère un token UUID stocké sur le doc, ouvre un mailto pré-rempli avec le
// lien public /signature/{token}. Le statut passe à "en attente signature".
function EnvoiSignatureModal({doc,onSent,onClose,entreprise}){
  const [email,setEmail]=useState(doc.emailClient||"");
  const [message,setMessage]=useState(`Bonjour${doc.client?` ${doc.client}`:""},\n\nVous trouverez ci-joint le devis n° ${doc.numero} pour validation.\n\nMerci de cliquer sur le lien suivant pour le consulter et le signer électroniquement.\n\nCordialement,\n${entreprise?.nom||""}`);
  function genererToken(){
    return typeof crypto!=="undefined"&&crypto.randomUUID
      ?crypto.randomUUID()
      :Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  }
  function envoyer(){
    if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())){
      alert("Email valide requis pour envoyer la demande de signature.");return;
    }
    // Si pas encore de token, en créer un. Sinon, on réutilise (cas re-envoi).
    const token=doc.signatureToken||genererToken();
    const link=`${window.location.origin}/signature/${token}`;
    // Compose mailto
    const subject=`Demande de signature — Devis ${doc.numero}`;
    const body=`${message}\n\n👉 Lien de signature : ${link}\n\n⏱ Ce lien est unique et personnel. La signature est horodatée et juridiquement valide.`;
    const mailto=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Update doc avec token + statut + message
    onSent({
      signatureToken:token,
      signatureRequestedAt:new Date().toISOString(),
      signatureMessage:message,
      emailClient:email.trim(),
      statut:"en attente signature",
    });
    // Open mailto
    setTimeout(()=>{window.location.href=mailto;},100);
    // Aussi : copier le lien dans le clipboard pour fallback
    try{navigator.clipboard?.writeText(link);}catch{}
  }
  return(
    <Modal title={`✍️ Envoyer pour signature — ${doc.numero}`} onClose={onClose} maxWidth={520}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{padding:"10px 12px",background:L.navyBg,borderRadius:8,fontSize:11,color:L.navy,lineHeight:1.5}}>
          📧 Un email avec un lien unique sera ouvert dans ton client mail. Le client pourra signer en ligne sur mobile ou ordinateur. Le lien sera aussi copié dans ton presse-papier.
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Email du client <span style={{color:L.red}}>*</span></label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="client@exemple.fr"
            style={{width:"100%",padding:"10px 12px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
        </div>
        <div>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:4}}>Message personnalisé</label>
          <textarea rows={6} value={message} onChange={e=>setMessage(e.target.value)}
            style={{width:"100%",padding:"10px 12px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit",resize:"vertical",lineHeight:1.5}}/>
          <div style={{fontSize:10,color:L.textXs,marginTop:4}}>Le lien de signature sera ajouté automatiquement en bas du message.</div>
        </div>
        {doc.signatureToken&&(
          <div style={{padding:"8px 11px",background:L.orangeBg||"#FEF3C7",borderRadius:7,fontSize:11,color:L.orange||"#92400E",lineHeight:1.5}}>
            ⚠ Un lien de signature a déjà été généré pour ce devis. Si tu réenvoies, le client pourra utiliser n'importe lequel des deux liens (ils mènent au même devis).
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={envoyer} variant="primary" icon="📧" disabled={!email}>Générer lien & envoyer</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── ACOMPTE : numérotation FA-ACOMPTE-YYYY-NNN ─────────────────────────────
function nextAcompteNumero(docs){
  const year=new Date().getFullYear();
  const prefix=`FA-ACOMPTE-${year}-`;
  const max=(docs||[]).reduce((m,d)=>{
    if(!(d.numero||"").startsWith(prefix))return m;
    const n=parseInt((d.numero||"").slice(prefix.length),10);
    return isNaN(n)?m:Math.max(m,n);
  },0);
  return `${prefix}${String(max+1).padStart(3,"0")}`;
}
// ─── MODALE CRÉATION D'ACOMPTE ──────────────────────────────────────────────
// Crée une facture d'acompte (estAcompte=true, acompteParentId=parent.id)
// liée au devis ou facture parent. Le solde restant est calculé automatique-
// ment dans ApercuDevis du parent (acomptes versés affichés).
function AcompteModal({parent,parentTTC,allDocs,onSave,onClose}){
  const [mode,setMode]=useState("pourcent");
  const [valeur,setValeur]=useState("30");
  const num=parseFloat(valeur)||0;
  const montantTTC=mode==="pourcent"?+(parentTTC*num/100).toFixed(2):num;
  const taux=parent.lignes?.find(l=>isLigneDevis(l))?.tva??20;
  const ht=+(montantTTC/(1+taux/100)).toFixed(2);
  function submit(){
    if(montantTTC<=0)return;
    const id=typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Date.now();
    const facture={
      id,
      type:"facture",
      estAcompte:true,
      acompteParentId:parent.id,
      numero:nextAcompteNumero(allDocs),
      date:new Date().toISOString().slice(0,10),
      client:parent.client||"",
      emailClient:parent.emailClient||"",
      telClient:parent.telClient||"",
      adresseClient:parent.adresseClient||"",
      titreChantier:parent.titreChantier||"",
      statut:"en attente",
      lignes:[{
        id:Date.now()+1,
        type:"ligne",
        libelle:`Acompte ${mode==="pourcent"?num+"% ":""}sur ${parent.type==="devis"?"devis":"facture"} ${parent.numero}`,
        qte:1,
        unite:"forfait",
        prixUnitHT:ht,
        tva:taux,
      }],
      conditionsReglement:"Paiement à réception",
      notes:`Acompte sur ${parent.type==="devis"?"devis":"facture"} ${parent.numero}.`,
    };
    onSave(facture);
  }
  return(
    <Modal title={`Créer un acompte sur ${parent.numero}`} onClose={onClose} maxWidth={500}>
      <div style={{padding:"4px 0 16px"}}>
        <div style={{background:L.navyBg,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
          <div style={{fontSize:11,color:L.textMd}}>Total TTC du {parent.type==="devis"?"devis":"facture"}</div>
          <div style={{fontSize:18,fontWeight:800,color:L.navy,fontFamily:"monospace"}}>{euro(parentTTC)}</div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <label style={{flex:1,display:"flex",gap:6,alignItems:"center",padding:"8px 12px",border:`2px solid ${mode==="pourcent"?L.navy:L.border}`,borderRadius:8,cursor:"pointer",background:mode==="pourcent"?L.navyBg:L.surface}}>
            <input type="radio" checked={mode==="pourcent"} onChange={()=>setMode("pourcent")}/>
            <span style={{fontSize:12,fontWeight:600}}>% du total TTC</span>
          </label>
          <label style={{flex:1,display:"flex",gap:6,alignItems:"center",padding:"8px 12px",border:`2px solid ${mode==="montant"?L.navy:L.border}`,borderRadius:8,cursor:"pointer",background:mode==="montant"?L.navyBg:L.surface}}>
            <input type="radio" checked={mode==="montant"} onChange={()=>setMode("montant")}/>
            <span style={{fontSize:12,fontWeight:600}}>Montant TTC fixe</span>
          </label>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:L.textMd,marginBottom:5,fontWeight:600}}>{mode==="pourcent"?"Pourcentage":"Montant TTC en €"}</label>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" min={0} step={mode==="pourcent"?5:100} value={valeur} onChange={e=>setValeur(e.target.value)}
              style={{flex:1,padding:"10px 12px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:14,fontFamily:"inherit"}}/>
            <span style={{fontSize:14,color:L.textMd,fontWeight:600}}>{mode==="pourcent"?"%":"€"}</span>
          </div>
        </div>
        <div style={{background:"#F5F3FF",border:`1px solid #C4B5FD`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
          <div style={{fontSize:11,color:"#6D28D9",fontWeight:700,marginBottom:4}}>Aperçu acompte</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:L.textMd,padding:"2px 0"}}><span>Montant HT</span><span style={{fontFamily:"monospace"}}>{fmt2(ht)} €</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:L.textMd,padding:"2px 0"}}><span>TVA ({taux}%)</span><span style={{fontFamily:"monospace"}}>{fmt2(montantTTC-ht)} €</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:800,color:"#5B21B6",padding:"4px 0",borderTop:`1px solid #C4B5FD`,marginTop:4}}><span>TOTAL TTC</span><span style={{fontFamily:"monospace"}}>{fmt2(montantTTC)} €</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:L.textSm,padding:"4px 0",fontStyle:"italic"}}><span>Solde restant après acompte</span><span style={{fontFamily:"monospace"}}>{fmt2(parentTTC-montantTTC)} €</span></div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={submit} variant="primary" disabled={montantTTC<=0||montantTTC>parentTTC} icon="💰">Créer la facture d'acompte</Btn>
        </div>
      </div>
    </Modal>
  );
}

function ApercuDevis({doc,entreprise,calcDocTotal,acomptes}){
  const tot=calcDocTotal(doc);
  const {ht,tv:tva,ttc,optionsHT=0,optionsTVA=0,optionsTTC=0,optionsByid}=tot;
  const items=doc.lignes||[];
  const optMap=ligneToOptionMap(items);
  // Items hors option = base (rendu dans la table principale)
  // Items option = rendus dans une section séparée en bas du devis
  const baseItems=items.filter(it=>{
    if(it.type==="option")return false;
    if(isLigneDevis(it))return optMap.get(it.id)==null;
    return true; // titres/soustitres restent
  });
  // Prépare la liste des blocs option (chaque option = header + ses lignes)
  const optionBlocks=[];
  let cur=null;
  for(const it of items){
    if(it.type==="option"){cur={header:it,lignes:[]};optionBlocks.push(cur);}
    else if(it.type==="titre"){cur=null;}
    else if(cur&&isLigneDevis(it))cur.lignes.push(it);
  }
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
      {/* Bandeau AVENANT (si applicable) */}
      {doc.devisOriginalId&&(
        <div style={{background:"linear-gradient(90deg,#F59E0B,#EA580C)",color:"#fff",padding:"8px 12px",borderRadius:6,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>📎 Avenant n°{doc.avenantNum||1}</div>
          <div style={{fontSize:11,fontWeight:600,opacity:0.95}}>au devis {doc.numeroOriginal||(doc.numero||"").replace(/-AV\d+$/,"")}</div>
        </div>
      )}
      {/* Bandeau BON POUR ACCORD (si demandé) */}
      {doc.bonPourAccord&&(
        <div style={{background:"linear-gradient(90deg,#7C3AED,#5B21B6)",color:"#fff",padding:"10px 14px",borderRadius:6,marginBottom:10,textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:900,letterSpacing:2,textTransform:"uppercase"}}>📝 Bon pour accord</div>
          <div style={{fontSize:10,fontWeight:500,opacity:0.9,marginTop:2}}>À retourner signé pour validation du devis</div>
        </div>
      )}
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
        <tbody>{baseItems.map((l,i)=>{
          if(l.type==="titre")return(
            <tr key={l.id||i} style={{background:"#1B3A5C",color:"#fff"}}>
              <td colSpan={5} style={{padding:"7px 9px",fontSize:11,fontWeight:800,letterSpacing:0.4,textTransform:"uppercase"}}>{l.libelle||"Titre"}</td>
            </tr>
          );
          if(l.type==="soustitre")return(
            <tr key={l.id||i} style={{background:"#F5F5F5",borderBottom:"1px solid #E2E8F0"}}>
              <td colSpan={5} style={{padding:"6px 9px 6px 22px",fontSize:11,fontWeight:700,color:"#1B3A5C"}}>{l.libelle||"Sous-titre"}</td>
            </tr>
          );
          return(
            <tr key={l.id||i} style={{borderBottom:"1px solid #E2E8F0",background:i%2===0?"#fff":"#F8FAFC"}}>
              <td style={{padding:"6px 9px",fontSize:11,whiteSpace:"pre-wrap"}}>
                {l.photo?(
                  <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <img src={l.photo} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:4,border:"1px solid #CBD5E1",flexShrink:0}}/>
                    <span style={{flex:1,minWidth:0}}>{l.libelle}</span>
                  </div>
                ):l.libelle}
              </td>
              <td style={{padding:"6px 9px",textAlign:"right",color:"#64748B",fontSize:11}}>{l.qte}</td>
              <td style={{padding:"6px 9px",color:"#64748B",fontSize:11}}>{l.unite}</td>
              <td style={{padding:"6px 9px",textAlign:"right",fontSize:11,fontFamily:"monospace"}}>{fmt2(l.prixUnitHT)} €</td>
              <td style={{padding:"6px 9px",textAlign:"right",fontWeight:600,fontSize:11,fontFamily:"monospace"}}>{fmt2((+l.qte||0)*(+l.prixUnitHT||0))} €</td>
            </tr>
          );
        })}</tbody>
      </table>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <div style={{minWidth:240}}>
          {[["Montant HT",ht],["TVA",tva],["TOTAL TTC",ttc]].map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #E2E8F0"}}><span style={{color:"#475569",fontSize:12}}>{l}</span><span style={{fontWeight:l==="TOTAL TTC"?800:500,color:l==="TOTAL TTC"?"#1B3A5C":"#374151",fontFamily:"monospace",fontSize:l==="TOTAL TTC"?13:12}}>{fmt2(v)} €</span></div>)}
          {Array.isArray(acomptes)&&acomptes.length>0&&(()=>{
            const totalAc=acomptes.reduce((a,f)=>{
              let t=0;for(const l of (f.lignes||[])){if(!isLigneDevis(l))continue;const h=(+l.qte||0)*(+l.prixUnitHT||0);t+=h*(1+(+l.tva||0)/100);}
              return a+t;
            },0);
            const solde=ttc-totalAc;
            return(
              <>
                <div style={{marginTop:6,padding:"6px 0",borderTop:"1px dashed #7C3AED"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Acomptes versés</div>
                  {acomptes.map(f=>{
                    let t=0;for(const l of (f.lignes||[])){if(!isLigneDevis(l))continue;const h=(+l.qte||0)*(+l.prixUnitHT||0);t+=h*(1+(+l.tva||0)/100);}
                    return(
                      <div key={f.id} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:10,color:"#475569"}}>
                        <span>{f.numero} <span style={{color:"#94A3B8"}}>({f.date})</span></span>
                        <span style={{fontFamily:"monospace"}}>−{fmt2(t)} €</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"2px solid #1B3A5C",marginTop:4}}>
                  <span style={{fontSize:13,fontWeight:800,color:"#1B3A5C"}}>SOLDE DÛ</span>
                  <span style={{fontSize:14,fontWeight:800,color:"#1B3A5C",fontFamily:"monospace"}}>{fmt2(solde)} €</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
      {/* Section OPTIONS (prestations facultatives) */}
      {optionBlocks.length>0&&(
        <div style={{marginTop:18,paddingTop:14,borderTop:`2px dashed #F59E0B`}}>
          <div style={{background:"linear-gradient(90deg,#F59E0B,#EA580C)",color:"#fff",padding:"8px 12px",borderRadius:6,marginBottom:10,fontSize:13,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>📎 Options / prestations facultatives</div>
          {optionBlocks.map((blk,bi)=>{
            const sub=optionsByid?.get(blk.header.id)||{ht:0,tv:0};
            return(
              <div key={blk.header.id} style={{marginBottom:14,border:`1px solid #FDE68A`,borderRadius:6,overflow:"hidden"}}>
                <div style={{background:"#FEF3C7",padding:"7px 10px",fontSize:12,fontWeight:800,color:"#92400E",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #FDE68A"}}>
                  <span>Option {bi+1} — {blk.header.libelle||"Prestation facultative"}</span>
                  <span style={{fontFamily:"monospace"}}>{fmt2(sub.ht)} € HT</span>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <tbody>
                    {blk.lignes.map((l,i)=>(
                      <tr key={l.id||i} style={{borderBottom:"1px solid #FDE68A",background:i%2===0?"#FFFBEB":"#fff"}}>
                        <td style={{padding:"6px 9px",fontSize:11,whiteSpace:"pre-wrap"}}>{l.libelle}</td>
                        <td style={{padding:"6px 9px",textAlign:"right",color:"#64748B",fontSize:11,width:60}}>{l.qte}</td>
                        <td style={{padding:"6px 9px",color:"#64748B",fontSize:11,width:50}}>{l.unite}</td>
                        <td style={{padding:"6px 9px",textAlign:"right",fontSize:11,fontFamily:"monospace",width:90}}>{fmt2(l.prixUnitHT)} €</td>
                        <td style={{padding:"6px 9px",textAlign:"right",fontWeight:600,fontSize:11,fontFamily:"monospace",width:100}}>{fmt2((+l.qte||0)*(+l.prixUnitHT||0))} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <div style={{minWidth:240,background:"#FFFBEB",border:`1px solid #FDE68A`,padding:"8px 12px",borderRadius:6}}>
              {[["Total options HT",optionsHT],["Total options TVA",optionsTVA],["Total options TTC",optionsTTC]].map(([l,v])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:11,color:"#92400E"}}>
                  <span>{l}</span><span style={{fontWeight:l==="Total options TTC"?800:500,fontFamily:"monospace"}}>+{fmt2(v)} €</span>
                </div>
              ))}
              <div style={{marginTop:5,fontSize:9,color:"#A16207",fontStyle:"italic"}}>Si toutes les options retenues : Total devis = {fmt2(ttc+optionsTTC)} € TTC</div>
            </div>
          </div>
        </div>
      )}
      <div style={{fontSize:10,color:"#94A3B8",marginTop:10}}>{doc.conditionsReglement} · {doc.notes}</div>
      {/* Signature électronique intégrée (si déjà signé via /signature/:token) */}
      {doc.signature&&(
        <div style={{marginTop:24,paddingTop:18,borderTop:`2px solid #16A34A`}}>
          <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:"#16A34A",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>✓ Signature électronique</div>
              <div style={{fontSize:11,color:"#1E293B",lineHeight:1.7}}>
                <div><strong>Signé par :</strong> {doc.signerName||"—"}</div>
                {doc.signerEmail&&<div><strong>Email :</strong> {doc.signerEmail}</div>}
                {doc.signedAt&&<div><strong>Date :</strong> {new Date(doc.signedAt).toLocaleString("fr-FR")}</div>}
                {doc.signerIP&&<div style={{fontSize:9,color:"#64748B"}}>IP : <span style={{fontFamily:"monospace"}}>{doc.signerIP}</span></div>}
              </div>
            </div>
            <div style={{flex:1.5}}>
              <div style={{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Signature manuscrite</div>
              <div style={{border:"1px solid #CBD5E1",borderRadius:6,background:"#fff",padding:6,minHeight:90}}>
                <img src={doc.signature} alt="Signature" style={{maxWidth:"100%",maxHeight:140,display:"block"}}/>
              </div>
              <div style={{fontSize:9,color:"#16A34A",fontStyle:"italic",marginTop:4}}>🔒 Signature électronique simple eIDAS niveau 1 — IP et horodatage du signataire conservés comme preuve d'acceptation.</div>
            </div>
          </div>
        </div>
      )}
      {/* Zone signature client (bon pour accord — si pas encore signé électroniquement) */}
      {doc.bonPourAccord&&!doc.signature&&(
        <div style={{marginTop:24,paddingTop:18,borderTop:`2px dashed #7C3AED`}}>
          <div style={{display:"flex",gap:24,marginTop:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Date</div>
              <div style={{height:30,borderBottom:"1px solid #94A3B8"}}/>
            </div>
            <div style={{flex:2}}>
              <div style={{fontSize:10,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Signature client précédée de "Bon pour accord"</div>
              <div style={{height:80,border:"1px dashed #CBD5E1",borderRadius:4,background:"#F8FAFC"}}/>
              <div style={{fontSize:9,color:"#64748B",marginTop:4,fontStyle:"italic"}}>Le client reconnaît avoir pris connaissance des conditions et accepte le présent devis.</div>
            </div>
          </div>
        </div>
      )}
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
function DevisRapideIAModal({onSave,onClose,salaries=[],statut="sarl",entreprise={},ouvragesPersoCount=0}){
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState(null);
  const [listening,setListening]=useState(false);
  const recRef=useRef(null);
  // ─── Fallbacks gracieux : valeurs par défaut si données absentes ────
  // 1. Équipe vide → taux MO moyen 25€/h chargé (marché national BTP courant)
  // 2. Statut absent → 42% charges patronales (entre auto-entrep 22% et SARL 45%)
  // 3. Ville absente → pas de mention de zone, prompt national générique
  // 4. Bibliothèque vide → comportement IA inchangé (prix génériques marché)
  const tauxMOMoyen=salaries.length>0
    ?Math.round(salaries.reduce((a,s)=>a+(+s.tauxHoraire||0)*(1+(+s.chargesPatron||0.42)),0)/salaries.length)
    :25;
  const STATUT_INFO=(typeof STATUTS!=="undefined"&&STATUTS?.[statut])||null;
  const chargesPct=Math.round(((STATUT_INFO?.tauxCharges)||0.42)*100);
  const ville=(entreprise?.ville||"").trim();
  const equipeVide=salaries.length===0;
  const biblioVide=ouvragesPersoCount<=0;
  const SR=typeof window!=="undefined"?(window.SpeechRecognition||window.webkitSpeechRecognition):null;
  const speechSupported=!!SR;

  function toggleMic(){
    if(!SR)return;
    if(listening){recRef.current?.stop();return;}
    const rec=new SR();
    rec.lang="fr-FR";
    rec.interimResults=false;
    rec.continuous=true;
    rec.onstart=()=>setListening(true);
    rec.onend=()=>{setListening(false);recRef.current=null;};
    rec.onerror=()=>{setListening(false);recRef.current=null;};
    rec.onresult=e=>{
      let transcript="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal)transcript+=e.results[i][0].transcript;
      }
      if(transcript){
        setText(prev=>(prev?prev.trim()+" ":"")+transcript.trim());
      }
    };
    recRef.current=rec;
    try{rec.start();}catch{setListening(false);recRef.current=null;}
  }

  // Stop la reconnaissance si on ferme la modale
  useEffect(()=>()=>{recRef.current?.stop?.();},[]);

  // Parse robuste avec réparation automatique pour les cas où l'IA renvoie
  // un JSON tronqué (max_tokens dépassé, troncature mid-string, etc.).
  // Stratégie multi-niveaux :
  //   1. Strip markdown ```json puis tente JSON.parse direct.
  //   2. Auto-close : trim mid-string si nécessaire, supprime virgules
  //      orphelines, ferme tous les brackets ouverts ({, [) en cohérence.
  //   3. En dernier recours, recherche le dernier '}' top-level fermé.
  function tryParseLLMJson(raw){
    if(!raw||typeof raw!=="string")throw new Error("Réponse vide");
    // Strip markdown fences (```json ... ``` ou variantes)
    let s=raw.replace(/```json\s*/gi,"").replace(/```/g,"").trim();
    // Isole à partir du premier { (l'IA peut écrire du préambule malgré le prompt)
    const firstBrace=s.indexOf("{");
    if(firstBrace<0)throw new Error("Pas de '{' trouvé dans la réponse");
    s=s.slice(firstBrace);
    // Niveau 1 : parse direct
    try{return JSON.parse(s);}catch{}
    // Niveau 2 : réparation auto-close
    const repaired=repairTruncatedJson(s);
    if(repaired){
      try{return JSON.parse(repaired);}catch(e2){
        console.warn("[parser] auto-close a produit du JSON encore invalide :",e2.message);
      }
    }
    // Niveau 3 : dernier '}' top-level fermé (fallback historique)
    let depth=0,inStr=false,esc=false,lastBalanced=-1;
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(esc){esc=false;continue;}
      if(ch==="\\"&&inStr){esc=true;continue;}
      if(ch==='"'){inStr=!inStr;continue;}
      if(inStr)continue;
      if(ch==="{")depth++;
      else if(ch==="}"){depth--;if(depth===0)lastBalanced=i;}
    }
    if(lastBalanced>0){
      try{return JSON.parse(s.slice(0,lastBalanced+1));}catch{}
    }
    throw new Error("JSON invalide ou tronqué (3 stratégies de récupération échouées). Essayez une description plus courte ou plus précise.");
  }
  // Répare un JSON tronqué : track la pile {/[, gère les chaînes,
  // tronque proprement si on est mid-string, supprime virgules trailing,
  // puis ferme tous les brackets restants.
  function repairTruncatedJson(s){
    const stack=[];
    let inStr=false,esc=false;
    let lastSafe=0;  // position après le dernier élément complet (} ] " ou littéral)
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(esc){esc=false;continue;}
      if(ch==="\\"&&inStr){esc=true;continue;}
      if(ch==='"'){
        if(inStr){inStr=false;lastSafe=i+1;}
        else inStr=true;
        continue;
      }
      if(inStr)continue;
      if(ch==="{"||ch==="[")stack.push(ch);
      else if(ch==="}"){
        if(stack[stack.length-1]==="{")stack.pop();
        lastSafe=i+1;
      }else if(ch==="]"){
        if(stack[stack.length-1]==="[")stack.pop();
        lastSafe=i+1;
      }else if(ch===","||/\s/.test(ch)){
        // pas un point safe (peut être trailing)
      }else if(/[\d.eE+\-tnflasrue]/i.test(ch)){
        // dans un nombre/literal → la position devient potentiellement safe
        lastSafe=i+1;
      }
    }
    // Si on est encore dans une chaîne, tronque jusqu'au début de cette chaîne
    if(inStr){
      // Cherche le " d'ouverture de la chaîne courante (le dernier " non-escapé après lastSafe)
      let openQ=-1;
      for(let j=s.length-1;j>=0;j--){
        if(s[j]==='"'&&s[j-1]!=="\\"){openQ=j;break;}
      }
      if(openQ<=0)return null;
      // Avant " : trouve la dernière virgule ou { ou [ pour couper proprement
      let cut=openQ;
      while(cut>0&&/\s/.test(s[cut-1]))cut--;
      // Recule jusqu'à virgule ou ouverture
      while(cut>0&&!",[{".includes(s[cut-1]))cut--;
      // Retire la virgule éventuelle pour ne pas avoir trailing comma
      if(cut>0&&s[cut-1]===",")cut--;
      s=s.slice(0,cut);
    }else{
      // Tronque à la dernière position safe
      s=s.slice(0,Math.max(lastSafe,0));
    }
    // Supprime virgules orphelines avant } ou ]
    s=s.replace(/,(\s*[}\]])/g,"$1");
    // Supprime virgule en queue
    s=s.replace(/,\s*$/,"");
    // Ferme les brackets restants dans l'ordre inverse
    while(stack.length>0){
      const last=stack.pop();
      s+=last==="{"?"}":"]";
    }
    return s;
  }

  async function callApi(description,maxTokens){
    const r=await fetch("/api/estimer",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:maxTokens,
        system:lastSysPrompt.current,
        messages:[{role:"user",content:description}],
      }),
    });
    const data=await r.json();
    if(data?.error)throw new Error(data.error.message||data.error);
    return data?.content?.[0]?.text||"";
  }

  const lastSysPrompt=useRef("");
  async function generer(){
    if(!text.trim()||loading)return;
    setLoading(true);setErr(null);
    try{
      const sys=`Tu es un expert BTP français (Artiprix, Batiprix, Mediabat 2024${ville?`, marché ${ville}`:", marché national"}).
RÉPONDS UNIQUEMENT AVEC DU JSON VALIDE. Pas de markdown, pas de \`\`\`json, pas de texte avant ou après. Le JSON doit être parsable directement par JSON.parse().

Contexte de l'entreprise utilisatrice :
- Statut juridique : ${statut||"SARL"} (charges patronales ${chargesPct}%)
- Taux horaire MO chargé moyen : ${tauxMOMoyen}€/h
${ville?`- Zone géographique : ${ville} (ajuste les prix au marché local)`:"- Zone géographique : France (prix moyens nationaux, sans surcôte régionale)"}

═══════════════════════════════════════════════════════════════════════════
RÈGLE ABSOLUE — heuresPrevues et fournitures[].qte sont TOUJOURS PAR
UNITÉ DE MESURE, jamais en valeur absolue. Le frontend multipliera par
qte (la qte de la ligne reste, elle, la quantité TOTALE de l'ouvrage).
Ex : 12m² de placo → qte:12, unite:"m2", heuresPrevues:0.45 (PAR m²),
fournitures:[{designation:"Plaque BA13", qte:1.05, unite:"m2", ...}]
═══════════════════════════════════════════════════════════════════════════

Schéma JSON STRICT :
{
  "client": "<nom client si donné, sinon ''>",
  "titreChantier": "<court résumé du chantier>",
  "lignes": [
    {"type":"titre","libelle":"NOM DU LOT EN MAJUSCULES"},
    {"type":"soustitre","libelle":"<sous-section>"},
    {"type":"ligne","libelle":"<désignation détaillée>","qte":<quantité TOTALE de l'ouvrage>,"unite":"m2|m3|ml|h|U|forfait|kg","prixUnitHT":<number>,"tva":10|20|5.5,"heuresPrevues":<heures PAR UNITÉ>,"nbOuvriers":<1-3>,"fournitures":[{"designation":"<matériau>","qte":<qté PAR UNITÉ du poste>,"unite":"<unité>","prixAchat":<HT achat>,"prixVente":<HT vente>,"fournisseur":"Point P|Gedimat|Leroy Merlin|Brico Dépôt|Kiloutou|Autre"}]}
  ]
}

Ratios de référence à appliquer selon l'unité du poste :

▸ SURFACE (m2 / m3) — heures et qtés PAR M² ou M³ :
  • Placo BA13 plafond     : 0.45h/m², plaque BA13 1.05m², rail 0.5ml, montant 0.6ml, vis 12U, enduit 0.3kg
  • Carrelage sol 60x60    : 0.6h/m²,  carrelage 1.1m², colle 4kg, joint 0.3kg, croisillons 10U
  • Faïence murale         : 0.8h/m²,  faïence 1.1m², colle 5kg, joint 0.3kg
  • Peinture mur 2 couches : 0.15h/m², peinture 0.25L, sous-couche 0.1L, ruban 1ml, bâche 0.1m²
  • Isolation laine verre  : 0.2h/m²,  laine 1.1m², agrafes 8U, pare-vapeur 1.05m²
  • Parquet flottant       : 0.4h/m²,  lames 1.05m², sous-couche 1.05m², plinthe 0.4ml
  • Béton dosage 350       : 1.2h/m³, béton 1.05m³, ferraillage 25kg, coffrage 4m²
  • Démolition cloison     : 0.8h/m³, big-bag 0.3U, gants 0.5U

▸ LINÉAIRE (ml) — heures et qtés PAR ML :
  • Câble électrique 2.5²  : 0.05h/ml, câble 1.05ml, attache-câble 2U
  • Tuyau PER Ø16          : 0.08h/ml, tuyau 1.05ml, collier 1U, raccord 0.2U
  • Plinthe MDF 70mm       : 0.10h/ml, plinthe 1.05ml, colle 0.05L, pointes 4U
  • Gaine ICTA Ø20         : 0.03h/ml, gaine 1.05ml, collier 2U
  • Tuyau cuivre Ø14       : 0.15h/ml, tuyau 1.05ml, raccord 0.3U, soudure 0.05U

▸ UNITÉ (U / pce) — heures et qtés POUR 1 ÉLÉMENT :
  • Prise électrique       : 0.5h/U,  prise 1U, boîte encastrement 1U, dominos 2U
  • Interrupteur           : 0.4h/U,  interrupteur 1U, boîte 1U, vis 2U
  • Point lumineux DCL     : 0.6h/U,  douille 1U, boîte 1U, dominos 2U
  • WC suspendu            : 4h/U,    cuvette 1U, bâti-support 1U, abattant 1U, flexibles 2U, plaque commande 1U
  • Receveur douche        : 3h/U,    receveur 1U, bonde 1U, étanchéité SEL 1U, joint silicone 0.3U
  • Lavabo + meuble        : 2.5h/U,  meuble 1U, vasque 1U, mitigeur 1U, siphon 1U
  • Radiateur électrique   : 1.5h/U,  radiateur 1U, chevilles 4U, vis 4U
  • Radiateur eau chaude   : 2.5h/U,  radiateur 1U, robinetterie 1U, chevilles 4U
  • Porte intérieure       : 3h/U,    bloc-porte 1U, poignée 1U, charnières 3U, joint 2ml
  • Fenêtre PVC pose neuf  : 4h/U,    fenêtre 1U, mousse PU 1U, vis 8U, joint 6ml
  • Spot encastré LED      : 0.4h/U,  spot 1U, transformateur 1U

▸ FORFAIT (forfait) — heures et qtés POUR L'ENSEMBLE DU POSTE :
  • Tableau électrique 13 modules  : 8h/forfait, tableau 1U, disjoncteurs 13U, différentiel 30mA 2U, peignes 1U
  • VMC simple flux                : 6h/forfait, centrale 1U, bouches 2U, gaine isolée 5ml, sortie toiture 1U
  • Ballon ECC 200L                : 5h/forfait, ballon 1U, groupe sécurité 1U, vase expansion 1U
  • Saignée + raccordement chantier: 4h/forfait, disqueuse loc 0.5j, sac gravats 2U

▸ HEURES (h) — quantité = nombre d'heures déjà chiffrées :
  • heuresPrevues = 1 (1h saisie = 1h facturée), fournitures vide ou minimes

═══════════════════════════════════════════════════════════════════════════

Règles strictes :
- Pour chaque grand corps d'état, ajoute une ligne type:"titre" (ex : DÉPOSE & PRÉPARATION, PLOMBERIE, CARRELAGE, PEINTURE, ÉLECTRICITÉ).
- Donne 2 à 6 lignes chiffrées par titre selon la complexité.
- qte = quantité TOTALE de l'ouvrage (12 pour 12m²). heuresPrevues et fournitures.qte = PAR UNITÉ (cf. ratios ci-dessus). Ne JAMAIS multiplier par qte dans tes nombres — c'est le frontend qui le fait.
- Inclure ~5% de chute pour les matériaux découpés (carrelage 1.1m²/m², peinture 0.25L/m², etc.).
- TVA : 10 par défaut (rénovation), 20 pour neuf, 5.5 pour logement social aidé.
- Prix puHT (de marché PACA 2024) : prix unitaire fourni-posé (par m², par U, etc.), cohérent avec marge ~40%.
- heuresPrevues OBLIGATOIRE et > 0 sur chaque ligne (PAR UNITÉ). Pour forfait : heures totales du poste.
- nbOuvriers OBLIGATOIRE, 1 à 3 (1 finition / 2 gros œuvre courant / 3 manutention lourde).
- fournitures OBLIGATOIRE : 1 à 5 articles principaux PAR UNITÉ avec prixAchat HT et prixVente HT (= prixAchat × ~1.3). Si pure MO sans matériel, met fournitures: [].
- Si la description est trop floue, fais des hypothèses raisonnables et NE LAISSE JAMAIS heuresPrevues=0.`;
      lastSysPrompt.current=sys;
      // Tentative 1 : description complète, 8000 tokens (large marge pour devis longs)
      let parsed=null;
      try{
        const txt=await callApi(text,8000);
        parsed=tryParseLLMJson(txt);
      }catch(e1){
        console.warn("[devis IA] première tentative échouée, retry tronqué :",e1.message);
        // Tentative 2 : description tronquée à 1500 chars + max_tokens 8000
        // pour laisser plus de marge à la réponse JSON
        const truncated=text.length>1500?text.slice(0,1500)+"\n\n[Description tronquée — résumer en restant cohérent]":text;
        try{
          const txt2=await callApi(truncated,8000);
          parsed=tryParseLLMJson(txt2);
        }catch(e2){
          throw new Error(`JSON invalide après 2 tentatives. ${e2.message}`);
        }
      }
      if(!parsed||!Array.isArray(parsed.lignes))throw new Error("Réponse IA mal formée (champ 'lignes' manquant)");
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
        {/* Bannières contextuelles : guident sans bloquer */}
        {(equipeVide||biblioVide)&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {equipeVide&&<div style={{padding:"7px 11px",background:L.orangeBg||"#FEF3C7",border:`1px solid ${L.orange}33`,borderRadius:7,fontSize:11,color:L.orange||"#92400E",lineHeight:1.5}}>👷 Aucun salarié enregistré — l'IA utilise un taux MO par défaut de <strong>{tauxMOMoyen}€/h</strong>. Ajoutez vos taux horaires dans <strong>Équipe</strong> pour une MO personnalisée.</div>}
            {biblioVide&&<div style={{padding:"7px 11px",background:L.navyBg,border:`1px solid ${L.navy}33`,borderRadius:7,fontSize:11,color:L.navy,lineHeight:1.5}}>📖 Bibliothèque non personnalisée — l'IA utilise ses prix génériques. Enrichissez votre <strong>Bibliothèque</strong> pour des devis encore plus précis.</div>}
          </div>
        )}
        <div style={{position:"relative"}}>
          <textarea value={text} onChange={e=>setText(e.target.value)} rows={8} disabled={loading}
            placeholder="Ex : Rénovation salle de bain 8m² — dépose ancienne salle de bain, nouveau carrelage sol 60x60, faïence murs, pose receveur extra-plat + colonne de douche, lavabo + meuble, WC suspendu, peinture plafond. Marseille."
            style={{width:"100%",padding:"11px 50px 11px 13px",border:`1px solid ${L.border}`,borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.5,opacity:loading?0.7:1}}/>
          {speechSupported&&(
            <button onClick={toggleMic} disabled={loading} title={listening?"En écoute…":"Dicter la description"} aria-label={listening?"Arrêter la dictée":"Démarrer la dictée"}
              style={{position:"absolute",top:8,right:8,width:36,height:36,borderRadius:"50%",border:"none",cursor:loading?"not-allowed":"pointer",background:listening?L.red:L.navy,color:"#fff",fontSize:16,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",animation:listening?"cp-mic-pulse 1.1s infinite":"none",boxShadow:listening?`0 0 0 4px ${L.red}33`:"0 1px 4px rgba(0,0,0,0.15)"}}>{listening?"🔴":"🎤"}</button>
          )}
          <style>{`@keyframes cp-mic-pulse{0%,100%{box-shadow:0 0 0 4px ${L.red}33;}50%{box-shadow:0 0 0 10px ${L.red}11;}}`}</style>
        </div>
        {listening&&<div style={{fontSize:11,color:L.red,fontWeight:600,marginTop:-6}}>🔴 Écoute en cours… cliquez à nouveau pour arrêter.</div>}
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

Réponds toujours en français, de façon concise et actionnable.

Tu disposes d'OUTILS pour interroger et modifier les données du patron :

LECTURE :
- list_chantiers / list_devis / list_salaries / list_planning

ÉCRITURE (mode 'propose only' — l'humain confirme) :
- propose_change_devis_statut : changer un statut devis/facture
- propose_create_phase : créer une nouvelle phase de planning
- propose_add_to_planning : ajouter des ouvriers à une période sur un chantier
  (ajoute à une phase existante qui chevauche, sinon en crée une)
- propose_remove_from_planning : retirer un ouvrier de phases dans une période

RÈGLES STRICTES :
1. Ne JAMAIS prétendre avoir modifié quelque chose. Tu PROPOSES, l'humain confirme.
2. Quand un outil renvoie un pending_action, écris une phrase concise qui résume
   l'action (chantier, ouvriers, dates) et termine par "Confirmer ?".
3. Si l'outil renvoie 'error' ou 'info', explique-la clairement sans contourner.
4. Pour les dates relatives ("la semaine prochaine", "du 10 au 20 mai"), convertis
   au format YYYY-MM-DD avant d'appeler l'outil. La date courante est ${new Date().toISOString().slice(0,10)}.
5. Pour les ouvriers nommés vaguement ("le maçon"), tu peux passer le nom/rôle
   tel quel à l'outil — il fait le matching. S'il ne résout pas, list_salaries
   pour clarifier avec l'utilisateur.
6. Ne jamais inventer un numéro de devis ou un nom de chantier — utilise
   list_devis ou list_chantiers en cas de doute.

Quand l'utilisateur cite un chantier ou un devis, utilise les outils plutôt que les chiffres en haut (qui ne sont qu'un aperçu).`;
  },[entreprise,statut,chantiers,salaries,docs]);

  const [messages,setMessages]=useState([{role:"assistant",content:`Bonjour ${entreprise?.nomCourt||entreprise?.nom||""}, je suis votre assistant **BTP + comptabilité** avec accès direct à vos données.\n\nJe peux désormais consulter vos **chantiers**, **devis/factures** et **équipe** pour répondre. Essayez :\n• "Liste mes chantiers en cours"\n• "Combien j'ai de devis en attente ?"\n• "Quels ouvriers j'ai dans mon équipe ?"\n\nEt toujours : chiffrage, normes DTU, fiscalité, sous-traitance, régime juridique.`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const endRef=useRef(null);
  const SUGG=["Liste mes chantiers en cours","Crée une phase carrelage du 15 au 25 mai sur DEV-XXX","Ajoute le maçon sur DEV-XXX du lundi au vendredi","Mon planning de la semaine prochaine","Comment calculer ma marge ?"];

  async function envoyer(){
    if(!input.trim()||loading)return;
    const msg=input.trim();setInput("");
    const next=[...messages,{role:"user",content:msg}];
    setMessages(next);
    setLoading(true);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),50);
    try{
      // Récupère l'access_token courant pour permettre aux tools côté serveur
      // d'interroger Supabase sous l'identité du patron (RLS = données privées).
      const {data:sess}=supabase?await supabase.auth.getSession():{data:{session:null}};
      const accessToken=sess?.session?.access_token;
      if(!accessToken){
        setMessages(m=>[...m,{role:"assistant",content:"⚠ Tu n'es pas connecté — l'assistant a besoin de ta session pour lire tes données. Connecte-toi puis réessaie."}]);
        return;
      }
      const r=await fetch("/api/assistant",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:systemPrompt,
          messages:next.map(m=>({role:m.role,content:m.content})),
          access_token:accessToken,
        }),
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data?.error||`HTTP ${r.status}`);
      const text=data?.text||"(réponse vide)";
      const toolsUsed=Array.isArray(data?.tools_used)?data.tools_used:[];
      setMessages(m=>[...m,{role:"assistant",content:text,tools_used:toolsUsed}]);
    }catch(e){
      setMessages(m=>[...m,{role:"assistant",content:`⚠ Erreur communication avec l'IA : ${e.message}.\n\nVérifie ta connexion + la clé ANTHROPIC_API_KEY côté Vercel.`}]);
    }finally{
      setLoading(false);
      setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),100);
    }
  }
  // Exécute une pending_action après confirmation utilisateur. Tous les écrits
  // passent par la session Supabase de l'utilisateur (RLS = user_id check).
  // Helpers d'écriture par type :
  async function execChangeDevisStatut(action){
    const {data:rows}=await supabase.from("devis").select("data").eq("id",action.devis_id).limit(1);
    if(!rows?.[0])throw new Error("devis introuvable");
    return supabase.from("devis").update({data:{...rows[0].data,statut:action.target_statut}}).eq("id",action.devis_id);
  }
  async function execCreatePhase(action){
    const {data:rows}=await supabase.from("chantiers_v2").select("data").eq("id",action.chantier_id).limit(1);
    if(!rows?.[0])throw new Error("chantier introuvable");
    const c=rows[0].data;
    const newPhase={
      id:Date.now(),
      tache:action.phase.libelle,
      dateDebut:action.phase.date_debut,
      dureeJours:action.phase.duree_jours,
      salariesIds:[...action.phase.salariesIds],
      budgetHT:0,
      posteId:null,
    };
    return supabase.from("chantiers_v2").update({data:{...c,planning:[...(c.planning||[]),newPhase]}}).eq("id",action.chantier_id);
  }
  async function execAddToPhase(action){
    const {data:rows}=await supabase.from("chantiers_v2").select("data").eq("id",action.chantier_id).limit(1);
    if(!rows?.[0])throw new Error("chantier introuvable");
    const c=rows[0].data;
    const idsToAdd=action.ouvriers_to_add.map(o=>o.id);
    const planning=(c.planning||[]).map(p=>{
      if(p.id!==action.phase_id)return p;
      const current=new Set(p.salariesIds||[]);
      idsToAdd.forEach(id=>current.add(id));
      return {...p,salariesIds:Array.from(current)};
    });
    return supabase.from("chantiers_v2").update({data:{...c,planning}}).eq("id",action.chantier_id);
  }
  async function execRemoveFromPhases(action){
    // Plusieurs phases potentiellement, sur plusieurs chantiers — boucle par chantier
    const byChantier=new Map();
    for(const r of action.removals){
      if(!byChantier.has(r.chantier_id))byChantier.set(r.chantier_id,[]);
      byChantier.get(r.chantier_id).push(r.phase_id);
    }
    for(const [chId,phaseIds] of byChantier){
      const {data:rows}=await supabase.from("chantiers_v2").select("data").eq("id",chId).limit(1);
      if(!rows?.[0])continue;
      const c=rows[0].data;
      const planning=(c.planning||[]).map(p=>{
        if(!phaseIds.includes(p.id))return p;
        return {...p,salariesIds:(p.salariesIds||[]).filter(id=>id!==action.ouvrier_id)};
      });
      const {error}=await supabase.from("chantiers_v2").update({data:{...c,planning}}).eq("id",chId);
      if(error)throw error;
    }
    return {error:null};
  }
  async function executerAction(msgIndex,actionIndex,action){
    if(!supabase)return;
    setMessages(ms=>ms.map((m,i)=>i===msgIndex?{...m,tools_used:m.tools_used.map((t,j)=>j===actionIndex?{...t,executing:true}:t)}:m));
    let err=null,successMsg="";
    try{
      let r;
      if(action.kind==="change_devis_statut"){
        r=await execChangeDevisStatut(action);
        successMsg=`✅ Statut du devis ${action.numero} changé en "${action.target_statut}".`;
      }else if(action.kind==="create_phase"){
        r=await execCreatePhase(action);
        successMsg=`✅ Phase "${action.phase.libelle}" créée sur le chantier ${action.chantier_nom} (${action.phase.duree_jours}j, ${action.phase.salariesIds.length} ouvrier(s)).`;
      }else if(action.kind==="add_to_phase"){
        r=await execAddToPhase(action);
        successMsg=`✅ ${action.ouvriers_to_add.length} ouvrier(s) ajouté(s) à la phase "${action.phase_libelle}" (${action.chantier_nom}).`;
      }else if(action.kind==="remove_from_phases"){
        r=await execRemoveFromPhases(action);
        successMsg=`✅ ${action.ouvrier_nom} retiré de ${action.removals.length} phase(s).`;
      }else{
        throw new Error(`Type d'action inconnu : ${action.kind}`);
      }
      err=r?.error||null;
    }catch(e){err=e;}
    setMessages(ms=>ms.map((m,i)=>{
      if(i!==msgIndex)return m;
      return {...m,tools_used:m.tools_used.map((t,j)=>j===actionIndex?{...t,executing:false,executed:!err,exec_error:err?.message||null}:t)};
    }));
    setMessages(ms=>[...ms,{role:"assistant",content:err?`⚠ Échec : ${err.message}`:successMsg}]);
  }
  function annulerAction(msgIndex,actionIndex){
    setMessages(ms=>ms.map((m,i)=>i===msgIndex?{...m,tools_used:m.tools_used.map((t,j)=>j===actionIndex?{...t,cancelled:true}:t)}:m));
    setMessages(ms=>[...ms,{role:"assistant",content:"D'accord, action annulée."}]);
  }

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 60px)"}}>
      <PageH title="Assistant IA" subtitle="Questions BTP · IA désignation disponible dans Devis"/>
      <Card style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:11}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:5,alignItems:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start",width:"100%"}}>
                {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:L.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginTop:2}}>🤖</div>}
                <div style={{maxWidth:"72%",padding:"10px 13px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.role==="user"?L.navy:L.bg,color:m.role==="user"?"#fff":L.text,fontSize:12,lineHeight:1.6,border:`1px solid ${m.role==="user"?L.navy:L.border}`,whiteSpace:m.role==="user"?"pre-wrap":"normal",wordBreak:"break-word"}}>{m.role==="user"?m.content:<MarkdownText text={m.content}/>}</div>
              </div>
              {/* Tools used : chips informatives + bulle de confirmation pour les pending_action */}
              {m.role==="assistant"&&Array.isArray(m.tools_used)&&m.tools_used.length>0&&(
                <div style={{marginLeft:34,display:"flex",flexDirection:"column",gap:6,maxWidth:"72%"}}>
                  {m.tools_used.map((t,j)=>(
                    <div key={j}>
                      <span style={{fontSize:9,color:L.textXs,fontWeight:600,padding:"2px 7px",borderRadius:5,background:L.bg,border:`1px solid ${L.border}`}}>🔧 {t.name} · {t.result_summary}</span>
                      {t.pending_action&&!t.executed&&!t.cancelled&&(
                        <div style={{marginTop:6,padding:"10px 12px",border:`1.5px solid ${L.accent}`,borderRadius:10,background:"#FFF7ED"}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                            <span style={{fontSize:18,flexShrink:0}}>⚡</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:700,color:L.accent,textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Action en attente de confirmation</div>
                              {t.pending_action.kind==="change_devis_statut"&&(
                                <div style={{fontSize:12,color:L.text}}>
                                  Devis <strong style={{fontFamily:"monospace"}}>{t.pending_action.numero}</strong> ({t.pending_action.client})<br/>
                                  Statut : <code style={{background:L.bg,padding:"1px 5px",borderRadius:3}}>{t.pending_action.current_statut}</code> → <code style={{background:L.greenBg||"#D1FAE5",color:L.green,padding:"1px 5px",borderRadius:3,fontWeight:700}}>{t.pending_action.target_statut}</code>
                                </div>
                              )}
                              {t.pending_action.kind==="create_phase"&&(
                                <div style={{fontSize:12,color:L.text}}>
                                  Créer une phase planning sur <strong>{t.pending_action.chantier_nom}</strong><br/>
                                  Tâche : <strong>« {t.pending_action.phase.libelle} »</strong><br/>
                                  Période : <code style={{background:L.bg,padding:"1px 5px",borderRadius:3}}>{t.pending_action.phase.date_debut} → {t.pending_action.phase.date_fin}</code> ({t.pending_action.phase.duree_jours}j)<br/>
                                  Ouvriers ({t.pending_action.phase.ouvriers_resolved.length}) : {t.pending_action.phase.ouvriers_resolved.map(o=>o.nom).join(", ")||"(aucun)"}
                                </div>
                              )}
                              {t.pending_action.kind==="add_to_phase"&&(
                                <div style={{fontSize:12,color:L.text}}>
                                  Ajouter à la phase <strong>« {t.pending_action.phase_libelle} »</strong><br/>
                                  Chantier : <strong>{t.pending_action.chantier_nom}</strong> · {t.pending_action.phase_dates}<br/>
                                  Nouveaux ouvriers ({t.pending_action.ouvriers_to_add.length}) : {t.pending_action.ouvriers_to_add.map(o=>o.nom).join(", ")}
                                </div>
                              )}
                              {t.pending_action.kind==="remove_from_phases"&&(
                                <div style={{fontSize:12,color:L.text}}>
                                  Retirer <strong>{t.pending_action.ouvrier_nom}</strong> de {t.pending_action.removals.length} phase(s) :
                                  <ul style={{margin:"4px 0 0",paddingLeft:18}}>
                                    {t.pending_action.removals.map((r,k)=><li key={k} style={{marginBottom:2}}>{r.phase_libelle} <span style={{color:L.textSm}}>· {r.chantier_nom} · {r.phase_dates}</span></li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div style={{display:"flex",gap:6,flexShrink:0}}>
                              <button onClick={()=>annulerAction(i,j)} disabled={t.executing} style={{padding:"7px 12px",border:`1px solid ${L.border}`,borderRadius:7,background:L.surface,color:L.textSm,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
                              <button onClick={()=>executerAction(i,j,t.pending_action)} disabled={t.executing} style={{padding:"7px 14px",border:"none",borderRadius:7,background:t.executing?L.textSm:L.green,color:"#fff",fontSize:12,fontWeight:700,cursor:t.executing?"wait":"pointer",fontFamily:"inherit"}}>{t.executing?"⏳ …":"✓ Confirmer"}</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {t.executed&&<div style={{marginTop:4,fontSize:10,color:L.green,fontWeight:600}}>✓ Action exécutée</div>}
                      {t.cancelled&&<div style={{marginTop:4,fontSize:10,color:L.textXs,fontWeight:600}}>✗ Action annulée</div>}
                      {t.exec_error&&<div style={{marginTop:4,fontSize:10,color:L.red,fontWeight:600}}>⚠ {t.exec_error}</div>}
                    </div>
                  ))}
                </div>
              )}
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

function ScanFactureModal({chantiers,onSave,onClose,defaultChantierId,lockChantier,entreprise}){
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [err,setErr]=useState(null);
  const [extracted,setExtracted]=useState(null); // résultat IA
  const [form,setForm]=useState({
    fournisseur:"",montantHT:"",tva:"",montantTTC:"",date:new Date().toISOString().slice(0,10),
    numeroFacture:"",description:"",
    chantierId:defaultChantierId??"",
    categorie:"materiaux",
    lot:"",
  });
  // Lots disponibles selon le chantier sélectionné (issus de chantier.postes)
  const lotsDuChantier=(()=>{
    const cid=+form.chantierId;
    const ch=(chantiers||[]).find(c=>c.id===cid);
    if(!ch)return[];
    const set=new Set();
    for(const p of (ch.postes||[]))if(p.lot)set.add(p.lot);
    return Array.from(set);
  })();
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
      lot:form.lot||null,
      date:form.date,
      fournisseur:form.fournisseur||null,
      numeroFacture:form.numeroFacture||null,
      description:form.description||null,
      sourceFacture:preview||null,
    };
    onSave?.(form.chantierId,depense);
    onClose?.();
  }

  async function envoyerQonto(){
    const token=entreprise?.integrations?.qontoToken?.trim();
    if(!token){
      setQontoFeedback({type:"err",msg:"⚠️ Token Qonto non configuré. Renseignez-le dans Paramètres → Intégrations (icône ⚙️ en bas de la sidebar)."});
      return;
    }
    if(!form.montantTTC&&!form.montantHT){
      setQontoFeedback({type:"err",msg:"Renseignez au moins le montant TTC ou HT avant l'envoi."});
      return;
    }
    setQontoFeedback({type:"info",msg:"⏳ Envoi vers Qonto…"});
    const payload={
      supplier_invoice:{
        supplier_name:form.fournisseur||"Fournisseur",
        invoice_number:form.numeroFacture||`CP-${Date.now()}`,
        issue_date:form.date||null,
        due_date:form.date||null,
        total_amount_cents:Math.round((+form.montantTTC||(+form.montantHT||0))*100),
        currency:"EUR",
        description:form.description||form.fournisseur||"Facture fournisseur",
      },
    };
    try{
      const r=await fetch("/api/qonto-invoice",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          token,
          organizationSlug:entreprise?.integrations?.qontoOrgSlug||null,
          payload,
        }),
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok){
        const msg=data?.errors?.[0]?.detail||data?.error||data?.message||`HTTP ${r.status}`;
        setQontoFeedback({type:"err",msg:`❌ Échec Qonto : ${msg}`});
        return;
      }
      const id=data?.supplier_invoice?.id||data?.id||"(id non renvoyé)";
      setQontoFeedback({type:"ok",msg:`✓ Facture envoyée vers Qonto — ID ${id}`});
    }catch(e){
      setQontoFeedback({type:"err",msg:`❌ Erreur réseau Qonto : ${e.message}`});
    }
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
          <select value={form.chantierId} onChange={e=>setForm(f=>({...f,chantierId:e.target.value?+e.target.value:"",lot:""}))} disabled={lockChantier} style={{...inp,opacity:lockChantier?0.7:1,cursor:lockChantier?"not-allowed":"pointer"}}>
            <option value="">— Choisir un chantier —</option>
            {(chantiers||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={form.categorie} onChange={e=>setForm(f=>({...f,categorie:e.target.value}))} style={inp}>
            {CATS_DEPENSE.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {lotsDuChantier.length>0&&(
            <select value={form.lot} onChange={e=>setForm(f=>({...f,lot:e.target.value}))} style={inp} title="Lot d'imputation pour le bilan par lot">
              <option value="">— Lot (optionnel) —</option>
              {lotsDuChantier.map(l=><option key={l} value={l}>{l}</option>)}
            </select>
          )}

          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
            <Btn onClick={enregistrer} variant="success" icon="💾" disabled={!form.chantierId}>Enregistrer</Btn>
            <Btn onClick={envoyerQonto} variant="navy" icon="🏦">Envoyer vers Qonto</Btn>
            <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          </div>
          {qontoFeedback&&(()=>{
            const kind=qontoFeedback.type;
            const bg=kind==="ok"?L.greenBg:kind==="err"?L.redBg:L.navyBg;
            const fg=kind==="ok"?L.green:kind==="err"?L.red:L.navy;
            return <div style={{marginTop:6,padding:"8px 12px",background:bg,color:fg,border:`1px solid ${fg}33`,borderRadius:7,fontSize:11,fontWeight:600,whiteSpace:"pre-wrap",lineHeight:1.5}}>{qontoFeedback.msg}</div>;
          })()}
        </div>
      </div>
    </Modal>
  );
}

// ─── COMPTA ───────────────────────────────────────────────────────────────────
// ─── HELPERS MASSE SALARIALE ─────────────────────────────────────────────────
// Heures planifiées sur le mois de référence pour un ouvrier donné.
// Calcule l'intersection de chaque phase [dateDebut, dateDebut+dureeJours[
// avec le mois, puis convertit en heures (5/7 × jours × 8h pour exclure
// week-ends de façon approximative).
function heuresPlanifieesMoisOuvrier(salId,chantiers,monthStart,monthEnd){
  let h=0;
  for(const c of (chantiers||[])){
    for(const p of (c.planning||[])){
      if(!p.dateDebut||!p.dureeJours)continue;
      if(!Array.isArray(p.salariesIds)||!p.salariesIds.includes(salId))continue;
      const s=new Date(p.dateDebut);
      const e=new Date(s);e.setDate(s.getDate()+(+p.dureeJours||1));
      const iS=s>monthStart?s:monthStart;
      const iE=e<monthEnd?e:monthEnd;
      if(iS<iE){
        const days=Math.round((+iE-+iS)/86400000);
        h+=Math.round(days*5/7)*8;
      }
    }
  }
  return h;
}
// Liste des chantiers où l'ouvrier est affecté (toutes périodes)
function chantiersOuvrier(salId,chantiers){
  const set=new Set();
  for(const c of (chantiers||[])){
    for(const p of (c.planning||[])){
      if(Array.isArray(p.salariesIds)&&p.salariesIds.includes(salId))set.add(c.nom||`#${c.id}`);
    }
  }
  return Array.from(set);
}

function VueCompta({chantiers,setChantiers,salaries,sousTraitants=[],entreprise}){
  const [tab,setTab]=useState("overview");
  const [showScan,setShowScan]=useState(false);
  function onSaveDepense(chantierId,depense){
    setChantiers?.(cs=>cs.map(c=>c.id===chantierId?{...c,depensesReelles:[...(c.depensesReelles||[]),depense]}:c));
  }
  const totCA=chantiers.reduce((a,c)=>a+c.devisHT,0);
  const totCouts=chantiers.reduce((a,c)=>a+rentaChantier(c,salaries).totalCouts,0);
  const benef=totCA-totCouts;const tb=pct(benef,totCA);const mc=tb>=25?L.green:tb>=15?L.orange:L.red;
  const totDepenses=chantiers.reduce((a,c)=>a+(c.depensesReelles||[]).reduce((b,d)=>b+(+d.montant||0),0),0);
  // ─── Coûts sous-traitants : agrégat par sous-traitant à partir des phases planning
  // (phase.sousTraitantsIds × dureeJours × tauxJournalier).
  // Heuristique simple : si plusieurs sous-traitants sur une phase, on attribue
  // dureeJours complets à chacun (ils travaillent en parallèle).
  const stByChantier=chantiers.map(c=>{
    const phases=c.planning||[];
    const detail=[];
    let total=0;
    for(const p of phases){
      const ids=Array.isArray(p.sousTraitantsIds)?p.sousTraitantsIds:[];
      const dur=+p.dureeJours||0;
      for(const stid of ids){
        const st=sousTraitants.find(x=>x.id===stid);
        if(!st)continue;
        const cout=dur*(+st.tauxJournalier||0);
        total+=cout;
        detail.push({stid,nom:st.nom,specialite:st.specialite,couleur:st.couleur||"#7C3AED",jours:dur,tauxJ:+st.tauxJournalier||0,cout,phaseLib:p.tache||"—",dateDebut:p.dateDebut||""});
      }
    }
    return{chantierId:c.id,chantierNom:c.nom,total,detail};
  }).filter(x=>x.detail.length>0);
  const totalST=stByChantier.reduce((a,x)=>a+x.total,0);
  const stTotalsByPersonne=new Map();
  for(const c of stByChantier){
    for(const d of c.detail){
      const cur=stTotalsByPersonne.get(d.stid)||{nom:d.nom,specialite:d.specialite,couleur:d.couleur,jours:0,cout:0};
      cur.jours+=d.jours;cur.cout+=d.cout;
      stTotalsByPersonne.set(d.stid,cur);
    }
  }
  return(
    <div>
      <PageH title="Comptabilité" subtitle="Vue d'ensemble financière"
        actions={<Btn onClick={()=>setShowScan(true)} variant="primary" icon="📸" disabled={!chantiers||chantiers.length===0}>Scanner facture</Btn>}/>
      <Tabs tabs={[{id:"overview",icon:"📊",label:"Vue d'ensemble"},{id:"masse",icon:"👷",label:"Masse salariale"},{id:"frais",icon:"💸",label:"Frais fixes"}]} active={tab} onChange={setTab}/>
      {tab==="masse"&&<MasseSalarialeTab chantiers={chantiers} salaries={salaries} totCA={totCA}/>}
      {tab==="frais"&&<VueFrais/>}
      {tab==="overview"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <KPI label="CA total" value={euro(totCA)} icon="💰" color={L.navy}/>
        <KPI label="Coûts estimés" value={euro(totCouts)} icon="📉" color={L.orange}/>
        <KPI label="Bénéfice est." value={euro(benef)} icon="📈" color={mc}/>
        <KPI label="Taux marge" value={`${tb}%`} icon="📊" color={mc}/>
        <KPI label="Encaissé" value={euro(chantiers.reduce((a,c)=>a+(c.acompteEncaisse||0),0))} icon="✅" color={L.green}/>
        <KPI label="Dépenses réelles" value={euro(totDepenses)} icon="🧾" color={L.red}/>
        <KPI label="Sous-traitants" value={euro(totalST)} icon="🤝" color="#7C3AED"/>
      </div>
      {/* ─── Graphique CA vs Marge par chantier (SVG natif) ─── */}
      {chantiers.length>0&&(
        <Card style={{padding:"14px 18px",marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,color:L.text,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>📊 CA HT vs Marge par chantier</span>
            <span style={{fontSize:10,fontWeight:500,color:L.textXs,display:"flex",gap:10}}>
              <span><span style={{display:"inline-block",width:10,height:10,background:L.navy,marginRight:4,borderRadius:2,verticalAlign:"middle"}}/>CA HT</span>
              <span><span style={{display:"inline-block",width:10,height:10,background:L.green,marginRight:4,borderRadius:2,verticalAlign:"middle"}}/>Marge</span>
            </span>
          </div>
          {(()=>{
            const data=chantiers.map(c=>{const cc=rentaChantier(c,salaries);return{nom:c.nom,ca:+c.devisHT||0,marge:cc.marge||0,tauxMarge:cc.tauxMarge||0};});
            const maxV=Math.max(1,...data.map(d=>Math.max(d.ca,d.marge>0?d.marge:0)));
            const rowH=28,gap=4,labelW=140,chartW=420,svgH=data.length*rowH+8;
            return(
              <div style={{overflowX:"auto"}}>
                <svg width={labelW+chartW+70} height={svgH} style={{display:"block",fontFamily:"inherit"}}>
                  {data.map((d,i)=>{
                    const y=i*rowH+4;
                    const wCA=Math.max(2,(d.ca/maxV)*chartW);
                    const wMarge=d.marge>0?Math.max(2,(d.marge/maxV)*chartW):0;
                    const margeColor=d.tauxMarge>=25?L.green:d.tauxMarge>=15?L.orange:L.red;
                    return(
                      <g key={i}>
                        <text x={0} y={y+11} fontSize={10} fontWeight={600} fill={L.text}>{(d.nom||"").length>18?(d.nom||"").slice(0,17)+"…":d.nom||""}</text>
                        {/* Barre CA en haut */}
                        <rect x={labelW} y={y} width={wCA} height={(rowH-gap)/2} fill={L.navy} rx={2}/>
                        <text x={labelW+wCA+5} y={y+9} fontSize={9} fill={L.textSm} fontFamily="monospace">{euro(d.ca)}</text>
                        {/* Barre Marge en bas */}
                        {d.marge>0?(<>
                          <rect x={labelW} y={y+(rowH-gap)/2+gap} width={wMarge} height={(rowH-gap)/2} fill={margeColor} rx={2}/>
                          <text x={labelW+wMarge+5} y={y+rowH-2} fontSize={9} fill={margeColor} fontFamily="monospace" fontWeight={700}>{euro(d.marge)} ({d.tauxMarge}%)</text>
                        </>):(
                          <text x={labelW+5} y={y+rowH-2} fontSize={9} fill={L.red} fontStyle="italic">Marge négative ({euro(d.marge)})</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}
        </Card>
      )}
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
      {/* ─── Coûts sous-traitants ─── */}
      {sousTraitants.length>0&&(
        <Card style={{overflow:"hidden",marginTop:18}}>
          <div style={{padding:"11px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>🤝 Coûts sous-traitants par chantier</span>
            <span style={{fontFamily:"monospace",fontSize:13,color:"#7C3AED"}}>{euro(totalST)}</span>
          </div>
          {stByChantier.length===0?(
            <div style={{padding:18,fontSize:11,color:L.textSm,textAlign:"center"}}>Aucun sous-traitant assigné sur les plannings actuels. Assignez-les dans l'éditeur de phase (Gantt → clic sur une barre).</div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:L.bg}}>{["Chantier","Sous-traitant","Spécialité","Jours","Taux/j","Coût"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
              <tbody>
                {stByChantier.flatMap((c,ci)=>{
                  const lignes=[];
                  c.detail.forEach((d,di)=>{
                    lignes.push(
                      <tr key={`${c.chantierId}-${d.stid}-${di}`} style={{borderBottom:`1px solid ${L.border}`,background:ci%2===0?L.surface:L.bg}}>
                        <td style={{padding:"7px 12px",fontSize:11,fontWeight:600}}>{di===0?c.chantierNom:""}</td>
                        <td style={{padding:"7px 12px",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                          <span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:d.couleur}}/>
                          <span style={{fontWeight:600}}>{d.nom}</span>
                        </td>
                        <td style={{padding:"7px 12px",fontSize:11,color:L.textSm}}>{d.specialite||"—"}</td>
                        <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11}}>{d.jours}</td>
                        <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11,color:L.textSm}}>{euro(d.tauxJ)}</td>
                        <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#7C3AED"}}>{euro(d.cout)}</td>
                      </tr>
                    );
                  });
                  lignes.push(
                    <tr key={`${c.chantierId}-total`} style={{borderBottom:`2px solid ${L.borderMd}`,background:"#F5F3FF"}}>
                      <td colSpan={5} style={{padding:"6px 12px",fontSize:11,fontWeight:700,textAlign:"right",color:L.textMd}}>Sous-total {c.chantierNom}</td>
                      <td style={{padding:"6px 12px",fontFamily:"monospace",fontSize:12,fontWeight:800,color:"#7C3AED"}}>{euro(c.total)}</td>
                    </tr>
                  );
                  return lignes;
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
      {/* ─── Récap par sous-traitant (cumul tous chantiers) ─── */}
      {stTotalsByPersonne.size>0&&(
        <Card style={{overflow:"hidden",marginTop:14}}>
          <div style={{padding:"11px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text}}>Cumul par sous-traitant</div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:L.bg}}>{["Sous-traitant","Spécialité","Jours total","Coût total"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 12px",fontSize:10,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {Array.from(stTotalsByPersonne.entries()).sort((a,b)=>b[1].cout-a[1].cout).map(([id,v],i)=>(
                <tr key={id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                  <td style={{padding:"7px 12px",fontSize:11,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{display:"inline-block",width:10,height:10,borderRadius:3,background:v.couleur}}/>
                    <span style={{fontWeight:600}}>{v.nom}</span>
                  </td>
                  <td style={{padding:"7px 12px",fontSize:11,color:L.textSm}}>{v.specialite||"—"}</td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:11}}>{v.jours}</td>
                  <td style={{padding:"7px 12px",fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#7C3AED"}}>{euro(v.cout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      </>}
      {showScan&&<ScanFactureModal chantiers={chantiers} entreprise={entreprise} onSave={onSaveDepense} onClose={()=>setShowScan(false)}/>}
    </div>
  );
}

// ─── ONGLET MASSE SALARIALE (équipe interne uniquement) ─────────────────────
// Sous-traitants exclus volontairement : ils sont des prestations facturées
// (compte 604), pas de la masse salariale URSSAF (compte 64). Voir leur
// section dédiée dans la Vue d'ensemble Compta.
function MasseSalarialeTab({chantiers,salaries,totCA}){
  const ref=new Date();
  const monthStart=new Date(ref.getFullYear(),ref.getMonth(),1);
  const monthEnd=new Date(ref.getFullYear(),ref.getMonth()+1,1);
  const monthLabel=ref.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  const rows=(salaries||[]).map(s=>{
    const tauxBase=+s.tauxHoraire||0;
    const charges=+s.chargesPatron||0;
    const tauxCharge=tauxBase*(1+charges);
    const coutJour=tauxCharge*8;
    const heuresMois=heuresPlanifieesMoisOuvrier(s.id,chantiers,monthStart,monthEnd);
    const coutMois=tauxCharge*heuresMois;
    // Annuel théorique : 1607h légales × taux chargé
    const coutAn=tauxCharge*1607;
    const chList=chantiersOuvrier(s.id,chantiers);
    return{...s,tauxBase,charges,tauxCharge,coutJour,heuresMois,coutMois,coutAn,chList};
  });
  const totalMois=rows.reduce((a,r)=>a+r.coutMois,0);
  const totalAn=rows.reduce((a,r)=>a+r.coutAn,0);
  const ratioCA=totCA>0?Math.round((totalAn/totCA)*100):0;
  const chantiersActifs=(chantiers||[]).filter(c=>c.statut!=="terminé"&&c.statut!=="annulé").length;
  const td={padding:"8px 11px",fontSize:11,color:L.text,borderBottom:`1px solid ${L.border}`};
  const tdr={...td,fontFamily:"monospace",textAlign:"right"};
  return(
    <div>
      <div style={{padding:"9px 14px",background:L.navyBg,borderRadius:8,marginBottom:14,fontSize:12,fontWeight:700,color:L.navy,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
        <span>📅 Mois de référence : {monthLabel}</span>
        <span style={{fontSize:10,fontWeight:500,color:L.textSm}}>Calcul basé sur le planning Gantt — 5 jours ouvrés / semaine, 8 h / jour</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,marginBottom:18}}>
        <KPI label="Masse salariale / mois" value={euro(totalMois)} icon="💼" color={L.navy} sub={`${rows.length} salarié${rows.length>1?"s":""}`}/>
        <KPI label="Masse salariale / an" value={euro(totalAn)} icon="📅" color={L.orange} sub="Base 1607 h / an"/>
        <KPI label="% du CA total" value={`${ratioCA}%`} icon="📊" color={ratioCA>50?L.red:ratioCA>35?L.orange:L.green} sub={totCA>0?`sur ${euro(totCA)}`:"CA = 0"}/>
        <KPI label="Chantiers actifs" value={chantiersActifs} icon="🏗" color={L.purple} sub={chantiersActifs>0?`${euro(totalMois/chantiersActifs)} / chantier`:"—"}/>
      </div>
      <Card style={{overflow:"hidden",marginBottom:14}}>
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${L.border}`,fontSize:12,fontWeight:700,color:L.text,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>👷 Équipe interne — détail par ouvrier</span>
          <span style={{fontFamily:"monospace",fontSize:13,color:L.navy}}>{euro(totalMois)} / mois</span>
        </div>
        {rows.length===0?(
          <div style={{padding:18,fontSize:11,color:L.textSm,textAlign:"center"}}>Aucun salarié dans l'équipe.</div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
              <thead><tr style={{background:L.bg}}>{["Ouvrier","Poste","Taux/h","Charges","Coût/jour","Coût/mois","Coût annuel","H. planifiées","Chantiers"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 11px",fontSize:9,color:L.textSm,fontWeight:600,textTransform:"uppercase",borderBottom:`1px solid ${L.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:`1px solid ${L.border}`,background:i%2===0?L.surface:L.bg}}>
                    <td style={{...td,fontWeight:700,whiteSpace:"nowrap"}}>
                      <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:couleurSalarie(r),marginRight:6,verticalAlign:"middle"}}/>
                      {r.nom}
                    </td>
                    <td style={{...td,color:L.textSm,whiteSpace:"nowrap"}}>{r.poste||"—"}</td>
                    <td style={{...tdr,color:L.navy}}>{r.tauxBase.toFixed(2)} €</td>
                    <td style={{...tdr,color:L.textSm}}>{Math.round(r.charges*100)}%</td>
                    <td style={{...tdr,color:L.orange,fontWeight:700}}>{euro(r.coutJour)}</td>
                    <td style={{...tdr,color:L.navy,fontWeight:800,fontSize:12}}>{euro(r.coutMois)}</td>
                    <td style={{...tdr,color:L.textMd,fontWeight:600}}>{euro(r.coutAn)}</td>
                    <td style={{...tdr,color:L.blue,fontWeight:700}}>{r.heuresMois}h</td>
                    <td style={{...td,fontSize:10,color:L.textSm,maxWidth:170}}>{r.chList.length===0?"—":r.chList.slice(0,2).join(", ")+(r.chList.length>2?` +${r.chList.length-2}`:"")}</td>
                  </tr>
                ))}
                <tr style={{background:L.navyBg,borderTop:`2px solid ${L.navy}33`}}>
                  <td colSpan={5} style={{...td,fontWeight:800,textAlign:"right",color:L.navy}}>TOTAL</td>
                  <td style={{...tdr,fontWeight:900,color:L.navy,fontSize:13}}>{euro(totalMois)}</td>
                  <td style={{...tdr,fontWeight:800,color:L.navy}}>{euro(totalAn)}</td>
                  <td colSpan={2}/>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div style={{padding:"11px 14px",background:L.orangeBg,border:`1px solid ${L.orange}33`,borderRadius:8,fontSize:12,color:"#7C2D12",lineHeight:1.55}}>
        ⚠️ <strong>Estimation indicative</strong> — coûts calculés depuis le planning Gantt sur la base du taux horaire chargé déclaré. <strong>Vérifiez avec votre comptable pour la déclaration URSSAF</strong> (DSN, taux exacts AT/MP, exonérations, primes, IJSS…).
      </div>
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

// ─── VUE AGENTS IA — monitoring + toggle on/off + historique notifs ─────────
const AGENTS_META={
  devis:{label:"Agent Devis",icon:"📄",description:"Analyse les marges et alerte si une vente est trop basse vs ses coûts. Tourne toutes les heures."},
  chantier:{label:"Agent Chantier",icon:"🏗",description:"Détecte les chantiers en retard et ceux sans activité depuis 5 jours. Tourne toutes les 6 heures."},
  comptabilite:{label:"Agent Comptabilité",icon:"💰",description:"Repère les factures impayées >30j et la baisse de CA mois/mois. Tourne tous les jours à 8h."},
  planning:{label:"Agent Planning",icon:"📅",description:"Détecte les conflits d'affectation (un ouvrier 2 fois le même jour) et les salariés sans planning. Tourne tous les matins à 7h."},
};
const NOTIF_TYPES={
  info:{color:"#2563EB",bg:"#DBEAFE",icon:"ℹ️"},
  warning:{color:"#D97706",bg:"#FEF3C7",icon:"⚠️"},
  urgent:{color:"#DC2626",bg:"#FEE2E2",icon:"🚨"},
  success:{color:"#16A34A",bg:"#D1FAE5",icon:"✅"},
};

function VueAgents({authUser,entreprise,setEntreprise,onChangeRead}){
  const [notifs,setNotifs]=useState([]);
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("notifs");
  const enabled=entreprise?.agents_enabled||{devis:true,chantier:true,comptabilite:true,planning:true};

  async function reload(){
    if(!supabase)return;
    setLoading(true);
    const [{data:n},{data:l}]=await Promise.all([
      supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(40),
      supabase.from("agent_logs").select("*").order("created_at",{ascending:false}).limit(20),
    ]);
    setNotifs(n||[]);setLogs(l||[]);setLoading(false);
  }
  useEffect(()=>{reload();},[]);

  async function toggleAgent(key){
    if(!supabase||!authUser)return;
    const next={...enabled,[key]:enabled[key]===false?true:!enabled[key]};
    setEntreprise?.(e=>({...e,agents_enabled:next}));
    const {error}=await supabase.from("entreprises").update({agents_enabled:next}).eq("user_id",authUser.id);
    if(error){console.warn("[agents toggle]",error.message);}
  }
  async function markRead(id){
    if(!supabase)return;
    setNotifs(ns=>ns.map(n=>n.id===id?{...n,lu:true}:n));
    await supabase.from("notifications").update({lu:true}).eq("id",id);
    onChangeRead?.();
  }
  async function markAllRead(){
    if(!supabase)return;
    const ids=notifs.filter(n=>!n.lu).map(n=>n.id);
    if(ids.length===0)return;
    setNotifs(ns=>ns.map(n=>({...n,lu:true})));
    await supabase.from("notifications").update({lu:true}).in("id",ids);
    onChangeRead?.();
  }
  async function dismiss(id){
    if(!supabase)return;
    setNotifs(ns=>ns.filter(n=>n.id!==id));
    await supabase.from("notifications").delete().eq("id",id);
    onChangeRead?.();
  }

  const unread=notifs.filter(n=>!n.lu).length;
  const lastRunByAgent=new Map();
  for(const l of logs){
    if(l.type==="run_summary"&&!lastRunByAgent.has(l.agent_id)){
      lastRunByAgent.set(l.agent_id,l.created_at);
    }
  }

  return(
    <div>
      <PageH title="🤖 Agents IA" subtitle="Surveillance automatique 24/7 — devis, chantiers, compta, planning"
        actions={unread>0?<Btn onClick={markAllRead} variant="secondary" icon="✓">Tout marquer lu ({unread})</Btn>:null}/>

      {/* Cards par agent */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12,marginBottom:18}}>
        {Object.entries(AGENTS_META).map(([key,meta])=>{
          const isOn=enabled[key]!==false;
          const lastRun=lastRunByAgent.get(key);
          return(
            <Card key={key} style={{padding:14,borderLeft:`4px solid ${isOn?L.green:L.border}`}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:L.text,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:18}}>{meta.icon}</span>{meta.label}</div>
                  <div style={{fontSize:11,color:isOn?L.green:L.textXs,fontWeight:600,marginTop:2}}>{isOn?"● Actif":"○ Désactivé"}</div>
                </div>
                <button onClick={()=>toggleAgent(key)} role="switch" aria-checked={isOn}
                  style={{width:40,height:22,borderRadius:11,border:"none",background:isOn?L.green:L.border,cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                  <span style={{position:"absolute",top:2,left:isOn?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"left 0.2s"}}/>
                </button>
              </div>
              <div style={{fontSize:11,color:L.textSm,lineHeight:1.5,marginBottom:8}}>{meta.description}</div>
              <div style={{fontSize:10,color:L.textXs,fontStyle:"italic"}}>{lastRun?`Dernière exécution : ${new Date(lastRun).toLocaleString("fr-FR")}`:"Pas encore exécuté"}</div>
            </Card>
          );
        })}
      </div>

      {/* Tabs notifs / historique */}
      <div style={{borderBottom:`1px solid ${L.border}`,marginBottom:14,display:"flex",gap:4}}>
        <button onClick={()=>setTab("notifs")} style={{padding:"9px 14px",border:"none",background:"transparent",color:tab==="notifs"?L.navy:L.textSm,fontSize:13,fontWeight:tab==="notifs"?700:500,borderBottom:tab==="notifs"?`2px solid ${L.accent}`:"2px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>
          🔔 Notifications {unread>0&&<span style={{marginLeft:6,background:L.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:8,padding:"1px 6px"}}>{unread}</span>}
        </button>
        <button onClick={()=>setTab("logs")} style={{padding:"9px 14px",border:"none",background:"transparent",color:tab==="logs"?L.navy:L.textSm,fontSize:13,fontWeight:tab==="logs"?700:500,borderBottom:tab==="logs"?`2px solid ${L.accent}`:"2px solid transparent",cursor:"pointer",fontFamily:"inherit"}}>
          📋 Historique d'exécution
        </button>
      </div>

      {loading?(
        <div style={{padding:30,textAlign:"center",color:L.textSm}}>Chargement…</div>
      ):tab==="notifs"?(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {notifs.length===0?(
            <Card style={{padding:30,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8}}>✨</div>
              <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:4}}>Aucune notification</div>
              <div style={{fontSize:12,color:L.textSm}}>Les agents tournent en arrière-plan et te préviennent quand ils détectent un point à corriger.</div>
            </Card>
          ):notifs.map(n=>{
            const cfg=NOTIF_TYPES[n.type]||NOTIF_TYPES.info;
            return(
              <Card key={n.id} style={{padding:12,borderLeft:`4px solid ${cfg.color}`,opacity:n.lu?0.6:1}}>
                <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:cfg.color,textTransform:"uppercase",letterSpacing:0.5}}>{cfg.icon} {n.agent_id||"agent"}</span>
                  {!n.lu&&<span style={{background:L.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:8,padding:"1px 6px"}}>NEW</span>}
                  <span style={{fontSize:10,color:L.textXs,marginLeft:"auto"}}>{new Date(n.created_at).toLocaleString("fr-FR")}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:L.text,marginBottom:4}}>{n.titre}</div>
                <div style={{fontSize:12,color:L.textSm,lineHeight:1.5,marginBottom:8}}>{n.message}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {!n.lu&&<button onClick={()=>markRead(n.id)} style={{padding:"4px 10px",border:`1px solid ${L.border}`,borderRadius:5,background:L.surface,color:L.text,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓ Marquer lu</button>}
                  <button onClick={()=>dismiss(n.id)} style={{padding:"4px 10px",border:`1px solid ${L.red}55`,borderRadius:5,background:"transparent",color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕ Archiver</button>
                </div>
              </Card>
            );
          })}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {logs.length===0?(
            <Card style={{padding:20,textAlign:"center",color:L.textSm,fontSize:12}}>Aucune exécution enregistrée pour l'instant.</Card>
          ):logs.map(l=>(
            <Card key={l.id} style={{padding:10,fontSize:11}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:6,marginBottom:3}}>
                <span style={{fontWeight:700,color:L.navy}}>{AGENTS_META[l.agent_id]?.icon||"🤖"} {l.agent_id}</span>
                <span style={{color:L.textXs}}>{new Date(l.created_at).toLocaleString("fr-FR")}</span>
              </div>
              <div style={{color:L.textSm}}>{l.message}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VUE MÉDIA IA (admin uniquement) ─────────────────────────────────────────
// Génère du contenu réseaux sociaux à partir d'un chantier livré : LinkedIn,
// Instagram (post + story), Facebook (post + story), TikTok (vidéo + story).
// Test interne — visible UNIQUEMENT pour francehabitat.immo@gmail.com.

const MEDIA_PLATFORMS=[
  {key:"linkedin-post",label:"LinkedIn — Post",icon:"💼",color:"#0A66C2",group:"linkedin"},
  {key:"instagram-post",label:"Instagram — Publication",icon:"📸",color:"#E1306C",group:"instagram"},
  {key:"instagram-story",label:"Instagram — Story",icon:"⭕",color:"#E1306C",group:"instagram"},
  {key:"facebook-post",label:"Facebook — Publication",icon:"👍",color:"#1877F2",group:"facebook"},
  {key:"facebook-story",label:"Facebook — Story",icon:"⭕",color:"#1877F2",group:"facebook"},
  {key:"tiktok-video",label:"TikTok — Vidéo",icon:"🎵",color:"#000",group:"tiktok"},
  {key:"tiktok-story",label:"TikTok — Story",icon:"⚡",color:"#000",group:"tiktok"},
];
const MEDIA_TONS=["Professionnel","Décontracté","Humoristique"];
const MEDIA_MISE_EN_AVANT=["Qualité","Rapidité","Prix","Savoir-faire"];

function VueMedia({chantiers,entreprise,statut,authUser}){
  const [chantierId,setChantierId]=useState(null);
  const [selectedFormats,setSelectedFormats]=useState(new Set(["linkedin-post","instagram-post"]));
  const [ton,setTon]=useState("Professionnel");
  const [inclurePrix,setInclurePrix]=useState(false);
  const [miseEnAvant,setMiseEnAvant]=useState("Qualité");
  const [ville,setVille]=useState(entreprise?.ville||"Marseille");
  const [generating,setGenerating]=useState(false);
  const [results,setResults]=useState({}); // { 'linkedin-post': '...', ... }
  const [error,setError]=useState("");
  const [historique,setHistorique]=useState(()=>{try{return JSON.parse(localStorage.getItem("cp_media_history")||"[]");}catch{return[];}});
  const [showHisto,setShowHisto]=useState(false);
  const [copiedKey,setCopiedKey]=useState(null);
  // Photos du chantier sélectionné
  const [photos,setPhotos]=useState([]);
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const [photoError,setPhotoError]=useState("");
  const fileInputRef=useRef(null);

  // Filtre chantiers en cours ou terminés
  const chantiersEligibles=(chantiers||[]).filter(c=>c.statut==="en cours"||c.statut==="terminé");
  const chantierSelected=chantiersEligibles.find(c=>c.id===chantierId);

  // Auto-résumé du chantier sélectionné
  const resume=(()=>{
    if(!chantierSelected)return null;
    const c=chantierSelected;
    // Type travaux : déduit des postes ou du nom
    const lots=[...new Set((c.postes||[]).map(p=>p.lot).filter(Boolean))];
    const typeTravaux=lots.length?lots.slice(0,3).join(", "):c.nom||"travaux";
    // Durée : si planning, somme dureeJours
    const planning=c.planning||[];
    let duree="non renseignée";
    if(planning.length){
      const totalJ=planning.reduce((a,p)=>a+(+p.dureeJours||0),0);
      duree=totalJ?`environ ${totalJ} jour${totalJ>1?"s":""}`:duree;
    }
    return{
      nom:c.nom||"",
      type_travaux:typeTravaux,
      ville:c.adresse?(c.adresse.split(/[,\s]+/).slice(-1)[0]||ville):ville,
      duree,
      description:c.notes||"",
      devis_ht:c.devisHT||0,
    };
  })();

  function toggleFormat(k){
    setSelectedFormats(prev=>{
      const n=new Set(prev);
      if(n.has(k))n.delete(k);else n.add(k);
      return n;
    });
  }

  // Charge les photos déjà uploadées pour ce chantier au changement de sélection
  useEffect(()=>{
    if(!chantierId){setPhotos([]);return;}
    let cancelled=false;
    listChantierPhotos(chantierId).then(list=>{
      if(!cancelled)setPhotos(list);
    });
    return()=>{cancelled=true;};
  },[chantierId]);

  async function onFilesSelected(e){
    const files=Array.from(e.target.files||[]);
    e.target.value=""; // reset input pour pouvoir re-sélectionner les mêmes fichiers
    if(files.length===0)return;
    if(!chantierId){setPhotoError("Sélectionne d'abord un chantier.");return;}
    const remaining=PHOTO_LIMITS.maxPerSession-photos.length;
    if(remaining<=0){setPhotoError(`Limite atteinte (${PHOTO_LIMITS.maxPerSession} photos max). Supprime-en avant d'en ajouter.`);return;}
    const toUpload=files.slice(0,remaining);
    setPhotoError("");setUploadingPhoto(true);
    const uploaded=[];
    for(const file of toUpload){
      try{
        const r=await uploadChantierPhoto({file,chantierId,authUser});
        uploaded.push(r);
      }catch(err){
        setPhotoError(`${file.name} : ${err.message}`);
        break;
      }
    }
    setUploadingPhoto(false);
    if(uploaded.length>0)setPhotos(p=>[...uploaded.reverse(),...p]);
  }

  async function removerPhoto(photo){
    if(!window.confirm("Supprimer cette photo ?"))return;
    try{
      await deleteChantierPhoto(photo);
      setPhotos(p=>p.filter(x=>x.id!==photo.id));
    }catch(err){
      setPhotoError(`Suppression : ${err.message}`);
    }
  }

  async function generer(){
    setError("");setResults({});
    if(!chantierSelected){setError("Sélectionne d'abord un chantier.");return;}
    if(selectedFormats.size===0){setError("Sélectionne au moins une plateforme.");return;}
    setGenerating(true);
    try{
      const r=await fetch("/api/media-ia",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          chantier:resume,
          formats:Array.from(selectedFormats),
          options:{ton,inclure_prix:inclurePrix,mise_en_avant:miseEnAvant,ville},
          photo_urls:photos.map(p=>p.url),
        }),
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok){setError(data?.error||`Erreur HTTP ${r.status}`);setGenerating(false);return;}
      setResults(data.posts||{});
    }catch(e){setError("Erreur réseau : "+e.message);}
    setGenerating(false);
  }

  function copy(key){
    const txt=results[key]||"";
    if(!txt)return;
    navigator.clipboard?.writeText(txt).then(()=>{
      setCopiedKey(key);
      setTimeout(()=>setCopiedKey(c=>c===key?null:c),1500);
    });
  }

  function regenerer(key){
    // Re-génère seulement ce format précis
    if(!chantierSelected)return;
    setError("");
    const formats=[key];
    setResults(prev=>{const n={...prev};delete n[key];return n;});
    fetch("/api/media-ia",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        chantier:resume,formats,
        options:{ton,inclure_prix:inclurePrix,mise_en_avant:miseEnAvant,ville},
        photo_urls:photos.map(p=>p.url),
      }),
    }).then(r=>r.json()).then(data=>{
      if(data.posts?.[key])setResults(prev=>({...prev,[key]:data.posts[key]}));
      else setError(data?.error||"Échec régénération");
    }).catch(e=>setError("Erreur réseau : "+e.message));
  }

  function sauvegarder(){
    if(Object.keys(results).length===0)return;
    const entry={
      id:Date.now(),
      date:new Date().toISOString(),
      chantier:resume?.nom||"chantier",
      ville:resume?.ville,
      ton,miseEnAvant,inclurePrix,
      formats:Object.keys(results),
      posts:results,
    };
    const next=[entry,...historique].slice(0,30); // cap 30 entrées
    setHistorique(next);
    try{localStorage.setItem("cp_media_history",JSON.stringify(next));}catch{}
  }

  function chargerHistorique(entry){
    setResults(entry.posts||{});
    setShowHisto(false);
  }
  function supprimerHistorique(id){
    const next=historique.filter(h=>h.id!==id);
    setHistorique(next);
    try{localStorage.setItem("cp_media_history",JSON.stringify(next));}catch{}
  }

  const inp={width:"100%",padding:"9px 11px",fontSize:13,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6};

  return(
    <div>
      <PageH title="📱 Média IA — Réseaux sociaux"
        subtitle="Génère des posts pour LinkedIn, Instagram, Facebook, TikTok à partir d'un chantier"
        actions={historique.length>0?<Btn onClick={()=>setShowHisto(true)} variant="secondary" icon="📚">Mes posts ({historique.length})</Btn>:null}/>

      <div style={{background:`linear-gradient(135deg,${L.purple}15,${L.accent}15)`,border:`1px solid ${L.purple}33`,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>🛠️</span>
        <div style={{flex:1,fontSize:12,color:L.text}}>
          <strong>Test interne</strong> — module visible uniquement pour {SUPPORT_ADMIN_EMAIL}. Sera élargi aux patrons quand stable.
        </div>
      </div>

      {/* 1. Sélection chantier */}
      <Card style={{padding:16,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:L.navy,marginBottom:10}}>1. Chantier source</div>
        <select value={chantierId||""} onChange={e=>setChantierId(+e.target.value||null)} style={inp}>
          <option value="">— Choisis un chantier (en cours ou terminé) —</option>
          {chantiersEligibles.map(c=>(
            <option key={c.id} value={c.id}>{c.nom} — {c.client||"?"} — {c.statut}</option>
          ))}
        </select>
        {resume&&(
          <div style={{marginTop:10,padding:"10px 12px",background:L.bg,borderRadius:7,fontSize:12,color:L.textSm,lineHeight:1.6}}>
            <div><strong style={{color:L.text}}>Type :</strong> {resume.type_travaux}</div>
            <div><strong style={{color:L.text}}>Ville :</strong> {resume.ville}</div>
            <div><strong style={{color:L.text}}>Durée :</strong> {resume.duree}</div>
            {resume.devis_ht>0&&<div><strong style={{color:L.text}}>Montant :</strong> {euro(resume.devis_ht)} HT</div>}
            {resume.description&&<div style={{marginTop:4,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{resume.description}</div>}
          </div>
        )}
      </Card>

      {/* 2. Photos du chantier */}
      <Card style={{padding:16,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
          <div style={{fontSize:14,fontWeight:700,color:L.navy}}>2. Photos du chantier {photos.length>0&&<span style={{fontSize:11,color:L.textSm,fontWeight:500}}>({photos.length}/{PHOTO_LIMITS.maxPerSession})</span>}</div>
          <input ref={fileInputRef} type="file" accept={PHOTO_LIMITS.acceptedMime.join(",")} multiple onChange={onFilesSelected} style={{display:"none"}}/>
          <Btn onClick={()=>fileInputRef.current?.click()} variant="secondary" icon={uploadingPhoto?"⏳":"📷"} disabled={uploadingPhoto||!chantierId||photos.length>=PHOTO_LIMITS.maxPerSession}>
            {uploadingPhoto?"Upload…":"Ajouter des photos"}
          </Btn>
        </div>
        {!chantierId&&<div style={{fontSize:12,color:L.textSm,fontStyle:"italic"}}>Sélectionne un chantier pour ajouter des photos.</div>}
        {photoError&&<div style={{background:"#FEE2E2",color:L.red,padding:"6px 10px",borderRadius:6,fontSize:12,marginBottom:8}}>{photoError}</div>}
        {photos.length>0?(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
            {photos.map(ph=>(
              <div key={ph.id} style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`1px solid ${L.border}`,background:L.bg}}>
                <img src={ph.url} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                <button onClick={()=>removerPhoto(ph)} title="Supprimer cette photo" aria-label="Supprimer"
                  style={{position:"absolute",top:4,right:4,width:24,height:24,border:"none",borderRadius:6,background:"rgba(220,38,38,0.85)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(2px)"}}>✕</button>
              </div>
            ))}
          </div>
        ):chantierId&&!uploadingPhoto&&(
          <div style={{padding:"14px 12px",textAlign:"center",color:L.textSm,fontSize:12,background:L.bg,borderRadius:7,border:`1px dashed ${L.border}`}}>
            <div style={{fontSize:24,marginBottom:4}}>📷</div>
            Aucune photo. L'IA peut générer du contenu sans photo, mais des photos avant/après donnent des posts beaucoup plus parlants.
          </div>
        )}
        <div style={{fontSize:10,color:L.textXs,marginTop:6,fontStyle:"italic"}}>JPG / PNG / WebP / HEIC, max 5 Mo par photo. Les photos prises côté Terrain par tes ouvriers apparaissent ici aussi.</div>
      </Card>

      {/* 3. Plateformes */}
      <Card style={{padding:16,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:L.navy,marginBottom:10}}>3. Plateformes & formats</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
          {MEDIA_PLATFORMS.map(p=>{
            const sel=selectedFormats.has(p.key);
            return(
              <button key={p.key} onClick={()=>toggleFormat(p.key)}
                style={{padding:"10px 12px",borderRadius:8,border:`1.5px solid ${sel?p.color:L.border}`,background:sel?p.color+"15":L.surface,color:sel?p.color:L.text,fontWeight:sel?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,textAlign:"left"}}>
                <span style={{fontSize:18}}>{p.icon}</span>
                <span style={{flex:1}}>{p.label}</span>
                {sel&&<span style={{fontSize:14,color:p.color}}>✓</span>}
              </button>
            );
          })}
        </div>
        <div style={{fontSize:11,color:L.textXs,marginTop:6,fontStyle:"italic"}}>{selectedFormats.size} format(s) sélectionné(s)</div>
      </Card>

      {/* 4. Options */}
      <Card style={{padding:16,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:L.navy,marginBottom:10}}>4. Personnalisation</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
          <div>
            <label style={lbl}>Ton</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {MEDIA_TONS.map(t=><button key={t} onClick={()=>setTon(t)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${ton===t?L.accent:L.border}`,background:ton===t?L.accent+"15":L.surface,color:ton===t?L.accent:L.text,fontWeight:ton===t?700:500,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{t}</button>)}
            </div>
          </div>
          <div>
            <label style={lbl}>Mettre en avant</label>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {MEDIA_MISE_EN_AVANT.map(m=><button key={m} onClick={()=>setMiseEnAvant(m)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${miseEnAvant===m?L.green:L.border}`,background:miseEnAvant===m?L.greenBg:L.surface,color:miseEnAvant===m?L.green:L.text,fontWeight:miseEnAvant===m?700:500,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{m}</button>)}
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={lbl}>Inclure le prix</label>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"6px 0"}}>
              <input type="checkbox" checked={inclurePrix} onChange={e=>setInclurePrix(e.target.checked)}/>
              {inclurePrix?"Oui — afficher le montant":"Non — pas de prix"}
            </label>
          </div>
          <div>
            <label style={lbl}>Ville / zone</label>
            <input value={ville} onChange={e=>setVille(e.target.value)} style={inp} placeholder="Ex: Marseille"/>
          </div>
        </div>
      </Card>

      {/* 4. Action génération */}
      <div style={{marginBottom:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={generer} variant="primary" icon={generating?"⏳":"✨"} disabled={generating||!chantierSelected||selectedFormats.size===0}>
          {generating?"Génération en cours…":"Générer le contenu"}
        </Btn>
        {Object.keys(results).length>0&&<Btn onClick={sauvegarder} variant="secondary" icon="💾">Sauvegarder dans Mes posts</Btn>}
      </div>
      {error&&<div style={{background:"#FEE2E2",color:L.red,padding:10,borderRadius:7,fontSize:12,marginBottom:14}}>{error}</div>}

      {/* 5. Résultats par plateforme */}
      {Object.keys(results).length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {MEDIA_PLATFORMS.filter(p=>results[p.key]).map(p=>(
            <Card key={p.key} style={{padding:14,borderLeft:`4px solid ${p.color}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:6}}>
                <div style={{fontSize:13,fontWeight:700,color:p.color,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:18}}>{p.icon}</span>{p.label}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>copy(p.key)} title="Copier" style={{padding:"5px 10px",border:`1px solid ${L.border}`,borderRadius:6,background:copiedKey===p.key?L.greenBg:L.surface,color:copiedKey===p.key?L.green:L.text,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    {copiedKey===p.key?"✓ Copié !":"📋 Copier"}
                  </button>
                  <button onClick={()=>regenerer(p.key)} title="Régénérer" style={{padding:"5px 10px",border:`1px solid ${L.border}`,borderRadius:6,background:L.surface,color:L.purple,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    🔄 Régénérer
                  </button>
                </div>
              </div>
              <pre style={{margin:0,padding:"10px 12px",background:L.bg,borderRadius:6,fontSize:12,fontFamily:"inherit",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-word",color:L.text,maxHeight:400,overflowY:"auto"}}>{results[p.key]}</pre>
            </Card>
          ))}
        </div>
      )}

      {/* Modale historique */}
      {showHisto&&(
        <Modal title={`📚 Mes posts (${historique.length})`} onClose={()=>setShowHisto(false)} maxWidth={680}>
          {historique.length===0?(
            <div style={{padding:20,textAlign:"center",color:L.textSm}}>Aucun post sauvegardé pour l'instant.</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:"60vh",overflowY:"auto"}}>
              {historique.map(h=>(
                <Card key={h.id} style={{padding:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4,flexWrap:"wrap",gap:6}}>
                    <div style={{fontSize:13,fontWeight:700,color:L.text}}>{h.chantier}</div>
                    <span style={{fontSize:10,color:L.textXs}}>{new Date(h.date).toLocaleString("fr-FR")}</span>
                  </div>
                  <div style={{fontSize:11,color:L.textSm,marginBottom:8}}>{h.formats.length} format(s) · ton {h.ton} · mise en avant {h.miseEnAvant}{h.ville?` · ${h.ville}`:""}</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>chargerHistorique(h)} style={{padding:"5px 10px",border:`1px solid ${L.accent}`,borderRadius:6,background:L.accent+"15",color:L.accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>↩️ Recharger</button>
                    <button onClick={()=>supprimerHistorique(h.id)} style={{padding:"5px 10px",border:`1px solid ${L.red}55`,borderRadius:6,background:"transparent",color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕ Supprimer</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── VUE SUPPORT (Phase 1) ───────────────────────────────────────────────────
// Onglet "Support" pour les patrons connectés. 3 sous-onglets : Mes tickets,
// Roadmap, FAQ. Si l'utilisateur est admin (email = SUPPORT_ADMIN_EMAIL),
// affiche un bandeau "→ Dashboard admin" qui sera fonctionnel en Phase 2.
const SUPPORT_TICKET_STATUTS={
  ouvert:{label:"Ouvert",color:L.orange,bg:L.orangeBg||"#FEF3C7"},
  en_cours:{label:"En cours",color:L.blue,bg:L.blueBg||"#DBEAFE"},
  resolu:{label:"Résolu",color:L.green,bg:L.greenBg||"#D1FAE5"},
  refuse:{label:"Refusé",color:L.red,bg:"#FEE2E2"},
};
const SUPPORT_TYPES={
  bug:{label:"🐛 Bug",color:L.red},
  feature:{label:"✨ Fonctionnalité",color:L.accent},
  recommandation:{label:"💡 Recommandation",color:L.green},
  autre:{label:"💬 Autre",color:L.textSm},
};
const ROADMAP_STATUTS={
  planifie:{label:"Planifié",color:L.textSm,bg:L.bg},
  en_cours:{label:"En cours",color:L.orange,bg:L.orangeBg||"#FEF3C7"},
  livre:{label:"Livré",color:L.green,bg:L.greenBg||"#D1FAE5"},
  annule:{label:"Annulé",color:L.red,bg:"#FEE2E2"},
};
const ROADMAP_TYPE_ICONS={feature:"✨",bug_fix:"🔧",improvement:"⚡"};

// ─── Options des formulaires guidés (Phase 2.1) ─────────────────────────────
// Ces listes pilotent les selects type-spécifiques de NouveauTicketModal et
// de TicketForm (page publique). Les valeurs stockées en metadata sont
// exactement celles de cette liste — l'IA et l'admin les reçoivent telles
// quelles.
const SUPPORT_FIELDS={
  bug:{
    description:{label:"Que s'est-il passé ?",max:200,placeholder:"Décris précisément ce qui ne va pas (1-2 phrases)."},
    selects:[
      {key:"page",label:"Quelle page ?",options:["Devis","Chantiers","Facturation","Équipe","Planning","Comptabilité","Mobile","Connexion","Autre"]},
      {key:"appareil",label:"Quel appareil ?",options:["iPhone","Android","PC Windows","PC Mac"]},
      {key:"gravite",label:"Gravité ?",options:["Bloquant","Gênant","Mineur"]},
    ],
  },
  feature:{
    description:{label:"Décrivez la fonctionnalité",max:300,placeholder:"Ex : pouvoir dupliquer un devis en un clic depuis la liste."},
    selects:[
      {key:"module",label:"Quel module ?",options:["Devis","Chantiers","Facturation","Équipe","Mobile","Autre"]},
      {key:"priorite_utilisateur",label:"Priorité pour vous ?",options:["Indispensable","Utile","Agréable à avoir"]},
    ],
  },
  recommandation:{
    description:{label:"Votre recommandation",max:300,placeholder:"Une suggestion d'amélioration, un retour d'usage, etc."},
    selects:[],
  },
  autre:{
    description:{label:"Votre message",max:300,placeholder:"Tout ce qui ne rentre pas dans les autres catégories."},
    selects:[],
  },
};

function VueSupport({authUser}){
  const [tab,setTab]=useState("tickets");
  const [tickets,setTickets]=useState([]);
  const [roadmap,setRoadmap]=useState([]);
  const [announcements,setAnnouncements]=useState([]);
  const [faq,setFaq]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showNouveau,setShowNouveau]=useState(false);
  // Filtres admin
  const [fStatut,setFStatut]=useState("tous");
  const [fType,setFType]=useState("tous");
  const [fPriorite,setFPriorite]=useState("tous");
  // Modales admin
  const [editTicket,setEditTicket]=useState(null);
  const [editRoadmap,setEditRoadmap]=useState(null);  // null=fermé, {}=nouveau, {id...}=édition
  const [editAnnounce,setEditAnnounce]=useState(null);
  const [editFaq,setEditFaq]=useState(null);
  const isAdmin=(authUser?.email||"").trim().toLowerCase()===SUPPORT_ADMIN_EMAIL;
  const voterId=authUser?.id||(authUser?.email||"").trim().toLowerCase();

  async function reload(){
    if(!supabase){setLoading(false);return;}
    setLoading(true);
    const [t,r,a,f]=await Promise.all([
      supabase.from("tickets").select("*").order("created_at",{ascending:false}),
      supabase.from("roadmap").select("*").order("statut",{ascending:true}).order("votes",{ascending:false}).order("ordre",{ascending:true}),
      isAdmin?supabase.from("announcements").select("*").order("created_at",{ascending:false}):Promise.resolve({data:[]}),
      supabase.from("faq").select("*").order("ordre",{ascending:true}),
    ]);
    setTickets(t.data||[]);
    setRoadmap(r.data||[]);
    setAnnouncements(a.data||[]);
    setFaq(f.data||[]);
    setLoading(false);
  }
  useEffect(()=>{reload();},[isAdmin]);

  // Filtres + KPIs (admin)
  const filteredTickets=tickets.filter(tk=>(
    (fStatut==="tous"||tk.statut===fStatut)&&
    (fType==="tous"||tk.type===fType)&&
    (fPriorite==="tous"||tk.priorite===fPriorite)
  ));
  const kpiOuverts=tickets.filter(t=>t.statut==="ouvert").length;
  const kpiResolus=tickets.filter(t=>t.statut==="resolu").length;
  const kpiTempsMoyen=(()=>{
    const repondus=tickets.filter(t=>t.reponse_at);
    if(!repondus.length)return null;
    const sumMs=repondus.reduce((a,t)=>a+(new Date(t.reponse_at)-new Date(t.created_at)),0);
    const h=sumMs/repondus.length/3600000;
    return h<1?`${Math.round(h*60)} min`:h<24?`${h.toFixed(1)} h`:`${(h/24).toFixed(1)} j`;
  })();

  const tabBtn=(id,label,badge)=>(
    <button onClick={()=>setTab(id)} style={{padding:"9px 14px",border:"none",background:"transparent",color:tab===id?L.navy:L.textSm,fontSize:13,fontWeight:tab===id?700:500,borderBottom:tab===id?`2px solid ${L.accent}`:"2px solid transparent",cursor:"pointer",fontFamily:"inherit",position:"relative"}}>
      {label}{badge!=null&&badge>0&&<span style={{marginLeft:6,background:L.red,color:"#fff",fontSize:9,fontWeight:800,borderRadius:8,padding:"1px 5px"}}>{badge}</span>}
    </button>
  );

  return(
    <div>
      <PageH title="Support" subtitle={isAdmin?"Dashboard admin — tickets, roadmap, annonces, FAQ":"Tickets, roadmap, FAQ — on est là pour aider"}
        actions={tab==="tickets"&&!isAdmin?<Btn onClick={()=>setShowNouveau(true)} variant="primary" icon="✏️">Nouveau ticket</Btn>:null}/>

      {/* KPIs admin */}
      {isAdmin&&tab==="tickets"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:14}}>
          <KPI label="Tickets ouverts" value={kpiOuverts} color={L.orange}/>
          <KPI label="Résolus (total)" value={kpiResolus} color={L.green}/>
          <KPI label="Temps moyen réponse" value={kpiTempsMoyen||"—"} color={L.blue}/>
          <KPI label="Total tickets" value={tickets.length} color={L.navy}/>
        </div>
      )}

      <div style={{borderBottom:`1px solid ${L.border}`,marginBottom:14,display:"flex",gap:4,flexWrap:"wrap"}}>
        {tabBtn("tickets",isAdmin?"🎫 Tickets":"Mes tickets",isAdmin?kpiOuverts:tickets.filter(t=>t.statut==="ouvert").length)}
        {tabBtn("roadmap","🗺️ Roadmap")}
        {isAdmin&&tabBtn("annonces","📢 Annonces")}
        {tabBtn("faq","❓ FAQ")}
      </div>

      {loading?(
        <div style={{padding:30,textAlign:"center",color:L.textSm}}>Chargement…</div>
      ):tab==="tickets"?(
        <>
          {/* Filtres admin */}
          {isAdmin&&(
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5}}>Filtres :</span>
              <select value={fStatut} onChange={e=>setFStatut(e.target.value)} style={{padding:"6px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
                <option value="tous">Tous statuts</option>
                {Object.entries(SUPPORT_TICKET_STATUTS).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
              </select>
              <select value={fType} onChange={e=>setFType(e.target.value)} style={{padding:"6px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
                <option value="tous">Tous types</option>
                {Object.entries(SUPPORT_TYPES).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
              </select>
              <select value={fPriorite} onChange={e=>setFPriorite(e.target.value)} style={{padding:"6px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,fontFamily:"inherit"}}>
                <option value="tous">Toutes priorités</option>
                {["basse","normale","haute","urgente"].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <span style={{fontSize:11,color:L.textXs,marginLeft:"auto"}}>{filteredTickets.length} / {tickets.length}</span>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredTickets.length===0?(
              <Card style={{padding:30,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:8}}>📭</div>
                <div style={{fontSize:14,fontWeight:600,color:L.text,marginBottom:4}}>Aucun ticket{tickets.length>0?" avec ces filtres":""}</div>
                {!isAdmin&&<div style={{fontSize:12,color:L.textSm}}>Cliquez sur "Nouveau ticket" pour signaler un bug ou suggérer une fonctionnalité.</div>}
              </Card>
            ):filteredTickets.map(tk=>{
              const st=SUPPORT_TICKET_STATUTS[tk.statut]||SUPPORT_TICKET_STATUTS.ouvert;
              const tp=SUPPORT_TYPES[tk.type]||SUPPORT_TYPES.autre;
              const isClickable=isAdmin;
              return(
                <Card key={tk.id} style={{padding:14,cursor:isClickable?"pointer":"default"}} onClick={isClickable?()=>setEditTicket(tk):undefined}>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:tp.color}}>{tp.label}</span>
                    <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,textTransform:"uppercase",letterSpacing:0.4}}>{st.label}</span>
                    <span style={{fontSize:10,color:L.textXs,fontWeight:600}}>{tk.priorite}</span>
                    {isAdmin&&tk.email&&<span style={{fontSize:10,color:L.textXs,fontFamily:"monospace"}}>{tk.email}</span>}
                    <span style={{fontSize:10,color:L.textXs,marginLeft:"auto"}}>{new Date(tk.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:L.text,marginBottom:4}}>{tk.titre}</div>
                  {tk.metadata&&Object.keys(tk.metadata).length>0&&(
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                      {tk.metadata.page&&<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,background:L.bg,color:L.textSm}}>📍 {tk.metadata.page}</span>}
                      {tk.metadata.appareil&&<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,background:L.bg,color:L.textSm}}>📱 {tk.metadata.appareil}</span>}
                      {tk.metadata.gravite&&<span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,background:tk.metadata.gravite==="Bloquant"?"#FEE2E2":tk.metadata.gravite==="Gênant"?"#FEF3C7":L.bg,color:tk.metadata.gravite==="Bloquant"?L.red:tk.metadata.gravite==="Gênant"?L.orange:L.textSm}}>🔥 {tk.metadata.gravite}</span>}
                      {tk.metadata.module&&<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,background:L.bg,color:L.textSm}}>📦 {tk.metadata.module}</span>}
                      {tk.metadata.priorite_utilisateur&&<span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,background:tk.metadata.priorite_utilisateur==="Indispensable"?L.greenBg||"#D1FAE5":L.bg,color:tk.metadata.priorite_utilisateur==="Indispensable"?L.green:L.textSm}}>⭐ {tk.metadata.priorite_utilisateur}</span>}
                    </div>
                  )}
                  <div style={{fontSize:12,color:L.textSm,whiteSpace:"pre-wrap",lineHeight:1.5}}>{tk.description}</div>
                  {tk.reponse_admin&&(()=>{
                    const isEscalade=tk.reponse_par==="ia"&&tk.reponse_admin.startsWith("[escalade IA]");
                    const isIA=tk.reponse_par==="ia"&&!isEscalade;
                    const color=isEscalade?L.orange:isIA?L.purple:L.green;
                    const label=isEscalade?"🤖 IA → escalade admin":isIA?"🤖 Répondu par IA":"💬 Répondu par Marco";
                    // Pour les non-admin : si escalade, on remplace le résumé interne
                    // (qui parle à Marco) par un message rassurant pour le client
                    const visibleText=isEscalade
                      ?(isAdmin?tk.reponse_admin:"Votre demande a été transmise à notre équipe — un humain va y répondre prochainement.")
                      :tk.reponse_admin;
                    return(
                      <div style={{marginTop:10,padding:"10px 12px",background:L.bg,borderLeft:`3px solid ${color}`,borderRadius:6}}>
                        <div style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:0.4,marginBottom:4}}>
                          {label}{tk.reponse_at?` · ${new Date(tk.reponse_at).toLocaleDateString("fr-FR")}`:""}
                        </div>
                        <div style={{fontSize:12,color:L.text,whiteSpace:"pre-wrap",lineHeight:1.5}}>{visibleText}</div>
                      </div>
                    );
                  })()}
                  {isAdmin&&!tk.reponse_admin&&<div style={{marginTop:8,fontSize:11,color:L.accent,fontWeight:600}}>👆 Cliquer pour répondre</div>}
                </Card>
              );
            })}
          </div>
        </>
      ):tab==="roadmap"?(
        <>
          {isAdmin&&(
            <div style={{marginBottom:12,display:"flex",justifyContent:"flex-end"}}>
              <Btn onClick={()=>setEditRoadmap({})} variant="primary" icon="➕">Ajouter un item</Btn>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {roadmap.length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>Aucun item de roadmap.</Card>
            ):roadmap.map(item=>{
              const st=ROADMAP_STATUTS[item.statut]||ROADMAP_STATUTS.planifie;
              const hasVoted=(item.voters||[]).includes(voterId);
              return(
                <Card key={item.id} style={{padding:14,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <button onClick={async()=>{
                    if(hasVoted||!voterId||!supabase)return;
                    const {data,error}=await supabase.rpc("vote_item",{p_table:"roadmap",p_item_id:item.id,p_voter:voterId});
                    if(!error){setRoadmap(rs=>rs.map(r=>r.id===item.id?{...r,votes:data??r.votes+1,voters:[...(r.voters||[]),voterId]}:r));}
                  }} disabled={hasVoted}
                    style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${hasVoted?L.green:L.border}`,background:hasVoted?L.greenBg||"#D1FAE5":L.surface,color:hasVoted?L.green:L.text,cursor:hasVoted?"default":"pointer",fontFamily:"inherit",minWidth:50}}>
                    <span style={{fontSize:18}}>{hasVoted?"✓":"👍"}</span>
                    <span style={{fontSize:13,fontWeight:700}}>{item.votes||0}</span>
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:L.text}}>{ROADMAP_TYPE_ICONS[item.type]||"✨"} {item.titre}</span>
                      <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,textTransform:"uppercase",letterSpacing:0.4}}>{st.label}</span>
                      {item.livre_le&&<span style={{fontSize:10,color:L.textXs}}>livré le {new Date(item.livre_le).toLocaleDateString("fr-FR")}</span>}
                      {isAdmin&&(
                        <span style={{marginLeft:"auto",display:"flex",gap:4}}>
                          <button onClick={()=>setEditRoadmap(item)} title="Modifier" style={{padding:"3px 8px",border:`1px solid ${L.border}`,borderRadius:5,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                          <button onClick={async()=>{if(window.confirm(`Supprimer "${item.titre}" ?`)){await supabase.from("roadmap").delete().eq("id",item.id);reload();}}} title="Supprimer" style={{padding:"3px 8px",border:`1px solid ${L.red}55`,borderRadius:5,background:"transparent",color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                        </span>
                      )}
                    </div>
                    {item.description&&<div style={{fontSize:12,color:L.textSm,lineHeight:1.5}}>{item.description}</div>}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ):tab==="annonces"?(
        <>
          {isAdmin&&(
            <div style={{marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:12,color:L.textSm}}>Les patrons verront un pop-up "Nouveautés" au login (Phase 4).</div>
              <Btn onClick={()=>setEditAnnounce({})} variant="primary" icon="📢">Publier une annonce</Btn>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {announcements.length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>Aucune annonce publiée.</Card>
            ):announcements.map(an=>(
              <Card key={an.id} style={{padding:14}}>
                <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontSize:18}}>{an.icone||"✨"}</span>
                  <span style={{fontSize:14,fontWeight:700,color:L.text}}>{an.titre}</span>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,...(an.publie?{background:L.greenBg,color:L.green}:{background:"#FEE2E2",color:L.red})}}>{an.publie?"Publié":"Brouillon"}</span>
                  <span style={{fontSize:10,color:L.textXs,marginLeft:"auto"}}>{new Date(an.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
                {an.description&&<div style={{fontSize:12,color:L.textSm,lineHeight:1.5,marginBottom:6}}>{an.description}</div>}
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  <button onClick={()=>setEditAnnounce(an)} style={{padding:"3px 10px",border:`1px solid ${L.border}`,borderRadius:5,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️ Modifier</button>
                  <button onClick={async()=>{if(window.confirm(`Supprimer l'annonce "${an.titre}" ?`)){await supabase.from("announcements").delete().eq("id",an.id);reload();}}} style={{padding:"3px 10px",border:`1px solid ${L.red}55`,borderRadius:5,background:"transparent",color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕ Supprimer</button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ):(
        /* FAQ */
        <>
          {isAdmin&&(
            <div style={{marginBottom:12,display:"flex",justifyContent:"flex-end"}}>
              <Btn onClick={()=>setEditFaq({})} variant="primary" icon="➕">Ajouter une FAQ</Btn>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {faq.filter(f=>isAdmin||f.active).length===0?(
              <Card style={{padding:30,textAlign:"center",color:L.textSm}}>Aucune FAQ pour le moment.</Card>
            ):faq.filter(f=>isAdmin||f.active).map(f=>(
              <Card key={f.id} style={{padding:14,opacity:f.active?1:0.6}}>
                <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                  <div style={{fontSize:13,fontWeight:700,color:L.navy}}>❓ {f.question}</div>
                  {!f.active&&<span style={{fontSize:9,color:L.textXs,fontWeight:700,background:L.bg,padding:"1px 6px",borderRadius:4}}>INACTIVE</span>}
                  {isAdmin&&(
                    <span style={{marginLeft:"auto",display:"flex",gap:4}}>
                      <button onClick={()=>setEditFaq(f)} title="Modifier" style={{padding:"3px 8px",border:`1px solid ${L.border}`,borderRadius:5,background:L.surface,color:L.orange,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                      <button onClick={async()=>{if(window.confirm(`Supprimer la FAQ "${f.question.slice(0,50)}…" ?`)){await supabase.from("faq").delete().eq("id",f.id);reload();}}} title="Supprimer" style={{padding:"3px 8px",border:`1px solid ${L.red}55`,borderRadius:5,background:"transparent",color:L.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                    </span>
                  )}
                </div>
                <div style={{fontSize:12,color:L.textSm,whiteSpace:"pre-wrap",lineHeight:1.6}}>{f.reponse}</div>
                {isAdmin&&f.keywords?.length>0&&<div style={{fontSize:10,color:L.textXs,marginTop:6,fontStyle:"italic"}}>Mots-clés : {f.keywords.join(", ")}</div>}
              </Card>
            ))}
          </div>
        </>
      )}

      {showNouveau&&<NouveauTicketModal authUser={authUser} onClose={()=>setShowNouveau(false)} onSaved={()=>{setShowNouveau(false);reload();}}/>}
      {editTicket&&<TicketReplyModal ticket={editTicket} onClose={()=>setEditTicket(null)} onSaved={()=>{setEditTicket(null);reload();}}/>}
      {editRoadmap!==null&&<RoadmapEditModal item={editRoadmap} onClose={()=>setEditRoadmap(null)} onSaved={()=>{setEditRoadmap(null);reload();}}/>}
      {editAnnounce!==null&&<AnnouncementEditModal item={editAnnounce} onClose={()=>setEditAnnounce(null)} onSaved={()=>{setEditAnnounce(null);reload();}}/>}
      {editFaq!==null&&<FaqEditModal item={editFaq} onClose={()=>setEditFaq(null)} onSaved={()=>{setEditFaq(null);reload();}}/>}
    </div>
  );
}

// ─── Modale réponse à un ticket (admin) ─────────────────────────────────────
function TicketReplyModal({ticket,onClose,onSaved}){
  const [reponse,setReponse]=useState(ticket.reponse_par==="admin"?ticket.reponse_admin||"":"");
  const [statut,setStatut]=useState(ticket.statut);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  async function save(){
    setError("");setSubmitting(true);
    const patch={statut};
    if(reponse.trim()){
      patch.reponse_admin=reponse.trim();
      patch.reponse_par="admin";
      patch.reponse_at=new Date().toISOString();
    }
    const {error:err}=await supabase.from("tickets").update(patch).eq("id",ticket.id);
    setSubmitting(false);
    if(err){setError(`Erreur : ${err.message}`);return;}
    onSaved();
  }
  const tp=SUPPORT_TYPES[ticket.type]||SUPPORT_TYPES.autre;
  const inp={width:"100%",padding:"9px 11px",fontSize:13,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6};
  return(
    <Modal title={`Ticket #${ticket.id} — ${ticket.titre}`} onClose={onClose} maxWidth={620}>
      <div style={{background:L.bg,borderRadius:8,padding:12,marginBottom:14}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"baseline",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:tp.color}}>{tp.label}</span>
          <span style={{fontSize:10,color:L.textXs,fontWeight:600}}>priorité {ticket.priorite}</span>
          <span style={{fontSize:10,color:L.textXs,fontFamily:"monospace"}}>{ticket.email}</span>
          <span style={{fontSize:10,color:L.textXs,marginLeft:"auto"}}>{new Date(ticket.created_at).toLocaleString("fr-FR")}</span>
        </div>
        {ticket.metadata&&Object.keys(ticket.metadata).length>0&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {Object.entries(ticket.metadata).filter(([,v])=>v).map(([k,v])=>(
              <span key={k} style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:5,background:"#fff",border:`1px solid ${L.border}`,color:L.text}}>
                <span style={{color:L.textSm,marginRight:4}}>{k.replace(/_/g," ")} :</span>{v}
              </span>
            ))}
          </div>
        )}
        <div style={{fontSize:13,color:L.text,whiteSpace:"pre-wrap",lineHeight:1.5}}>{ticket.description}</div>
      </div>
      {ticket.reponse_admin&&ticket.reponse_par==="ia"&&(()=>{
        const isEscalade=ticket.reponse_admin.startsWith("[escalade IA]");
        const color=isEscalade?L.orange:L.purple;
        const bg=isEscalade?"#FEF3C7":"#F5F3FF";
        const label=isEscalade?"🤖 Escalade IA — résumé interne (non visible côté client)":"🤖 Réponse IA envoyée au client";
        return(
          <div style={{marginBottom:14,padding:"10px 12px",background:bg,borderLeft:`3px solid ${color}`,borderRadius:6}}>
            <div style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:0.4,marginBottom:4}}>{label}</div>
            <div style={{fontSize:12,color:L.text,whiteSpace:"pre-wrap",lineHeight:1.5}}>{ticket.reponse_admin}</div>
          </div>
        );
      })()}
      <div style={{marginBottom:12}}>
        <label style={lbl}>Statut</label>
        <select value={statut} onChange={e=>setStatut(e.target.value)} style={inp}>
          {Object.entries(SUPPORT_TICKET_STATUTS).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
        </select>
      </div>
      <div style={{marginBottom:14}}>
        <label style={lbl}>Réponse au client {ticket.reponse_par==="admin"?"(modification)":""}</label>
        <textarea value={reponse} onChange={e=>setReponse(e.target.value)} rows={6} maxLength={3000} style={{...inp,resize:"vertical",minHeight:120}} placeholder="Tape ta réponse — visible par le client à sa prochaine consultation. Laisse vide si tu changes juste le statut."/>
        <div style={{fontSize:10,color:L.textXs,marginTop:4,fontStyle:"italic"}}>📧 Notification email au client : pas encore activée (Resend/SendGrid à configurer).</div>
      </div>
      {error&&<div style={{background:"#FEE2E2",color:L.red,padding:10,borderRadius:7,fontSize:12,marginBottom:10}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
        <button onClick={async()=>{if(window.confirm(`Supprimer le ticket #${ticket.id} ?`)){await supabase.from("tickets").delete().eq("id",ticket.id);onSaved();}}}
          style={{padding:"8px 14px",border:`1px solid ${L.red}55`,borderRadius:7,background:"transparent",color:L.red,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Supprimer</button>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={onClose} variant="secondary">Annuler</Btn>
          <Btn onClick={save} variant="primary" disabled={submitting} icon={submitting?"⏳":"💾"}>{submitting?"Enregistrement…":"Enregistrer"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modale édition roadmap (admin) ────────────────────────────────────────
function RoadmapEditModal({item,onClose,onSaved}){
  const isNew=!item.id;
  const [titre,setTitre]=useState(item.titre||"");
  const [description,setDescription]=useState(item.description||"");
  const [type,setType]=useState(item.type||"feature");
  const [statut,setStatut]=useState(item.statut||"planifie");
  const [livreLe,setLivreLe]=useState(item.livre_le||"");
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  async function save(){
    setError("");
    if(!titre.trim()){setError("Titre obligatoire.");return;}
    setSubmitting(true);
    const payload={titre:titre.trim(),description:description.trim()||null,type,statut,livre_le:livreLe||null};
    const {error:err}=isNew
      ?await supabase.from("roadmap").insert(payload)
      :await supabase.from("roadmap").update(payload).eq("id",item.id);
    setSubmitting(false);
    if(err){setError(`Erreur : ${err.message}`);return;}
    onSaved();
  }
  const inp={width:"100%",padding:"9px 11px",fontSize:13,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6};
  return(
    <Modal title={isNew?"Ajouter à la roadmap":`Modifier : ${item.titre}`} onClose={onClose} maxWidth={520}>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Titre</label>
        <input value={titre} onChange={e=>setTitre(e.target.value)} maxLength={140} style={inp} placeholder="Ex : Module Gantt avec drag & drop"/>
      </div>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Description</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={1000} style={{...inp,resize:"vertical",minHeight:70}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div>
          <label style={lbl}>Type</label>
          <select value={type} onChange={e=>setType(e.target.value)} style={inp}>
            <option value="feature">✨ Nouvelle fonctionnalité</option>
            <option value="bug_fix">🔧 Correction</option>
            <option value="improvement">⚡ Amélioration</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Statut</label>
          <select value={statut} onChange={e=>setStatut(e.target.value)} style={inp}>
            {Object.entries(ROADMAP_STATUTS).map(([v,c])=><option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={lbl}>Date de livraison (optionnelle)</label>
        <input type="date" value={livreLe} onChange={e=>setLivreLe(e.target.value)} style={inp}/>
      </div>
      {error&&<div style={{background:"#FEE2E2",color:L.red,padding:10,borderRadius:7,fontSize:12,marginBottom:10}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={onClose} variant="secondary">Annuler</Btn>
        <Btn onClick={save} variant="primary" disabled={submitting} icon={submitting?"⏳":"💾"}>{submitting?"…":isNew?"Ajouter":"Enregistrer"}</Btn>
      </div>
    </Modal>
  );
}

// ─── Modale édition annonce (admin) ────────────────────────────────────────
function AnnouncementEditModal({item,onClose,onSaved}){
  const isNew=!item.id;
  const [titre,setTitre]=useState(item.titre||"");
  const [description,setDescription]=useState(item.description||"");
  const [icone,setIcone]=useState(item.icone||"✨");
  const [type,setType]=useState(item.type||"feature");
  const [url,setUrl]=useState(item.url||"");
  const [publie,setPublie]=useState(item.publie!==false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  async function save(){
    setError("");
    if(!titre.trim()){setError("Titre obligatoire.");return;}
    setSubmitting(true);
    const payload={titre:titre.trim(),description:description.trim()||null,icone:icone||"✨",type,url:url.trim()||null,publie};
    const {error:err}=isNew
      ?await supabase.from("announcements").insert(payload)
      :await supabase.from("announcements").update(payload).eq("id",item.id);
    setSubmitting(false);
    if(err){setError(`Erreur : ${err.message}`);return;}
    onSaved();
  }
  const inp={width:"100%",padding:"9px 11px",fontSize:13,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6};
  return(
    <Modal title={isNew?"Publier une annonce":`Modifier : ${item.titre}`} onClose={onClose} maxWidth={520}>
      <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:10,marginBottom:12}}>
        <div>
          <label style={lbl}>Icône</label>
          <input value={icone} onChange={e=>setIcone(e.target.value)} maxLength={4} style={{...inp,fontSize:18,textAlign:"center"}} placeholder="✨"/>
        </div>
        <div>
          <label style={lbl}>Titre</label>
          <input value={titre} onChange={e=>setTitre(e.target.value)} maxLength={140} style={inp} placeholder="Ex : Signature électronique disponible"/>
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Description</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={500} style={{...inp,resize:"vertical",minHeight:70}} placeholder="Court texte affiché dans le pop-up de nouveautés."/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div>
          <label style={lbl}>Type</label>
          <select value={type} onChange={e=>setType(e.target.value)} style={inp}>
            <option value="feature">✨ Fonctionnalité</option>
            <option value="bug_fix">🔧 Correction</option>
            <option value="improvement">⚡ Amélioration</option>
            <option value="info">ℹ️ Info</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Lien (optionnel)</label>
          <input value={url} onChange={e=>setUrl(e.target.value)} style={inp} placeholder="https://… ou /support"/>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
          <input type="checkbox" checked={publie} onChange={e=>setPublie(e.target.checked)}/>
          Publier maintenant (les patrons verront un pop-up au prochain login)
        </label>
      </div>
      {error&&<div style={{background:"#FEE2E2",color:L.red,padding:10,borderRadius:7,fontSize:12,marginBottom:10}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={onClose} variant="secondary">Annuler</Btn>
        <Btn onClick={save} variant="primary" disabled={submitting} icon={submitting?"⏳":"💾"}>{submitting?"…":isNew?"Publier":"Enregistrer"}</Btn>
      </div>
    </Modal>
  );
}

// ─── Modale édition FAQ (admin) ────────────────────────────────────────────
function FaqEditModal({item,onClose,onSaved}){
  const isNew=!item.id;
  const [question,setQuestion]=useState(item.question||"");
  const [reponse,setReponse]=useState(item.reponse||"");
  const [keywords,setKeywords]=useState((item.keywords||[]).join(", "));
  const [active,setActive]=useState(item.active!==false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  async function save(){
    setError("");
    if(!question.trim()||!reponse.trim()){setError("Question et réponse obligatoires.");return;}
    setSubmitting(true);
    const kwArr=keywords.split(",").map(k=>k.trim()).filter(Boolean);
    const payload={question:question.trim(),reponse:reponse.trim(),keywords:kwArr,active};
    const {error:err}=isNew
      ?await supabase.from("faq").insert(payload)
      :await supabase.from("faq").update(payload).eq("id",item.id);
    setSubmitting(false);
    if(err){setError(`Erreur : ${err.message}`);return;}
    onSaved();
  }
  const inp={width:"100%",padding:"9px 11px",fontSize:13,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6};
  return(
    <Modal title={isNew?"Ajouter une FAQ":`Modifier : ${item.question.slice(0,40)}…`} onClose={onClose} maxWidth={620}>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Question</label>
        <input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={200} style={inp} placeholder="Ex : Comment créer un devis avec l'IA ?"/>
      </div>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Réponse</label>
        <textarea value={reponse} onChange={e=>setReponse(e.target.value)} rows={5} maxLength={2000} style={{...inp,resize:"vertical",minHeight:100}} placeholder="Réponse claire et complète. L'agent IA réutilisera ce texte pour répondre aux tickets correspondants."/>
      </div>
      <div style={{marginBottom:12}}>
        <label style={lbl}>Mots-clés (séparés par virgule)</label>
        <input value={keywords} onChange={e=>setKeywords(e.target.value)} style={inp} placeholder="devis, ia, créer, rapide"/>
        <div style={{fontSize:10,color:L.textXs,marginTop:4,fontStyle:"italic"}}>L'IA utilise ces mots-clés pour matcher les tickets entrants.</div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
          <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>
          Active (visible par les utilisateurs et utilisée par l'IA)
        </label>
      </div>
      {error&&<div style={{background:"#FEE2E2",color:L.red,padding:10,borderRadius:7,fontSize:12,marginBottom:10}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={onClose} variant="secondary">Annuler</Btn>
        <Btn onClick={save} variant="primary" disabled={submitting} icon={submitting?"⏳":"💾"}>{submitting?"…":isNew?"Ajouter":"Enregistrer"}</Btn>
      </div>
    </Modal>
  );
}

function NouveauTicketModal({authUser,onClose,onSaved}){
  const [type,setType]=useState("bug");
  const [description,setDescription]=useState("");
  const [meta,setMeta]=useState({});
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const cfg=SUPPORT_FIELDS[type]||SUPPORT_FIELDS.autre;
  // Reset metadata + description quand on change de type (les champs sont différents)
  function changeType(t){setType(t);setMeta({});setDescription("");setError("");}
  async function submit(){
    setError("");
    if(!description.trim()){setError(`"${cfg.description.label}" obligatoire.`);return;}
    // Vérif champs obligatoires (selects)
    for(const s of cfg.selects){
      if(!meta[s.key]){setError(`"${s.label}" obligatoire.`);return;}
    }
    setSubmitting(true);
    let r;
    try{
      r=await fetch("/api/submit-ticket",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          user_id:authUser?.id||null,
          email:(authUser?.email||"").trim().toLowerCase()||"anonyme@chantierpro",
          type,
          description:description.trim(),
          metadata:meta,
        }),
      });
    }catch{
      setSubmitting(false);
      setError("Erreur réseau. Vérifie ta connexion.");
      return;
    }
    const data=await r.json().catch(()=>({}));
    setSubmitting(false);
    if(!r.ok){setError(data?.error||`Erreur HTTP ${r.status}`);return;}
    onSaved(data);
  }
  const inp={width:"100%",padding:"9px 11px",fontSize:13,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const lbl={display:"block",fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6};
  return(
    <Modal title="Nouveau ticket" onClose={onClose} maxWidth={560}>
      <div style={{marginBottom:14}}>
        <label style={lbl}>Type de demande</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {Object.entries(SUPPORT_TYPES).map(([v,t])=>(
            <button key={v} onClick={()=>changeType(v)} style={{padding:"7px 12px",borderRadius:7,border:`1.5px solid ${type===v?t.color:L.border}`,background:type===v?t.color+"15":L.surface,color:type===v?t.color:L.text,fontWeight:type===v?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Selects type-spécifiques (rendus dans une grille 2 colonnes auto) */}
      {cfg.selects.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:cfg.selects.length>1?"1fr 1fr":"1fr",gap:10,marginBottom:12}}>
          {cfg.selects.map(s=>(
            <div key={s.key} style={{gridColumn:cfg.selects.length===3&&s.key===cfg.selects[2].key?"1 / -1":undefined}}>
              <label style={lbl}>{s.label}</label>
              <select value={meta[s.key]||""} onChange={e=>setMeta(m=>({...m,[s.key]:e.target.value}))} style={inp}>
                <option value="">— Choisir —</option>
                {s.options.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <div style={{marginBottom:14}}>
        <label style={lbl}>{cfg.description.label}</label>
        <textarea value={description} onChange={e=>setDescription(e.target.value.slice(0,cfg.description.max))} rows={4} maxLength={cfg.description.max} style={{...inp,resize:"vertical",minHeight:90}} placeholder={cfg.description.placeholder}/>
        <div style={{fontSize:10,color:L.textXs,marginTop:4,textAlign:"right"}}>{description.length} / {cfg.description.max}</div>
      </div>

      {error&&<div style={{background:"#FEE2E2",color:L.red,padding:10,borderRadius:7,fontSize:12,marginBottom:10}}>{error}</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn onClick={onClose} variant="secondary">Annuler</Btn>
        <Btn onClick={submit} variant="primary" disabled={submitting} icon={submitting?"⏳":"📨"}>{submitting?"Envoi…":"Envoyer le ticket"}</Btn>
      </div>
    </Modal>
  );
}

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

// ─── MODÈLE DEVIS : presets + utilitaires de mise en page ───────────────────
const MODELE_DEVIS_DEFAULT={
  preset:"classique",primaryColor:"#1B3A5C",font:"sans",logoPosition:"left",
  showNumero:true,showDate:true,showConditions:true,showMentions:true,showSignature:false,
  introText:"Suite à votre demande, nous avons le plaisir de vous proposer le devis suivant.",
  conclusionText:"Devis établi en deux exemplaires. Valable 30 jours à compter de sa date d'émission. Bon pour accord, signature précédée de la mention « Bon pour accord ».",
  footerText:"RC Pro & garantie décennale souscrites. SIRET indiqué en en-tête. TVA non applicable, art. 293B du CGI (le cas échéant).",
};
const MODELE_PRESETS={
  classique:{preset:"classique",primaryColor:"#1B3A5C",font:"sans"},
  moderne:{preset:"moderne",primaryColor:"#0F172A",font:"moderne"},
  epure:{preset:"epure",primaryColor:"#475569",font:"serif"},
};
function getModele(entreprise){return{...MODELE_DEVIS_DEFAULT,...(entreprise?.modeleDevis||{})};}
function fontFamilyFor(font){
  if(font==="serif")return"'Georgia','Times New Roman',serif";
  if(font==="moderne")return"'Inter','SF Pro Display','Segoe UI',sans-serif";
  return"'Segoe UI','Plus Jakarta Sans',Arial,sans-serif";
}
function VueParametres({authUser,entreprise,setEntreprise,statut,setStatut,onClose,onExportJSON,onImportJSON,onImportCSV,onChangeNotifsRead}){
  const isAdmin=(authUser?.email||"").trim().toLowerCase()===SUPPORT_ADMIN_EMAIL;
  const [tab,setTab]=useState("profil");
  const [form,setForm]=useState({...entreprise,modeleDevis:getModele(entreprise)});
  const [stat,setStat]=useState(statut);
  const [logoErr,setLogoErr]=useState(null);
  const [importStatus,setImportStatus]=useState(null);
  function save(){setEntreprise({...form,nomCourt:form.nomCourt||(form.nom||"").split(" ").slice(0,2).join(" ")});setStatut(stat);onClose();}
  function updModele(k,v){setForm(f=>({...f,modeleDevis:{...getModele(f),[k]:v}}));}
  function applyPreset(name){
    const p=MODELE_PRESETS[name];
    if(!p)return;
    setForm(f=>({...f,modeleDevis:{...getModele(f),...p}}));
  }
  const modele=getModele(form);
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
    <Modal title="⚙️ Paramètres" onClose={onClose} maxWidth={680}>
      <Tabs tabs={[{id:"profil",icon:"🏢",label:"Profil entreprise"},{id:"modele",icon:"🎨",label:"Modèle devis"},{id:"integrations",icon:"🔗",label:"Intégrations"},...(isAdmin?[{id:"agents",icon:"🤖",label:"Agents IA (admin)"}]:[])]} active={tab} onChange={setTab}/>
      {tab==="agents"&&isAdmin&&<VueAgents authUser={authUser} entreprise={entreprise} setEntreprise={setEntreprise} onChangeRead={onChangeNotifsRead}/>}
      {tab==="integrations"&&(()=>{
        const ig=form.integrations||{};
        function updIg(k,v){setForm(f=>({...f,integrations:{...(f.integrations||{}),[k]:v}}));}
        const lblSt={fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4,display:"block"};
        const inpSt={width:"100%",padding:"8px 11px",border:`1px solid ${L.border}`,borderRadius:7,fontSize:12,fontFamily:"monospace",outline:"none",background:L.surface,color:L.text,boxSizing:"border-box"};
        return(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{padding:"10px 13px",background:L.navyBg,borderRadius:8,fontSize:11,color:L.navy,lineHeight:1.5}}>
              🔒 Vos tokens sont stockés chiffrés en base Supabase (RLS user-only). Ils ne sont utilisés que pour les appels sortants depuis votre compte. Ne les partagez jamais.
            </div>
            {/* Qonto */}
            <Card style={{padding:14,border:`1px solid ${L.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:20}}>🏦</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:L.text}}>Qonto</div>
                  <div style={{fontSize:10,color:L.textSm}}>Envoi automatique des factures fournisseurs scannées</div>
                </div>
                {ig.qontoToken&&<span style={{background:L.greenBg,color:L.green,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>✓ Configuré</span>}
              </div>
              <label style={lblSt}>Slug organisation Qonto <span style={{color:L.textXs,fontWeight:400}}>(ex: ma-boite-1234)</span></label>
              <input value={ig.qontoOrgSlug||""} onChange={e=>updIg("qontoOrgSlug",e.target.value)} placeholder="ma-boite-1234" style={inpSt}/>
              <label style={{...lblSt,marginTop:10}}>Clé secrète API Qonto</label>
              <input type="password" value={ig.qontoToken||""} onChange={e=>updIg("qontoToken",e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={inpSt} autoComplete="off"/>
              <a href="https://app.qonto.com/settings/integrations" target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:8,fontSize:11,color:L.blue,textDecoration:"none"}}>↗ Comment obtenir mon token Qonto</a>
            </Card>
            {/* Pennylane */}
            <Card style={{padding:14,border:`1px solid ${L.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:20}}>📊</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:L.text}}>Pennylane</div>
                  <div style={{fontSize:10,color:L.textSm}}>Synchronisation comptable (en préparation)</div>
                </div>
                {ig.pennylaneToken&&<span style={{background:L.greenBg,color:L.green,padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>✓ Configuré</span>}
              </div>
              <label style={lblSt}>Token API Pennylane</label>
              <input type="password" value={ig.pennylaneToken||""} onChange={e=>updIg("pennylaneToken",e.target.value)} placeholder="pl_live_xxxxxxxx" style={inpSt} autoComplete="off"/>
              <a href="https://pennylane.readme.io/docs/getting-started" target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:8,fontSize:11,color:L.blue,textDecoration:"none"}}>↗ Comment obtenir mon token Pennylane</a>
            </Card>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${L.border}`}}>
              <Btn onClick={onClose} variant="secondary">Annuler</Btn>
              <Btn onClick={save} variant="success">✓ Enregistrer</Btn>
            </div>
          </div>
        );
      })()}
      {tab==="modele"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* 3 modèles prédéfinis */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>Modèles prédéfinis (point de départ)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[
                {id:"classique",l:"Classique navy",c:"#1B3A5C"},
                {id:"moderne",l:"Moderne noir",c:"#0F172A"},
                {id:"epure",l:"Épuré gris",c:"#475569"},
              ].map(p=>(
                <button key={p.id} onClick={()=>applyPreset(p.id)} style={{padding:"10px 12px",borderRadius:8,border:`2px solid ${modele.preset===p.id?p.c:L.border}`,background:modele.preset===p.id?p.c+"15":L.surface,color:modele.preset===p.id?p.c:L.textMd,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit",textAlign:"left"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{display:"inline-block",width:14,height:14,borderRadius:3,background:p.c}}/>
                    <span>{p.l}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Couleur principale</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={modele.primaryColor} onChange={e=>updModele("primaryColor",e.target.value)} style={{width:42,height:34,border:"none",background:"transparent",cursor:"pointer",padding:0}}/>
                <span style={{fontFamily:"monospace",fontSize:12,color:L.textMd}}>{modele.primaryColor}</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Police de caractères</div>
              <select value={modele.font} onChange={e=>updModele("font",e.target.value)} style={{width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,fontFamily:fontFamilyFor(modele.font),background:L.surface,outline:"none"}}>
                <option value="sans">Sans-serif (Segoe UI)</option>
                <option value="serif">Serif (Georgia)</option>
                <option value="moderne">Moderne (Inter)</option>
              </select>
            </div>
            <div style={{gridColumn:"span 2"}}>
              <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Position du logo</div>
              <div style={{display:"flex",gap:6}}>
                {[{v:"left",l:"⬅ Gauche"},{v:"center",l:"⬛ Centre"},{v:"right",l:"➡ Droite"}].map(p=>(
                  <button key={p.v} onClick={()=>updModele("logoPosition",p.v)} style={{flex:1,padding:"7px 9px",borderRadius:6,border:`1px solid ${modele.logoPosition===p.v?modele.primaryColor:L.border}`,background:modele.logoPosition===p.v?modele.primaryColor+"15":L.surface,color:modele.logoPosition===p.v?modele.primaryColor:L.textMd,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{p.l}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>Éléments à afficher</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,fontSize:12}}>
              {[
                ["showNumero","Numéro du devis"],
                ["showDate","Date d'émission"],
                ["showConditions","Conditions de règlement"],
                ["showMentions","Mentions légales (pied)"],
                ["showSignature","Bloc signature client"],
              ].map(([k,l])=>(
                <label key={k} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 9px",border:`1px solid ${L.border}`,borderRadius:6,cursor:"pointer",background:modele[k]?modele.primaryColor+"08":L.surface}}>
                  <input type="checkbox" checked={!!modele[k]} onChange={e=>updModele(k,e.target.checked)}/>
                  <span style={{fontWeight:600,color:modele[k]?modele.primaryColor:L.textSm}}>{l}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Texte d'introduction</div>
            <textarea value={modele.introText} onChange={e=>updModele("introText",e.target.value)} rows={2} placeholder="Suite à votre demande…" style={{width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.4}}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Texte de conclusion</div>
            <textarea value={modele.conclusionText} onChange={e=>updModele("conclusionText",e.target.value)} rows={2} placeholder="Valable 30 jours…" style={{width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.4}}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:4}}>Mentions légales / pied de page</div>
            <textarea value={modele.footerText} onChange={e=>updModele("footerText",e.target.value)} rows={2} placeholder="RC Pro, décennale…" style={{width:"100%",padding:"7px 10px",border:`1px solid ${L.border}`,borderRadius:6,fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",lineHeight:1.4}}/>
          </div>
          {/* Preview miniature */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:L.textMd,marginBottom:6}}>Aperçu en direct</div>
            <ModelePreview modele={modele} entreprise={form}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${L.border}`}}>
            <Btn onClick={onClose} variant="secondary">Annuler</Btn>
            <Btn onClick={save} variant="success">✓ Enregistrer</Btn>
          </div>
        </div>
      )}
      {tab==="profil"&&(
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
      )}
    </Modal>
  );
}

// Aperçu miniature du modèle de devis (utilisé dans Paramètres → Modèle devis).
function ModelePreview({modele,entreprise}){
  const ff=fontFamilyFor(modele.font);
  const c=modele.primaryColor||"#1B3A5C";
  const headerJustify=modele.logoPosition==="center"?"center":(modele.logoPosition==="right"?"flex-end":"flex-start");
  return(
    <div style={{border:`1px solid ${L.borderMd}`,borderRadius:6,padding:14,background:"#fff",fontFamily:ff,fontSize:11,lineHeight:1.5,color:"#1E293B"}}>
      <div style={{display:"flex",justifyContent:modele.logoPosition==="center"?"center":"space-between",alignItems:"flex-start",marginBottom:8,paddingBottom:8,borderBottom:`2px solid ${c}`,gap:10,flexDirection:modele.logoPosition==="center"?"column":"row"}}>
        <div style={{order:modele.logoPosition==="right"?2:1,display:"flex",justifyContent:headerJustify,flex:modele.logoPosition==="center"?"none":1}}>
          {entreprise?.logo
            ? <img src={entreprise.logo} alt="logo" style={{maxHeight:40,maxWidth:120,objectFit:"contain"}}/>
            : <div style={{fontSize:14,fontWeight:900,color:c}}>{entreprise?.nomCourt||entreprise?.nom||"Mon Entreprise"}</div>}
        </div>
        <div style={{order:modele.logoPosition==="right"?1:2,textAlign:modele.logoPosition==="center"?"center":"right",fontSize:9,color:"#64748B"}}>
          <div style={{fontSize:11,fontWeight:800,color:c}}>{entreprise?.nom||"Mon Entreprise"}</div>
          {entreprise?.tel&&<div>{entreprise.tel}</div>}
          {entreprise?.email&&<div>{entreprise.email}</div>}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:800,color:c,textTransform:"uppercase"}}>DEVIS{modele.showNumero?" N° DEV-12345":""}</div>
        {modele.showDate&&<div style={{color:"#475569",fontSize:10}}>2026-05-02</div>}
      </div>
      <div style={{background:"#F8FAFC",borderRadius:5,padding:"6px 9px",marginBottom:8,fontSize:10}}>
        <div style={{fontWeight:700,color:c}}>Client : SARL Exemple</div>
        <div style={{color:"#475569",fontStyle:"italic"}}>Objet : Rénovation salle de bain</div>
      </div>
      {modele.introText&&<div style={{fontSize:10,color:"#475569",marginBottom:8,fontStyle:"italic"}}>{modele.introText}</div>}
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:8,fontSize:9}}>
        <thead><tr style={{background:c,color:"#fff"}}>{["Désignation","Qté","P.U.","Total"].map(h=><th key={h} style={{padding:"4px 6px",textAlign:"left",fontSize:9}}>{h}</th>)}</tr></thead>
        <tbody>
          <tr style={{borderBottom:"1px solid #E2E8F0"}}><td style={{padding:"3px 6px"}}>Démolition cloison</td><td style={{padding:"3px 6px"}}>1</td><td style={{padding:"3px 6px",fontFamily:"monospace"}}>450 €</td><td style={{padding:"3px 6px",fontFamily:"monospace"}}>450 €</td></tr>
          <tr style={{borderBottom:"1px solid #E2E8F0",background:"#F8FAFC"}}><td style={{padding:"3px 6px"}}>Carrelage 60×60</td><td style={{padding:"3px 6px"}}>12</td><td style={{padding:"3px 6px",fontFamily:"monospace"}}>85 €</td><td style={{padding:"3px 6px",fontFamily:"monospace"}}>1 020 €</td></tr>
        </tbody>
      </table>
      <div style={{textAlign:"right",fontSize:11,fontWeight:800,color:c,marginBottom:8}}>TOTAL TTC : 1 764 € </div>
      {modele.showConditions&&<div style={{fontSize:9,color:"#475569",marginBottom:6}}><strong>Conditions :</strong> 40% à la commande – 60% à l'achèvement.</div>}
      {modele.conclusionText&&<div style={{fontSize:9,color:"#475569",fontStyle:"italic",marginBottom:6}}>{modele.conclusionText}</div>}
      {modele.showSignature&&(
        <div style={{display:"flex",justifyContent:"space-between",gap:14,marginTop:10,marginBottom:6}}>
          <div style={{flex:1,border:`1px dashed ${L.borderMd}`,borderRadius:5,padding:"8px 10px",fontSize:9,color:L.textXs,minHeight:50}}>Date et signature client<br/><strong>« Bon pour accord »</strong></div>
        </div>
      )}
      {modele.showMentions&&modele.footerText&&<div style={{fontSize:8,color:"#94A3B8",borderTop:"1px solid #E2E8F0",paddingTop:5,marginTop:8}}>{modele.footerText}</div>}
    </div>
  );
}

// ─── ÉCRAN DÉFINITION MOT DE PASSE (post-invitation Supabase) ──────────────
// Affiché quand main.jsx a détecté un hash #type=invite ou #type=recovery.
// La session est déjà créée par Supabase JS SDK (detectSessionInUrl), il ne
// reste qu'à fixer un mot de passe via supabase.auth.updateUser.
function SetPasswordScreen({flow,onDone}){
  const [pwd,setPwd]=useState("");
  const [pwd2,setPwd2]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState(null);
  async function submit(e){
    e?.preventDefault?.();
    setErr(null);
    if(pwd.length<6){setErr("Mot de passe : 6 caractères minimum.");return;}
    if(pwd!==pwd2){setErr("Les deux mots de passe ne correspondent pas.");return;}
    if(!supabase){setErr("Connexion Supabase indisponible.");return;}
    setLoading(true);
    try{
      const{error}=await supabase.auth.updateUser({password:pwd});
      if(error)throw error;
      // Nettoie le hash résiduel pour éviter de re-afficher l'écran au refresh
      try{window.history.replaceState(null,"",window.location.pathname+window.location.search);}catch{}
      onDone?.();
    }catch(e){
      setErr(e.message||"Erreur définition mot de passe");
    }
    setLoading(false);
  }
  const isInvite=flow?.type==="invite";
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${L.navy} 0%,#2a5298 60%,${L.teal} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif"}}>
      <div style={{width:"100%",maxWidth:420,background:L.surface,borderRadius:16,padding:30,boxShadow:"0 20px 50px rgba(0,0,0,0.22)",border:`1px solid ${L.border}`}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:30,fontWeight:900,color:L.text,letterSpacing:-1}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
          <div style={{fontSize:14,fontWeight:700,color:L.green,marginTop:14,marginBottom:4}}>{isInvite?"🎉 Bienvenue dans l'équipe !":"🔑 Réinitialisation"}</div>
          <p style={{margin:"0",fontSize:12,color:L.textSm,lineHeight:1.5}}>{isInvite?"Définissez votre mot de passe pour accéder à votre espace ouvrier (pointage, chantier du jour, tâches).":"Définissez votre nouveau mot de passe."}</p>
        </div>
        <form onSubmit={submit}>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:5}}>Nouveau mot de passe</label>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} autoFocus disabled={loading} placeholder="6 caractères minimum"
              style={{width:"100%",padding:"11px 13px",fontSize:14,border:`1px solid ${L.border}`,borderRadius:8,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:11,fontWeight:600,color:L.textMd,marginBottom:5}}>Confirmer le mot de passe</label>
            <input type="password" value={pwd2} onChange={e=>setPwd2(e.target.value)} disabled={loading} placeholder="Retapez-le"
              style={{width:"100%",padding:"11px 13px",fontSize:14,border:`1px solid ${L.border}`,borderRadius:8,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          {err&&<div style={{background:L.redBg,color:L.red,padding:"9px 11px",borderRadius:8,fontSize:12,marginBottom:14,border:`1px solid ${L.red}33`}}>⚠ {err}</div>}
          <button type="submit" disabled={loading||!pwd||!pwd2}
            style={{width:"100%",padding:"13px 14px",background:loading?L.textXs:L.accent,color:"#fff",border:"none",borderRadius:9,fontSize:14,fontWeight:800,cursor:loading?"wait":"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(232,98,10,0.35)"}}>
            {loading?"⏳ Validation…":"✓ Activer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── PWA INSTALL BANNER ─────────────────────────────────────────────────────
// Affiche un bouton "📲 Installer l'app" en bas d'écran si :
//  - Android/Chrome : event 'beforeinstallprompt' a été capté → on peut
//    déclencher l'install dialog natif
//  - iOS Safari : pas d'event beforeinstallprompt (Apple le bloque), donc
//    on affiche des instructions Partager → "Sur l'écran d'accueil"
// Cache la bannière si déjà installée (display-mode standalone) ou si
// l'utilisateur a refusé (dismiss persisté en localStorage).
function PWAInstallBanner(){
  const [deferred,setDeferred]=useState(null);
  const [iosTip,setIosTip]=useState(false);
  const [dismissed,setDismissed]=useState(()=>{
    try{return localStorage.getItem("cp_pwa_dismissed")==="1";}catch{return false;}
  });
  const isStandalone=typeof window!=="undefined"&&(
    window.matchMedia?.("(display-mode: standalone)")?.matches||
    window.navigator?.standalone===true
  );
  const isIOS=typeof navigator!=="undefined"&&/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;
  useEffect(()=>{
    function handler(e){
      e.preventDefault();
      setDeferred(e);
    }
    window.addEventListener("beforeinstallprompt",handler);
    window.addEventListener("appinstalled",()=>setDeferred(null));
    return ()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);
  if(isStandalone||dismissed)return null;
  // Sur iOS sans event natif : on n'affiche que si l'user clique le bouton info
  if(!deferred&&!isIOS)return null;
  function close(){
    setDismissed(true);
    try{localStorage.setItem("cp_pwa_dismissed","1");}catch{}
  }
  async function install(){
    if(deferred){
      deferred.prompt();
      const{outcome}=await deferred.userChoice;
      if(outcome==="accepted"){setDeferred(null);}
      return;
    }
    if(isIOS){setIosTip(true);}
  }
  return(
    <>
      <div style={{position:"fixed",bottom:14,left:14,zIndex:98,background:L.navy,color:"#fff",padding:"10px 14px",borderRadius:12,fontSize:12,boxShadow:"0 4px 16px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:10,maxWidth:340,fontFamily:"inherit"}}>
        <span style={{fontSize:22}}>📲</span>
        <div style={{flex:1,lineHeight:1.4}}>
          <div style={{fontWeight:700}}>Installer l'app</div>
          <div style={{fontSize:11,opacity:0.85}}>Accès direct depuis votre écran d'accueil, hors-ligne possible.</div>
        </div>
        <button onClick={install} style={{background:L.accent,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Installer</button>
        <button onClick={close} aria-label="Fermer" style={{background:"transparent",color:"rgba(255,255,255,0.7)",border:"none",cursor:"pointer",fontSize:18,padding:"0 4px",fontFamily:"inherit"}}>×</button>
      </div>
      {iosTip&&(
        <div onClick={()=>setIosTip(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1500,display:"flex",alignItems:"flex-end",padding:18}}>
          <div onClick={e=>e.stopPropagation()} style={{background:L.surface,borderRadius:16,padding:22,maxWidth:420,margin:"0 auto",width:"100%",boxShadow:"0 -10px 40px rgba(0,0,0,0.3)"}}>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{fontSize:32}}>📲</div>
              <div style={{fontSize:16,fontWeight:800,color:L.text,marginTop:6}}>Installer ChantierPro sur iPhone</div>
            </div>
            <ol style={{paddingLeft:22,fontSize:13,color:L.textMd,lineHeight:1.7,margin:"0 0 16px"}}>
              <li>Touchez le bouton <strong>Partager</strong> <span style={{display:"inline-block",padding:"1px 6px",background:L.bg,border:`1px solid ${L.border}`,borderRadius:5,fontSize:11}}>↑</span> en bas de Safari</li>
              <li>Faites défiler et touchez <strong>Sur l'écran d'accueil</strong></li>
              <li>Touchez <strong>Ajouter</strong> en haut à droite</li>
            </ol>
            <div style={{padding:"9px 11px",background:L.navyBg,color:L.navy,borderRadius:8,fontSize:11,marginBottom:14,lineHeight:1.5}}>L'icône ChantierPro apparaît sur votre écran d'accueil. Lancez-la pour ouvrir l'app en plein écran (sans barre Safari).</div>
            <Btn onClick={()=>setIosTip(false)} variant="primary" fullWidth>Compris</Btn>
          </div>
        </div>
      )}
    </>
  );
}

// ─── WIZARD ONBOARDING — 8 étapes guidées après SIRET ───────────────────────
// Étape 1 (Bienvenue) : intro, pas comptée dans le badge.
// Étapes 2-8 : actionnables, comptées dans le badge "Guide X/7".
// Sentinelle "done" : wizard_step >= 9 (plus de badge ni d'auto-affichage).
const WIZARD_STEPS=[
  {n:1,icon:"👋",titre:"Bienvenue !",sous:"Bienvenue sur ChantierPro ! Suivez ce guide pour découvrir toutes les fonctionnalités.",actionLabel:"C'est parti",actionView:null},
  {n:2,icon:"👷",titre:"Étape 1 — Votre équipe",sous:"Commencez par ajouter vos ouvriers avec leurs taux horaires → vos devis IA seront précis.",actionLabel:"Aller à Équipe",actionView:"equipe"},
  {n:3,icon:"⚡",titre:"Étape 2 — Devis Rapide IA",sous:"Décrivez vos travaux en langage naturel, l'IA génère le devis structuré en quelques secondes.",actionLabel:"Essayer le Devis Rapide IA",actionView:"_devis_rapide_"},
  {n:4,icon:"🏗",titre:"Étape 3 — Chantier depuis devis",sous:"Une fois votre devis accepté par le client, convertissez-le en chantier en un clic depuis la page Devis.",actionLabel:"Voir mes devis",actionView:"devis"},
  {n:5,icon:"📱",titre:"Étape 4 — Terrain & Ouvriers",sous:"Invitez vos ouvriers — ils pointent leurs heures et voient leurs tâches depuis leur téléphone.",actionLabel:"Aller à Équipe / Inviter",actionView:"equipe"},
  {n:6,icon:"🧾",titre:"Étape 5 — Facturation",sous:"Convertissez vos devis acceptés en factures, gérez les acomptes et les encaissements.",actionLabel:"Aller à Factures",actionView:"factures"},
  {n:7,icon:"💰",titre:"Étape 6 — Comptabilité",sous:"Suivez votre CA, vos marges et synchronisez avec Qonto/Pennylane.",actionLabel:"Aller à Comptabilité",actionView:"compta"},
  {n:8,icon:"🤖",titre:"Étape 7 — Assistant IA & Support",sous:"Posez des questions en langage naturel à l'Assistant IA. Besoin d'aide ? Le support est disponible 24h/24.",actionLabel:"Ouvrir Assistant IA",actionView:"assistant",actionLabel2:"Aller au Support",actionView2:"support"},
];
function OnboardingWizard({step,onAdvance,onAction,onSkipAll,onClose}){
  const cur=WIZARD_STEPS.find(s=>s.n===step)||WIZARD_STEPS[0];
  const total=WIZARD_STEPS.length;       // 8
  const actionnables=total-1;            // 7 (étapes 2 à 8)
  const isLast=step===total;
  const isFirst=step===1;
  const progressPct=Math.round((step/total)*100);
  const headerLabel=isFirst?"Bienvenue":`Étape ${step-1} / ${actionnables}`;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",backdropFilter:"blur(2px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:14}}>
      <div style={{background:"#fff",borderRadius:16,maxWidth:520,width:"100%",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.35)"}}>
        {/* Barre de progression */}
        <div style={{height:5,background:L.bg}}>
          <div style={{height:"100%",width:`${progressPct}%`,background:`linear-gradient(90deg,${L.accent},${L.purple})`,transition:"width 0.3s ease"}}/>
        </div>
        {/* Header avec n° d'étape */}
        <div style={{padding:"16px 22px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:700,color:L.textSm,textTransform:"uppercase",letterSpacing:1.2}}>{headerLabel}</span>
          <button onClick={onClose} title="Fermer (le wizard reviendra plus tard)" aria-label="Fermer" style={{background:L.bg,border:"none",borderRadius:8,width:30,height:30,fontSize:14,color:L.textSm,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        </div>
        {/* Contenu */}
        <div style={{padding:"24px 32px 14px",textAlign:"center"}}>
          <div style={{fontSize:54,marginBottom:12,lineHeight:1}}>{cur.icon}</div>
          <div style={{fontSize:20,fontWeight:800,color:L.navy,marginBottom:10,letterSpacing:-0.3}}>{cur.titre}</div>
          <div style={{fontSize:13,color:L.textSm,lineHeight:1.6,maxWidth:380,margin:"0 auto"}}>{cur.sous}</div>
        </div>
        {/* Actions */}
        <div style={{padding:"14px 22px 22px",display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>onAction(cur,1)} style={{width:"100%",padding:"12px 18px",background:`linear-gradient(135deg,${L.accent},${L.purple})`,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(232,98,10,0.35)"}}>
            {cur.actionLabel}{cur.actionView?" →":""}
          </button>
          {cur.actionLabel2&&(
            <button onClick={()=>onAction(cur,2)} style={{width:"100%",padding:"10px 16px",background:"#fff",color:L.navy,border:`1.5px solid ${L.navy}`,borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {cur.actionLabel2}{cur.actionView2?" →":""}
            </button>
          )}
          <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",marginTop:2}}>
            <button onClick={onSkipAll} style={{flex:1,padding:"9px 12px",background:"transparent",color:L.textSm,border:"none",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Tout passer</button>
            <button onClick={onAdvance} style={{flex:1,padding:"10px 14px",background:L.surface,color:L.text,border:`1px solid ${L.border}`,borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{isLast?"Terminer ✓":"Passer cette étape →"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WIDGET FEEDBACK FLOTTANT — friction minimale ───────────────────────────
// Petit FAB 💬 fixe en bas à droite (au-dessus du bouton Login). Click → mini
// popover avec note ⭐ 1-5 + zone texte. Envoi via /api/submit-ticket avec
// type=recommandation — réutilise toute l'infra tickets/IA/notif existante,
// pas de table dédiée ni de schéma supplémentaire.
function FeedbackWidget({authUser}){
  const [open,setOpen]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState("");
  const [text,setText]=useState("");
  const [rating,setRating]=useState(0);

  async function send(){
    setError("");
    if(!text.trim()){setError("Tape quelques mots…");return;}
    setSubmitting(true);
    try{
      const r=await fetch("/api/submit-ticket",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          user_id:authUser?.id||null,
          email:(authUser?.email||"").trim().toLowerCase()||"anonyme@chantierpro",
          type:"recommandation",
          description:text.trim()+(rating?` [Note: ${rating}/5]`:""),
          metadata:rating?{rating}:{},
        }),
      });
      const data=await r.json().catch(()=>({}));
      setSubmitting(false);
      if(!r.ok){
        // Affiche l'erreur exacte + hint si l'API en fournit un
        // (typiquement : migrations Supabase manquantes).
        const msg=data?.error||`Erreur HTTP ${r.status}`;
        const hint=data?.hint;
        const supa=data?.supabase_message;
        setError(hint?`${msg}\n💡 ${hint}`:supa?`${msg}\n${supa}`:msg);
        // Log complet en console pour debug avancé
        console.warn("[feedback widget] submit-ticket failed",data);
        return;
      }
      setSent(true);setText("");setRating(0);
      // Auto-close après 2.5s pour ne pas bloquer l'UI
      setTimeout(()=>{setOpen(false);setSent(false);},2500);
    }catch(e){
      setSubmitting(false);
      setError("Erreur réseau, réessaie plus tard.");
    }
  }

  if(!open){
    return(
      <button onClick={()=>setOpen(true)} title="Donnez votre avis" aria-label="Feedback"
        style={{
          position:"fixed",bottom:75,right:14,zIndex:99,
          width:48,height:48,borderRadius:"50%",
          background:`linear-gradient(135deg,${L.accent},${L.purple})`,
          border:"none",color:"#fff",fontSize:22,cursor:"pointer",
          boxShadow:"0 4px 14px rgba(232,98,10,0.45)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontFamily:"inherit",transition:"transform 0.15s",
        }}
        onMouseDown={e=>e.currentTarget.style.transform="scale(0.92)"}
        onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>💬</button>
    );
  }
  return(
    <div style={{
      position:"fixed",bottom:75,right:14,zIndex:99,
      width:320,maxWidth:"calc(100vw - 28px)",
      background:"#fff",borderRadius:14,padding:16,
      boxShadow:"0 8px 32px rgba(0,0,0,0.22)",
      border:`1px solid ${L.border}`,
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:13,fontWeight:700,color:L.navy}}>💬 Donnez votre avis</div>
        <button onClick={()=>{setOpen(false);setError("");}} aria-label="Fermer"
          style={{background:L.bg,border:"none",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:12,color:L.textSm,fontFamily:"inherit"}}>✕</button>
      </div>
      {sent?(
        <div style={{padding:"22px 12px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:6}}>✅</div>
          <div style={{fontSize:14,fontWeight:700,color:L.green,marginBottom:4}}>Merci !</div>
          <div style={{fontSize:11,color:L.textSm}}>On lit chaque retour.</div>
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:2,justifyContent:"center",marginBottom:10}}>
            {[1,2,3,4,5].map(n=>(
              <button key={n} onClick={()=>setRating(n===rating?0:n)} title={`${n}/5`}
                style={{background:"transparent",border:"none",fontSize:24,cursor:"pointer",opacity:n<=rating?1:0.25,padding:"2px 4px",fontFamily:"inherit",transition:"opacity 0.15s"}}>⭐</button>
            ))}
          </div>
          <textarea value={text} onChange={e=>setText(e.target.value.slice(0,500))} rows={4}
            placeholder="Qu'est-ce qui pourrait être mieux ? Une idée, un retour, ce qui marche bien…"
            style={{width:"100%",padding:"8px 10px",fontSize:12,border:`1px solid ${L.border}`,borderRadius:7,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:80,boxSizing:"border-box",lineHeight:1.5}}/>
          <div style={{fontSize:9,color:L.textXs,textAlign:"right",marginTop:2}}>{text.length}/500</div>
          {error&&<div style={{background:"#FEE2E2",color:L.red,padding:"6px 8px",borderRadius:5,fontSize:11,marginTop:6,whiteSpace:"pre-wrap",lineHeight:1.4}}>{error}</div>}
          <button onClick={send} disabled={submitting||!text.trim()}
            style={{width:"100%",marginTop:8,padding:"9px 14px",
              background:(submitting||!text.trim())?L.bg:`linear-gradient(135deg,${L.accent},${L.purple})`,
              color:(submitting||!text.trim())?L.textXs:"#fff",
              border:"none",borderRadius:8,fontSize:13,fontWeight:700,
              cursor:(submitting||!text.trim())?"not-allowed":"pointer",
              fontFamily:"inherit"}}>
            {submitting?"⏳ Envoi…":"📨 Envoyer"}
          </button>
          {!authUser&&<div style={{fontSize:10,color:L.textXs,textAlign:"center",marginTop:6,fontStyle:"italic"}}>Envoyé en anonyme — connecte-toi pour qu'on puisse te répondre.</div>}
        </>
      )}
    </div>
  );
}

// ─── TOAST "NOUVEAUTÉS" — bannières séquentielles au login ──────────────────
// Charge les items roadmap (statut='livre') avec id > cp_last_seen_roadmap,
// les enchaîne en bannières top-center avec slide-in/out. Patron uniquement.
// One-shot par session (triggeredRef garanti via la condition + cleanup).
const NEW_FEATURES_ICONS={feature:"✨",bug_fix:"🔧",improvement:"⚡"};
function NewFeaturesToast({authUser,role}){
  const [current,setCurrent]=useState(null);
  const [visible,setVisible]=useState(false);
  const triggeredRef=useRef(false);
  const queueRef=useRef([]);
  const cancelledRef=useRef(false);
  const timersRef=useRef([]);

  function clearTimers(){
    timersRef.current.forEach(t=>clearTimeout(t));
    timersRef.current=[];
  }
  function setTimer(fn,ms){
    const t=setTimeout(()=>{
      timersRef.current=timersRef.current.filter(x=>x!==t);
      if(!cancelledRef.current)fn();
    },ms);
    timersRef.current.push(t);
    return t;
  }

  function showNext(){
    if(cancelledRef.current)return;
    if(queueRef.current.length===0)return;
    const next=queueRef.current.shift();
    setCurrent(next);
    setVisible(false);
    // Slide-in (laisse 30ms pour le 1er rendu avec visible=false → animation
    // CSS via top + opacity)
    setTimer(()=>setVisible(true),30);
    // Slide-out après 3000ms d'affichage
    setTimer(()=>setVisible(false),3030);
    // Sauvegarde + clear + enchainement après l'animation de sortie (300ms)
    setTimer(()=>{
      try{localStorage.setItem("cp_last_seen_roadmap",String(next.id));}catch{}
      setCurrent(null);
      setTimer(showNext,500); // 500ms de gap avant la suivante
    },3330);
  }

  // Fetch initial — 1 seule fois quand patron connecté
  useEffect(()=>{
    if(triggeredRef.current)return;
    if(!authUser||role==="ouvrier"||role==="soustraitant"||!supabase)return;
    triggeredRef.current=true;
    cancelledRef.current=false;
    (async()=>{
      let lastSeen=0;
      try{lastSeen=parseInt(localStorage.getItem("cp_last_seen_roadmap")||"0",10)||0;}catch{}
      try{
        const {data,error}=await supabase.from("roadmap")
          .select("id,titre,description,type,livre_le")
          .eq("statut","livre")
          .gt("id",lastSeen)
          .order("id",{ascending:true})
          .limit(5);
        if(error||!data||data.length===0||cancelledRef.current)return;
        queueRef.current=[...data];
        showNext();
      }catch(e){/* silent */}
    })();
    return()=>{
      cancelledRef.current=true;
      clearTimers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[authUser?.id,role]);

  function dismiss(){
    cancelledRef.current=true;
    clearTimers();
    // Marque comme vu jusqu'à la dernière de la queue (l'utilisateur ne veut
    // plus voir les bannières cette session — on saute le reste).
    const lastInQueue=queueRef.current[queueRef.current.length-1];
    const idToSave=lastInQueue?lastInQueue.id:(current?.id||0);
    if(idToSave){try{localStorage.setItem("cp_last_seen_roadmap",String(idToSave));}catch{}}
    queueRef.current=[];
    setVisible(false);
    setTimeout(()=>setCurrent(null),300);
  }

  if(!current)return null;
  const icon=NEW_FEATURES_ICONS[current.type]||"✨";
  return(
    <div role="status" aria-live="polite" style={{
      position:"fixed",
      top:visible?14:-120,
      left:"50%",
      transform:"translateX(-50%)",
      zIndex:2500,
      opacity:visible?1:0,
      transition:"top 0.3s ease, opacity 0.3s ease",
      maxWidth:500,
      width:"calc(100% - 28px)",
      pointerEvents:visible?"auto":"none",
    }}>
      <div style={{
        background:`linear-gradient(135deg, ${L.navy} 0%, ${L.accent} 100%)`,
        color:"#fff",
        borderRadius:12,
        padding:"12px 16px",
        boxShadow:"0 8px 28px rgba(15,23,42,0.32)",
        display:"flex",
        alignItems:"center",
        gap:12,
      }}>
        <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:current.description?2:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Nouveau — {current.titre}</div>
          {current.description&&<div style={{fontSize:11,opacity:0.92,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{current.description}</div>}
        </div>
        <button onClick={dismiss} aria-label="Fermer toutes les bannières" title="Fermer (ne plus voir)" style={{
          background:"rgba(255,255,255,0.18)",
          border:"none",
          borderRadius:6,
          width:26,
          height:26,
          color:"#fff",
          cursor:"pointer",
          fontSize:13,
          flexShrink:0,
          fontFamily:"inherit",
        }}>✕</button>
      </div>
    </div>
  );
}

// ─── TOAST NOTIFS URGENTES — au mount, séquentiel comme NewFeaturesToast ────
// Charge les notifications agents non lues (urgent prioritaire, puis warning)
// et les enchaîne en bannières top-center. Fond rouge pour 'urgent', orange
// pour 'warning'. Affichage 4500ms (plus long que les nouveautés). Mark
// 'vu' (pas 'lu') via localStorage pour ne pas réafficher la même notif.
function NotifsLoginBanner({authUser,role}){
  const [current,setCurrent]=useState(null);
  const [visible,setVisible]=useState(false);
  const triggeredRef=useRef(false);
  const queueRef=useRef([]);
  const cancelledRef=useRef(false);
  const timersRef=useRef([]);

  function clearTimers(){timersRef.current.forEach(t=>clearTimeout(t));timersRef.current=[];}
  function setTimer(fn,ms){
    const t=setTimeout(()=>{
      timersRef.current=timersRef.current.filter(x=>x!==t);
      if(!cancelledRef.current)fn();
    },ms);
    timersRef.current.push(t);return t;
  }
  function showNext(){
    if(cancelledRef.current||queueRef.current.length===0)return;
    const next=queueRef.current.shift();
    setCurrent(next);
    setVisible(false);
    setTimer(()=>setVisible(true),30);
    setTimer(()=>setVisible(false),4530);    // 4500ms d'affichage
    setTimer(()=>{
      // Mark 'vu' localement (pas 'lu' en DB — juste skip ce login)
      try{
        const seen=JSON.parse(localStorage.getItem("cp_notifs_seen_at")||"[]");
        seen.push(next.id);
        localStorage.setItem("cp_notifs_seen_at",JSON.stringify(seen.slice(-50)));
      }catch{}
      setCurrent(null);
      setTimer(showNext,500);
    },4830);
  }

  useEffect(()=>{
    if(triggeredRef.current)return;
    if(!authUser||role==="ouvrier"||role==="soustraitant"||!supabase)return;
    triggeredRef.current=true;
    cancelledRef.current=false;
    (async()=>{
      let alreadySeen=[];
      try{alreadySeen=JSON.parse(localStorage.getItem("cp_notifs_seen_at")||"[]");}catch{}
      const seenSet=new Set(alreadySeen);
      try{
        // Urgent + warning, non-lu, pas déjà vu cette session
        const{data,error}=await supabase
          .from("notifications")
          .select("id,titre,message,type,agent_id,created_at")
          .eq("lu",false)
          .in("type",["urgent","warning"])
          .order("type",{ascending:true})  // 'urgent' < 'warning' alphabétique
          .order("created_at",{ascending:false})
          .limit(5);
        if(error||!data)return;
        const filtered=data.filter(n=>!seenSet.has(n.id));
        if(filtered.length===0||cancelledRef.current)return;
        queueRef.current=[...filtered];
        showNext();
      }catch(e){/* silent */}
    })();
    return()=>{cancelledRef.current=true;clearTimers();};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[authUser?.id,role]);

  function dismiss(){
    cancelledRef.current=true;clearTimers();
    // Toutes celles de la queue sont marquées vues
    try{
      const seen=JSON.parse(localStorage.getItem("cp_notifs_seen_at")||"[]");
      seen.push(...queueRef.current.map(n=>n.id),current?.id);
      localStorage.setItem("cp_notifs_seen_at",JSON.stringify(seen.filter(Boolean).slice(-50)));
    }catch{}
    queueRef.current=[];
    setVisible(false);
    setTimeout(()=>setCurrent(null),300);
  }

  if(!current)return null;
  const isUrgent=current.type==="urgent";
  const grad=isUrgent
    ?`linear-gradient(135deg, #DC2626 0%, #991B1B 100%)`
    :`linear-gradient(135deg, #D97706 0%, ${L.accent} 100%)`;
  const icon=isUrgent?"🚨":"⚠️";
  return(
    <div role="status" aria-live="polite" style={{
      position:"fixed",
      top:visible?14:-120,
      left:"50%",
      transform:"translateX(-50%)",
      zIndex:2400,                      // sous NewFeaturesToast 2500
      opacity:visible?1:0,
      transition:"top 0.3s ease, opacity 0.3s ease",
      maxWidth:520,
      width:"calc(100% - 28px)",
      pointerEvents:visible?"auto":"none",
    }}>
      <div style={{background:grad,color:"#fff",borderRadius:12,padding:"12px 16px",boxShadow:"0 8px 28px rgba(15,23,42,0.32)",display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{current.titre}</div>
          <div style={{fontSize:11,opacity:0.95,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{current.message}</div>
        </div>
        <button onClick={dismiss} aria-label="Fermer" title="Fermer" style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:6,width:26,height:26,color:"#fff",cursor:"pointer",fontSize:13,flexShrink:0,fontFamily:"inherit"}}>✕</button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPALE ────────────────────────────────────────────────────────────
export default function App(){
  const [onboardingDone,setOnboardingDone]=useState(false);
  // wizard_step : 0 = pas commencé (auto-affiche), 1-4 = en cours (badge),
  // 5 = terminé. Synchronisé avec entreprises.wizard_step.
  const [wizardStep,setWizardStep]=useState(0);
  const [wizardOpen,setWizardOpen]=useState(false);
  // Persiste la progression du wizard côté Supabase (best-effort, on ne
  // bloque pas l'UI si l'écriture échoue — seul le local state est
  // critique pour la session courante).
  async function persistWizardStep(next){
    setWizardStep(next);
    if(!supabase)return;
    try{
      const{data:sess}=await supabase.auth.getSession();
      const uid=sess?.session?.user?.id;
      if(!uid)return;
      await supabase.from("entreprises").update({wizard_step:next}).eq("user_id",uid);
    }catch(e){console.warn("[wizard persist]",e?.message||e);}
  }
  const [entreprise,setEntreprise]=useState(ENTREPRISE_INIT);
  const [statut,setStatut]=useState("sarl");
  // 3 salariés "types" pour guider l'utilisateur (à renommer/dupliquer
  // dans Équipe). Tarif chargé approx. = tauxHoraire × (1 + chargesPatron).
  // Les ids sont générés en UUID (la colonne salaries.id est de type UUID
  // côté Supabase — un id numérique fait planter l'upsert avec 22P02).
  const [salaries,setSalaries]=useState(()=>{
    const u=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);
    return[
      {id:u(),nom:"Chef (à renommer)",poste:"Ouvrier qualifié N3P2",qualification:"chef",tauxHoraire:18,chargesPatron:0.94,coefficient:1.5,disponible:true,competences:[]},
      {id:u(),nom:"Qualifié (à renommer)",poste:"Ouvrier qualifié N2P2",qualification:"qualifie",tauxHoraire:15,chargesPatron:0.94,coefficient:1.3,disponible:true,competences:[]},
      {id:u(),nom:"Manœuvre (à renommer)",poste:"Manœuvre N1P1",qualification:"manoeuvre",tauxHoraire:12,chargesPatron:0.94,coefficient:1.1,disponible:true,competences:[]},
    ];
  });
  const [chantiers,setChantiers]=useState([]);
  // Sous-traitants : entreprises externes (maçon, plombier…) facturées séparément.
  // Distinct de salaries (interne, taux horaire chargé) — facturation au taux journalier.
  const [sousTraitants,setSousTraitants]=useState([]);
  // Fournisseurs : fiches entreprises de matériaux/outillage/sous-traitance
  // + bons de commande + factures reçues (suivi coûts réels chantier).
  const [fournisseurs,setFournisseurs]=useState([]);
  const [commandesFournisseur,setCommandesFournisseur]=useState([]);
  const [facturesFournisseur,setFacturesFournisseur]=useState([]);
  // Clients : schéma plat (cf. migration 20260513_clients.sql) pour permettre
  // les filtres SQL natifs et l'autocomplete dans CreateurDevis.
  const [clients,setClients]=useState([]);
  const [docs,setDocs]=useState(DOCS_INIT);
  const [selectedChantier,setSelectedChantier]=useState(1);
  const [view,setView]=useState("accueil");
  const [showSettings,setShowSettings]=useState(false);
  const [showDevisRapide,setShowDevisRapide]=useState(false);
  const [pendingEditDocId,setPendingEditDocId]=useState(null);
  const [notif,setNotif]=useState(null);
  // Visites du Terrain : pour notifs patron (chantier mis à jour depuis ma dernière visite).
  // localStorage par user, pas synchro Supabase (état per-device acceptable).
  const [terrainVisits,setTerrainVisits]=useState({});
  // useEffect déplacé sous la déclaration de `authUser` (TDZ).
  function markTerrainVisited(chantierId){
    if(!chantierId)return;
    const next={...terrainVisits,[chantierId]:Date.now()};
    setTerrainVisits(next);
    saveTerrainVisits(authUser?.id,next);
  }
  // Compte de chantiers avec mises à jour terrain non vues
  const terrainUnreadCount=(chantiers||[]).filter(c=>chantierTerrainUnread(c,terrainVisits)).length;
  // Compte de notifications agents non lues — polling 60s + refresh manuel
  // appelé par VueAgents après marquage 'lu'.
  const [agentsUnreadCount,setAgentsUnreadCount]=useState(0);
  const refreshAgentsBadge=useRef(()=>{}).current;
  // On override ref via assignement direct sur l'objet retourné par useRef
  // — pattern utilisé pour exposer un callback aux enfants.
  const agentsRefreshRef=useRef(null);
  useEffect(()=>{
    if(!supabase||!authUser){setAgentsUnreadCount(0);return;}
    let cancelled=false;
    async function pull(){
      const{count}=await supabase.from("notifications").select("id",{count:"exact",head:true}).eq("lu",false);
      if(!cancelled)setAgentsUnreadCount(count||0);
    }
    agentsRefreshRef.current=pull;
    pull();
    const i=setInterval(pull,60000);
    return()=>{cancelled=true;clearInterval(i);agentsRefreshRef.current=null;};
  },[authUser?.id]);
  // Responsive : sidebar compacte (icônes seuls + drawer hamburger) UNIQUEMENT
  // sous 768px (mobile). Au-dessus → labels visibles (desktop).
  // Cas paysage mobile (iPhone landscape ≈ 932×430) : winW > 768 mais hauteur
  // < 500 — la sidebar desktop avec labels prend trop de place vertical, on
  // force aussi le mode compact dans ce cas.
  // Lecture directe à chaque render — useViewportSize force le re-render
  // sur resize/orientationchange.
  useViewportSize();
  const winW=typeof window!=="undefined"?window.innerWidth:1200;
  const winH=typeof window!=="undefined"?window.innerHeight:800;
  const sidebarCompact=winW<768||winH<500||(winW<900&&winH<winW);
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
  // authChecked : true dès que la 1ʳᵉ résolution de session Supabase est
  // terminée (succès OU pas de session). Évite que l'onboarding flashe au
  // refresh quand une session existe mais n'a pas encore été restaurée.
  const [authChecked,setAuthChecked]=useState(!supabase);

  // Charge les visites terrain (par utilisateur) après que authUser soit
  // déclaré — sinon on est en TDZ sur authUser et le module crash.
  useEffect(()=>{setTerrainVisits(getTerrainVisits(authUser?.id));},[authUser?.id]);

  useEffect(()=>{
    if(!supabase) return;
    // Timeout de sécurité : si Supabase ne répond pas en 5s (réseau coupé,
    // service down…), on libère le gate pour ne pas bloquer l'app.
    const safetyTimer=setTimeout(()=>setAuthChecked(true),5000);
    supabase.auth.getSession().then(({data})=>{
      if(data?.session?.user) setAuthUser(data.session.user);
      setAuthChecked(true);
    }).catch(()=>setAuthChecked(true));
    const {data:sub} = supabase.auth.onAuthStateChange((_evt, session)=>{
      setAuthUser(session?.user || null);
      setAuthChecked(true);
    });
    return ()=>{clearTimeout(safetyTimer);sub?.subscription?.unsubscribe();};
  },[]);

  // Charge le profil entreprise depuis Supabase quand l'utilisateur est authentifié.
  // Si pas de profil propre → tente l'auto-match en cherchant son email dans
  // les salaries/soustraitants des patrons (RPC SECURITY DEFINER). Si match →
  // crée un profil 'ouvrier' (ou 'soustraitant') lié au patron, bypass total
  // de l'onboarding (un ouvrier n'a ni SIRET ni statut à renseigner).
  const entrepriseSkipRef=useRef(false);
  // loadingProfile : true entre l'ouverture de session et la résolution du
  // profil (load Supabase + éventuel RPC). Évite que l'onboarding flashe
  // brièvement pendant que l'auto-match se résout.
  const [loadingProfile,setLoadingProfile]=useState(false);
  useEffect(()=>{
    if(!supabase || !authUser) return;
    let cancelled=false;
    setLoadingProfile(true);
    // Filet de sécurité : si la résolution prend > 5s (réseau lent, RPC
    // qui pend, table absente…), on libère le gate plutôt que bloquer
    // l'utilisateur sur le loading indéfiniment.
    const safetyTimer=setTimeout(()=>{
      if(!cancelled)setLoadingProfile(false);
    },5000);
    (async()=>{
      try{
        const{data,error}=await supabase.from("entreprises").select("*").eq("user_id",authUser.id).maybeSingle();
        if(cancelled)return;
        if(error){
          console.warn("[entreprises] load error:",error.message);
          // Erreurs typiques que l'utilisateur doit voir :
          // - "infinite recursion" → migration 20260507_fix_rls_recursion non jouée
          // - "relation does not exist" → migration 20260502_multi_user_data non jouée
          // - "column does not exist" → migration plus récente non jouée (peut être ignoré ici, le load tolère les colonnes manquantes via les ?? fallback)
          const m=(error.message||"").toLowerCase();
          if(m.includes("recursion")||m.includes("relation")&&m.includes("does not exist")){
            setNotif({type:"err",msg:`⚠️ Migration Supabase manquante — exécutez ${m.includes("recursion")?"20260507_fix_rls_recursion.sql":"20260502_multi_user_data.sql"} dans le SQL Editor. (${error.message})`});
          }
          return;
        }
        if(data){
          // Profil existant — on l'applique. Onboarding considéré comme fait
          // si data.onboarding_done est explicitement true OU si data.nom
          // est non-vide (compat avec lignes pré-existantes sans la colonne).
          entrepriseSkipRef.current=true;
          setEntreprise({
            // PK UUID de la table entreprises — critique pour la FK
            // salaries.entreprise_id → entreprises.id. user_id (FK auth.users)
            // n'est PAS une cible valide pour cette FK.
            id:data.id||null,
            user_id:data.user_id||authUser.id,
            nom:data.nom||ENTREPRISE_INIT.nom,
            nomCourt:data.nom_court||data.nom?.split(" ").slice(0,2).join(" ")||ENTREPRISE_INIT.nomCourt,
            siret:data.siret||"",
            adresse:data.adresse||"",
            tel:data.tel||"",
            email:data.email||authUser.email||"",
            activite:data.activite||ENTREPRISE_INIT.activite,
            tva:data.tva??true,
            logo:data.logo||null,
            role:data.role||"patron",
            patron_user_id:data.patron_user_id||null,
            integrations:data.integrations||{},
            agents_enabled:data.agents_enabled||{devis:true,chantier:true,comptabilite:true,planning:true},
          });
          if(data.statut) setStatut(data.statut);
          const onbDone=data.onboarding_done===true||(typeof data.nom==="string"&&data.nom.trim().length>0);
          if(onbDone)setOnboardingDone(true);
          // Wizard onboarding (8 étapes) : seulement pour les patrons (pas
          // les ouvriers/sous-traitants). Auto-ouvre si pas terminé (< 9).
          // Note : les anciens utilisateurs qui avaient wizard_step=5 (ancienne
          // sentinelle 'done' à 5 étapes) seront re-déclenchés au step 5 ; ils
          // peuvent passer rapidement les nouvelles étapes ou cliquer 'Tout
          // passer' pour repasser à 9.
          const ws=Number.isInteger(data.wizard_step)?data.wizard_step:0;
          setWizardStep(ws);
          if(onbDone&&ws<9&&data.role!=="ouvrier"&&data.role!=="soustraitant"){
            setWizardOpen(true);
          }
          // Bascule directe sur Chantiers pour les invités (ouvrier/sous-traitant)
          if(data.role==="ouvrier"||data.role==="soustraitant"){
            setView("chantiers");
            return;
          }
          // ⚠ FIX bug invitation : un user peut avoir une ligne entreprises
          // avec role='patron' (valeur par défaut de la colonne ou ligne créée
          // avant l'invitation). Si son email correspond à un salarié dans
          // l'équipe d'un patron, on force la bascule en role='ouvrier'.
          const emailExist=(authUser.email||"").trim();
          if(!emailExist)return;
          try{
            const{data:p1bis}=await supabase.rpc("find_patron_by_email",{p_email:emailExist});
            if(p1bis){
              const upd={user_id:authUser.id,role:"ouvrier",patron_user_id:p1bis,onboarding_done:true};
              const{error:upErr}=await supabase.from("entreprises").upsert(upd,{onConflict:"user_id"});
              if(upErr){console.warn("[invitation upsert]",upErr.message);return;}
              entrepriseSkipRef.current=true;
              setEntreprise(e=>({...e,role:"ouvrier",patron_user_id:p1bis}));
              setView("chantiers");
              setNotif({type:"ok",msg:"✓ Espace ouvrier activé — vous êtes connecté à l'équipe de votre patron."});
              return;
            }
            const{data:p2bis}=await supabase.rpc("find_patron_by_email_st",{p_email:emailExist});
            if(p2bis){
              const upd={user_id:authUser.id,role:"soustraitant",patron_user_id:p2bis,onboarding_done:true};
              const{error:upErr}=await supabase.from("entreprises").upsert(upd,{onConflict:"user_id"});
              if(upErr){console.warn("[invitation upsert ST]",upErr.message);return;}
              entrepriseSkipRef.current=true;
              setEntreprise(e=>({...e,role:"soustraitant",patron_user_id:p2bis}));
              setView("chantiers");
              setNotif({type:"ok",msg:"✓ Espace sous-traitant activé."});
              return;
            }
          }catch(e){console.warn("[invitation rpc]",e.message);}
          return;
        }
        // ─── AUTO-MATCH INVITATION (row absente) ───────────────────────────
        // Cas 1ʳᵉ connexion sans ligne entreprises : on cherche dans les
        // salaries des patrons un email qui correspond, puis on insère.
        const email=(authUser.email||"").trim();
        if(!email)return;
        let matchedPatron=null,matchedRole=null;
        try{
          const{data:p1}=await supabase.rpc("find_patron_by_email",{p_email:email});
          if(p1){matchedPatron=p1;matchedRole="ouvrier";}
          else{
            const{data:p2}=await supabase.rpc("find_patron_by_email_st",{p_email:email});
            if(p2){matchedPatron=p2;matchedRole="soustraitant";}
          }
        }catch(e){console.warn("[invitation rpc]",e.message);}
        if(!matchedPatron||cancelled)return;
        // Charge le profil patron (nom, logo, etc.) pour l'afficher à l'ouvrier
        const{data:patronProfile}=await supabase.from("entreprises").select("*").eq("user_id",matchedPatron).maybeSingle();
        // Crée la fiche 'ouvrier'/'soustraitant' liée
        const newRow={
          user_id:authUser.id,
          nom:patronProfile?.nom||"Entreprise",
          nom_court:patronProfile?.nom_court||null,
          siret:patronProfile?.siret||null,
          email:email,
          role:matchedRole,
          patron_user_id:matchedPatron,
          statut:patronProfile?.statut||"sarl",
          logo:patronProfile?.logo||null,
          onboarding_done:true,
        };
        const{error:insErr}=await supabase.from("entreprises").upsert(newRow,{onConflict:"user_id"});
        if(insErr){console.warn("[invitation insert]",insErr.message);return;}
        entrepriseSkipRef.current=true;
        setEntreprise({
          nom:newRow.nom,
          nomCourt:newRow.nom_court||newRow.nom,
          siret:newRow.siret||"",
          adresse:patronProfile?.adresse||"",
          tel:patronProfile?.tel||"",
          email:email,
          activite:patronProfile?.activite||"",
          tva:patronProfile?.tva??true,
          logo:newRow.logo,
          role:matchedRole,
          patron_user_id:matchedPatron,
        });
        if(patronProfile?.statut) setStatut(patronProfile.statut);
        setOnboardingDone(true);
        // Bypass total : ouvrier/sous-traitant ouvre direct la vue Chantiers
        setView("chantiers");
        setNotif({type:"ok",msg:`✓ Bienvenue ! Vous êtes connecté en tant que ${matchedRole==="ouvrier"?"ouvrier":"sous-traitant"} de ${patronProfile?.nom||"votre patron"}.`});
      }catch(e){
        console.warn("[profile load] erreur inattendue :",e?.message||e);
      }finally{
        if(!cancelled){clearTimeout(safetyTimer);setLoadingProfile(false);}
      }
    })();
    return ()=>{cancelled=true;clearTimeout(safetyTimer);};
  // ⚠ Dépendance sur authUser?.id (pas authUser objet) — sinon Supabase
  // recrée un nouvel objet user à chaque onAuthStateChange (TOKEN_REFRESHED,
  // INITIAL_SESSION…) et le useEffect re-trigger en boucle, le finally
  // précédent étant gardé par !cancelled ne reset pas loadingProfile,
  // résultat : spinner infini.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[authUser?.id]);

  // Sauvegarde l'entreprise dans Supabase à chaque modification (debounce 800ms).
  // Gardée par onboardingDone+authUser pour éviter d'écraser avec ENTREPRISE_INIT
  // pendant les transitions logout/login. Pas de save en mode ouvrier (read-only).
  useEffect(()=>{
    if(!supabase||!authUser||!onboardingDone)return;
    if(entrepriseSkipRef.current){entrepriseSkipRef.current=false;return;}
    if(entreprise?.role==="ouvrier"||entreprise?.role==="soustraitant")return;
    const t=setTimeout(async()=>{
      try{
        // Colonnes "core" garanties par la migration de base 20260502
        const coreRow={
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
        // Colonnes ajoutées par les migrations ultérieures (peuvent ne pas
        // exister sur une instance pas à jour). On les inclut d'abord ; si
        // l'upsert échoue, on retry avec coreRow seul.
        const fullRow={
          ...coreRow,
          role:entreprise?.role||"patron",                    // 20260503
          integrations:entreprise?.integrations||{},          // 20260508
          onboarding_done:true,                               // 20260506
        };
        // .select() pour récupérer l'id généré côté DB et l'injecter dans le
        // state local — sinon les sync downstream (salaries.entreprise_id)
        // restent bloqués jusqu'au prochain reload de l'app.
        let{data:upData,error}=await supabase.from("entreprises").upsert(fullRow,{onConflict:"user_id"}).select().maybeSingle();
        if(error){
          const m=(error.message||"").toLowerCase();
          // Si une colonne ajoutée par une migration n'existe pas, retry
          // sur le coreRow pour au moins persister l'essentiel.
          if(m.includes("column")&&m.includes("does not exist")){
            console.warn("[entreprises save] retry sans colonnes optionnelles :",error.message);
            const r2=await supabase.from("entreprises").upsert(coreRow,{onConflict:"user_id"}).select().maybeSingle();
            if(r2.error){
              console.warn("[entreprises save] retry échoué :",r2.error.message);
              setNotif({type:"err",msg:`⚠️ Profil non sauvegardé : ${r2.error.message}. Migration Supabase incomplète.`});
            }else{
              upData=r2.data;
              setNotif({type:"ok",msg:"⚠️ Profil sauvegardé en mode dégradé — exécutez les migrations Supabase manquantes (role, integrations, onboarding_done) pour la persistance complète."});
            }
          }else{
            console.warn("[entreprises save]",error.message);
            setNotif({type:"err",msg:`⚠️ Profil non sauvegardé : ${error.message}`});
          }
        }
        // Hydrate l'id PK dans le state local s'il n'est pas encore connu
        if(upData?.id&&!entreprise?.id){
          setEntreprise(e=>({...e,id:upData.id,user_id:upData.user_id||authUser?.id}));
        }
      }catch(e){
        console.warn("[entreprises save]",e);
        setNotif({type:"err",msg:`⚠️ Erreur sauvegarde profil : ${e?.message||e}`});
      }
    },800);
    return ()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[entreprise,statut,authUser?.id,onboardingDone]);

  // ─── PERSISTENCE SUPABASE (devis, chantiers, salaries) ─────────────
  // Stratégie : à chaque login, on remplace le state local par les données
  // de l'utilisateur. Sur chaque modif (debounce 800ms) on synchronise par
  // upsert + delete des lignes orphelines.
  const [supaReady,setSupaReady]=useState(true);
  const supaSkipRef=useRef({devis:0,chantiers_v2:0,salaries:0,soustraitants:0});

  useEffect(()=>{
    if(!supabase||!authUser){setSupaReady(true);return;}
    let cancelled=false;
    setSupaReady(false);
    // Si l'utilisateur est un ouvrier/sous-traitant invité, on lit les données
    // de SON PATRON (RLS étendue côté SQL autorise le SELECT cross-user).
    // Sinon on lit ses propres données.
    const isInvited=entreprise?.role==="ouvrier"||entreprise?.role==="soustraitant";
    const targetUserId=isInvited&&entreprise?.patron_user_id?entreprise.patron_user_id:authUser.id;
    Promise.all([
      // Devis : confidentiels patron — pas d'accès ouvrier
      isInvited?Promise.resolve({data:[],error:null}):supabase.from("devis").select("*").eq("user_id",targetUserId),
      supabase.from("chantiers_v2").select("*").eq("user_id",targetUserId),
      supabase.from("salaries").select("*").eq("user_id",targetUserId),
      supabase.from("soustraitants").select("*").eq("user_id",targetUserId),
      // Fournisseurs et leurs documents — confidentiels patron (pas d'accès ouvrier)
      isInvited?Promise.resolve({data:[],error:null}):supabase.from("fournisseurs").select("*").eq("user_id",targetUserId),
      isInvited?Promise.resolve({data:[],error:null}):supabase.from("commandes_fournisseur").select("*").eq("user_id",targetUserId),
      isInvited?Promise.resolve({data:[],error:null}):supabase.from("factures_fournisseur").select("*").eq("user_id",targetUserId),
      // Clients — schéma plat (pas jsonb), confidentiels patron
      isInvited?Promise.resolve({data:[],error:null}):supabase.from("clients").select("*").eq("user_id",targetUserId).order("nom"),
    ]).then(([d,c,s,st,f,cf,ff,cl])=>{
      if(cancelled)return;
      // Skip le save déclenché par le setX qui suit (un par table)
      supaSkipRef.current={devis:1,chantiers_v2:1,salaries:1,soustraitants:1,fournisseurs:1,commandes_fournisseur:1,factures_fournisseur:1,clients:1};
      if(!d.error&&Array.isArray(d.data))setDocs(d.data.map(r=>r.data).filter(Boolean));
      else if(d.error)console.warn("[supa devis load]",d.error.message);
      if(!c.error&&Array.isArray(c.data))setChantiers(c.data.map(r=>r.data).filter(Boolean));
      else if(c.error)console.warn("[supa chantiers_v2 load]",c.error.message);
      // Salaries : si Supabase est vide (nouveau user), on garde les
      // 3 templates initiaux qui seront persistés au prochain save.
      if(!s.error&&Array.isArray(s.data)&&s.data.length>0)setSalaries(s.data.map(r=>r.data).filter(Boolean));
      else if(s.error)console.warn("[supa salaries load]",s.error.message);
      // Sous-traitants : la table peut être absente (migration pas encore exécutée).
      // On log un warning mais on ne bloque pas l'app — l'utilisateur pourra utiliser
      // localement et la sync s'activera dès que la table existe.
      if(!st.error&&Array.isArray(st.data))setSousTraitants(st.data.map(r=>r.data).filter(Boolean));
      else if(st.error)console.warn("[supa soustraitants load]",st.error.message);
      // Fournisseurs / commandes / factures fournisseur : tolérant aux tables
      // absentes (migration 20260512 pas encore exécutée).
      if(!f.error&&Array.isArray(f.data))setFournisseurs(f.data.map(r=>r.data).filter(Boolean));
      else if(f.error)console.warn("[supa fournisseurs load]",f.error.message);
      if(!cf.error&&Array.isArray(cf.data))setCommandesFournisseur(cf.data.map(r=>r.data).filter(Boolean));
      else if(cf.error)console.warn("[supa commandes_fournisseur load]",cf.error.message);
      if(!ff.error&&Array.isArray(ff.data))setFacturesFournisseur(ff.data.map(r=>r.data).filter(Boolean));
      else if(ff.error)console.warn("[supa factures_fournisseur load]",ff.error.message);
      // Clients : schéma plat, on garde les rows tels quels (pas de r.data)
      if(!cl.error&&Array.isArray(cl.data))setClients(cl.data);
      else if(cl.error)console.warn("[supa clients load]",cl.error.message);
      setSupaReady(true);
    }).catch(e=>{
      console.error("[supa load]",e);
      if(!cancelled)setSupaReady(true);
    });
    return ()=>{cancelled=true;};
  },[authUser?.id,entreprise?.role,entreprise?.patron_user_id]);

  // Mode read-only en invitation : on désactive tous les writes Supabase.
  // L'ouvrier lit les données du patron mais ne peut pas les modifier
  // (RLS bloquerait de toute façon — on évite les warnings inutiles).
  const writesEnabled=!(entreprise?.role==="ouvrier"||entreprise?.role==="soustraitant");
  useSupaSync("devis",docs,supaReady&&writesEnabled,authUser,supaSkipRef);
  useSupaSync("chantiers_v2",chantiers,supaReady&&writesEnabled,authUser,supaSkipRef);
  // ⚠ salaries (et potentiellement soustraitants) ont une colonne entreprise_id
  // NOT NULL ajoutée hors migrations versionnées. On l'injecte au moment de
  // l'upsert pour éviter le 23502. Gate sur entreprise.id pour éviter la sync
  // STRICT : la FK salaries.entreprise_id → entreprises.id (UUID PK généré).
  // Pas de fallback sur user_id ni authUser.id (qui sont des références à
  // auth.users — mauvaise FK). Si entreprise.id n'est pas encore chargé,
  // on renvoie null → useSupaSync diffère le sync silencieusement jusqu'à
  // ce que le profil soit prêt.
  const getEntrepriseId=()=>entreprise?.id||null;
  // Schéma prod : salaries / soustraitants ont plusieurs colonnes NOT NULL au
  // top-level (entreprise_id, nom, taux_horaire, qualification…). On hoiste
  // depuis le state React :
  //  - sans arg  → check global (deps prêtes ?)
  //  - avec arg  → row-spécifique (nom/taux/qualif extraits de chaque salarié)
  // Pour vérifier la liste exacte des colonnes NOT NULL côté Supabase :
  //   SELECT column_name, column_default, is_nullable
  //     FROM information_schema.columns
  //    WHERE table_name='salaries' AND is_nullable='NO'
  //    ORDER BY ordinal_position;
  // Si une nouvelle 23502 apparaît sur un autre nom de colonne, ajoute-la ici
  // avec un fallback raisonnable (les candidates probables : poste, coefficient,
  // charges_patron, disponible — toutes ont des valeurs par défaut côté state).
  useSupaSync("salaries",salaries,supaReady&&writesEnabled,authUser,supaSkipRef,
    (it)=>{
      const eid=getEntrepriseId();
      if(!eid)return null;
      if(!it)return{entreprise_id:eid};
      return{
        entreprise_id:eid,
        nom:(it.nom&&String(it.nom).trim())||"(à renommer)",
        taux_horaire:Number.isFinite(+it.tauxHoraire)?+it.tauxHoraire:0,
        qualification:(it.qualification&&String(it.qualification).trim())||"qualifie",
      };
    });
  useSupaSync("soustraitants",sousTraitants,supaReady&&writesEnabled,authUser,supaSkipRef,
    (it)=>{
      const eid=getEntrepriseId();
      if(!eid)return null;
      if(!it)return{entreprise_id:eid};
      return{
        entreprise_id:eid,
        nom:(it.nom&&String(it.nom).trim())||(it.raisonSociale&&String(it.raisonSociale).trim())||"(à renommer)",
      };
    });
  useSupaSync("fournisseurs",fournisseurs,supaReady&&writesEnabled,authUser,supaSkipRef);
  useSupaSync("commandes_fournisseur",commandesFournisseur,supaReady&&writesEnabled,authUser,supaSkipRef);
  useSupaSync("factures_fournisseur",facturesFournisseur,supaReady&&writesEnabled,authUser,supaSkipRef);
  // Sync clients : schéma plat (pas le pattern jsonb de useSupaSync) →
  // upsert avec colonnes natives nom/prenom/email/etc directement.
  useEffect(()=>{
    if(!supaReady||!supabase||!authUser||!writesEnabled)return;
    if(supaSkipRef.current.clients>0){supaSkipRef.current.clients--;return;}
    const t=setTimeout(async()=>{
      try{
        const ids=clients.map(c=>c.id).filter(x=>x!=null);
        if(clients.length>0){
          const rows=clients.map(c=>({
            user_id:authUser.id,
            id:c.id,
            nom:(c.nom||"").trim()||"Sans nom",
            prenom:c.prenom||null,
            email:c.email||null,
            telephone:c.telephone||null,
            adresse:c.adresse||null,
            type:c.type==="professionnel"?"professionnel":"particulier",
            siret:c.siret||null,
            notes:c.notes||null,
          }));
          const{error}=await supabase.from("clients").upsert(rows,{onConflict:"user_id,id"});
          if(error){
            console.warn("[supa clients upsert]",error.message,"| code:",error.code);
            try{window.dispatchEvent(new CustomEvent("cp-supa-error",{detail:{table:"clients",op:"upsert",msg:error.message,code:error.code}}));}catch{}
            return;
          }
        }
        if(ids.length>0){
          const{error:delErr}=await supabase.from("clients")
            .delete().eq("user_id",authUser.id)
            .not("id","in",`(${ids.join(",")})`);
          if(delErr)console.warn("[supa clients delete]",delErr.message);
        }
      }catch(e){console.warn("[supa clients save]",e);}
    },800);
    return()=>clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[clients,supaReady,authUser?.id,writesEnabled]);

  // Écoute les erreurs Supabase remontées par useSupaSync et affiche un notif
  useEffect(()=>{
    function onErr(e){
      const{table,op,msg,code}=e.detail||{};
      setNotif({type:"err",msg:`⚠️ Sync ${table} ${op} échoué (${code||"?"}): ${msg}. Données non persistées.`});
    }
    window.addEventListener("cp-supa-error",onErr);
    return()=>window.removeEventListener("cp-supa-error",onErr);
  },[]);

  // Auto-entrepreneur / micro : un seul salarié possible — "Moi-même".
  // À chaque changement de statut vers solo, on remplace les templates par une
  // unique entrée si l'utilisateur n'a pas déjà un "Moi-même" personnalisé.
  useEffect(()=>{
    if(!isSoloStatut(statut))return;
    // En mode ouvrier/soustraitant, salaries[] = équipe du patron — pas
    // de "Moi-même" auto à insérer (ça pollerait la liste).
    if(entreprise?.role==="ouvrier"||entreprise?.role==="soustraitant")return;
    const hasMoi=salaries.some(s=>s.id===1&&s.isMoi);
    if(hasMoi)return;
    // Remplace les 3 templates par défaut (id 1/2/3) par un seul "Moi-même"
    const restants=salaries.filter(s=>s.id!==1&&s.id!==2&&s.id!==3);
    const moi={id:1,isMoi:true,nom:entreprise?.nom?`Moi-même — ${entreprise.nom}`:"Moi-même",poste:"Auto-entrepreneur",qualification:"chef",tauxHoraire:35,chargesPatron:0.22,coefficient:1,disponible:true,competences:[],couleur:"#16A34A"};
    setSalaries([moi,...restants]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[statut,entreprise?.nom]);

  async function handleLogout(){
    if(supabase) await supabase.auth.signOut();
    setAuthUser(null);
    // Reset local pour éviter le mélange entre comptes lors d'un re-login
    setDocs([]);setChantiers([]);setSalaries([]);setSousTraitants([]);
    setEntreprise(ENTREPRISE_INIT);
  }
  // ─────────────────────────────────────────────────────

  const s=STATUTS[statut];
  const baseModules=s?.modules||STATUTS.sarl.modules;
  // Patron : modules du statut juridique + 'terrain' ajouté.
  // Ouvrier : accès restreint à chantiers + terrain + assistant uniquement.
  // Ouvrier ET sous-traitant ont l'accès restreint (modules limités).
  const isOuvrier=entreprise?.role==="ouvrier"||entreprise?.role==="soustraitant";
  // Module 'media' (IA Réseaux Sociaux) : test interne, visible UNIQUEMENT
  // pour l'admin support. À élargir aux patrons quand ce sera prêt.
  const isAdmin=(authUser?.email||"").trim().toLowerCase()===SUPPORT_ADMIN_EMAIL;
  const modules=isOuvrier?MODULES_OUVRIER:[...baseModules,"terrain",...(isAdmin?["media"]:[])];
  // Pour ouvrier, view par défaut = chantiers (pas accueil)
  const fallbackView=isOuvrier?"chantiers":"accueil";
  const activeView=modules.includes(view)?view:fallbackView;

  function handleOnboarding(data){
    setEntreprise({nom:data.nom||"Mon Entreprise",nomCourt:data.nom?.split(" ").slice(0,2).join(" ")||"Mon Entreprise",siret:data.siret||"",adresse:"",tel:data.tel||"",email:data.email||"",activite:data.activite||"Rénovation générale"});
    setStatut(data.statut||"sarl");setOnboardingDone(true);
    // Déclenche le wizard guidé tout de suite après le SIRET pour un nouveau
    // patron (wizardStep est encore à 0). L'effet de chargement initial
    // n'aura jamais lieu pour ces users (ils n'avaient pas de profil avant).
    if((wizardStep||0)<9)setWizardOpen(true);
  }

  // ─── EXPORT / IMPORT JSON ──────────────────────────────────────────
  function exporterToutJSON(){
    const payload={
      app:"ChantierPro",
      version:1,
      exportedAt:new Date().toISOString(),
      entreprise,statut,
      chantiers,docs,salaries,sousTraitants,
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
    if(Array.isArray(payload.sousTraitants))setSousTraitants(payload.sousTraitants);
    return{ok:true,
      summary:`Import OK: ${payload.chantiers?.length||0} chantier(s), ${payload.docs?.length||0} doc(s), ${payload.salaries?.length||0} salarié(s), ${payload.sousTraitants?.length||0} sous-traitant(s)`};
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
        if(t==="ligne"){
          const fournitures=Array.isArray(l.fournitures)?l.fournitures.map((f,j)=>({
            id:Date.now()+i*100+j+1,
            designation:f.designation||f.libelle||"",
            qte:+f.qte||1,
            unite:f.unite||"U",
            prixAchat:+f.prixAchat||0,
            prixVente:+f.prixVente||+(((+f.prixAchat||0)*1.3).toFixed(2)),
            fournisseur:f.fournisseur||"Point P",
          })):[];
          return{
            ...base,
            qte:+l.qte||1,
            unite:l.unite||"U",
            prixUnitHT:+l.prixUnitHT||0,
            tva:+l.tva||10,
            heuresPrevues:+l.heuresPrevues||0,
            nbOuvriers:+l.nbOuvriers||1,
            fournitures,
            salariesAssignes:[],
          };
        }
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

  // Pendant la résolution du profil (load + RPC auto-match), on affiche un
  // écran de chargement plutôt que l'onboarding — sinon le wizard SIRET/statut
  // flashe brièvement avant que l'auto-match ne le dégage pour un ouvrier.
  // Idem au boot : tant que la session Supabase n'est pas restaurée
  // (authChecked=false) on n'affiche pas l'onboarding pour éviter le flash
  // chez un user déjà loggé qui refresh.
  // ⚠ Gate basé sur loadingProfile (et non !onboardingDone) — sinon on
  // resterait coincé en loading si le profil n'existe pas et que
  // l'auto-match n'a rien donné (cas patron qui doit faire l'onboarding).
  // ─── FLOW INVITATION (mot de passe → auto-match → ouvrier home) ─────────
  // Étapes :
  //   "password"  → SetPasswordScreen (saisie nouveau mdp)
  //   "matching"  → loading "Connexion à votre équipe…" + RPC find_patron
  //   "no-match"  → écran erreur (email pas dans aucune équipe)
  //   null        → flow normal (entreprise load, onboarding, etc.)
  const [inviteFlow,setInviteFlow]=useState(()=>typeof window!=="undefined"?window.__cp_auth_flow__||null:null);
  const [inviteStep,setInviteStep]=useState("password");
  const [inviteError,setInviteError]=useState(null);
  async function resolveInviteRole(){
    setInviteStep("matching");
    setInviteError(null);
    if(!supabase){
      setInviteError("Session invalide — reconnectez-vous via le lien d'invitation.");
      setInviteStep("no-match");return;
    }
    // Récupère le user frais depuis Supabase SDK : après updateUser le state
    // React authUser peut ne pas être encore propagé (onAuthStateChange est
    // async). Sans ça, l'early return tombe sur "Session invalide" et bloque
    // le patron invité par admin Supabase sur l'écran no-match.
    let liveUser=authUser;
    if(!liveUser?.id||!liveUser?.email){
      try{
        const{data}=await supabase.auth.getUser();
        liveUser=data?.user||null;
      }catch{}
    }
    if(!liveUser?.id||!liveUser?.email){
      setInviteError("Session invalide — reconnectez-vous via le lien d'invitation.");
      setInviteStep("no-match");return;
    }
    const email=liveUser.email.trim();
    try{
      // 1) Cherche dans les salaries des patrons
      const{data:p1}=await supabase.rpc("find_patron_by_email",{p_email:email});
      let role=null,patronId=null;
      if(p1){role="ouvrier";patronId=p1;}
      else{
        const{data:p2}=await supabase.rpc("find_patron_by_email_st",{p_email:email});
        if(p2){role="soustraitant";patronId=p2;}
      }
      if(!role){
        // Aucune équipe ne reconnaît cet email → c'est probablement un nouveau
        // patron invité directement par admin Supabase (pas par un autre patron).
        // On ne bloque PAS sur un écran erreur : on laisse le flow normal
        // reprendre la main → entreprise load (vide) → Onboarding wizard SIRET.
        if(typeof window!=="undefined")window.__cp_auth_flow__=null;
        setInviteFlow(null);
        setInviteStep("password");
        setNotif({type:"info",msg:"Bienvenue ! Configurez votre profil entreprise pour commencer."});
        return;
      }
      // 2) Charge le profil patron pour récupérer logo/nom
      const{data:patronProfile}=await supabase.from("entreprises").select("*").eq("user_id",patronId).maybeSingle();
      // 3) Upsert la ligne entreprises de l'ouvrier avec role correct
      const newRow={
        user_id:liveUser.id,
        nom:patronProfile?.nom||"Entreprise",
        nom_court:patronProfile?.nom_court||null,
        siret:patronProfile?.siret||null,
        email:email,
        role:role,
        patron_user_id:patronId,
        statut:patronProfile?.statut||"sarl",
        logo:patronProfile?.logo||null,
        onboarding_done:true,
      };
      const{error:upErr}=await supabase.from("entreprises").upsert(newRow,{onConflict:"user_id"});
      if(upErr){
        console.warn("[invitation upsert entreprises]",upErr.message);
        setInviteError(`Erreur lors de l'enregistrement de votre profil : ${upErr.message}`);
        setInviteStep("no-match");return;
      }
      // 4) Force l'état local pour ne pas dépendre du re-load
      entrepriseSkipRef.current=true;
      setEntreprise({
        nom:newRow.nom,nomCourt:newRow.nom_court||newRow.nom,siret:newRow.siret||"",
        adresse:patronProfile?.adresse||"",tel:patronProfile?.tel||"",email,
        activite:patronProfile?.activite||"",tva:patronProfile?.tva??true,
        logo:newRow.logo,role:role,patron_user_id:patronId,integrations:{},
      });
      if(patronProfile?.statut)setStatut(patronProfile.statut);
      setOnboardingDone(true);
      setView("chantiers");
      setNotif({type:"ok",msg:`✓ Bienvenue ! Vous êtes connecté en tant que ${role==="ouvrier"?"ouvrier":"sous-traitant"} de ${patronProfile?.nom||"votre patron"}.`});
      // 5) Clear le flow
      if(typeof window!=="undefined")window.__cp_auth_flow__=null;
      setInviteFlow(null);
      setInviteStep("password");
    }catch(e){
      console.warn("[invitation resolve]",e?.message||e);
      setInviteError(`Erreur réseau : ${e.message||e}`);
      setInviteStep("no-match");
    }
  }
  if(inviteFlow){
    if(inviteStep==="password")return <SetPasswordScreen flow={inviteFlow} onDone={resolveInviteRole}/>;
    if(inviteStep==="matching")return(
      <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${L.navy} 0%,#2a5298 60%,${L.teal} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",color:"#fff"}}>
        <style>{`@keyframes cpSpin{to{transform:rotate(360deg)}}`}</style>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:30,fontWeight:900,letterSpacing:-1,marginBottom:14}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
          <div style={{width:36,height:36,border:"3px solid rgba(255,255,255,0.25)",borderTopColor:"#fff",borderRadius:"50%",margin:"0 auto 14px",animation:"cpSpin .8s linear infinite"}}/>
          <div style={{fontSize:13,fontWeight:600}}>Connexion à votre équipe…</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:6}}>Recherche de votre patron parmi les comptes ChantierPro</div>
        </div>
      </div>
    );
    // no-match
    return(
      <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${L.navy} 0%,#2a5298 60%,${L.teal} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif"}}>
        <div style={{maxWidth:460,width:"100%",background:L.surface,borderRadius:16,padding:30,boxShadow:"0 20px 50px rgba(0,0,0,0.22)"}}>
          <div style={{textAlign:"center",marginBottom:18}}>
            <div style={{fontSize:38,marginBottom:10}}>⚠️</div>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:L.text}}>Aucune équipe trouvée</h2>
          </div>
          <div style={{padding:"11px 13px",background:L.redBg,color:L.red,borderRadius:8,fontSize:12,marginBottom:14,lineHeight:1.5,border:`1px solid ${L.red}33`}}>{inviteError}</div>
          <div style={{fontSize:12,color:L.textMd,lineHeight:1.6,marginBottom:18}}>
            Pour résoudre ce problème :
            <ol style={{paddingLeft:20,margin:"8px 0"}}>
              <li>Demandez à votre patron de vérifier sa fiche salarié vous concernant.</li>
              <li>L'email doit être <strong>exactement</strong> celui auquel vous avez reçu l'invitation : <code style={{background:L.bg,padding:"1px 5px",borderRadius:3,fontSize:11}}>{authUser?.email}</code></li>
              <li>Une fois corrigé, déconnectez-vous puis reconnectez-vous.</li>
            </ol>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={resolveInviteRole} variant="primary" fullWidth>🔄 Réessayer</Btn>
            <Btn onClick={async()=>{await supabase?.auth.signOut();if(typeof window!=="undefined")window.__cp_auth_flow__=null;setInviteFlow(null);setAuthUser(null);}} variant="secondary">Déconnexion</Btn>
          </div>
        </div>
      </div>
    );
  }

  const showLoadingGate=(!authChecked)||(authUser&&loadingProfile);
  if(showLoadingGate)return(
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${L.navy} 0%,#2a5298 60%,${L.teal} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",color:"#fff"}}>
      <style>{`@keyframes cpSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30,fontWeight:900,letterSpacing:-1,marginBottom:14}}>Chantier<span style={{color:L.accent}}>Pro</span></div>
        <div style={{width:36,height:36,border:"3px solid rgba(255,255,255,0.25)",borderTopColor:"#fff",borderRadius:"50%",margin:"0 auto 14px",animation:"cpSpin .8s linear infinite"}}/>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>Chargement du profil…</div>
      </div>
    </div>
  );
  if(!onboardingDone)return(<>
    <Onboarding onComplete={handleOnboarding} onLogin={()=>setShowLogin(true)}/>
    {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={(u)=>{setAuthUser(u);setShowLogin(false);}}/>}
  </>);

  return(
    <div style={{minHeight:"100vh",background:L.bg,color:L.text,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",display:"flex",height:"100vh",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        html,body{margin:0;padding:0;overflow-x:hidden;-webkit-text-size-adjust:100%;overscroll-behavior-y:contain;touch-action:pan-x pan-y;}
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
        /* Mobile paysage (iPhone landscape ≈ 932×430) : force scroll vertical
           et sidebar compacte. La condition combinée évite de matcher un
           desktop en orientation paysage (qui a winH largement > 500). */
        @media (orientation: landscape) and (max-height: 500px),
               (orientation: landscape) and (max-width: 900px){
          .cp-main-content{overflow-y:auto!important;}
          .cp-modal{max-height:96vh!important;}
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
      <div className="no-print"><Sidebar modules={modules} active={activeView} onNav={v=>setView(v)} entreprise={entreprise} statut={statut} onSettings={isOuvrier?null:()=>setShowSettings(true)} onDevisRapide={isOuvrier?null:()=>setShowDevisRapide(true)} compact={sidebarCompact} terrainUnread={terrainUnreadCount} wizardStep={wizardStep} onOpenWizard={isOuvrier?null:()=>setWizardOpen(true)} agentsUnread={agentsUnreadCount} onChangeNotifsRead={()=>agentsRefreshRef.current?.()}/></div>
      <div className="cp-main-content" style={{flex:1,overflowY:(activeView==="planning"||(activeView==="chantiers"&&!isOuvrier))?"hidden":"auto",padding:activeView==="chantiers"&&!isOuvrier?0:activeView==="chantiers"?14:24,display:"flex",flexDirection:"column",minWidth:0}}>
        {activeView==="accueil"&&<Accueil chantiers={chantiers} docs={docs} entreprise={entreprise} statut={statut} salaries={salaries} onNav={v=>setView(v)} onSettings={()=>setShowSettings(true)} onDevisRapide={()=>setShowDevisRapide(true)} terrainVisits={terrainVisits}/>}
        {activeView==="clients"&&<VueClients clients={clients} setClients={setClients} docs={docs} onNav={v=>setView(v)}/>}
        {activeView==="chantiers"&&(isOuvrier
          ? <VueOuvrierTerrain authUser={authUser} entreprise={entreprise} chantiers={chantiers} setChantiers={setChantiers} salaries={salaries}/>
          : <VueChantiers chantiers={chantiers} setChantiers={setChantiers} selected={selectedChantier} setSelected={setSelectedChantier} salaries={salaries} statut={statut} entreprise={entreprise} terrainVisits={terrainVisits} onTerrainVisit={markTerrainVisited}/>
        )}
        {activeView==="devis"&&<VueDevis chantiers={chantiers} salaries={salaries} sousTraitants={sousTraitants} statut={statut} entreprise={entreprise} docs={docs} setDocs={setDocs} clients={clients} setClients={setClients} onConvertirChantier={convertirDevisEnChantier} onOpenChantier={(id)=>{setSelectedChantier(id);setView("chantiers");}} onSaveOuvrage={addOuvrage} pendingEditDocId={pendingEditDocId} onPendingEditHandled={()=>setPendingEditDocId(null)}/>}
        {activeView==="factures"&&<VueFactures entreprise={entreprise} docs={docs} setDocs={setDocs}/>}
        {activeView==="fournisseurs"&&<VueFournisseurs fournisseurs={fournisseurs} setFournisseurs={setFournisseurs} commandesFournisseur={commandesFournisseur} setCommandesFournisseur={setCommandesFournisseur} facturesFournisseur={facturesFournisseur} setFacturesFournisseur={setFacturesFournisseur} chantiers={chantiers} docs={docs} entreprise={entreprise}/>}
        {activeView==="equipe"&&<VueEquipe salaries={salaries} setSalaries={setSalaries} sousTraitants={sousTraitants} setSousTraitants={setSousTraitants} statut={statut} chantiers={chantiers} authUser={authUser}/>}
        {activeView==="planning"&&<div style={{overflowY:"auto",padding:24,height:"100%"}}><VuePlanning chantiers={chantiers} setChantiers={setChantiers} salaries={salaries} sousTraitants={sousTraitants}/></div>}
        {activeView==="compta"&&<VueCompta chantiers={chantiers} setChantiers={setChantiers} salaries={salaries} sousTraitants={sousTraitants} entreprise={entreprise}/>}
        {activeView==="assistant"&&<VueAssistant entreprise={entreprise} statut={statut} chantiers={chantiers} salaries={salaries} docs={docs}/>}
        {activeView==="terrain"&&<VueTerrain chantiers={chantiers} setChantiers={setChantiers} salaries={salaries} entreprise={entreprise} terrainVisits={terrainVisits} onVisit={markTerrainVisited}/>}
        {activeView==="bibliotheque"&&<VueBibliotheque/>}
        {activeView==="media"&&<VueMedia chantiers={chantiers} entreprise={entreprise} statut={statut} authUser={authUser}/>}
        {activeView==="support"&&<VueSupport authUser={authUser}/>}
      </div>
      {showSettings&&<VueParametres authUser={authUser} entreprise={entreprise} setEntreprise={setEntreprise} statut={statut} setStatut={setStatut} onClose={()=>setShowSettings(false)} onExportJSON={exporterToutJSON} onImportJSON={importerJSON} onImportCSV={importerDevisCSV} onChangeNotifsRead={()=>agentsRefreshRef.current?.()}/>}
      {showDevisRapide&&<DevisRapideIAModal onSave={handleDevisRapide} onClose={()=>setShowDevisRapide(false)} salaries={salaries} statut={statut} entreprise={entreprise} ouvragesPersoCount={Math.max(0,(bibliotheque?.length||0)-BIBLIOTHEQUE_BTP.length)}/>}
      <PWAInstallBanner/>
      {/* Bannières "Nouveautés" séquentielles au login — patron uniquement */}
      <NewFeaturesToast authUser={authUser} role={entreprise?.role||"patron"}/>
      {/* Bannières "Alertes urgentes" agents IA au login — patron uniquement */}
      <NotifsLoginBanner authUser={authUser} role={entreprise?.role||"patron"}/>
      {/* Widget feedback flottant — au-dessus du bouton login */}
      <FeedbackWidget authUser={authUser}/>
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

      {/* Wizard onboarding 8-étapes (auto-ouvert au 1er login après SIRET).
          Sentinelle 'done' = wizard_step >= 9. */}
      {wizardOpen&&(
        <OnboardingWizard
          step={Math.max(1,Math.min(8,wizardStep||1))}
          onAdvance={()=>{
            const next=Math.min(9,(wizardStep||0)+1);
            persistWizardStep(next);
            if(next>=9)setWizardOpen(false);
          }}
          onAction={(s,btnIdx)=>{
            // btnIdx 1 = bouton primaire, 2 = bouton secondaire (étape 8)
            const view=btnIdx===2?s.actionView2:s.actionView;
            if(view==="_devis_rapide_"){setShowDevisRapide(true);}
            else if(view){setView(view);}
            const next=Math.min(9,(wizardStep||0)+1);
            persistWizardStep(next);
            setWizardOpen(false);
          }}
          onSkipAll={()=>{persistWizardStep(9);setWizardOpen(false);}}
          onClose={()=>setWizardOpen(false)}
        />
      )}
    </div>
  );
}
