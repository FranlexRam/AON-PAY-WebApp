"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Currency {
  id: string;
  name: string;
  code: string;
  flag: string;
  rate_to_usdt: number;
  updated_at?: string;
}

const DEFAULT_CURRENCIES: Currency[] = [
  { id: "usa", name: "Estados Unidos", code: "USD", flag: "🇺🇸", rate_to_usdt: 1 },
  { id: "ven", name: "Venezuela", code: "VES", flag: "🇻🇪", rate_to_usdt: 36.5 },
  { id: "col", name: "Colombia", code: "COP", flag: "🇨🇴", rate_to_usdt: 3950.0 },
  { id: "per", name: "Perú", code: "PEN", flag: "🇵🇪", rate_to_usdt: 3.72 },
  { id: "chl", name: "Chile", code: "CLP", flag: "🇨🇱", rate_to_usdt: 940.0 },
  { id: "ecu", name: "Ecuador", code: "USD", flag: "🇪🇨", rate_to_usdt: 1.0 },
  { id: "bra", name: "Brasil", code: "BRL", flag: "🇧🇷", rate_to_usdt: 4.98 },
];

// Función para formatear el tiempo transcurrido
function getRelativeTimeString(dateString?: string): string {
  if (!dateString) return "recientemente";

  const lastUpdate = new Date(dateString).getTime();
  const now = new Date().getTime();
  const diffInMinutes = Math.floor((now - lastUpdate) / (1000 * 60));

  if (diffInMinutes < 1) return "hace unos segundos";
  if (diffInMinutes < 60) return `hace ${diffInMinutes}min`;

  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  if (minutes === 0) return `hace ${hours}h`;
  return `hace ${hours}h ${minutes}min`;
}

