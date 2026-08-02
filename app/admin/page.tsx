"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Currency {
  id: string;
  name: string;
  code: string;
  flag: string;
  rate_to_usdt: number;
  lauren_rate?: number;
  operator?: "divide" | "multiply";
}

interface BcvData {
  usd: number | null;
  eur: number | null;
  updatedAt: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  
  // Estados de datos
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [originalCurrencies, setOriginalCurrencies] = useState<Currency[]>([]);
  
  // Estados de control y UI
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estado para la confirmación de cambio (Modal)
  const [pendingUpdate, setPendingUpdate] = useState<{
    currency: Currency;
    type: "lauren" | "base";
  } | null>(null);

  // Estado para la referencia del BCV
  const [bcvData, setBcvData] = useState<BcvData>({ usd: null, eur: null, updatedAt: null });
  const [bcvLoading, setBcvLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setLoading(true);
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/login");
        return;
      }

      setAdminEmail(session.user.email || "Administrador");
      setAuthenticated(true);

      await Promise.all([fetchRates(), fetchBcvReference()]);
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [router]);

  // Consulta la lista de divisas en Supabase
  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("id, name, code, flag, rate_to_usdt, lauren_rate, operator")
      .order("name");

    if (error) {
      showToast("❌ Error al cargar las tasas");
    } else if (data) {
      const formatted = data.map((c: any) => ({
        ...c,
        lauren_rate: c.lauren_rate ?? c.rate_to_usdt ?? 1,
        operator: c.operator || (c.code === "COP" ? "multiply" : "divide"),
      }));
      setCurrencies(formatted);
      setOriginalCurrencies(JSON.parse(JSON.stringify(formatted)));
    }
  };

  // Consulta el endpoint interno del BCV
  const fetchBcvReference = async () => {
    setBcvLoading(true);
    try {
      const res = await fetch("/api/bcv");
      if (res.ok) {
        const data = await res.json();
        setBcvData(data);
      }
    } catch {
      console.error("Error consultando referencia BCV");
    } finally {
      setBcvLoading(false);
    }
  };

  const getRelativeTimeString = (isoDateString: string | null) => {
    if (!isoDateString) return "Desconocido";
    const updatedDate = new Date(isoDateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - updatedDate.getTime()) / 1000);

    if (diffInSeconds < 60) return "hace unos segundos";
    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} hr${hours > 1 ? "s" : ""}`;
    const days = Math.floor(hours / 24);
    return `hace ${days} día${days > 1 ? "s" : ""}`;
  };

  // Manejo de cambios en Tasa del Día (Lauren)
  const handleLaurenRateChange = (id: string, value: string) => {
    const numVal = parseFloat(value);

    if (isNaN(numVal) || !isFinite(numVal) || numVal < 0) {
      setCurrencies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, lauren_rate: 0 } : c))
      );
      return;
    }

    const SAFE_MAX_RATE = 1000000000;
    const sanitizedValue = Math.min(numVal, SAFE_MAX_RATE);

    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, lauren_rate: sanitizedValue } : c))
    );
  };

  // Manejo de cambios en Tasa Base (USDT)
  const handleBaseRateChange = (id: string, value: string) => {
    const numVal = parseFloat(value);

    if (isNaN(numVal) || !isFinite(numVal) || numVal < 0) {
      setCurrencies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: 0 } : c))
      );
      return;
    }

    const SAFE_MAX_RATE = 1000000000;
    const sanitizedValue = Math.min(numVal, SAFE_MAX_RATE);

    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: sanitizedValue } : c))
    );
  };

  // Reversión al perder foco
  const handleRateBlur = (currencyId: string) => {
    setTimeout(() => {
      setPendingUpdate((currentPending) => {
        if (currentPending?.currency.id !== currencyId) {
          setCurrencies((prev) =>
            prev.map((c) => {
              if (c.id === currencyId) {
                const original = originalCurrencies.find((orig) => orig.id === currencyId);
                return original ? { ...original } : c;
              }
              return c;
            })
          );
        }
        return currentPending;
      });
    }, 150);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Confirmaciones
  const triggerSaveConfirmation = (currency: Currency, type: "lauren" | "base") => {
    const targetValue = type === "lauren" ? currency.lauren_rate : currency.rate_to_usdt;
    
    if (!targetValue || targetValue <= 0) {
      showToast("⚠️ La tasa debe ser mayor a 0");
      cancelUpdate(currency.id);
      return;
    }

    const original = originalCurrencies.find((c) => c.id === currency.id);
    const origValue = type === "lauren" ? original?.lauren_rate : original?.rate_to_usdt;

    if (origValue === targetValue) {
      showToast("ℹ️ Ninguna tasa ha sufrido cambios");
      return;
    }

    setPendingUpdate({ currency, type });
  };

  const confirmSave = async () => {
    if (!pendingUpdate) return;

    const { currency, type } = pendingUpdate;
    setSavingId(currency.id);
    setPendingUpdate(null);

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (type === "lauren") {
      updatePayload.lauren_rate = currency.lauren_rate;
    } else {
      updatePayload.rate_to_usdt = currency.rate_to_usdt;
    }

    const { error } = await supabase
      .from("currencies")
      .update(updatePayload)
      .eq("id", currency.id);

    if (error) {
      showToast("❌ Error al actualizar la tasa");
      cancelUpdate(currency.id);
    } else {
      showToast(`✨ ${type === "lauren" ? "Tasa del Día" : "Tasa Base"} de ${currency.name} guardada`);
      setOriginalCurrencies((prev) =>
        prev.map((c) => (c.id === currency.id ? { ...currency } : c))
      );
    }
    setSavingId(null);
  };

  const cancelUpdate = (id?: string) => {
    const targetId = id || pendingUpdate?.currency.id;
    if (targetId) {
      const original = originalCurrencies.find((c) => c.id === targetId);
      if (original) {
        setCurrencies((prev) =>
          prev.map((c) => (c.id === targetId ? { ...original } : c))
        );
      }
    }
    setPendingUpdate(null);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch {
      showToast("❌ Error al cerrar sesión");
    }
  };

  if (loading || !authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Cargando panel de administración...</p>
        </div>
      </main>
    );
  }

  // Filtrar monedas: Venezuela no necesita "Tasa del Día"
  const laurenCurrencies = currencies.filter((c) => c.code !== "VES");

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4 py-8 relative">

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 transition-all animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {pendingUpdate && (
        <div 
          onClick={() => cancelUpdate()} 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-xs w-full space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl">
              📝
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-100">
                ¿Guardar {pendingUpdate.type === "lauren" ? "Tasa del Día" : "Tasa Base"}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Moneda: <span className="font-bold text-indigo-400">{pendingUpdate.currency.name}</span>
              </p>
              
              <div className="mt-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-center text-xs">
                <p className="text-slate-400">Nuevo Valor:</p>
                <p className="text-lg font-extrabold text-emerald-400">
                  {pendingUpdate.type === "lauren" ? pendingUpdate.currency.lauren_rate : pendingUpdate.currency.rate_to_usdt}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => cancelUpdate()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSave}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg space-y-6">

        {/* ENCABEZADO ADMIN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-100">Gestión de Tasas</h1>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{adminEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Salir
          </button>
        </div>

        {/* 🏛️ REFERENCIA BCV */}
        <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">🏛️</span>
              <h2 className="text-xs font-extrabold tracking-wider text-indigo-300 uppercase">
                Referencia Oficial BCV
              </h2>
            </div>
            <button 
              onClick={fetchBcvReference}
              title="Recargar referencia"
              className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              🔄
            </button>
          </div>

          {bcvLoading ? (
            <div className="text-center py-2 text-xs text-slate-400 animate-pulse">
              Consultando BCV...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dólar BCV</p>
                  <p className="text-base font-extrabold text-slate-100 mt-0.5">
                    {bcvData.usd ? `${bcvData.usd.toFixed(2)} VES` : "N/A"}
                  </p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Euro BCV</p>
                  <p className="text-base font-extrabold text-slate-100 mt-0.5">
                    {bcvData.eur ? `${bcvData.eur.toFixed(2)} VES` : "N/A"}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-medium text-slate-500">
                  Actualizado {getRelativeTimeString(bcvData.updatedAt)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 🟢 SECCIÓN 1: TASAS DEL DÍA (LAUREN - OPERACIONES CON VENEZUELA) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <h2 className="text-xs font-black tracking-wider text-emerald-400 uppercase">
              1. Tasas del Día (Operaciones Venezuela)
            </h2>
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4 shadow-xl divide-y divide-slate-800/60">
            {laurenCurrencies.map((currency) => (
              <div
                key={`lauren-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{currency.flag}</span>
                  <div className="truncate">
                    <h3 className="text-xs font-bold text-slate-100 truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-bold">{currency.code}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {currency.operator === "multiply" ? "x Bs" : "/ Bs"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-emerald-500/30 rounded-xl bg-slate-950/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={currency.lauren_rate === 0 ? "" : currency.lauren_rate}
                      onChange={(e) => handleLaurenRateChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-emerald-400 font-bold text-right p-2 rounded-xl outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <button
                    onClick={() => triggerSaveConfirmation(currency, "lauren")}
                    disabled={savingId === currency.id}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === currency.id ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🔵 SECCIÓN 2: TASAS BASE (INTERNACIONALES USDT) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
            <h2 className="text-xs font-black tracking-wider text-indigo-400 uppercase">
              2. Tasas Base (Operaciones entre Otros Países)
            </h2>
          </div>

          <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-4 shadow-xl divide-y divide-slate-800/60">
            {currencies.map((currency) => (
              <div
                key={`base-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{currency.flag}</span>
                  <div className="truncate">
                    <h3 className="text-xs font-bold text-slate-100 truncate">{currency.name}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{currency.code}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-slate-800 rounded-xl bg-slate-950/80 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={currency.rate_to_usdt === 0 ? "" : currency.rate_to_usdt}
                      onChange={(e) => handleBaseRateChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-indigo-400 font-bold text-right p-2 rounded-xl outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <button
                    onClick={() => triggerSaveConfirmation(currency, "base")}
                    disabled={savingId === currency.id}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === currency.id ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}