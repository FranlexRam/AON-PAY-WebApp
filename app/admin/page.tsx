"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Currency {
  id: string;
  name: string;
  code: string;
  flag: string;
  rate_to_usdt: number;
  lauren_rate?: number;
  lauren_rate_out?: number;
  rate_from_peru?: number;
  rate_from_colombia?: number;
  rate_from_chile?: number;
  rate_from_usa?: number;
  rate_from_ecuador?: number;
  rate_from_brazil?: number;
  operator?: "divide" | "multiply";
}

interface BcvData {
  usd: number | null;
  eur: number | null;
  updatedAt: string | null;
}

const COUNTRY_ISO_MAP: Record<string, { iso: string; name: string }> = {
  usa: { iso: "us", name: "Estados Unidos" },
  ecu: { iso: "ec", name: "Ecuador" },
  ven: { iso: "ve", name: "Venezuela" },
  col: { iso: "co", name: "Colombia" },
  per: { iso: "pe", name: "Perú" },
  chl: { iso: "cl", name: "Chile" },
  bra: { iso: "br", name: "Brasil" },
};

function FlagIcon({ id, code, name, className = "w-6 h-4 sm:w-7 sm:h-5" }: { id?: string; code: string; name?: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  
  const key = (id && COUNTRY_ISO_MAP[id]) ? id : code.toLowerCase();
  const countryInfo = COUNTRY_ISO_MAP[key] || { iso: key, name: name || code };
  const countryName = name || countryInfo.name;

  if (hasError) {
    return (
      <span
        role="img"
        aria-label={`Bandera de ${countryName}`}
        className={`inline-flex items-center justify-center bg-[#121212] border border-[#b58e45]/40 text-[#b58e45] font-bold text-[9px] rounded px-1 shrink-0 ${className}`}
      >
        {id === "ecu" ? "EC" : code.substring(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${countryInfo.iso}.png`}
      srcSet={`https://flagcdn.com/w80/${countryInfo.iso}.png 2x`}
      alt={`Bandera de ${countryName}`}
      role="img"
      aria-label={`Bandera de ${countryName}`}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`object-cover rounded shadow-sm shrink-0 ${className}`}
    />
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [originalCurrencies, setOriginalCurrencies] = useState<Currency[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isSavingRef = useRef<boolean>(false);

  const [pendingUpdate, setPendingUpdate] = useState<{
    currency: Currency;
    type: "lauren" | "lauren_out" | "from_peru" | "from_colombia" | "from_chile" | "from_usa" | "from_ecuador" | "from_brazil";
  } | null>(null);

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

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("id, name, code, flag, rate_to_usdt, lauren_rate, lauren_rate_out, rate_from_peru, rate_from_colombia, rate_from_chile, rate_from_usa, rate_from_ecuador, rate_from_brazil, operator")
      .order("name");

    if (error) {
      showToast("❌ Error al cargar las tasas");
    } else if (data) {
      const formatted = data.map((c: any) => ({
        ...c,
        lauren_rate: c.lauren_rate ?? c.rate_to_usdt ?? 1,
        lauren_rate_out: c.lauren_rate_out ?? c.lauren_rate ?? 1,
        rate_from_peru: c.rate_from_peru ?? (c.id === "col" ? 850 : c.id === "chl" ? 254 : c.id === "ecu" ? 3.74 : c.id === "bra" ? 1.41 : c.id === "usa" ? 3.75 : 1),
        rate_from_colombia: c.rate_from_colombia ?? (c.id === "per" ? 1000 : c.id === "chl" ? 3.69 : c.id === "bra" ? 0.0014 : c.id === "ecu" ? 3420 : c.id === "usa" ? 3440 : 1),
        rate_from_chile: c.rate_from_chile ?? (c.id === "per" ? 290 : c.id === "col" ? 3.15 : c.id === "bra" ? 0.0051 : c.id === "ecu" ? 1000 : c.id === "usa" ? 1020 : 1),
        rate_from_usa: c.rate_from_usa ?? (c.id === "chl" ? 830 : c.id === "col" ? 2822 : c.id === "per" ? 3.07 : c.id === "bra" ? 4.55 : c.id === "ecu" ? 10 : 1),
        rate_from_ecuador: c.rate_from_ecuador ?? (c.id === "chl" ? 835 : c.id === "col" ? 2845 : c.id === "per" ? 3.09 : c.id === "bra" ? 4.55 : c.id === "usa" ? 8 : 1),
        rate_from_brazil: c.rate_from_brazil ?? (c.id === "per" ? 0.59 : c.id === "chl" ? 0.0051 : c.id === "ecu" ? 5.75 : c.id === "col" ? 550 : c.id === "usa" ? 5.75 : 1),
        operator: c.operator || (c.code === "COP" ? "divide" : "multiply"),
      }));
      setCurrencies(formatted);
      setOriginalCurrencies(JSON.parse(JSON.stringify(formatted)));
    }
  };

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

  const sanitizeNumericInput = (val: string): string => {
    let clean = val.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    return clean;
  };

  const handleLaurenRateChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, lauren_rate: clean as any } : c)));
  };

  const handleLaurenRateOutChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, lauren_rate_out: clean as any } : c)));
  };

  const handleRateFromPeruChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, rate_from_peru: clean as any } : c)));
  };

  const handleRateFromColombiaChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, rate_from_colombia: clean as any } : c)));
  };

  const handleRateFromChileChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, rate_from_chile: clean as any } : c)));
  };

  const handleRateFromUsaChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, rate_from_usa: clean as any } : c)));
  };

  const handleRateFromEcuadorChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, rate_from_ecuador: clean as any } : c)));
  };

  const handleRateFromBrazilChange = (id: string, value: string) => {
    const clean = sanitizeNumericInput(value);
    setCurrencies((prev) => prev.map((c) => (c.id === id ? { ...c, rate_from_brazil: clean as any } : c)));
  };

  const handleRateBlur = (id: string) => {
    setTimeout(() => {
      if (!isSavingRef.current) {
        cancelUpdate(id);
      }
    }, 150);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const triggerSaveConfirmation = (currency: Currency, type: "lauren" | "lauren_out" | "from_peru" | "from_colombia" | "from_chile" | "from_usa" | "from_ecuador" | "from_brazil") => {
    let rawValue = 0;
    if (type === "lauren") rawValue = currency.lauren_rate ?? 0;
    if (type === "lauren_out") rawValue = currency.lauren_rate_out ?? 0;
    if (type === "from_peru") rawValue = currency.rate_from_peru ?? 0;
    if (type === "from_colombia") rawValue = currency.rate_from_colombia ?? 0;
    if (type === "from_chile") rawValue = currency.rate_from_chile ?? 0;
    if (type === "from_usa") rawValue = currency.rate_from_usa ?? 0;
    if (type === "from_ecuador") rawValue = currency.rate_from_ecuador ?? 0;
    if (type === "from_brazil") rawValue = currency.rate_from_brazil ?? 0;

    const targetValue = parseFloat(String(rawValue));
    
    if (isNaN(targetValue) || targetValue <= 0) {
      showToast("⚠️ La tasa debe ser mayor a 0");
      cancelUpdate(currency.id);
      isSavingRef.current = false;
      return;
    }

    const original = originalCurrencies.find((c) => c.id === currency.id);
    let origValue = 0;
    if (type === "lauren") origValue = original?.lauren_rate ?? 0;
    if (type === "lauren_out") origValue = original?.lauren_rate_out ?? 0;
    if (type === "from_peru") origValue = original?.rate_from_peru ?? 0;
    if (type === "from_colombia") origValue = original?.rate_from_colombia ?? 0;
    if (type === "from_chile") origValue = original?.rate_from_chile ?? 0;
    if (type === "from_usa") origValue = original?.rate_from_usa ?? 0;
    if (type === "from_ecuador") origValue = original?.rate_from_ecuador ?? 0;
    if (type === "from_brazil") origValue = original?.rate_from_brazil ?? 0;

    if (origValue === targetValue) {
      showToast("ℹ️ Ninguna tasa ha sufrido cambios");
      isSavingRef.current = false;
      return;
    }

    setPendingUpdate({ currency, type });
  };

  const confirmSave = async () => {
    if (!pendingUpdate) return;

    const { currency, type } = pendingUpdate;
    setSavingId(`${type}-${currency.id}`);
    setPendingUpdate(null);

    let rawValue = 0;
    if (type === "lauren") rawValue = currency.lauren_rate ?? 0;
    if (type === "lauren_out") rawValue = currency.lauren_rate_out ?? 0;
    if (type === "from_peru") rawValue = currency.rate_from_peru ?? 0;
    if (type === "from_colombia") rawValue = currency.rate_from_colombia ?? 0;
    if (type === "from_chile") rawValue = currency.rate_from_chile ?? 0;
    if (type === "from_usa") rawValue = currency.rate_from_usa ?? 0;
    if (type === "from_ecuador") rawValue = currency.rate_from_ecuador ?? 0;
    if (type === "from_brazil") rawValue = currency.rate_from_brazil ?? 0;

    const numericValue = parseFloat(String(rawValue));

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (type === "lauren") {
      updatePayload.lauren_rate = numericValue;
    } else if (type === "lauren_out") {
      updatePayload.lauren_rate_out = numericValue;
    } else if (type === "from_peru") {
      updatePayload.rate_from_peru = numericValue;
    } else if (type === "from_colombia") {
      updatePayload.rate_from_colombia = numericValue;
    } else if (type === "from_chile") {
      updatePayload.rate_from_chile = numericValue;
    } else if (type === "from_usa") {
      updatePayload.rate_from_usa = numericValue;
    } else if (type === "from_ecuador") {
      updatePayload.rate_from_ecuador = numericValue;
    } else if (type === "from_brazil") {
      updatePayload.rate_from_brazil = numericValue;
    }

    const { error } = await supabase
      .from("currencies")
      .update(updatePayload)
      .eq("id", currency.id);

    if (error) {
      showToast("❌ Error al actualizar la tasa");
      cancelUpdate(currency.id);
    } else {
      const typeLabel = type === "lauren" ? "Hacia Venezuela" : type === "lauren_out" ? "Desde Venezuela" : type === "from_peru" ? "Desde Perú" : type === "from_colombia" ? "Desde Colombia" : type === "from_chile" ? "Desde Chile" : type === "from_usa" ? "Desde EE. UU." : type === "from_ecuador" ? "Desde Ecuador" : "Desde Brasil";
      showToast(`✨ Tasa (${typeLabel}) de ${currency.name} guardada`);
      
      const updatedCurrency = { ...currency, ...updatePayload };
      setOriginalCurrencies((prev) =>
        prev.map((c) => (c.id === currency.id ? updatedCurrency : c))
      );
      setCurrencies((prev) =>
        prev.map((c) => (c.id === currency.id ? updatedCurrency : c))
      );
    }
    setSavingId(null);
    isSavingRef.current = false;
  };

  const cancelUpdate = (id?: string) => {
    const targetId = id || pendingUpdate?.currency.id;
    if (targetId) {
      const original = originalCurrencies.find((c) => c.id === targetId);
      if (original) {
        setCurrencies((prev) =>
          prev.map((c) => (c.id === targetId ? JSON.parse(JSON.stringify(original)) : c))
        );
      }
    }
    setPendingUpdate(null);
    isSavingRef.current = false;
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

  const laurenCurrencies = currencies.filter((c) => c.code !== "VES");
  const peruCurrencies = currencies.filter((c) => c.id !== "per" && c.code !== "VES");
  const colombiaCurrencies = currencies.filter((c) => c.id !== "col" && c.code !== "VES");
  const chileCurrencies = currencies.filter((c) => c.id !== "chl" && c.code !== "VES");
  const usaCurrencies = currencies.filter((c) => c.id !== "usa" && c.code !== "VES");
  const ecuadorCurrencies = currencies.filter((c) => c.id !== "ecu" && c.code !== "VES");
  const brazilCurrencies = currencies.filter((c) => c.id !== "bra" && c.code !== "VES");

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
                    : pendingUpdate.type === "from_peru"
                    ? pendingUpdate.currency.rate_from_peru
                    : pendingUpdate.type === "from_colombia"
                    ? pendingUpdate.currency.rate_from_colombia
                    : pendingUpdate.type === "from_chile"
                    ? pendingUpdate.currency.rate_from_chile
                    : pendingUpdate.type === "from_usa"
                    ? (pendingUpdate.currency.id === "ecu" ? `${pendingUpdate.currency.rate_from_usa}%` : pendingUpdate.currency.rate_from_usa)
                    : pendingUpdate.type === "from_ecuador"
                    ? (pendingUpdate.currency.id === "usa" ? `${pendingUpdate.currency.rate_from_ecuador}%` : pendingUpdate.currency.rate_from_ecuador)
                    : pendingUpdate.currency.rate_from_brazil}
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

        {/* 🟡 SECCIÓN 1: TASAS DEL DÍA (HACIA VENEZUELA) */}
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
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
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
                      type="text"
                      inputMode="decimal"
                      value={currency.lauren_rate ?? ""}
                      onChange={(e) => handleLaurenRateChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "lauren")}
                    disabled={savingId === `lauren-${currency.id}`}
                    className="bg-[#b58e45] hover:bg-[#8b6d32] active:scale-95 text-[#121212] hover:text-[#f4f1ea] font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `lauren-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🟢 SECCIÓN 2: TASAS DEL DÍA (DESDE VENEZUELA) */}
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
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
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
                      type="text"
                      inputMode="decimal"
                      value={currency.lauren_rate_out ?? ""}
                      onChange={(e) => handleLaurenRateOutChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#cdead2] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "lauren_out")}
                    disabled={savingId === `lauren_out-${currency.id}`}
                    className="bg-[#cdead2] hover:bg-[#a1c4a7] active:scale-95 text-[#121212] font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `lauren_out-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🇵🇪 SECCIÓN 3: TASAS DEL DÍA (ENVÍOS DESDE PERÚ) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e63946]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#e63946] uppercase flex items-center gap-1.5">
              <span>🇵🇪</span> 3. Tasas del Día (Envíos DESDE Perú)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#e63946]/30 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {peruCurrencies.map((currency) => (
              <div
                key={`from-peru-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#e63946]/10 text-[#e63946] border border-[#e63946]/20">
                        {currency.id === "ecu" || currency.id === "usa" ? "/ Soles" : "x Soles"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#e63946]/40 rounded-xl bg-[#121212]/60 focus-within:border-[#e63946]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currency.rate_from_peru ?? ""}
                      onChange={(e) => handleRateFromPeruChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "from_peru")}
                    disabled={savingId === `from_peru-${currency.id}`}
                    className="bg-[#e63946] hover:bg-[#c12a36] active:scale-95 text-white font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `from_peru-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🇨🇴 SECCIÓN 4: TASAS DEL DÍA (ENVÍOS DESDE COLOMBIA) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffcd00]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#ffcd00] uppercase flex items-center gap-1.5">
              <span>🇨🇴</span> 4. Tasas del Día (Envíos DESDE Colombia)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#ffcd00]/30 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {colombiaCurrencies.map((currency) => (
              <div
                key={`from-colombia-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#ffcd00]/10 text-[#ffcd00] border border-[#ffcd00]/20">
                        {currency.id === "bra" ? "x COP" : "/ COP"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#ffcd00]/40 rounded-xl bg-[#121212]/60 focus-within:border-[#ffcd00]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currency.rate_from_colombia ?? ""}
                      onChange={(e) => handleRateFromColombiaChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "from_colombia")}
                    disabled={savingId === `from_colombia-${currency.id}`}
                    className="bg-[#ffcd00] hover:bg-[#d4a800] active:scale-95 text-[#121212] font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `from_colombia-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🇨🇱 SECCIÓN 5: TASAS DEL DÍA (ENVÍOS DESDE CHILE) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0039a6]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#0039a6] uppercase flex items-center gap-1.5">
              <span>🇨🇱</span> 5. Tasas del Día (Envíos DESDE Chile)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#0039a6]/40 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {chileCurrencies.map((currency) => (
              <div
                key={`from-chile-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#0039a6]/20 text-[#60a5fa] border border-[#0039a6]/30">
                        {currency.id === "col" || currency.id === "bra" ? "x CLP" : "/ CLP"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#0039a6]/50 rounded-xl bg-[#121212]/60 focus-within:border-[#60a5fa]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currency.rate_from_chile ?? ""}
                      onChange={(e) => handleRateFromChileChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "from_chile")}
                    disabled={savingId === `from_chile-${currency.id}`}
                    className="bg-[#0039a6] hover:bg-[#002880] active:scale-95 text-white font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `from_chile-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🇺🇸 SECCIÓN 6: TASAS DEL DÍA (ENVÍOS DESDE ESTADOS UNIDOS) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#3b82f6] uppercase flex items-center gap-1.5">
              <span>🇺🇸</span> 6. Tasas del Día (Envíos DESDE Estados Unidos)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#3b82f6]/40 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {usaCurrencies.map((currency) => (
              <div
                key={`from-usa-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#3b82f6]/20 text-[#60a5fa] border border-[#3b82f6]/30">
                        {currency.id === "ecu" ? "% Comisión" : "x USD"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#3b82f6]/50 rounded-xl bg-[#121212]/60 focus-within:border-[#60a5fa]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currency.rate_from_usa ?? ""}
                      onChange={(e) => handleRateFromUsaChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "from_usa")}
                    disabled={savingId === `from_usa-${currency.id}`}
                    className="bg-[#3b82f6] hover:bg-[#2563eb] active:scale-95 text-white font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `from_usa-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🇪🇨 SECCIÓN 7: TASAS DEL DÍA (ENVÍOS DESDE ECUADOR) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#10b981] uppercase flex items-center gap-1.5">
              <span>🇪🇨</span> 7. Tasas del Día (Envíos DESDE Ecuador)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#10b981]/40 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {ecuadorCurrencies.map((currency) => (
              <div
                key={`from-ecuador-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30">
                        {currency.id === "usa" ? "% Comisión" : "x USD"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#10b981]/50 rounded-xl bg-[#121212]/60 focus-within:border-[#34d399]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currency.rate_from_ecuador ?? ""}
                      onChange={(e) => handleRateFromEcuadorChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "from_ecuador")}
                    disabled={savingId === `from_ecuador-${currency.id}`}
                    className="bg-[#10b981] hover:bg-[#059669] active:scale-95 text-white font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `from_ecuador-${currency.id}` ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🇧🇷 SECCIÓN 8: TASAS DEL DÍA (ENVÍOS DESDE BRASIL) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div>
            <h2 className="text-[0.75rem] font-black tracking-wider text-[#22c55e] uppercase flex items-center gap-1.5">
              <span>🇧🇷</span> 8. Tasas del Día (Envíos DESDE Brasil)
            </h2>
          </div>

          <div className="bg-[#2c2e30] border border-[#22c55e]/40 rounded-2xl p-4 shadow-xl divide-y divide-[#121212]/60">
            {brazilCurrencies.map((currency) => (
              <div
                key={`from-brazil-${currency.id}`}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FlagIcon id={currency.id} code={currency.code} name={currency.name} />
                  <div className="truncate">
                    <h3 className="text-[0.75rem] font-bold text-[#f4f1ea] truncate">{currency.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[0.625rem] text-[#f4f1ea]/60 font-bold">{currency.code}</span>
                      <span className="text-[0.5625rem] font-extrabold px-1.5 py-0.2 rounded bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/30">
                        {currency.id === "per" || currency.id === "col" ? "x Reales" : "/ Reales"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative border border-[#22c55e]/50 rounded-xl bg-[#121212]/60 focus-within:border-[#4ade80]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={currency.rate_from_brazil ?? ""}
                      onChange={(e) => handleRateFromBrazilChange(currency.id, e.target.value)}
                      onBlur={() => handleRateBlur(currency.id)}
                      className="w-24 bg-transparent text-[#f4f1ea] font-bold text-right p-2 rounded-xl outline-none text-[0.75rem]"
                    />
                  </div>

                  <button
                    onMouseDown={() => { isSavingRef.current = true; }}
                    onClick={() => triggerSaveConfirmation(currency, "from_brazil")}
                    disabled={savingId === `from_brazil-${currency.id}`}
                    className="bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 text-white font-extrabold text-[0.75rem] py-2 px-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingId === `from_brazil-${currency.id}` ? "..." : "Guardar"}
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