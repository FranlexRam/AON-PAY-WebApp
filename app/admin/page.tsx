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

export default function AdminDashboard() {
  const router = useRouter();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      setLoading(true);
      // 1. Verificación de sesión activa
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        router.replace("/login");
        return;
      }

      // OPCIONAL: Si implementas Custom Claims o un rol en tabla 'profiles':
      // if (session.user.app_metadata.role !== 'admin') { router.replace("/"); return; }

      setAdminEmail(session.user.email || "Administrador");
      setAuthenticated(true);

      // 2. Carga segura de datos
      await fetchRates();
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [router]);

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("currencies")
      .select("id, name, code, flag, rate_to_usdt")
      .order("name");

    if (error) {
      showToast("❌ Error al cargar los datos");
      console.error("[SECURITY LOG] Error consultando tasas:", error.message);
    } else if (data) {
      setCurrencies(data);
    }
  };

  // Sanitización y límites en entrada de usuario
  const handleRateChange = (id: string, value: string) => {
    const numVal = parseFloat(value);
    
    // Previene valores NaN, infinitos, o negativos
    if (isNaN(numVal) || !isFinite(numVal) || numVal < 0) {
      setCurrencies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: 0 } : c))
      );
      return;
    }

    // Límite máximo de seguridad para prevenir desbordamientos o valores erróneos
    const SAFE_MAX_RATE = 1000000000; // 1 mil millones
    const sanitizedValue = Math.min(numVal, SAFE_MAX_RATE);

    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: sanitizedValue } : c))
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSave = async (currency: Currency) => {
    // Validaciones estrictas pre-envío
    if (currency.rate_to_usdt <= 0) {
      showToast("⚠️ La tasa debe ser mayor a 0");
      return;
    }

    setSavingId(currency.id);

    const { error } = await supabase
      .from("currencies")
      .update({ 
        rate_to_usdt: currency.rate_to_usdt,
        updated_at: new Date().toISOString()
      })
      .eq("id", currency.id);

    if (error) {
      showToast("❌ Error al actualizar la tasa (Permisos insuficientes)");
      console.error("[SECURITY LOG] Fallo de actualización RLS/BD:", error.message);
    } else {
      showToast(`✨ Tasa de ${currency.name} modificada exitosamente`);
    }
    setSavingId(null);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (err: any) {
      console.error("[SECURITY LOG] Error cerrando sesión:", err?.message || err);
      showToast("❌ Error al cerrar sesión");
    }
  };

  // Prevención de Fuga de UI: No renderiza nada del Dashboard si no está autenticado
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

        {/* LISTA DE MONEDAS */}
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
                  className="w-24 bg-transparent text-indigo-400 font-bold text-right p-2.5 rounded-xl outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <button
                onClick={() => handleSave(currency)}
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