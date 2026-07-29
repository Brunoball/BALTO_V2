import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BASE_URL from "../../../../config/config.jsx";
import "../../../Global/Global_css/roots.css";
import "../../../Global/Global_css/GlobalsModalsV2.css";
import "../../Ventas/modales/ModalNuevaVenta.css";
import { DEMO_BLOCK_MESSAGE, isBaltoDemoMode } from "../../../../utils/demoMode";

const MOTIVOS = [
  ["DEVOLUCION_MERCADERIA", "Devolución de mercadería al proveedor"],
  ["DESCUENTO", "Descuento"],
  ["BONIFICACION", "Bonificación"],
  ["ANULACION_TOTAL", "Anulación total"],
  ["DIFERENCIA_PRECIO", "Diferencia de precio"],
  ["OTRO", "Otro ajuste"],
];
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function num(v){const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:0;}
function money(v){return Number(v||0).toLocaleString("es-AR",{style:"currency",currency:"ARS"});}
function makeKey(id){
  const uuid = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `nc-compra-${id||0}-${uuid}`.slice(0,100);
}
function auth(){const token=(localStorage.getItem("token")||"").trim();const sessionKey=(localStorage.getItem("session_key")||localStorage.getItem("sessionKey")||localStorage.getItem("X-Session")||"").trim();let idUsuario=0;try{const u=JSON.parse(localStorage.getItem("usuario")||"null");idUsuario=Number(u?.idUsuarioMaster??u?.idUsuario??u?.id_usuario??u?.id??0)||0;}catch{}return{token,sessionKey,idUsuario};}
function headers(json=false){const a=auth();const h=json?{"Content-Type":"application/json"}:{};if(a.sessionKey)h["X-Session"]=a.sessionKey;if(a.token)h.Authorization=`Bearer ${a.token}`;return h;}
async function parse(res){const text=await res.text();let d;try{d=text?JSON.parse(text):null;}catch{throw new Error(text||"Respuesta inválida.");}if(!res.ok||!d?.exito)throw new Error(d?.mensaje||d?.message||"Error en la operación.");return d;}
function allowedFile(file){if(!file)return false;return file.type==="application/pdf"||String(file.type||"").startsWith("image/");}

