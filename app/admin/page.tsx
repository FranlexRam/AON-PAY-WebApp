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

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<any>(null);

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    // Comprobar si ya hay sesión iniciada
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchCurrencies();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchCurrencies();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchCurrencies = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("currencies").select("*").order("id");
    if (error) alert("Error al cargar divisas: " + error.message);
    else setCurrencies(data || []);
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error de inicio de sesión: " + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleRateChange = (id: string, newRate: string) => {
    setCurrencies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, rate_to_usdt: parseFloat(newRate) || 0 } : c))
    );
  };

  const handleSaveRate = async (id: string, newRate: number) => {
    setSavingId(id);
    const { error } = await supabase
      .from("currencies")
      .update({ rate_to_usdt: newRate, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      alert("Error guardando la tasa: " + error.message);
    } else {
      alert("Tasa actualizada con éxito.");
    }
    setSavingId(null);
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-center">Panel Admin - Iniciar Sesión</h1>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
            Entrar al Panel
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div>
            <h1 className="font-bold text-base">Gestión de Tasas</h1>
            <p className="text-xs text-slate-400">{session.user.email}</p>
          </div>
          <button onClick={handleLogout} className="bg-rose-600/20 text-rose-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-500/30">
            Salir
          </button>
        </div>

        {loading ? (
          <p className="text-center text-slate-400 text-sm">Cargando divisas...</p>
        ) : (
          <div className="space-y-3">
            {currencies.map((curr) => (
              <div key={curr.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{curr.flag}</span>
                  <div>
                    <p className="font-bold text-sm">{curr.name}</p>
                    <p className="text-xs text-slate-400">{curr.code}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={curr.rate_to_usdt}
                    onChange={(e) => handleRateChange(curr.id, e.target.value)}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-right text-sm font-bold text-indigo-400 outline-none"
                  />
                  <button
                    onClick={() => handleSaveRate(curr.id, curr.rate_to_usdt)}
                    disabled={savingId === curr.id}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                  >
                    {savingId === curr.id ? "..." : "Guardar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}