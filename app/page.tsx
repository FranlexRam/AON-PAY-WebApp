"use client";

import React, { useState } from "react";

// Estructura de tipo para los países / divisas
interface Currency {
  id: string;
  name: string;
  code: string;
  flag: string;
  rateToUSDT: number; // Tasa referencial base (se sincronizará con Supabase más adelante)
}

// Lista actualizada de países solicitados
const AVAILABLE_CURRENCIES: Currency[] = [
  { id: "usa", name: "Estados Unidos", code: "USD", flag: "🇺🇸", rateToUSDT: 1 },
  { id: "ven", name: "Venezuela", code: "VES", flag: "🇻🇪", rateToUSDT: 36.5 },
  { id: "col", name: "Colombia", code: "COP", flag: "🇨🇴", rateToUSDT: 3950.0 },
  { id: "per", name: "Perú", code: "PEN", flag: "🇵🇪", rateToUSDT: 3.72 },
  { id: "chl", name: "Chile", code: "CLP", flag: "🇨🇱", rateToUSDT: 940.0 },
  { id: "ecu", name: "Ecuador", code: "USD", flag: "🇪🇨", rateToUSDT: 1.0 },
  { id: "bra", name: "Brasil", code: "BRL", flag: "🇧🇷", rateToUSDT: 4.98 },
];

