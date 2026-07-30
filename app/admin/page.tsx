"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Currency {
  id: string;
  name: string;
  code: string;
  flag: string;
  rate_to_usdt: number;
}

export default function AdminDashboard() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("currencies").select("*").order("name");
    if (!error && data) {
      setCurrencies(data);
    }
    setLoading(false);
  };

  const handleRateChange = (id: string, value: string) => {
    const numVal = parseFloat(value);
    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: isNaN(numVal) ? 0 : numVal } : c))
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSave = async (currency: Currency) => {
    setSavingId(currency.id);
    const { error } = await supabase
      .from("currencies")
      .update({ 
      rate_to_usdt: currency.rate_to_usdt,
      updated_at: new Date().toISOString() // 👈 Sincroniza la fecha exacta
    })
      .eq("id", currency.id);

    if (error) {
      showToast("❌ Error al actualizar la tasa");
    } else {
      showToast(`✨ Tasa de ${currency.name} modificada exitosamente`);
    }
    setSavingId(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center p-4 py-8 relative">
      
      {/* NOTIFICACIÓN TOAST EN TIEMPO REAL */}
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
            <p className="text-xs text-slate-400">admin@calculadora.com</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
          >
            Salir
          </button>
        </div>

        {/* LISTA DE MONEDAS */}
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm animate-pulse">
            Cargando tasas...
          </div>
        ) : (
          currencies.map((currency) => (
            <div
              key={currency.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3"
            >
              {/* Información del País */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{currency.flag}</span>
                <div className="truncate">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{currency.name}</h3>
                  <p className="text-xs text-slate-400 font-semibold">{currency.code}</p>
                </div>
              </div>

              {/* Input y Botón Guardar */}
              <div className="flex items-center gap-2">
                <div className="relative border border-slate-800/80 rounded-xl bg-slate-950/60 transition-all focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <input
                    type="number"
                    step="any"
                    value={currency.rate_to_usdt === 0 ? "" : currency.rate_to_usdt}
                    onChange={(e) => handleRateChange(currency.id, e.target.value)}
                    className="w-24 bg-transparent text-indigo-400 font-bold text-right p-2.5 rounded-xl outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <button
                  onClick={() => handleSave(currency)}
                  disabled={savingId === currency.id}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {savingId === currency.id ? "..." : "Guardar"}
                </button>
              </div>
            </div>
          ))
        )}

      </div>
    </main>
  );
}