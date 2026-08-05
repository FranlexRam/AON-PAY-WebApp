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
  lauren_rate_out?: number; // Tasa del día para envíos DESDE Venezuela
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
    type: "lauren" | "lauren_out" | "base";
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
      .select("id, name, code, flag, rate_to_usdt, lauren_rate, lauren_rate_out, operator")
      .order("name");

    if (error) {
      showToast("❌ Error al cargar las tasas");
    } else if (data) {
      const formatted = data.map((c: any) => ({
        ...c,
        lauren_rate: c.lauren_rate ?? c.rate_to_usdt ?? 1,
        lauren_rate_out: c.lauren_rate_out ?? c.lauren_rate ?? 1,
        operator: c.operator || (c.code === "COP" ? "divide" : "multiply"),
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

  const formatBcvDate = (isoDateString: string | null) => {
    const dateObj = isoDateString ? new Date(isoDateString) : new Date();
    if (isNaN(dateObj.getTime())) return "Fecha no disponible";

    const formattedDate = dateObj.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
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

  // Manejo de cambios en Tasa del Día (HACIA Venezuela)
  const handleLaurenRateChange = (id: string, value: string) => {
    const numVal = parseFloat(value);
    const sanitizedValue = isNaN(numVal) || !isFinite(numVal) || numVal < 0 ? 0 : Math.min(numVal, 1000000000);

    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, lauren_rate: sanitizedValue } : c))
    );
  };

  // Manejo de cambios en Tasa del Día (DESDE Venezuela)
  const handleLaurenRateOutChange = (id: string, value: string) => {
    const numVal = parseFloat(value);
    const sanitizedValue = isNaN(numVal) || !isFinite(numVal) || numVal < 0 ? 0 : Math.min(numVal, 1000000000);

    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, lauren_rate_out: sanitizedValue } : c))
    );
  };

  // Manejo de cambios en Tasa Base (USDT)
  const handleBaseRateChange = (id: string, value: string) => {
    const numVal = parseFloat(value);
    const sanitizedValue = isNaN(numVal) || !isFinite(numVal) || numVal < 0 ? 0 : Math.min(numVal, 1000000000);

    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: sanitizedValue } : c))
    );
  };

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
  const triggerSaveConfirmation = (currency: Currency, type: "lauren" | "lauren_out" | "base") => {
    let targetValue = currency.rate_to_usdt;
    if (type === "lauren") targetValue = currency.lauren_rate || 0;
    if (type === "lauren_out") targetValue = currency.lauren_rate_out || 0;
    
    if (!targetValue || targetValue <= 0) {
      showToast("⚠️ La tasa debe ser mayor a 0");
      cancelUpdate(currency.id);
      return;
    }

    const original = originalCurrencies.find((c) => c.id === currency.id);
    let origValue = original?.rate_to_usdt;
    if (type === "lauren") origValue = original?.lauren_rate;
    if (type === "lauren_out") origValue = original?.lauren_rate_out;

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
    } else if (type === "lauren_out") {
      updatePayload.lauren_rate_out = currency.lauren_rate_out;
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
      const typeLabel = type === "lauren" ? "Hacia Venezuela" : type === "lauren_out" ? "Desde Venezuela" : "Base";
      showToast(`✨ Tasa (${typeLabel}) de ${currency.name} guardada`);
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
      <main className="min-h-screen bg-[#121212] text-[#f4f1ea] flex items-center justify-center p-4 antialiased">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-8 h-8 border-2 border-[#b58e45] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-[#f4f1ea]/60 font-medium">Cargando panel de administración...</p>
        </div>
      </main>
    );
  }

  // Filtrar monedas: Venezuela no aparece como destino de sí misma
  const laurenCurrencies = currencies.filter((c) => c.code !== "VES");

  return (
    <main className="min-h-screen bg-[#121212] text-[#f4f1ea] flex flex-col items-center p-4 py-8 relative antialiased selection:bg-[#b58e45] selection:text-[#121212]">
      <style jsx global>{`
        html { font-size: 16px; }
        @media (min-width: 768px) { html { font-size: 18px; } }
        @media (min-width: 1024px) { html { font-size: 20px; } }
        @media (min-width: 1440px) { html { font-size: 22px; } }
        body { font-size: 1rem; line-height: 1.5; }
      `}</style>

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#2c2e30] border border-[#b58e45]/50 text-[#f4f1ea] px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-[0.75rem] font-bold flex items-center gap-2 transition-all animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN */}
      {pendingUpdate && (
        <div 
          onClick={() => cancelUpdate()} 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-[#2c2e30] border border-[#b58e45]/40 rounded-2xl p-6 shadow-2xl max-w-xs w-full space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-[#b58e45]/10 border border-[#b58e45]/30 text-[#b58e45] flex items-center justify-center mx-auto text-[1.25rem]">
              📝
            </div>

            <div>
              <h3 className="text-[1rem] font-bold text-[#f4f1ea]">
                ¿Guardar Tasa del Día?
              </h3>
              <p className="text-[0.75rem] text-[#f4f1ea]/60 mt-1">
                Moneda: <span className="font-bold text-[#b58e45]">{pendingUpdate.currency.name}</span>
              </p>
              
              <div className="mt-3 bg-[#121212]/60 p-2.5 rounded-xl border border-[#b58e45]/20 text-center text-[0.75rem]">
                <p className="text-[#f4f1ea]/60">Nuevo Valor:</p>
                <p className="text-[1.25rem] font-extrabold text-[#cdead2]">
                  {pendingUpdate.type === "lauren"
                    ? pendingUpdate.currency.lauren_rate
                    : pendingUpdate.type === "lauren_out"
                    ? pendingUpdate.currency.lauren_rate_out
                    : pendingUpdate.currency.rate_to_usdt}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => cancelUpdate()}
                className="bg-[#121212]/80 hover:bg-[#121212] text-[#f4f1ea]/70 border border-[#b58e45]/20 font-bold text-[0.75rem] py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSave}
                className="bg-[#b58e45] hover:bg-[#8b6d32] text-[#121212] hover:text-[#f4f1ea] font-extrabold text-[0.75rem] py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-lg space-y-6">

        {/* ENCABEZADO ADMIN */}
        <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-5 shadow-xl flex justify-between items-center">
          <div>
            <h1 className="text-[1rem] font-bold text-[#f4f1ea]">Gestión de Tasas AON Pay</h1>
            <p className="text-[0.75rem] text-[#f4f1ea]/60 truncate max-w-[200px]">{adminEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-[0.75rem] font-bold transition-colors cursor-pointer"
          >
            Salir
          </button>
        </div>

        {/* 🏛️ REFERENCIA BCV */}
        <div className="bg-[#2c2e30] border border-[#b58e45]/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
          <div className="flex justify-between items-center border-b border-[#121212]/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[1.1rem]">🏛️</span>
              <h2 className="text-[0.8rem] font-extrabold tracking-wider text-[#b58e45] uppercase">
                Referencia Oficial BCV
              </h2>
            </div>
            
            <button 
              onClick={fetchBcvReference}
              disabled={bcvLoading}
              className="bg-[#b58e45]/15 hover:bg-[#b58e45] text-[#b58e45] hover:text-[#121212] border border-[#b58e45]/40 font-bold px-3 py-1.5 rounded-xl text-[0.7rem] sm:text-[0.75rem] flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span className={`inline-block ${bcvLoading ? "animate-spin" : ""}`}>🔄</span>
              <span>{bcvLoading ? "Cargando..." : "Actualizar"}</span>
            </button>
          </div>

          {bcvLoading ? (
            <div className="text-center py-4 text-[0.75rem] text-[#f4f1ea]/60 animate-pulse">
              Consultando tasas del BCV...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#121212]/60 border border-[#b58e45]/20 rounded-xl p-3 text-center">
                  <p className="text-[0.65rem] font-bold text-[#f4f1ea]/60 uppercase tracking-wider">Dólar BCV</p>
                  <p className="text-[1.1rem] font-extrabold text-[#cdead2] mt-0.5">
                    {bcvData.usd ? `${bcvData.usd.toFixed(2)} VES` : "N/A"}
                  </p>
                </div>
                <div className="bg-[#121212]/60 border border-[#b58e45]/20 rounded-xl p-3 text-center">
                  <p className="text-[0.65rem] font-bold text-[#f4f1ea]/60 uppercase tracking-wider">Euro BCV</p>
                  <p className="text-[1.1rem] font-extrabold text-[#cdead2] mt-0.5">
                    {bcvData.eur ? `${bcvData.eur.toFixed(2)} VES` : "N/A"}
                  </p>
                </div>
              </div>

              <div className="text-center pt-1 border-t border-[#121212]/30 space-y-0.5">
                <p className="text-[0.7rem] font-bold text-[#b58e45]">
                  📅 {formatBcvDate(bcvData.updatedAt)}
                </p>
                <p className="text-[0.625rem] font-medium text-[#f4f1ea]/40">
                  Actualizado {getRelativeTimeString(bcvData.updatedAt)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 🟢 SECCIÓN 1: TASAS DEL DÍA (HACIA VENEZUELA) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#b58e45]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#b58e45] uppercase">
              1. Tasas del Día (Envíos HACIA Venezuela)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {laurenCurrencies.map((currency) => (
              <div
                key={`lauren-in-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[1.25rem]">{currency.flag}</span>
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#b58e45]/10 text-[#b58e45] border border-[#b58e45]/20">
                        {currency.operator === "multiply" ? "x Bs" : "/ Bs"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#b58e45]/30 rounded-xl bg-[#121212]/60 focus-within:border-[#b58e45]">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={currency.lauren_rate === 0 ? "" : currency.lauren_rate}
                      onChange={(e) => handleLaurenRateChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <button
                    onClick={() => triggerSaveConfirmation(currency, "lauren")}
                    disabled={savingId === currency.id}
                    className="bg-[#b58e45] hover:bg-[#8b6d32] active:scale-95 text-[#121212] hover:text-[#f4f1ea] font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === currency.id ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🟡 SECCIÓN 2: TASAS DEL DÍA (DESDE VENEZUELA HACIA OTROS PAÍSES) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#cdead2]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#cdead2] uppercase">
              2. Tasas del Día (Envíos DESDE Venezuela)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#cdead2]/20 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {laurenCurrencies.map((currency) => (
              <div
                key={`lauren-out-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[1.25rem]">{currency.flag}</span>
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#cdead2]/10 text-[#cdead2] border border-[#cdead2]/20">
                        {currency.code === "COP" ? "/ Bs" : "x Bs"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#cdead2]/30 rounded-xl bg-[#121212]/60 focus-within:border-[#cdead2]">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={currency.lauren_rate_out === 0 ? "" : currency.lauren_rate_out}
                      onChange={(e) => handleLaurenRateOutChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#cdead2] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <button
                    onClick={() => triggerSaveConfirmation(currency, "lauren_out")}
                    disabled={savingId === currency.id}
                    className="bg-[#cdead2] hover:bg-[#a1c4a7] active:scale-95 text-[#121212] font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === currency.id ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🔵 SECCIÓN 3: TASAS BASE (INTERNACIONALES USDT) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f4f1ea]/40"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#f4f1ea]/80 uppercase">
              3. Tasas Base (Operaciones entre Otros Países)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {currencies.map((currency) => (
              <div
                key={`base-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[1.25rem]">{currency.flag}</span>
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <p className="text-[0.625rem] text-[#f4f1ea]/60 font-semibold">{currency.code}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#b58e45]/30 rounded-xl bg-[#121212]/60 focus-within:border-[#b58e45]">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={currency.rate_to_usdt === 0 ? "" : currency.rate_to_usdt}
                      onChange={(e) => handleBaseRateChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <button
                    onClick={() => triggerSaveConfirmation(currency, "base")}
                    disabled={savingId === currency.id}
                    className="bg-[#b58e45] hover:bg-[#8b6d32] active:scale-95 text-[#121212] hover:text-[#f4f1ea] font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
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