export default function Home() {
  // Selección de divisas globales para la sesión
  const [originCurrency, setOriginCurrency] = useState<Currency>(AVAILABLE_CURRENCIES[0]); // USA (USD)
  const [targetCurrency, setTargetCurrency] = useState<Currency>(AVAILABLE_CURRENCIES[1]); // Venezuela (VES)

  // Estados Calculadora 1: "Si se envían" -> "Se reciben"
  const [c1Envio, setC1Envio] = useState<string>("");
  const [c1Recibe, setC1Recibe] = useState<string>("");

  // Estados Calculadora 2: "Para recibir" -> "Hay que enviar"
  const [c2Recibe, setC2Recibe] = useState<string>("");
  const [c2Envio, setC2Envio] = useState<string>("");

  // Estado para el modal selector de país
  const [modalType, setModalType] = useState<"origin" | "target" | null>(null);

  // Número oficial para WhatsApp
  const PHONE_NUMBER = "584127591543";

  // Tasa de cambio cruzada entre Origen y Destino
  const currentRate = targetCurrency.rateToUSDT / originCurrency.rateToUSDT;

  // --- LÓGICA CALCULADORA 1 ---
  const handleC1EnvioChange = (val: string) => {
    setC1Envio(val);
    if (val === "" || isNaN(Number(val))) {
      setC1Recibe("");
    } else {
      setC1Recibe((parseFloat(val) * currentRate).toFixed(2));
    }
  };

  const handleC1RecibeChange = (val: string) => {
    setC1Recibe(val);
    if (val === "" || isNaN(Number(val))) {
      setC1Envio("");
    } else {
      setC1Envio((parseFloat(val) / currentRate).toFixed(2));
    }
  };

  // --- LÓGICA CALCULADORA 2 ---
  const handleC2RecibeChange = (val: string) => {
    setC2Recibe(val);
    if (val === "" || isNaN(Number(val))) {
      setC2Envio("");
    } else {
      setC2Envio((parseFloat(val) / currentRate).toFixed(2));
    }
  };

  const handleC2EnvioChange = (val: string) => {
    setC2Envio(val);
    if (val === "" || isNaN(Number(val))) {
      setC2Recibe("");
    } else {
      setC2Recibe((parseFloat(val) * currentRate).toFixed(2));
    }
  };

  // Cambio de selección de divisa en Modal
  const handleSelectCurrency = (currency: Currency) => {
    if (modalType === "origin") {
      setOriginCurrency(currency);
    } else if (modalType === "target") {
      setTargetCurrency(currency);
    }
    setModalType(null);
    // Limpiar campos al cambiar de moneda
    setC1Envio(""); setC1Recibe("");
    setC2Recibe(""); setC2Envio("");
  };

  // Envío a WhatsApp
  const handleWhatsAppSend = (montoEnvio: string, montoRecibo: string, tipoOperacion: string) => {
    if (!montoEnvio || parseFloat(montoEnvio) <= 0) {
      alert("Por favor ingresa un monto válido antes de consultar.");
      return;
    }

    const text = `Hola! Quisiera realizar una consulta (${tipoOperacion}):\n\n` +
      `*Envía:* ${montoEnvio} ${originCurrency.code} (${originCurrency.name})\n` +
      `*Recibe:* ${montoRecibo} ${targetCurrency.code} (${targetCurrency.name})\n` +
      `*Tasa Aplicada:* 1 ${originCurrency.code} = ${currentRate.toFixed(4)} ${targetCurrency.code}\n\n` +
      `¿Me confirman disponibilidad para operar?`;

    const url = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start p-4 py-8">
      <div className="w-full max-w-md space-y-6">
        
        {/* ENCABEZADO Y SELECCIÓN DE PAÍSES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-slate-100">Tasas de Envío</h1>
            <p className="text-xs text-amber-400 font-medium bg-amber-500/10 py-1 px-3 rounded-full inline-block border border-amber-500/20">
              ⚠️ Tasas referenciales. Se confirman al momento de la operación.
            </p>
          </div>

          {/* Selector de Ruta (Origen -> Destino) */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                País Origen
              </span>
              <button
                onClick={() => setModalType("origin")}
                className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 p-2.5 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-lg">{originCurrency.flag}</span>
                  <span className="text-xs font-bold truncate">{originCurrency.code}</span>
                </div>
                <span className="text-slate-400 text-xs">▼</span>
              </button>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                País Destino
              </span>
              <button
                onClick={() => setModalType("target")}
                className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 p-2.5 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-lg">{targetCurrency.flag}</span>
                  <span className="text-xs font-bold truncate">{targetCurrency.code}</span>
                </div>
                <span className="text-slate-400 text-xs">▼</span>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400 pt-1">
            Tasa actual: <span className="text-indigo-400 font-bold">1 {originCurrency.code} = {currentRate.toFixed(4)} {targetCurrency.code}</span>
          </div>
        </div>

        {/* TARJETA 1: CALCULAR CUÁNTO RECIBE SI ENVÍA UN MONTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Calculadora por Monto a Enviar
          </h2>

          <div className="space-y-3">
            {/* Si se envían */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Si se envían ({originCurrency.code})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={c1Envio}
                onChange={(e) => handleC1EnvioChange(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder-slate-600"
              />
            </div>

            {/* Se reciben */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Se reciben ({targetCurrency.code})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={c1Recibe}
                onChange={(e) => handleC1RecibeChange(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-emerald-400 outline-none placeholder-slate-600"
              />
            </div>
          </div>

          <button
            onClick={() => handleWhatsAppSend(c1Envio, c1Recibe, "Monto a Enviar")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
          >
            <span>Consultar este envío por WhatsApp</span>
          </button>
        </div>

        {/* TARJETA 2: CALCULAR CUÁNTO ENVIAR PARA RECIBIR MONTO EXACTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Calculadora por Monto a Recibir
          </h2>

          <div className="space-y-3">
            {/* Para recibir */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Para recibir ({targetCurrency.code})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={c2Recibe}
                onChange={(e) => handleC2RecibeChange(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-emerald-400 outline-none placeholder-slate-600"
              />
            </div>

            {/* Hay que enviar */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Hay que enviar ({originCurrency.code})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={c2Envio}
                onChange={(e) => handleC2EnvioChange(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder-slate-600"
              />
            </div>
          </div>

          <button
            onClick={() => handleWhatsAppSend(c2Envio, c2Recibe, "Monto a Recibir")}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
          >
            <span>Consultar este envío por WhatsApp</span>
          </button>
        </div>

      </div>

      {/* MODAL SELECTOR DE PAÍS */}
      {modalType !== null && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100">
                Selecciona País de {modalType === "origin" ? "Origen" : "Destino"}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-white text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {AVAILABLE_CURRENCIES.map((curr) => (
                <button
                  key={curr.id}
                  onClick={() => handleSelectCurrency(curr)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{curr.flag}</span>
                    <div>
                      <p className="font-semibold text-sm text-slate-100">{curr.name}</p>
                      <p className="text-xs text-slate-400">{curr.code}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}