"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Currency {
  id: string;
  name: string;
  code: string;
  flag: string;
  rate_to_usdt: number;
  lauren_rate?: number;
  operator?: "divide" | "multiply";
  updated_at?: string;
}

interface BcvData {
  usd: number | null;
  eur: number | null;
}

const DEFAULT_CURRENCIES: Currency[] = [
  { id: "usa", name: "Estados Unidos", code: "USD", flag: "🇺🇸", rate_to_usdt: 1, lauren_rate: 690, operator: "divide" },
  { id: "ven", name: "Venezuela", code: "VES", flag: "🇻🇪", rate_to_usdt: 1, lauren_rate: 1, operator: "divide" },
  { id: "col", name: "Colombia", code: "COP", flag: "🇨🇴", rate_to_usdt: 3950.0, lauren_rate: 4.88, operator: "multiply" },
  { id: "per", name: "Perú", code: "PEN", flag: "🇵🇪", rate_to_usdt: 3.72, lauren_rate: 233, operator: "divide" },
  { id: "chl", name: "Chile", code: "CLP", flag: "🇨🇱", rate_to_usdt: 940.0, lauren_rate: 0.74, operator: "multiply" },
  { id: "ecu", name: "Ecuador", code: "USD", flag: "🇪🇨", rate_to_usdt: 1.0, lauren_rate: 690, operator: "divide" },
  { id: "bra", name: "Brasil", code: "BRL", flag: "🇧🇷", rate_to_usdt: 4.98, lauren_rate: 4.98, operator: "divide" },
];

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

// FORMATO PARA INPUTS Y RESULTADOS (MILES + 2 DECIMALES)
function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// FORMATO DINÁMICO PARA TASA ACTUAL
function formatRate(rate: number): string {
  if (isNaN(rate)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate);
}