export default function ModalNotaCreditoProveedor({open,row,onClose,onToast,onDone}){
  const API=`${BASE_URL}/api.php`;
  const [ctx,setCtx]=useState(null);const [items,setItems]=useState([]);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const [motivo,setMotivo]=useState("DEVOLUCION_MERCADERIA");const [observaciones,setObservaciones]=useState("");
  const [tipo,setTipo]=useState("NOTA CREDITO C");const [puntoVenta,setPuntoVenta]=useState("");const [numero,setNumero]=useState("");const [fecha,setFecha]=useState(todayISO());const [cae,setCae]=useState("");
  const [ajuste,setAjuste]=useState("");const [ivaAjuste,setIvaAjuste]=useState("0");const [descripcionAjuste,setDescripcionAjuste]=useState("DESCUENTO / BONIFICACIÓN");const [archivo,setArchivo]=useState(null);
  const fileRef=useRef(null);const keyRef=useRef("");
  const toast=useCallback((t,m,d=3200)=>onToast?.(t,m,d),[onToast]);
  const idOrigen=Number(row?.id_movimiento ?? row?.id_compra ?? row?.id ?? 0);

  const load=useCallback(async()=>{if(!idOrigen)return;setLoading(true);setError("");try{const r=await fetch(`${API}?action=compras_nota_credito_contexto&id_movimiento=${idOrigen}`,{headers:headers()});const d=await parse(r);const c=d.contexto||d.data?.contexto;setCtx(c);setItems((c?.items||[]).map(it=>({id_item_origen:Number(it.id_item),descripcion:it.descripcion_resuelta||it.descripcion||"Ítem",disponible:Number(it.cantidad_disponible||0),cantidadOriginal:Number(it.cantidad_original||it.cantidad||0),subtotalOriginal:Number(it.subtotal||0),ivaOriginal:Number(it.iva_monto||0),totalOriginal:Number(it.total||0),iva_pct:Number(it.iva_pct||0),cantidad:"",afecta_stock:true})));}catch(e){setError(e.message||"No se pudo cargar la compra.");}finally{setLoading(false);}},[API,idOrigen]);
  useEffect(()=>{if(!open)return;keyRef.current=makeKey(idOrigen);setCtx(null);setItems([]);setError("");setMotivo("DEVOLUCION_MERCADERIA");setObservaciones("");setTipo("NOTA CREDITO C");setPuntoVenta("");setNumero("");setFecha(todayISO());setCae("");setAjuste("");setIvaAjuste("0");setDescripcionAjuste("DESCUENTO / BONIFICACIÓN");setArchivo(null);load();},[open,idOrigen,load]);
  useEffect(()=>{if(!open)return;const prev=document.body.style.overflow;document.body.style.overflow="hidden";const k=e=>{if(e.key==="Escape"&&!loading)onClose?.();};document.addEventListener("keydown",k,true);return()=>{document.body.style.overflow=prev;document.removeEventListener("keydown",k,true);};},[open,loading,onClose]);
  useEffect(()=>{if(motivo==="ANULACION_TOTAL"){setItems(p=>p.map(x=>({...x,cantidad:x.disponible>0?String(x.disponible):"",afecta_stock:false})));setAjuste("");}else if(["DESCUENTO","BONIFICACION","DIFERENCIA_PRECIO"].includes(motivo)){setItems(p=>p.map(x=>({...x,cantidad:"",afecta_stock:false})));}},[motivo]);

  const selected=useMemo(()=>items.filter(x=>num(x.cantidad)>0).map(x=>{const q=num(x.cantidad),base=Math.max(.000001,x.cantidadOriginal);return{...x,cantidad:q,subtotal:Number((x.subtotalOriginal/base*q).toFixed(2)),iva_monto:Number((x.ivaOriginal/base*q).toFixed(2)),total:Number((x.totalOriginal/base*q).toFixed(2))};}),[items]);
  const ajusteN=Math.max(0,num(ajuste));const total=useMemo(()=>Number((selected.reduce((a,x)=>a+x.total,0)+ajusteN).toFixed(2)),[selected,ajusteN]);const disponible=Number(ctx?.total_disponible||0);const excede=total-disponible>.05;
  const valid=total>0&&!excede&&numero.trim()!==""&&tipo.trim()!==""&&archivo&&selected.every(x=>x.cantidad<=x.disponible+.0001);

  const submit=async()=>{if(isBaltoDemoMode())return toast("advertencia",DEMO_BLOCK_MESSAGE,5200);if(!valid)return setError(!archivo?"Adjuntá la nota de crédito enviada por el proveedor.":"Completá el comprobante y seleccioná un importe válido.");setLoading(true);setError("");try{const body={id_movimiento_origen:idOrigen,modalidad:"PROVEEDOR",motivo,fecha,observaciones,id_usuario:auth().idUsuario||null,idempotency_key:keyRef.current,comprobante_tipo:tipo,comprobante_punto_venta:Number(puntoVenta||0)||null,comprobante_numero:numero.trim(),comprobante_fecha:fecha,comprobante_cae:cae.trim(),items:selected.map(x=>({id_item_origen:x.id_item_origen,cantidad:x.cantidad,afecta_stock:Boolean(x.afecta_stock)})),importe_ajuste:ajusteN,iva_pct_ajuste:Math.max(0,num(ivaAjuste)),descripcion_ajuste:descripcionAjuste||"DESCUENTO / BONIFICACIÓN"};const r=await fetch(`${API}?action=compras_nota_credito_crear`,{method:"POST",headers:headers(true),body:JSON.stringify(body)});const d=await parse(r);const idNc=Number(d.id_movimiento_nota_credito||d.data?.id_movimiento_nota_credito||0);if(idNc&&archivo){const fd=new FormData();fd.append("archivo",archivo);fd.append("tipo","NOTA_CREDITO_PROVEEDOR");fd.append("force","0");fd.append("ids_movimiento",JSON.stringify([idNc]));const ur=await fetch(`${API}?action=compras_comprobantes_vincular_movimientos_lote_upload`,{method:"POST",headers:headers(),body:fd});await parse(ur);}toast("exito","Nota de crédito del proveedor registrada correctamente.",4200);onDone?.(d);onClose?.();}catch(e){setError(e.message||"No se pudo registrar la nota de crédito.");toast("error",e.message||"No se pudo registrar la nota de crédito.",4600);}finally{setLoading(false);}};

  if(!open)return null;
  return createPortal(<div className="gm-modal-overlay"><div className="gm-modal-container gm-modal-v2 modal-nc-container" role="dialog" aria-modal="true">
    <div className="gm-modal-header"><div className="gm-modal-head-left"><h2 className="gm-modal-title">Nota de crédito del proveedor</h2><p className="gm-modal-subtitle">Compra #{idOrigen||"—"}</p></div><button className="gm-modal-close" onClick={onClose} disabled={loading}>✕</button></div>
    <div className="gm-modal-content modal-nc-body">{loading&&!ctx&&<div className="modal-nc-loading">Cargando compra…</div>}{error&&<div className="modal-nc-error">{error}</div>}{ctx&&<>
      <div className="modal-nc-grid modal-nc-grid--totals"><div className="modal-nc-card"><span>Total compra</span><strong>{money(ctx.total_original)}</strong></div><div className="modal-nc-card"><span>Ya acreditado</span><strong>{money(ctx.total_acreditado)}</strong></div><div className="modal-nc-card"><span>Disponible</span><strong>{money(disponible)}</strong></div><div className="modal-nc-card modal-nc-card--accent"><span>Esta nota</span><strong>{money(total)}</strong></div></div>
      <div className="modal-nc-section-title">Comprobante recibido</div><div className="modal-nc-form-grid modal-nc-form-grid--three">
        <label className="modal-nc-field"><span>Tipo</span><select value={tipo} onChange={e=>setTipo(e.target.value)}><option>NOTA CREDITO A</option><option>NOTA CREDITO B</option><option>NOTA CREDITO C</option><option>NOTA CREDITO M</option><option>OTRA</option></select></label>
        <label className="modal-nc-field"><span>Punto de venta</span><input inputMode="numeric" value={puntoVenta} onChange={e=>setPuntoVenta(e.target.value.replace(/\D/g,""))}/></label>
        <label className="modal-nc-field"><span>Número</span><input value={numero} onChange={e=>setNumero(e.target.value.replace(/[^0-9-]/g,""))}/></label>
        <label className="modal-nc-field"><span>Fecha</span><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></label>
        <label className="modal-nc-field"><span>CAE (opcional)</span><input value={cae} onChange={e=>setCae(e.target.value.replace(/\D/g,""))}/></label>
        <label className="modal-nc-field"><span>Archivo PDF o imagen</span><input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={e=>{const f=e.target.files?.[0]||null;if(f&&!allowedFile(f)){setError("Solo se permiten imágenes o PDF.");e.target.value="";setArchivo(null);}else setArchivo(f);}}/></label>
      </div>
      <div className="modal-nc-form-grid"><label className="modal-nc-field"><span>Motivo</span><select value={motivo} onChange={e=>setMotivo(e.target.value)}>{MOTIVOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="modal-nc-field"><span>Observaciones</span><input value={observaciones} onChange={e=>setObservaciones(e.target.value.toUpperCase())} placeholder="DETALLE OPCIONAL"/></label></div>
      <div className="modal-nc-section-title">Productos devueltos al proveedor</div><div className="modal-nc-table-wrap"><table className="modal-nc-table"><thead><tr><th>Producto</th><th>Disponible</th><th>Cantidad</th><th>Retira stock</th><th>Importe</th></tr></thead><tbody>{items.map((it,i)=>{const sel=selected.find(x=>x.id_item_origen===it.id_item_origen);return <tr key={it.id_item_origen}><td>{it.descripcion}</td><td>{it.disponible}</td><td><input type="number" min="0" max={it.disponible} step="0.01" value={it.cantidad} disabled={["DESCUENTO","BONIFICACION","DIFERENCIA_PRECIO"].includes(motivo)} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,cantidad:e.target.value}:x))}/></td><td><input type="checkbox" checked={it.afecta_stock} disabled={!num(it.cantidad)} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,afecta_stock:e.target.checked}:x))}/></td><td>{money(sel?.total||0)}</td></tr>;})}</tbody></table></div>
      <div className="modal-nc-section-title">Descuento o ajuste sin stock</div><div className="modal-nc-form-grid modal-nc-form-grid--three"><label className="modal-nc-field"><span>Descripción</span><input value={descripcionAjuste} onChange={e=>setDescripcionAjuste(e.target.value.toUpperCase())}/></label><label className="modal-nc-field"><span>Importe final</span><input type="number" min="0" step="0.01" value={ajuste} onChange={e=>setAjuste(e.target.value)}/></label><label className="modal-nc-field"><span>IVA % incluido</span><input type="number" min="0" step="0.01" value={ivaAjuste} onChange={e=>setIvaAjuste(e.target.value)}/></label></div>
      {excede&&<div className="modal-nc-error">La nota supera el importe disponible de la compra.</div>}
    </>}</div>
    <div className="mit-actions"><button className="mit-btn mit-btn--ghost" onClick={onClose} disabled={loading}>Cancelar</button><button className="mit-btn mit-btn--solid" onClick={submit} disabled={loading||!ctx||!valid}>{loading?"Guardando…":"Registrar nota de crédito"}</button></div>
  </div></div>,document.body);
}
