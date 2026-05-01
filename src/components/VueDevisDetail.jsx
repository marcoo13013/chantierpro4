import { useState } from "react";
import BoutonIALigne from "./BoutonIALigne";

const L = { blue:"#2563EB", green:"#16A34A", orange:"#D97706", red:"#DC2626", border:"#E2E8F0", text:"#0F172A", textSm:"#64748B", surface:"#FFFFFF", bg:"#F4F6F9" };

function LigneEditable({ ligne, onChange }) {
  const [edit, setEdit] = useState(false);
  const [data, setData] = useState(ligne);

  function update(field, val) {
    const updated = { ...data, [field]: val };
    if (field === "qte" || field === "puHT") {
      updated.totalHT = +(updated.qte * updated.puHT).toFixed(2);
    }
    setData(updated);
    onChange(updated);
  }

  function handleIA(result) {
    const updated = { ...data, heuresPrevues: result.heuresMO, fournitures: result.fournitures };
    setData(updated);
    onChange(updated);
  }

  return (
    <div style={{ borderBottom: `1px solid ${L.border}`, padding: "10px 12px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {edit ? (
          <input value={data.libelle} onChange={e => update("libelle", e.target.value)}
            style={{ flex: 2, border: `1px solid ${L.blue}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 }} />
        ) : (
          <span style={{ flex: 2, fontSize: 13, color: L.text }}>{data.libelle}</span>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {edit ? (
            <>
              <input type="number" value={data.qte} onChange={e => update("qte", +e.target.value)}
                style={{ width: 60, border: `1px solid ${L.blue}`, borderRadius: 4, padding: "4px 6px", fontSize: 13 }} />
              <span style={{ fontSize: 12, color: L.textSm }}>{data.unite}</span>
              <input type="number" value={data.puHT} onChange={e => update("puHT", +e.target.value)}
                style={{ width: 80, border: `1px solid ${L.blue}`, borderRadius: 4, padding: "4px 6px", fontSize: 13 }} />
              <span style={{ fontSize: 12, color: L.textSm }}>€/u</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: L.textSm }}>{data.qte} {data.unite}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{data.puHT} €</span>
            </>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: L.blue, minWidth: 80, textAlign: "right" }}>
            {(+data.totalHT || 0).toFixed(2)} €
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <BoutonIALigne ligne={data} onResult={handleIA} />
          <button onClick={() => setEdit(!edit)}
            style={{ background: edit ? L.green : L.orange, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
            {edit ? "✓ OK" : "✏️"}
          </button>
        </div>
      </div>

      {data.heuresPrevues > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: L.textSm }}>
          🔧 MO : {edit ? (
            <input type="number" value={data.heuresPrevues} onChange={e => update("heuresPrevues", +e.target.value)}
              style={{ width: 50, border: `1px solid ${L.border}`, borderRadius: 4, padding: "2px 4px", fontSize: 12 }} />
          ) : data.heuresPrevues} h × 35€ = <strong>{(data.heuresPrevues * 35).toFixed(2)} €</strong>
        </div>
      )}

      {data.fournitures && data.fournitures.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {data.fournitures.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: L.textSm, marginTop: 2 }}>
              <span style={{ minWidth: 80, fontWeight: 600 }}>{f.fournisseur}</span>
              <span>{f.designation}</span>
              {edit ? (
                <input type="number" value={f.prixAchat} onChange={e => {
                  const fours = [...data.fournitures];
                  fours[i] = { ...f, prixAchat: +e.target.value };
                  update("fournitures", fours);
                }} style={{ width: 70, border: `1px solid ${L.border}`, borderRadius: 4, padding: "2px 4px", fontSize: 12 }} />
              ) : (
                <span style={{ fontWeight: 600, color: L.blue }}>{(+f.prixAchat || 0).toFixed(2)} €</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VueDevisDetail({ devis, onClose, onSave }) {
  const [tranches, setTranches] = useState(devis.tranches || []);

  function updateLigne(tId, lIndex, updated) {
    setTranches(tranches.map(t => t.id !== tId ? t : {
      ...t,
      lignes: t.lignes.map((l, i) => i === lIndex ? updated : l),
      sousTotalHT: +t.lignes.reduce((a, l, i) => a + (i === lIndex ? updated.totalHT : l.totalHT || 0), 0).toFixed(2)
    }));
  }

  const totalHT = +tranches.reduce((a, t) => a + (t.sousTotalHT || 0), 0).toFixed(2);
  const totalTTC = +(totalHT * 1.2).toFixed(2);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 0" }}>
      <div style={{ background: L.surface, borderRadius: 12, width: "95%", maxWidth: 800, margin: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${L.border}`, display: "flex", justifyContent: "space-between", alignI
</div>
          <div style={{padding:"16px 24px"}}>
            {tranches.map(t=>(
              <div key={t.id} style={{marginBottom:16,border:`1px solid ${L.border}`,borderRadius:8,overflow:"hidden"}}>
                <div style={{background:L.bg,padding:"8px 12px",display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontWeight:700,fontSize:13}}>{t.titre}</span>
                  <span style={{fontWeight:700,fontSize:13,color:L.blue}}>{(+t.sousTotalHT||0).toFixed(2)} €</span>
                </div>
                {(t.lignes||[]).map((l,i)=>(
                  <LigneEditable key={i} ligne={l} onChange={updated=>updateLigne(t.id,i,updated)}/>
                ))}
              </div>
            ))}
          </div>
          <div style={{padding:"16px 24px",borderTop:`1px solid ${L.border}`,display:"flex",justifyContent:"flex-end",gap:24}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,color:L.textSm}}>Total HT</div>
              <div style={{fontSize:20,fontWeight:700}}>{(+totalHT).toFixed(2)} €</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,color:L.textSm}}>Total TTC</div>
              <div style={{fontSize:20,fontWeight:700,
