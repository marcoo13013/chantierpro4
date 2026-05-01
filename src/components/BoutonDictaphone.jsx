import{useState}from"react";
export default function BoutonDictaphone({onResult}){
  const[actif,setActif]=useState(false);
  function toggle(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Micro non supporté sur ce navigateur");return;}
    const rec=new SR();
    rec.lang="fr-FR";
    rec.interimResults=false;
    rec.maxAlternatives=1;
    rec.onstart=()=>setActif(true);
    rec.onend=()=>setActif(false);
    rec.onresult=e=>onResult(e.results[0][0].transcript);
    rec.onerror=()=>setActif(false);
    rec.start();
  }
  return(
    <button onClick={toggle} title={actif?"Écoute en cours...":"Dicter la désignation"} style={{background:actif?"#DC2626":"#6B7280",color:"#fff",border:"none",borderRadius:6,padding:"4px 8px",fontSize:14,cursor:"pointer",animation:actif?"pulse 1s infinite":"none"}}>
      {actif?"🔴":"🎤"}
    </button>
  );
}