export default function Home() {
  const [currencies, setCurrencies] = useState<Currency[]>(DEFAULT_CURRENCIES);
  const [loadingRates, setLoadingRates] = useState<boolean>(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>("");

  const [originCurrency, setOriginCurrency] = useState<Currency>(DEFAULT_CURRENCIES[0]);
  const [targetCurrency, setTargetCurrency] = useState<Currency>(DEFAULT_CURRENCIES[1]);

  // CALCULADORA 1: ESTADOS
  const [c1Envio, setC1Envio] = useState<string>("");
  const [c1Recibe, setC1Recibe] = useState<string>("");

  // CALCULADORA 2: ESTADOS
  const [c2Recibe, setC2Recibe] = useState<string>("");
  const [c2RecibeUsd, setC2RecibeUsd] = useState<string>("");
  const [c2Envio, setC2Envio] = useState<string>("");

  // Referencia oficial BCV
  const [bcvData, setBcvData] = useState<BcvData>({ usd: null, eur: null });

  // ESTADOS DEL MODAL
  const [modalType, setModalType] = useState<"origin" | "target" | null>(null);
  const [isClosingModal, setIsClosingModal] = useState<boolean>(false);

  const PHONE_NUMBER = "584127591543";

  useEffect(() => {
    const fetchRates = async () => {
      setLoadingRates(true);
      const { data, error } = await supabase.from("currencies").select("*").order("id");
      if (!error && data && data.length > 0) {
        updateCurrenciesState(data);
      }
      setLoadingRates(false);
    };

    const fetchBcv = async () => {
      try {
        const res = await fetch("/api/bcv");
        if (res.ok) {
          const data = await res.json();
          setBcvData({ usd: data.usd, eur: data.eur });
        }
      } catch (e) {
        console.error("Error al cargar referencia BCV", e);
      }
    };

    fetchRates();
    fetchBcv();

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
    const formatted = data.map((c) => ({
      ...c,
      lauren_rate: c.lauren_rate ?? c.rate_to_usdt ?? 1,
      operator: c.operator || (c.code === "COP" || c.code === "CLP" ? "multiply" : "divide"),
    }));
    setCurrencies(formatted);
    setOriginCurrency((prev) => formatted.find((c) => c.id === prev.id) || formatted[0]);
    setTargetCurrency((prev) => formatted.find((c) => c.id === prev.id) || formatted[1]);
    calculateLatestUpdateTime(formatted);
  };

  const currentRate = useMemo(() => {
    if (targetCurrency.code === "VES" && originCurrency.code !== "VES") {
      const rate = originCurrency.lauren_rate || 1;
      return originCurrency.operator === "multiply" ? 1 / rate : rate;
    }

    if (originCurrency.code === "VES" && targetCurrency.code !== "VES") {
      const rate = targetCurrency.lauren_rate || 1;
      return targetCurrency.operator === "multiply" ? rate : 1 / rate;
    }

    return targetCurrency.rate_to_usdt / originCurrency.rate_to_usdt;
  }, [originCurrency, targetCurrency]);

  const handleSwitchCurrencies = () => {
    const newOrigin = targetCurrency;
    const newTarget = originCurrency;

    setOriginCurrency(newOrigin);
    setTargetCurrency(newTarget);

    const cleanC1 = c1Envio.replace(/,/g, "");
    if (cleanC1 && !isNaN(Number(cleanC1))) {
      setC1Recibe(formatNumber(parseFloat(cleanC1) * currentRate));
    }

    const cleanC2 = c2Recibe.replace(/,/g, "");
    if (cleanC2 && !isNaN(Number(cleanC2))) {
      setC2Envio(formatNumber(parseFloat(cleanC2) / currentRate));
    }
  };

  useEffect(() => {
    const cleanC1 = c1Envio.replace(/,/g, "");
    if (cleanC1 && !isNaN(Number(cleanC1))) {
      setC1Recibe(formatNumber(parseFloat(cleanC1) * currentRate));
    }
    const cleanC2 = c2Recibe.replace(/,/g, "");
    if (cleanC2 && !isNaN(Number(cleanC2))) {
      setC2Envio(formatNumber(parseFloat(cleanC2) / currentRate));
    }
  }, [currentRate]);

  const sanitizePositiveNumber = (val: string): string => {
    let clean = val.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    return clean;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "-", "+"].includes(e.key)) {
      e.preventDefault();
    }
  };

  // --- HANDLERS CALCULADORA 1 ---
  const handleC1EnvioChange = (val: string) => {
    const cleanVal = sanitizePositiveNumber(val);
    setC1Envio(cleanVal);

    if (cleanVal === "" || isNaN(Number(cleanVal))) {
      setC1Recibe("");
    } else {
      const recibeCalculado = parseFloat(cleanVal) * currentRate;
      setC1Recibe(formatNumber(recibeCalculado));
    }
  };

  // --- HANDLERS CALCULADORA 2 ---
  const handleC2RecibeChange = (val: string) => {
    const cleanVal = sanitizePositiveNumber(val);
    setC2Recibe(cleanVal);

    if (cleanVal === "" || isNaN(Number(cleanVal))) {
      setC2Envio("");
      setC2RecibeUsd("");
    } else {
      const bs = parseFloat(cleanVal);
      setC2Envio(formatNumber(bs / currentRate));

      if (bcvData.usd && bcvData.usd > 0) {
        setC2RecibeUsd(formatNumber(bs / bcvData.usd));
      }
    }
  };

  const handleC2RecibeUsdChange = (val: string) => {
    const cleanVal = sanitizePositiveNumber(val);
    setC2RecibeUsd(cleanVal);

    if (cleanVal === "" || isNaN(Number(cleanVal)) || !bcvData.usd) {
      setC2Recibe("");
      setC2Envio("");
    } else {
      const usd = parseFloat(cleanVal);
      const vesCalculados = usd * bcvData.usd;

      setC2Recibe(formatNumber(vesCalculados));
      setC2Envio(formatNumber(vesCalculados / currentRate));
    }
  };

  const calculateBcvUsdEquivalent = (montoBs: string) => {
    const cleanBs = montoBs.replace(/,/g, "");
    if (!cleanBs || isNaN(Number(cleanBs)) || !bcvData.usd || bcvData.usd <= 0) return null;
    const usdEquivalent = parseFloat(cleanBs) / bcvData.usd;
    return formatNumber(usdEquivalent);
  };

  const closeModalWithAnimation = (callback?: () => void) => {
    setIsClosingModal(true);
    setTimeout(() => {
      if (callback) callback();
      setModalType(null);
      setIsClosingModal(false);
    }, 280);
  };

  const handleSelectCurrency = (currency: Currency) => {
    closeModalWithAnimation(() => {
      if (modalType === "origin") {
        setOriginCurrency(currency);
      } else if (modalType === "target") {
        setTargetCurrency(currency);
      }
      setC1Envio(""); setC1Recibe("");
      setC2Recibe(""); setC2RecibeUsd(""); setC2Envio("");
    });
  };

  const handleWhatsAppSend = (montoEnvio: string, montoRecibo: string, tipoOperacion: string) => {
    const cleanEnvio = montoEnvio.replace(/,/g, "");
    if (!cleanEnvio || parseFloat(cleanEnvio) <= 0) {
      alert("Por favor ingresa un monto válido antes de consultar.");
      return;
    }

    let bcvInfo = "";
    if (targetCurrency.code === "VES" && bcvData.usd) {
      const bcvUsd = calculateBcvUsdEquivalent(montoRecibo);
      if (bcvUsd) bcvInfo = `\n*Equivalente Estimado:* $${bcvUsd} USD`;
    } else if (originCurrency.code === "VES" && bcvData.usd) {
      const bcvUsd = calculateBcvUsdEquivalent(montoEnvio);
      if (bcvUsd) bcvInfo = `\n*Equivalente Estimado:* $${bcvUsd} USD`;
    }

    const text = `Hola AON Pay! Quisiera realizar una consulta (${tipoOperacion}):\n\n` +
      `*Envía:* ${montoEnvio} ${originCurrency.code} (${originCurrency.name})\n` +
      `*Recibe:* ${montoRecibo} ${targetCurrency.code} (${targetCurrency.name})${bcvInfo}\n\n` +
      `¿Me confirman disponibilidad para operar?`;

    const url = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <main className="min-h-screen bg-[#121212] text-[#f4f1ea] flex flex-col items-center justify-between p-4 sm:p-8 lg:p-12 antialiased selection:bg-[#b58e45] selection:text-[#121212]">
      
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl space-y-6 sm:space-y-8">
        
        {/* LOGO */}
        <header className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 text-center">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="AON Pay Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-3xl sm:text-4xl font-extrabold tracking-wide text-[#f4f1ea] leading-tight">
            AON <span className="text-[#b58e45]">Pay</span>
          </span>
        </header>

        {/* DISCLAIMER */}
        <div className="bg-[#b58e45]/10 border border-[#b58e45]/30 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 text-xs sm:text-sm text-[#f4f1ea]/90 shadow-sm w-full">
          <span className="text-[#b58e45] text-lg shrink-0 select-none">⚠️</span>
          <p className="leading-relaxed">
            <strong className="text-[#b58e45] font-semibold">Tasas referenciales.</strong> Se confirman al momento de la operación y pueden variar según el monto y destino.
          </p>
        </div>

        {/* SELECCIÓN DE PAÍSES */}
        <section className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-5 sm:p-8 shadow-2xl space-y-5 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#121212]/40 pb-4">
            <h1 className="text-base sm:text-xl font-bold text-[#f4f1ea] tracking-tight">
              Tasas de envío en tiempo real
            </h1>
            <p className="text-xs sm:text-sm text-[#f4f1ea]/60 font-medium">
              {loadingRates ? "Cargando actualización..." : `Actualizado ${lastUpdatedTime}`}
            </p>
          </div>

          <div className="relative grid grid-cols-2 gap-4 sm:gap-8 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#f4f1ea]/70 uppercase tracking-wider block">
                País Origen
              </label>
              <button
                onClick={() => setModalType("origin")}
                className="w-full min-h-[52px] sm:min-h-[60px] flex items-center justify-between bg-[#121212]/60 hover:bg-[#121212]/80 active:bg-[#121212] border border-[#b58e45]/30 px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-[#b58e45] outline-none cursor-pointer"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-2xl sm:text-3xl leading-none">{originCurrency.flag}</span>
                  <span className="text-sm sm:text-base font-bold truncate text-[#f4f1ea]">{originCurrency.code}</span>
                </div>
                <span className="text-[#b58e45] text-xs ml-1">▼</span>
              </button>
            </div>

            <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 z-10">
              <button
                onClick={handleSwitchCurrencies}
                title="Intercambiar países"
                className="bg-[#121212] hover:bg-[#8b6d32] hover:text-[#f4f1ea] active:scale-95 border border-[#b58e45]/50 w-12 h-12 rounded-full flex items-center justify-center text-[#b58e45] shadow-2xl transition-all focus:ring-2 focus:ring-[#b58e45] outline-none cursor-pointer"
              >
                <span className="text-base font-bold select-none">⇄</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#f4f1ea]/70 uppercase tracking-wider block">
                País Destino
              </label>
              <button
                onClick={() => setModalType("target")}
                className="w-full min-h-[52px] sm:min-h-[60px] flex items-center justify-between bg-[#121212]/60 hover:bg-[#121212]/80 active:bg-[#121212] border border-[#b58e45]/30 px-4 py-3 rounded-xl transition-all focus:ring-2 focus:ring-[#b58e45] outline-none cursor-pointer"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-2xl sm:text-3xl leading-none">{targetCurrency.flag}</span>
                  <span className="text-sm sm:text-base font-bold truncate text-[#f4f1ea]">{targetCurrency.code}</span>
                </div>
                <span className="text-[#b58e45] text-xs ml-1">▼</span>
              </button>
            </div>
          </div>

          <div className="text-center text-sm sm:text-base text-[#f4f1ea]/80 pt-2 font-medium">
            {loadingRates ? (
              <span className="animate-pulse">Cargando tasas actualizadas...</span>
            ) : (
              <>Tasa actual: <span className="text-[#b58e45] font-bold text-base sm:text-lg">1 {originCurrency.code} = {formatRate(currentRate)} {targetCurrency.code}</span></>
            )}
          </div>
        </section>

        {/* CALCULADORAS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 w-full">
          
          {/* CALCULADORA 1 */}
          <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#b58e45] border-b border-[#121212]/40 pb-3">
                Calculadora por Monto a Enviar
              </h2>

              <div className="space-y-4">
                <div className="bg-[#121212]/50 border border-[#b58e45]/20 focus-within:border-[#b58e45] rounded-xl p-4 transition-all">
                  <label className="text-xs sm:text-sm font-medium text-[#f4f1ea]/70 block mb-1">
                    Si se envían ({originCurrency.code})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={c1Envio}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => handleC1EnvioChange(e.target.value)}
                    className="w-full bg-transparent text-xl sm:text-2xl font-bold text-[#f4f1ea] outline-none placeholder-[#f4f1ea]/30 text-base"
                  />
                </div>

                <div className="bg-[#121212]/20 border border-[#121212]/60 rounded-xl p-4 cursor-not-allowed">
                  <label className="text-xs sm:text-sm font-medium text-[#f4f1ea]/40 block mb-1">
                    Se reciben ({targetCurrency.code})
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="0.00"
                    value={c1Recibe}
                    className="w-full bg-transparent text-xl sm:text-2xl font-bold text-[#cdead2] outline-none placeholder-[#f4f1ea]/20 cursor-not-allowed text-base"
                  />
                  {targetCurrency.code === "VES" && c1Recibe && calculateBcvUsdEquivalent(c1Recibe) && (
                    <p className="text-[11px] font-semibold text-[#b58e45] mt-1.5 animate-fade-in">
                      ≈ ${calculateBcvUsdEquivalent(c1Recibe)} USD al cambio oficial BCV
                    </p>
                  )}
                  {originCurrency.code === "VES" && c1Envio && calculateBcvUsdEquivalent(c1Envio) && (
                    <p className="text-[11px] font-semibold text-[#b58e45] mt-1.5 animate-fade-in">
                      ≈ ${calculateBcvUsdEquivalent(c1Envio)} USD al cambio oficial BCV
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleWhatsAppSend(c1Envio, c1Recibe, "Monto a Enviar")}
              className="w-full min-h-[52px] bg-[#b58e45] hover:bg-[#8b6d32] active:scale-[0.98] text-[#121212] hover:text-[#f4f1ea] font-extrabold py-3.5 px-5 rounded-xl shadow-lg transition-all text-sm sm:text-base flex items-center justify-center gap-3 focus:ring-2 focus:ring-offset-2 focus:ring-[#b58e45] outline-none cursor-pointer"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span className="truncate">Confirmar cambio por WhatsApp</span>
            </button>
          </div>

          {/* CALCULADORA 2 */}
          <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#b58e45] border-b border-[#121212]/40 pb-3">
                Calculadora por Monto a Recibir
              </h2>

              <div className="space-y-4">
                {targetCurrency.code === "VES" && (
                  <div className="bg-[#121212]/50 border border-[#b58e45]/30 focus-within:border-[#b58e45] rounded-xl p-4 transition-all">
                    <label className="text-xs sm:text-sm font-semibold text-[#b58e45] flex items-center justify-between mb-1">
                      <span>Para recibir (USD en Venezuela - BCV)</span>
                      <span className="text-[10px] bg-[#b58e45]/20 px-2 py-0.5 rounded text-[#f4f1ea] font-bold">Oficial</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="text-xl sm:text-2xl font-bold text-[#b58e45] mr-1.5">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={c2RecibeUsd}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => handleC2RecibeUsdChange(e.target.value)}
                        className="w-full bg-transparent text-xl sm:text-2xl font-bold text-[#f4f1ea] outline-none placeholder-[#f4f1ea]/30 text-base"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-[#121212]/50 border border-[#b58e45]/20 focus-within:border-[#b58e45] rounded-xl p-4 transition-all">
                  <label className="text-xs sm:text-sm font-medium text-[#f4f1ea]/70 block mb-1">
                    Para recibir ({targetCurrency.code})
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={c2Recibe}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => handleC2RecibeChange(e.target.value)}
                    className="w-full bg-transparent text-xl sm:text-2xl font-bold text-[#cdead2] outline-none placeholder-[#f4f1ea]/30 text-base"
                  />
                  {targetCurrency.code === "VES" && c2Recibe && calculateBcvUsdEquivalent(c2Recibe) && (
                    <p className="text-[11px] font-semibold text-[#b58e45] mt-1.5 animate-fade-in">
                      ≈ ${calculateBcvUsdEquivalent(c2Recibe)} USD al cambio oficial BCV
                    </p>
                  )}
                </div>

                <div className="bg-[#121212]/20 border border-[#121212]/60 rounded-xl p-4 cursor-not-allowed">
                  <label className="text-xs sm:text-sm font-medium text-[#f4f1ea]/40 block mb-1">
                    Hay que enviar ({originCurrency.code})
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="0.00"
                    value={c2Envio}
                    className="w-full bg-transparent text-xl sm:text-2xl font-bold text-[#f4f1ea] outline-none placeholder-[#f4f1ea]/20 cursor-not-allowed text-base"
                  />
                  {originCurrency.code === "VES" && c2Envio && calculateBcvUsdEquivalent(c2Envio) && (
                    <p className="text-[11px] font-semibold text-[#b58e45] mt-1.5 animate-fade-in">
                      ≈ ${calculateBcvUsdEquivalent(c2Envio)} USD al cambio oficial BCV
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleWhatsAppSend(c2Envio, c2Recibe, "Monto a Recibir")}
              className="w-full min-h-[52px] bg-[#b58e45] hover:bg-[#8b6d32] active:scale-[0.98] text-[#121212] hover:text-[#f4f1ea] font-extrabold py-3.5 px-5 rounded-xl shadow-lg transition-all text-sm sm:text-base flex items-center justify-center gap-3 focus:ring-2 focus:ring-offset-2 focus:ring-[#b58e45] outline-none cursor-pointer"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              <span className="truncate">Confirmar cambio por WhatsApp</span>
            </button>
          </div>

        </section>

      </div>

      {/* FOOTER */}
      <footer className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl pt-8 mt-10 border-t border-[#b58e45]/20 text-center space-y-1">
        <p className="text-xs sm:text-sm text-[#f4f1ea]/60 font-medium">
          © 2026 <strong className="text-[#f4f1ea]">AON Pay</strong> ·{" "}
          <a
            href="https://aonpay.com"
            target="_blank"
            rel="noreferrer"
            className="hover:underline text-[#b58e45] transition-colors"
          >
            aonpay.com
          </a>
        </p>
      </footer>

      {/* MODAL SELECTOR DE PAÍS */}
      {modalType !== null && (
        <div
          className={`fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
            isClosingModal ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          onClick={() => closeModalWithAnimation()}
        >
          <style jsx>{`
            @keyframes modal3dIn {
              0% {
                opacity: 0;
                transform: scale(0.8) translateY(24px) rotateX(-12deg);
              }
              100% {
                opacity: 1;
                transform: scale(1) translateY(0) rotateX(0deg);
              }
            }

            @keyframes modal3dOut {
              0% {
                opacity: 1;
                transform: scale(1) translateY(0) rotateX(0deg);
              }
              100% {
                opacity: 0;
                transform: scale(0.8) translateY(24px) rotateX(-12deg);
              }
            }

            .modal-in {
              animation: modal3dIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              perspective: 1000px;
              transform-style: preserve-3d;
            }

            .modal-out {
              animation: modal3dOut 0.28s cubic-bezier(0.7, 0, 0.84, 0) forwards;
              perspective: 1000px;
              transform-style: preserve-3d;
            }
          `}</style>

          <div
            onClick={(e) => e.stopPropagation()}
            className={`${
              isClosingModal ? "modal-out" : "modal-in"
            } bg-[#2c2e30] border border-[#b58e45]/40 w-full max-w-sm sm:max-w-md rounded-2xl p-5 sm:p-6 space-y-4 max-h-[80vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.85)] border-t-[#b58e45]/70`}
          >
            <div className="flex justify-between items-center border-b border-[#121212]/50 pb-3">
              <h3 className="font-bold text-base sm:text-lg text-[#f4f1ea] tracking-tight">
                Selecciona País de {modalType === "origin" ? "Origen" : "Destino"}
              </h3>
              <button
                onClick={() => closeModalWithAnimation()}
                className="text-[#f4f1ea]/60 hover:text-[#b58e45] min-w-[36px] min-h-[36px] flex items-center justify-center font-bold text-lg rounded-lg transition-colors hover:bg-[#121212]/50 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {currencies.map((curr) => (
                <button
                  key={curr.id}
                  onClick={() => handleSelectCurrency(curr)}
                  className="w-full min-h-[52px] flex items-center justify-between p-3.5 rounded-xl bg-[#121212]/40 hover:bg-[#121212]/80 border border-[#b58e45]/15 hover:border-[#b58e45]/50 transition-all text-left outline-none group active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-2xl sm:text-3xl leading-none">{curr.flag}</span>
                    <div>
                      <p className="font-bold text-sm text-[#f4f1ea] group-hover:text-[#b58e45] transition-colors">
                        {curr.name}
                      </p>
                      <p className="text-xs font-semibold text-[#b58e45]/80">{curr.code}</p>
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