export default function Home() {
  const [currencies, setCurrencies] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [loadingRates, setLoadingRates] = useState<boolean>(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>("");

  const [originCurrency, setOriginCurrency] = useState<Currency>(DEFAULT_CURRENCIES[0]);
  const [targetCurrency, setTargetCurrency] = useState<Currency>(DEFAULT_CURRENCIES[1]);

  const [c1Envio, setC1Envio] = useState<string>("");
  const [c1Recibe, setC1Recibe] = useState<string>("");

  const [c2Recibe, setC2Recibe] = useState<string>("");
  const [c2Envio, setC2Envio] = useState<string>("");

  const [modalType, setModalType] = useState<"origin" | "target" | null>(null);

  const PHONE_NUMBER = "584127591543";

  // Cargar y escuchar cambios en tiempo real
  useEffect(() => {
    const fetchRates = async () => {
      setLoadingRates(true);
      const { data, error } = await supabase.from("currencies").select("*").order("id");
      if (!error && data && data.length > 0) {
        updateCurrenciesState(data);
      }
      setLoadingRates(false);
    };

    fetchRates();

    const channel = supabase
      .channel("realtime-currencies")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "currencies" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updatedRow = payload.new as Currency;
            setCurrencies((prev) => {
              const newCurrencies = prev.map((c) => (c.id === updatedRow.id ? updatedRow : c));
              setOriginCurrency((cur) => (cur.id === updatedRow.id ? updatedRow : cur));
              setTargetCurrency((cur) => (cur.id === updatedRow.id ? updatedRow : cur));
              calculateLatestUpdateTime(newCurrencies);
              return newCurrencies;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const calculateLatestUpdateTime = (data: Currency[]) => {
    // Buscar la fecha de actualización más reciente entre todas las monedas
    const timestamps = data
      .map((c) => (c.updated_at ? new Date(c.updated_at).getTime() : 0))
      .filter((ts) => ts > 0);

    if (timestamps.length > 0) {
      const mostRecent = new Date(Math.max(...timestamps)).toISOString();
      setLastUpdatedTime(getRelativeTimeString(mostRecent));
    } else {
      setLastUpdatedTime("hace un momento");
    }
  };

  const updateCurrenciesState = (data: Currency[]) => {
    setCurrencies(data);
    setOriginCurrency((prev) => data.find((c) => c.id === prev.id) || data[0]);
    setTargetCurrency((prev) => data.find((c) => c.id === prev.id) || data[1]);
    calculateLatestUpdateTime(data);
  };

  const currentRate = targetCurrency.rate_to_usdt / originCurrency.rate_to_usdt;

  // Botón de Intercambio (Switch) conservando montos y recalculando
  const handleSwitchCurrencies = () => {
    const newOrigin = targetCurrency;
    const newTarget = originCurrency;

    setOriginCurrency(newOrigin);
    setTargetCurrency(newTarget);

    const newRate = newTarget.rate_to_usdt / newOrigin.rate_to_usdt;

    // Recalcular Tarjeta 1 si hay valor ingresado
    if (c1Envio && !isNaN(Number(c1Envio))) {
      setC1Recibe((parseFloat(c1Envio) * newRate).toFixed(2));
    }

    // Recalcular Tarjeta 2 si hay valor ingresado
    if (c2Recibe && !isNaN(Number(c2Recibe))) {
      setC2Envio((parseFloat(c2Recibe) / newRate).toFixed(2));
    }
  };

  useEffect(() => {
    if (c1Envio && !isNaN(Number(c1Envio))) {
      setC1Recibe((parseFloat(c1Envio) * currentRate).toFixed(2));
    }
    if (c2Recibe && !isNaN(Number(c2Recibe))) {
      setC2Envio((parseFloat(c2Recibe) / currentRate).toFixed(2));
    }
  }, [currentRate]);

  const handleC1EnvioChange = (val: string) => {
    setC1Envio(val);
    if (val === "" || isNaN(Number(val))) {
      setC1Recibe("");
    } else {
      setC1Recibe((parseFloat(val) * currentRate).toFixed(2));
    }
  };

  const handleC2RecibeChange = (val: string) => {
    setC2Recibe(val);
    if (val === "" || isNaN(Number(val))) {
      setC2Envio("");
    } else {
      setC2Envio((parseFloat(val) / currentRate).toFixed(2));
    }
  };

  const handleSelectCurrency = (currency: Currency) => {
    if (modalType === "origin") {
      setOriginCurrency(currency);
    } else if (modalType === "target") {
      setTargetCurrency(currency);
    }
    setModalType(null);
    setC1Envio(""); setC1Recibe("");
    setC2Recibe(""); setC2Envio("");
  };

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
          <div className="text-left space-y-1 border-b border-slate-800/80 pb-3">
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">Tasas de envío</h1>
            <p className="text-xs text-slate-400 font-medium">
              {loadingRates ? "Cargando actualización..." : `Actualizado ${lastUpdatedTime}`}
            </p>
          </div>

          <div className="relative grid grid-cols-2 gap-3 pt-1">
            {/* País Origen */}
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

            {/* BOTÓN SWITCH DE INTERCAMBIO */}
            <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 z-10">
              <button
                onClick={handleSwitchCurrencies}
                title="Intercambiar países"
                className="bg-slate-800 hover:bg-slate-700 active:scale-90 border border-slate-600/80 w-8 h-8 rounded-full flex items-center justify-center text-slate-200 shadow-lg transition-all"
              >
                <span className="text-xs font-bold">⇄</span>
              </button>
            </div>

            {/* País Destino */}
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
            {loadingRates ? (
              <span className="animate-pulse">Cargando tasas actualizadas...</span>
            ) : (
              <>Tasa actual: <span className="text-indigo-400 font-bold">1 {originCurrency.code} = {currentRate.toFixed(4)} {targetCurrency.code}</span></>
            )}
          </div>
        </div>

        {/* TARJETA 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Calculadora por Monto a Enviar
          </h2>

          <div className="space-y-3">
            <div className="bg-slate-800/60 border border-slate-700/50 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-xl p-3 transition-all">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Si se envían ({originCurrency.code})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={c1Envio}
                onChange={(e) => handleC1EnvioChange(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="bg-slate-800/30 border border-slate-800/80 rounded-xl p-3 cursor-not-allowed">
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Se reciben ({targetCurrency.code})
              </label>
              <input
                type="number"
                readOnly
                placeholder="0.00"
                value={c1Recibe}
                className="w-full bg-transparent text-xl font-bold text-emerald-400 outline-none placeholder-slate-700 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

        {/* TARJETA 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Calculadora por Monto a Recibir
          </h2>

          <div className="space-y-3">
            <div className="bg-slate-800/60 border border-slate-700/50 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-xl p-3 transition-all">
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Para recibir ({targetCurrency.code})
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={c2Recibe}
                onChange={(e) => handleC2RecibeChange(e.target.value)}
                className="w-full bg-transparent text-xl font-bold text-emerald-400 outline-none placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="bg-slate-800/30 border border-slate-800/80 rounded-xl p-3 cursor-not-allowed">
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                Hay que enviar ({originCurrency.code})
              </label>
              <input
                type="number"
                readOnly
                placeholder="0.00"
                value={c2Envio}
                className="w-full bg-transparent text-xl font-bold text-white outline-none placeholder-slate-700 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
              {currencies.map((curr) => (
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