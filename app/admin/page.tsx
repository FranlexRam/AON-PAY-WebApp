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
  const [pendingUpdate, setPendingUpdate] = useState<Currency | null>(null);

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
      .select("id, name, code, flag, rate_to_usdt")
      .order("name");

    if (error) {
      showToast("❌ Error al cargar las tasas");
    } else if (data) {
      setCurrencies(data);
      setOriginalCurrencies(JSON.parse(JSON.stringify(data))); // Copia de respaldo inmutable
    }
  };

  // Consulta el endpoint interno del BCV (Server-side proxy)
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

  // Formateador de tiempo relativo ("hace X minutos/horas")
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

  // Sanitización de inputs contra desbordamiento o valores inválidos
  const handleRateChange = (id: string, value: string) => {
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

  // Reversión automática al perder el foco (si no hace clic en "Guardar")
  const handleRateBlur = (currencyId: string) => {
    setTimeout(() => {
      setPendingUpdate((currentPending) => {
        // Si no se activó el modal de confirmación, revertimos la tasa al valor original
        if (currentPending?.id !== currencyId) {
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

  // Paso 1: Dispara el modal de confirmación
  const triggerSaveConfirmation = (currency: Currency) => {
    if (currency.rate_to_usdt <= 0) {
      showToast("⚠️ La tasa debe ser mayor a 0");
      cancelUpdate(currency.id);
      return;
    }

    // Si el valor no sufrió modificaciones reales, no abre el modal
    const original = originalCurrencies.find((c) => c.id === currency.id);
    if (original && original.rate_to_usdt === currency.rate_to_usdt) {
      showToast("ℹ️ La tasa no ha sufrido cambios");
      return;
    }

    setPendingUpdate(currency);
  };

  // Paso 2: Confirmación intencional y escritura segura en la BD
  const confirmSave = async () => {
    if (!pendingUpdate) return;

    const currency = pendingUpdate;
    setSavingId(currency.id);
    setPendingUpdate(null);

    const { error } = await supabase
      .from("currencies")
      .update({
        rate_to_usdt: currency.rate_to_usdt,
        updated_at: new Date().toISOString()
      })
      .eq("id", currency.id);

    if (error) {
      showToast("❌ Error al actualizar la tasa");
      cancelUpdate(currency.id);
    } else {
      showToast(`✨ Tasa de ${currency.name} modificada exitosamente`);
      // Sincronizamos la copia original de respaldo
      setOriginalCurrencies((prev) =>
        prev.map((c) => (c.id === currency.id ? { ...currency } : c))
      );
    }
    setSavingId(null);
  };

  // Paso 3: Cancela la operación y restaura el valor original
  const cancelUpdate = (id?: string) => {
    const targetId = id || pendingUpdate?.id;
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

  // Guard de renderizado: previene fuga de UI antes de validar la sesión
  if (loading || !authenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Verificando credenciales de acceso...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4 py-8 relative">

      {/* NOTIFICACIÓN TOAST */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 transition-all animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ⚠️ MODAL DE CONFIRMACIÓN (Cierre al hacer clic por fuera) */}
      {pendingUpdate && (
        <div 
          onClick={() => cancelUpdate()} 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-xs w-full space-y-4 text-center transform transition-all scale-100"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-100">¿Confirmar cambio de tasa?</h3>
              <p className="text-xs text-slate-400 mt-1">
                La tasa de <span className="font-bold text-indigo-400">{pendingUpdate.name}</span> cambiará a:
              </p>
              <p className="text-lg font-black text-indigo-300 mt-2 bg-slate-950/60 py-1.5 rounded-xl border border-slate-800">
                {pendingUpdate.rate_to_usdt}
              </p>
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
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Sí, Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-4">

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

        {/* 🏛️ TARJETA DE REFERENCIA OFICIAL BCV */}
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
                {/* Dólar BCV */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dólar BCV</p>
                  <p className="text-base font-extrabold text-slate-100 mt-0.5">
                    {bcvData.usd ? `${bcvData.usd.toFixed(2)} VES` : "N/A"}
                  </p>
                </div>

                {/* Euro BCV */}
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

        {/* LISTA DE MONEDAS DEL DASHBOARD */}
        {currencies.map((currency) => (
          <div
            key={currency.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl">{currency.flag}</span>
              <div className="truncate">
                <h3 className="text-sm font-bold text-slate-100 truncate">{currency.name}</h3>
                <p className="text-xs text-slate-400 font-semibold">{currency.code}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative border border-slate-800/80 rounded-xl bg-slate-950/60 transition-all focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={currency.rate_to_usdt === 0 ? "" : currency.rate_to_usdt}
                  onChange={(e) => handleRateChange(currency.id, e.target.value)}
                  onBlur={() => handleRateBlur(currency.id)}
                  className="w-24 bg-transparent text-indigo-400 font-bold text-right p-2.5 rounded-xl outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <button
                onClick={() => triggerSaveConfirmation(currency)}
                disabled={savingId === currency.id}
                className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingId === currency.id ? "..." : "Guardar"}
              </button>
            </div>
          </div>
        ))}

      </div>
    </main>
  );
}