"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("Credenciales inválidas. Revisa tu correo o contraseña.");
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-[#0e0e0e] text-[#f4f1ea] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden antialiased selection:bg-[#b58e45] selection:text-[#121212]">
      
      {/* 1. ESFERAS DE LUZ EN EL FONDO (GLOW RADIAL DORADO) */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#b58e45]/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#8b6d32]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* 2. CARD PRINCIPAL GLASSMORPHISM */}
      <div className="w-full max-w-md sm:max-w-lg bg-[#2c2e30]/65 backdrop-blur-xl border border-[#b58e45]/30 border-t-[#b58e45]/60 rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative z-10 space-y-6 sm:space-y-8">
        
        {/* ENCABEZADO CON LOGO, MARCA Y ESLOGAN */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-[#121212]/80 border border-[#b58e45]/30 rounded-2xl p-2.5 shadow-inner">
            <img
              src="/logo.png"
              alt="AON Pay Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-1">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-wide text-[#f4f1ea] leading-tight block">
              AON <span className="text-[#b58e45]">Pay</span>
            </span>
            <p className="text-xs sm:text-sm text-[#f4f1ea]/70 italic font-medium">
              "Conectamos tu dinero de origen a destino"
            </p>
          </div>

          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 bg-[#b58e45]/15 border border-[#b58e45]/30 text-[#b58e45] text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full">
              🛡️ Acceso Súper Usuario
            </span>
          </div>
        </div>

        {/* ALERTA DE ERROR */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm p-3.5 rounded-xl font-semibold text-center animate-shake">
            {errorMsg}
          </div>
        )}

        {/* FORMULARIO DE ACCESO */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* CAMPO EMAIL */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-semibold text-[#f4f1ea]/80 block">
              Correo Electrónico
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-[#b58e45]/70 text-base select-none">
                ✉️
              </span>
              <input
                type="email"
                required
                placeholder="admin@aonpay.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#121212]/70 border border-[#b58e45]/30 focus:border-[#b58e45] focus:ring-1 focus:ring-[#b58e45] rounded-xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-[#f4f1ea] placeholder-[#f4f1ea]/30 outline-none transition-all"
              />
            </div>
          </div>

          {/* CAMPO CONTRASEÑA */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-semibold text-[#f4f1ea]/80 block">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-[#b58e45]/70 text-base select-none">
                🔒
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#121212]/70 border border-[#b58e45]/30 focus:border-[#b58e45] focus:ring-1 focus:ring-[#b58e45] rounded-xl pl-11 pr-12 py-3.5 text-sm sm:text-base text-[#f4f1ea] placeholder-[#f4f1ea]/30 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-[#f4f1ea]/50 hover:text-[#b58e45] text-xs font-bold transition-colors p-1"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* BOTÓN CON SHIMMER DE ORO */}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full min-h-[52px] bg-[#b58e45] hover:bg-[#8b6d32] active:scale-[0.98] text-[#121212] hover:text-[#f4f1ea] font-extrabold py-3.5 px-5 rounded-xl shadow-[0_4px_20px_rgba(181,142,69,0.3)] transition-all text-sm sm:text-base overflow-hidden outline-none cursor-pointer disabled:opacity-50"
          >
            {/* EFECTO DE RESPLANDOR/DESTO AL PASAR EL CURSOR */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <span className="relative z-10">
              {loading ? "Iniciando sesión..." : "Ingresar al Panel"}
            </span>
          </button>
        </form>

        {/* PIE DE SEGURIDAD */}
        <div className="pt-2 text-center border-t border-[#121212]/50">
          <p className="text-[11px] sm:text-xs font-medium text-[#f4f1ea]/50 flex items-center justify-center gap-1.5">
            <span>🔒</span> Conexión cifrada de alta seguridad
          </p>
        </div>

      </div>
    </main>
  );
}