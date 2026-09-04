'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabasePlexus as supabase } from '@/lib/supabase';

interface Transaction {
  id: string;
  client_phone: string;
  origin_country: string;
  dest_country: string;
  origin_currency: string;
  dest_currency: string;
  amount_sent: number;
  amount_received: number;
  usd_equivalent: number;
  rate_applied: string;
  status: string;
  created_at: string;
}

interface Client {
  phone: string;
  full_name: string | null;
  status: string;
  contact_type: string;
  preferred_origin_country: string | null;
  preferred_dest_country: string | null;
  is_verified: boolean;
  created_at: string;
}

interface CurrencyRate {
  id?: number;
  country: string;
  currency_code: string;
  rate_to_usdt: number | string;
  updated_at?: string;
}

const COUNTRY_ISO_MAP: Record<string, { iso: string; name: string }> = {
  'Estados Unidos': { iso: 'us', name: 'Estados Unidos' },
  'Ecuador': { iso: 'ec', name: 'Ecuador' },
  'Venezuela': { iso: 've', name: 'Venezuela' },
  'Colombia': { iso: 'co', name: 'Colombia' },
  'Perú': { iso: 'pe', name: 'Perú' },
  'Chile': { iso: 'cl', name: 'Chile' },
  'Brasil': { iso: 'br', name: 'Brasil' },
};

function FlagIcon({ country, className = 'w-7 h-5' }: { country: string; className?: string }) {
  const [hasError, setHasError] = useState(false);
  const info = COUNTRY_ISO_MAP[country] || { iso: 'xx', name: country };

  if (hasError) {
    return (
      <span className={`inline-flex items-center justify-center bg-[#121212] border border-[#b58e45]/40 text-[#b58e45] font-bold text-sm rounded px-1.5 shrink-0 ${className}`}>
        {country.substring(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${info.iso}.png`}
      srcSet={`https://flagcdn.com/w80/${info.iso}.png 2x`}
      alt={`Bandera de ${country}`}
      loading="lazy"
      onError={() => setHasError(true)}
      className={`object-cover rounded shadow-sm shrink-0 ${className}`}
    />
  );
}

function AonLogo() {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-[#b58e45] to-[#8b6d32] p-0.5 shadow-[0_0_30px_rgba(181,142,69,0.4)] shrink-0">
        <div className="w-full h-full bg-[#121212] rounded-[22px] flex items-center justify-center">
          <span className="font-black tracking-tighter text-[#b58e45] text-2xl sm:text-3xl font-mono">AON</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt="AON Pay Logo"
      onError={() => setImgError(true)}
      className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-3xl drop-shadow-[0_0_25px_rgba(181,142,69,0.55)] shrink-0 transition-transform hover:scale-105 duration-300"
    />
  );
}

const VALID_COUNTRIES = [
  'Perú',
  'Colombia',
  'Chile',
  'Estados Unidos',
  'Ecuador',
  'Brasil',
  'Venezuela'
];

function CurrencyRatesManager() {
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [originalRates, setOriginalRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const fetchRates = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('currency_rates')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setRates(data as CurrencyRate[]);
        setOriginalRates(JSON.parse(JSON.stringify(data)));
      }
    } catch (err: any) {
      console.error('Error cargando currency_rates:', err);
      setErrorMessage('No se pudieron cargar los valores USDT.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const formatLatamNumber = (val: number | string | undefined): string => {
    if (val === undefined || val === null || val === '') return '';
    const cleanStr = String(val).replace(/\./g, '').replace(',', '.');
    const num = typeof val === 'number' ? val : parseFloat(cleanStr);
    if (isNaN(num)) return String(val);
    
    return num.toLocaleString('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  };

  const parseLatamToNumber = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const normalized = String(val).replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const handleRateChange = (country: string, rawVal: string) => {
    let clean = rawVal.replace(/[^0-9.,]/g, '');
    const hasComma = clean.includes(',');
    const hasDot = clean.includes('.');
    if (hasComma && hasDot) {
      clean = clean.replace(/\./g, '');
    }

    setRates((prev) =>
      prev.map((r) => (r.country === country ? { ...r, rate_to_usdt: clean } : r))
    );
  };

  const pendingChanges = useMemo(() => {
    return rates.filter((r) => {
      const original = originalRates.find((o) => o.country === r.country);
      if (!original) return false;
      const originalVal = parseLatamToNumber(original?.rate_to_usdt ?? '');
      const currentVal = parseLatamToNumber(r.rate_to_usdt);
      return originalVal !== currentVal;
    });
  }, [rates, originalRates]);

  const hasPendingChanges = pendingChanges.length > 0;

  const handleRevertChanges = () => {
    setRates(JSON.parse(JSON.stringify(originalRates)));
  };

  const handleSaveClick = () => {
    if (!hasPendingChanges) {
      setInfoMessage('ℹ️ Ningún valor ha sufrido cambios');
      setTimeout(() => setInfoMessage(null), 3000);
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');
    setShowConfirmModal(false);

    try {
      const nowIso = new Date().toISOString();
      const updates = rates.map((r) => ({
        country: r.country,
        currency_code: r.currency_code,
        rate_to_usdt: parseLatamToNumber(r.rate_to_usdt),
        updated_at: nowIso,
      }));

      const { error } = await supabase
        .from('currency_rates')
        .upsert(updates, { onConflict: 'country' });

      if (error) throw error;

      const updatedLocal = rates.map((r) => ({
        ...r,
        rate_to_usdt: parseLatamToNumber(r.rate_to_usdt),
        updated_at: nowIso
      }));
      setRates(updatedLocal);
      setOriginalRates(JSON.parse(JSON.stringify(updatedLocal)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error guardando currency_rates:', err);
      setErrorMessage('Hubo un error al guardar los valores.');
    } finally {
      setSaving(false);
    }
  };

  const editableCurrencies = rates.filter(
    (r) => !['Estados Unidos', 'Ecuador'].includes(r.country)
  );

  const formattedCurrentDate = useMemo(() => {
    try {
      const now = new Date();
      const formatted = now.toLocaleDateString('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return 'Día de hoy';
    }
  }, []);

  const lastUpdatedText = useMemo(() => {
    const dates = rates
      .map((r) => r.updated_at)
      .filter(Boolean) as string[];

    if (dates.length === 0) return null;

    dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const latest = new Date(dates[0]);
    const now = new Date();
    const diffMs = now.getTime() - latest.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return 'hace unos momentos';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} hr${diffHours > 1 ? 's' : ''}`;
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7) return `hace ${diffDays} días`;
    return latest.toLocaleDateString('es-VE', { dateStyle: 'short' });
  }, [rates]);

  return (
    <>
      {showConfirmModal && (
        <div 
          onClick={() => setShowConfirmModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 transition-all"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121212] border border-[#b58e45]/40 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] max-w-xl w-full space-y-6 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#b58e45]/15 border border-[#b58e45]/40 flex items-center justify-center text-2xl shrink-0">
                📝
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#f4f1ea]">
                  Confirmar Valores USDT del Día
                </h3>
                <p className="text-sm text-[#f4f1ea]/70 mt-0.5 font-medium">
                  {pendingChanges.length} {pendingChanges.length === 1 ? 'paridad modificada' : 'paridades modificadas'} para cálculo de Ref. USD
                </p>
              </div>
            </div>

            <div className="bg-[#2c2e30] border border-[#b58e45]/20 rounded-2xl p-4 divide-y divide-[#b58e45]/10 max-h-72 overflow-y-auto space-y-2">
              {pendingChanges.map((change) => {
                const original = originalRates.find((o) => o.country === change.country);
                return (
                  <div key={change.country} className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <FlagIcon country={change.country} className="w-7 h-5" />
                      <div>
                        <span className="font-extrabold text-base text-[#f4f1ea]">{change.country}</span>
                        <span className="ml-2 text-xs font-mono font-bold text-[#b58e45] bg-[#b58e45]/15 px-2 py-0.5 rounded border border-[#b58e45]/30">
                          {change.currency_code}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 font-mono self-end sm:self-auto">
                      <span className="text-sm text-[#f4f1ea]/50 line-through">
                        {formatLatamNumber(original?.rate_to_usdt)}
                      </span>
                      <span className="text-[#b58e45] text-sm">➔</span>
                      <span className="font-black text-emerald-400 text-lg">
                        {formatLatamNumber(change.rate_to_usdt)} <span className="text-xs">{change.currency_code}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-3.5 rounded-xl bg-[#2c2e30] hover:bg-[#383a3c] border border-[#b58e45]/25 text-[#f4f1ea]/80 font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-5 py-3.5 rounded-xl bg-[#b58e45] hover:bg-[#9d7938] text-[#121212] font-black text-sm shadow-xl transition-all cursor-pointer"
              >
                Confirmar y Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VALORES USDT CON FONDO ORIGINAL #121212 */}
      <section className="p-6 sm:p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_#10b981]" />
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-[#b58e45]">
                Valores USDT del Día (P2P Referencial)
              </h3>
            </div>
            <p className="text-sm sm:text-base text-[#f4f1ea]/70 mt-1 font-medium">
              Tasa operativa en moneda local para calcular Ref. USD universal sobre el capital recibido.
            </p>
            
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2c2e30] border border-[#b58e45]/25 text-xs font-bold text-[#b58e45]">
                <span>📅</span>
                <span>{formattedCurrentDate}</span>
              </div>
              {lastUpdatedText && (
                <span className="text-xs text-[#f4f1ea]/60 font-medium">
                  • Actualizado {lastUpdatedText}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-center">
            {hasPendingChanges && (
              <button
                onClick={handleRevertChanges}
                type="button"
                className="px-4 py-2.5 text-xs font-bold text-[#f4f1ea]/80 hover:text-[#f4f1ea] bg-[#2c2e30] hover:bg-[#383a3c] border border-[#b58e45]/25 rounded-xl transition-all cursor-pointer"
              >
                Deshacer
              </button>
            )}

            <button
              onClick={handleSaveClick}
              disabled={saving || loading}
              className={`px-5 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer shadow-lg flex items-center gap-2 ${
                saveSuccess
                  ? 'bg-emerald-500 text-[#121212] scale-105'
                  : hasPendingChanges
                  ? 'bg-amber-500 hover:bg-amber-400 text-[#121212] animate-pulse shadow-[0_0_24px_rgba(245,158,11,0.55)] scale-105'
                  : 'bg-[#b58e45] hover:bg-[#9d7938] text-[#121212] disabled:opacity-40 disabled:pointer-events-none'
              }`}
            >
              <span>{saveSuccess ? '✓' : hasPendingChanges ? '⚠️' : '💾'}</span>
              <span>
                {saving
                  ? 'Guardando...'
                  : saveSuccess
                  ? 'Guardado'
                  : hasPendingChanges
                  ? 'Guardar Cambios'
                  : 'Guardar'}
              </span>
            </button>
          </div>
        </div>

        {infoMessage && (
          <div className="text-xs sm:text-sm text-amber-300 bg-amber-950/40 border border-amber-500/40 p-3 rounded-xl flex items-center gap-2">
            <span>{infoMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 p-3 rounded-xl">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-sm text-[#f4f1ea]/40 animate-pulse">
            Cargando valores configurados de Supabase...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {editableCurrencies.map((item) => {
              const original = originalRates.find((o) => o.country === item.country);
              const originalVal = parseLatamToNumber(original?.rate_to_usdt ?? '');
              const currentVal = parseLatamToNumber(item.rate_to_usdt);
              const isModified = originalVal !== currentVal;

              return (
                <div
                  key={item.country}
                  className={`bg-[#2c2e30] rounded-2xl p-4 flex flex-col justify-between transition-all border ${
                    isModified
                      ? 'border-amber-500/80 shadow-[0_0_18px_rgba(245,158,11,0.25)]'
                      : 'border-[#b58e45]/20 hover:border-[#b58e45]/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 mb-3 text-center">
                    <FlagIcon country={item.country} className="w-7 h-5" />
                    <span className="text-base font-extrabold text-[#f4f1ea]">
                      {item.country}
                    </span>
                    <span className="text-xs font-mono font-black text-[#b58e45] bg-[#b58e45]/15 px-2 py-0.5 rounded border border-[#b58e45]/30">
                      {item.currency_code}
                    </span>
                  </div>
                  
                  <div className="relative border border-[#b58e45]/30 rounded-xl bg-[#121212] focus-within:border-[#b58e45] focus-within:ring-1 focus-within:ring-[#b58e45]/40 transition-all">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.rate_to_usdt ?? ''}
                      onChange={(e) => handleRateChange(item.country, e.target.value)}
                      className="w-full bg-transparent text-[#f4f1ea] font-black text-right p-3 rounded-xl outline-none text-lg sm:text-xl font-mono"
                      placeholder="0,00"
                    />
                  </div>

                  {isModified && (
                    <div className="text-xs font-mono text-amber-400 font-bold mt-2 text-center">
                      Anterior: {formatLatamNumber(original?.rate_to_usdt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

export default function AdminCrmPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originCountryFilter, setOriginCountryFilter] = useState<string>('all');
  const [destCountryFilter, setDestCountryFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);
  const [filterOnlyConfirmed, setFilterOnlyConfirmed] = useState<boolean>(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [tempStart, setTempStart] = useState<string>('');
  const [tempEnd, setTempEnd] = useState<string>('');
  const calendarRef = useRef<HTMLDivElement>(null);

  const [routeViewMode, setRouteViewMode] = useState<'confirmed' | 'quoted'>('confirmed');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  useEffect(() => {
    fetchCrmData();

    const txChannel = supabase
      .channel('realtime_transactions_crm_v3')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          setTransactions((prev) => [payload.new as Transaction, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
    };
  }, []);

  const fetchCrmData = async () => {
    setLoading(true);
    try {
      const [txRes, clientsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (txRes.data) setTransactions(txRes.data as Transaction[]);
      if (clientsRes.data) setClients(clientsRes.data as Client[]);
    } catch (err) {
      console.error('Error cargando métricas de CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCaracasDateString = (dateObj: Date): string => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  };

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => {
      if (c.phone && c.full_name) {
        map[c.phone] = c.full_name;
      }
    });
    return map;
  }, [clients]);

  const hasActiveClientFilters = useMemo(() => {
    return (
      searchTerm.trim() !== '' ||
      statusFilter !== 'all' ||
      originCountryFilter !== 'all' ||
      destCountryFilter !== 'all' ||
      selectedClientPhone !== null
    );
  }, [searchTerm, statusFilter, originCountryFilter, destCountryFilter, selectedClientPhone]);

  const handleClearClientFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setOriginCountryFilter('all');
    setDestCountryFilter('all');
    setSelectedClientPhone(null);
    setCurrentPage(1);
  };

  const sanitizedDateFilteredTransactions = useMemo(() => {
    const now = new Date();
    const todayCaracas = getCaracasDateString(now);

    return transactions.filter((tx) => {
      if (!tx.origin_country || tx.origin_country.toLowerCase() === 'origen') return false;

      const txDate = new Date(tx.created_at);

      if (dateRangeFilter === 'all') return true;

      if (dateRangeFilter === 'today') {
        const txCaracas = getCaracasDateString(txDate);
        return txCaracas === todayCaracas;
      }

      if (dateRangeFilter === '7d') {
        const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }

      if (dateRangeFilter === '30d') {
        const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }

      if (dateRangeFilter === 'custom') {
        const txCaracas = getCaracasDateString(txDate);
        if (customStartDate && txCaracas < customStartDate) return false;
        if (customEndDate && txCaracas > customEndDate) return false;
        return true;
      }

      return true;
    });
  }, [transactions, dateRangeFilter, customStartDate, customEndDate]);

  const handleCalendarDayClick = (dayStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dayStr);
      setTempEnd('');
    } else {
      if (dayStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dayStr);
      } else {
        setTempEnd(dayStr);
      }
    }
  };

  const applyCustomDateRange = () => {
    if (tempStart) {
      setCustomStartDate(tempStart);
      setCustomEndDate(tempEnd || tempStart);
      setDateRangeFilter('custom');
      setCurrentPage(1);
      setIsCalendarOpen(false);
    }
  };

  const setShortcutRange = (type: 'yesterday' | '7d' | '15d' | 'this_month' | 'last_month') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'yesterday') {
      start.setDate(now.getDate() - 1);
      end.setDate(now.getDate() - 1);
    } else if (type === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (type === '15d') {
      start.setDate(now.getDate() - 15);
    } else if (type === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (type === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const startStr = getCaracasDateString(start);
    const endStr = getCaracasDateString(end);

    setTempStart(startStr);
    setTempEnd(endStr);
    setCustomStartDate(startStr);
    setCustomEndDate(endStr);
    setDateRangeFilter('custom');
    setCurrentPage(1);
    setIsCalendarOpen(false);
  };

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dateStr: '', dayNum: 0, isCurrentMonth: false });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      days.push({
        dateStr: `${year}-${monthStr}-${dayStr}`,
        dayNum: d,
        isCurrentMonth: true
      });
    }

    return days;
  }, [calendarViewDate]);

  // KPIs
  const totalVolumeUSD = useMemo(() => {
    return sanitizedDateFilteredTransactions.reduce((acc, curr) => acc + (curr.usd_equivalent || 0), 0);
  }, [sanitizedDateFilteredTransactions]);

  const confirmedTransactions = useMemo(() => {
    return sanitizedDateFilteredTransactions.filter((tx) => tx.status && tx.status.toLowerCase() !== 'quoted');
  }, [sanitizedDateFilteredTransactions]);

  const confirmedVolumeUSD = useMemo(() => {
    return confirmedTransactions.reduce((acc, curr) => acc + (curr.usd_equivalent || 0), 0);
  }, [confirmedTransactions]);

  const totalTransactionsCount = sanitizedDateFilteredTransactions.length;

  const averageTicketUSD = useMemo(() => {
    if (totalTransactionsCount === 0) return 0;
    return totalVolumeUSD / totalTransactionsCount;
  }, [totalVolumeUSD, totalTransactionsCount]);

  const topVolumeClient = useMemo(() => {
    if (confirmedTransactions.length === 0) return { phone: 'N/A', name: 'N/A', amount: 0, ops: 0 };
    const userTotals: Record<string, { totalUsd: number; count: number }> = {};
    confirmedTransactions.forEach((tx) => {
      if (!userTotals[tx.client_phone]) {
        userTotals[tx.client_phone] = { totalUsd: 0, count: 0 };
      }
      userTotals[tx.client_phone].totalUsd += tx.usd_equivalent || 0;
      userTotals[tx.client_phone].count += 1;
    });
    const sorted = Object.entries(userTotals).sort((a, b) => b[1].totalUsd - a[1].totalUsd);
    if (!sorted[0]) return { phone: 'N/A', name: 'N/A', amount: 0, ops: 0 };
    const topPhone = sorted[0][0];
    const clientData = clients.find((c) => c.phone === topPhone);
    return {
      phone: topPhone,
      name: clientData?.full_name || 'Sin registrar',
      amount: sorted[0][1].totalUsd,
      ops: sorted[0][1].count
    };
  }, [confirmedTransactions, clients]);

  const mostLoyalClient = useMemo(() => {
    if (sanitizedDateFilteredTransactions.length === 0) return { phone: 'N/A', name: 'N/A', count: 0 };
    const userCounts: Record<string, number> = {};
    sanitizedDateFilteredTransactions.forEach((tx) => {
      userCounts[tx.client_phone] = (userCounts[tx.client_phone] || 0) + 1;
    });
    const sorted = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return { phone: 'N/A', name: 'N/A', count: 0 };
    const topPhone = sorted[0][0];
    const clientData = clients.find((c) => c.phone === topPhone);
    return {
      phone: topPhone,
      name: clientData?.full_name || 'Sin registrar',
      count: sorted[0][1]
    };
  }, [sanitizedDateFilteredTransactions, clients]);

  const conversionRate = useMemo(() => {
    if (sanitizedDateFilteredTransactions.length === 0) return 0;
    return (confirmedTransactions.length / sanitizedDateFilteredTransactions.length) * 100;
  }, [sanitizedDateFilteredTransactions, confirmedTransactions]);

  const routeDistribution = useMemo(() => {
    const targetSource = routeViewMode === 'confirmed' ? confirmedTransactions : sanitizedDateFilteredTransactions;
    const totalOps = targetSource.length;

    if (totalOps === 0) return [];
    const counts: Record<string, number> = {};
    targetSource.forEach((tx) => {
      const rKey = `${tx.origin_country} ➔ ${tx.dest_country}`;
      counts[rKey] = (counts[rKey] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([route, count]) => ({
        route,
        count,
        percentage: ((count / totalOps) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  }, [sanitizedDateFilteredTransactions, confirmedTransactions, routeViewMode]);

  const peakStats = useMemo(() => {
    const daysMap: Record<string, number> = {
      'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0
    };
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const hoursMap: Record<number, number> = {};

    sanitizedDateFilteredTransactions.forEach((tx) => {
      const d = new Date(tx.created_at);
      const dayName = dayNames[d.getDay()];
      if (daysMap[dayName] !== undefined) daysMap[dayName] += 1;

      const hour = d.getHours();
      hoursMap[hour] = (hoursMap[hour] || 0) + 1;
    });

    const topDayEntry = Object.entries(daysMap).sort((a, b) => b[1] - a[1])[0];
    const topHourEntry = Object.entries(hoursMap).sort((a, b) => b[1] - a[1])[0];

    const formatHour = (hStr: string) => {
      const h = parseInt(hStr, 10);
      if (isNaN(h)) return 'N/A';
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formatted = h % 12 === 0 ? 12 : h % 12;
      return `${formatted}:00 ${ampm}`;
    };

    return {
      peakDay: topDayEntry && topDayEntry[1] > 0 ? topDayEntry[0] : 'Sin datos',
      peakDayOps: topDayEntry ? topDayEntry[1] : 0,
      peakHour: topHourEntry ? formatHour(topHourEntry[0]) : 'Sin datos',
      peakHourOps: topHourEntry ? topHourEntry[1] : 0
    };
  }, [sanitizedDateFilteredTransactions]);

  const consolidatedClients = useMemo(() => {
    const activeBaseTransactions = filterOnlyConfirmed ? confirmedTransactions : sanitizedDateFilteredTransactions;

    const txMap: Record<string, { count: number; totalUsd: number }> = {};
    activeBaseTransactions.forEach((tx) => {
      if (!txMap[tx.client_phone]) {
        txMap[tx.client_phone] = { count: 0, totalUsd: 0 };
      }
      txMap[tx.client_phone].count += 1;
      txMap[tx.client_phone].totalUsd += tx.usd_equivalent || 0;
    });

    const clientTransactionsMap: Record<string, Transaction[]> = {};
    sanitizedDateFilteredTransactions.forEach((tx) => {
      if (!clientTransactionsMap[tx.client_phone]) {
        clientTransactionsMap[tx.client_phone] = [];
      }
      clientTransactionsMap[tx.client_phone].push(tx);
    });

    const cleanSearch = searchTerm.trim().toLowerCase();

    return clients
      .filter((c) => c.contact_type === 'client')
      .map((c) => ({
        ...c,
        txCount: txMap[c.phone]?.count || 0,
        totalVolume: txMap[c.phone]?.totalUsd || 0
      }))
      .filter((c) => {
        if (filterOnlyConfirmed && c.txCount === 0) return false;

        let matchesSearch = true;
        if (cleanSearch) {
          const rawPhone = (c.phone || '').toLowerCase();
          const prefixedPhone = `+${rawPhone}`;
          const clientName = (c.full_name || '').toLowerCase();

          matchesSearch =
            rawPhone.includes(cleanSearch) ||
            prefixedPhone.includes(cleanSearch) ||
            clientName.includes(cleanSearch);
        }

        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

        let matchesOrigin = true;
        if (originCountryFilter !== 'all') {
          const prefOrigin = (c.preferred_origin_country || '').toLowerCase();
          const targetOrigin = originCountryFilter.toLowerCase();
          const hasPrefMatch = prefOrigin.includes(targetOrigin);
          
          const clientTxs = clientTransactionsMap[c.phone] || [];
          const hasTxMatch = clientTxs.some((tx) => (tx.origin_country || '').toLowerCase().includes(targetOrigin));

          matchesOrigin = hasPrefMatch || hasTxMatch;
        }

        let matchesDest = true;
        if (destCountryFilter !== 'all') {
          const prefDest = (c.preferred_dest_country || '').toLowerCase();
          const targetDest = destCountryFilter.toLowerCase();
          const hasPrefMatch = prefDest.includes(targetDest);

          const clientTxs = clientTransactionsMap[c.phone] || [];
          const hasTxMatch = clientTxs.some((tx) => (tx.dest_country || '').toLowerCase().includes(targetDest));

          matchesDest = hasPrefMatch || hasTxMatch;
        }

        return matchesSearch && matchesStatus && matchesOrigin && matchesDest;
      })
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clients, sanitizedDateFilteredTransactions, confirmedTransactions, filterOnlyConfirmed, searchTerm, statusFilter, originCountryFilter, destCountryFilter]);

  const filteredTransactions = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    return sanitizedDateFilteredTransactions.filter((tx) => {
      if (filterOnlyConfirmed && (!tx.status || tx.status.toLowerCase() === 'quoted')) return false;
      if (selectedClientPhone && tx.client_phone !== selectedClientPhone) return false;

      if (cleanSearch) {
        const clientName = (clientMap[tx.client_phone] || '').toLowerCase();
        const rawPhone = (tx.client_phone || '').toLowerCase();
        const prefixedPhone = `+${rawPhone}`;
        const routeStr = `${tx.origin_country} ${tx.dest_country}`.toLowerCase();

        const matchesPhone = rawPhone.includes(cleanSearch) || prefixedPhone.includes(cleanSearch);
        const matchesName = clientName.includes(cleanSearch);
        const matchesRoute = routeStr.includes(cleanSearch);

        if (!matchesPhone && !matchesName && !matchesRoute) return false;
      }

      if (originCountryFilter !== 'all' && !(tx.origin_country || '').toLowerCase().includes(originCountryFilter.toLowerCase())) return false;
      if (destCountryFilter !== 'all' && !(tx.dest_country || '').toLowerCase().includes(destCountryFilter.toLowerCase())) return false;
      return true;
    });
  }, [sanitizedDateFilteredTransactions, filterOnlyConfirmed, selectedClientPhone, searchTerm, clientMap, originCountryFilter, destCountryFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-[#121212] text-[#f4f1ea] p-4 sm:p-6 lg:p-8 font-sans antialiased selection:bg-[#b58e45] selection:text-[#121212]">
      <div className="w-full max-w-[1700px] mx-auto space-y-6 text-base sm:text-lg">
        
        {/* HEADER LIMPIO CON LOGOTIPO PROTAGONISTA (FONDO ORIGINAL #121212) */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-[#b58e45]/20 gap-6">
          <div className="flex items-center gap-5 sm:gap-6">
            <AonLogo />
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#f4f1ea] flex items-center gap-3.5">
                <span className="w-4 h-4 rounded-full bg-[#b58e45] inline-block shadow-[0_0_16px_#b58e45]" />
                AON Pay — BI & CRM Operativo
              </h1>
              <p className="text-base sm:text-lg text-[#f4f1ea]/75 mt-2 font-medium">
                Control de operaciones, métricas comerciales y atención de clientes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 self-start lg:self-center">
            <Link
              href="/admin"
              className="px-5 py-3 rounded-xl bg-[#2c2e30] border border-[#b58e45]/30 hover:border-[#b58e45] text-base font-bold text-[#f4f1ea] transition-all"
            >
              ← Gestor de Tasas
            </Link>
            <button
              onClick={fetchCrmData}
              className="px-6 py-3 rounded-xl bg-[#b58e45] hover:bg-[#9d7938] text-base font-black text-[#121212] transition-all shadow-[0_2px_14px_rgba(181,142,69,0.35)] cursor-pointer"
            >
              Actualizar Datos
            </button>
          </div>
        </header>

        {/* BARRA DE FILTRO TEMPORAL GLOBAL (FONDO ORIGINAL #121212) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-[#121212] border border-[#b58e45]/20 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="text-base font-extrabold text-[#f4f1ea] flex items-center gap-2.5 pr-1">
              <span className="text-lg">📅</span>
              <span>Rango de Análisis:</span>
            </div>

            {[
              { id: 'all', label: 'Todo el Historial' },
              { id: 'today', label: 'Hoy' },
              { id: '7d', label: 'Últimos 7 Días' },
              { id: '30d', label: 'Últimos 30 Días' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setDateRangeFilter(btn.id);
                  setIsCalendarOpen(false);
                  setCurrentPage(1);
                }}
                className={`px-5 py-2.5 rounded-xl text-base font-bold transition-all cursor-pointer ${
                  dateRangeFilter === btn.id
                    ? 'bg-[#b58e45] text-[#121212] shadow-md font-black scale-105'
                    : 'bg-[#2c2e30] text-[#f4f1ea]/85 hover:text-[#f4f1ea] border border-[#b58e45]/20'
                }`}
              >
                {btn.label}
              </button>
            ))}

            <div className="relative">
              <button
                onClick={() => {
                  setIsCalendarOpen(!isCalendarOpen);
                  if (!tempStart && customStartDate) {
                    setTempStart(customStartDate);
                    setTempEnd(customEndDate);
                  }
                }}
                className={`px-5 py-2.5 rounded-xl text-base font-bold transition-all cursor-pointer flex items-center gap-2.5 ${
                  dateRangeFilter === 'custom'
                    ? 'bg-[#b58e45] text-[#121212] shadow-md font-black scale-105'
                    : 'bg-[#2c2e30] text-[#f4f1ea]/85 hover:text-[#f4f1ea] border border-[#b58e45]/20'
                }`}
              >
                <span>
                  {dateRangeFilter === 'custom' && customStartDate
                    ? `${customStartDate.split('-').slice(1).reverse().join('/')} al ${customEndDate.split('-').slice(1).reverse().join('/')}`
                    : 'Personalizado'}
                </span>
                <span className="text-xs opacity-70">▼</span>
              </button>

              {isCalendarOpen && (
                <div
                  ref={calendarRef}
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-3 z-50 w-[460px] max-w-[95vw] bg-[#2c2e30] border border-[#b58e45]/40 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.95)] backdrop-blur-xl flex flex-col gap-4 text-base"
                >
                  <div className="flex gap-4">
                    <div className="hidden sm:flex flex-col gap-2 w-36 border-r border-[#b58e45]/20 pr-3">
                      <span className="text-xs font-black uppercase text-[#f4f1ea]/50 tracking-wider mb-1">
                        Atajos
                      </span>
                      {[
                        { label: 'Ayer', id: 'yesterday' as const },
                        { label: 'Últimos 7 días', id: '7d' as const },
                        { label: 'Últimos 15 días', id: '15d' as const },
                        { label: 'Este mes', id: 'this_month' as const },
                        { label: 'Mes anterior', id: 'last_month' as const },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setShortcutRange(item.id)}
                          className="text-left px-3 py-2 rounded-lg text-sm font-semibold text-[#f4f1ea]/85 hover:text-[#f4f1ea] hover:bg-[#b58e45]/20 transition-colors cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#b58e45]/15">
                        <button
                          onClick={() => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(d.getMonth() - 1);
                            setCalendarViewDate(d);
                          }}
                          className="p-2 rounded-lg hover:bg-[#121212] text-[#f4f1ea]/80 hover:text-[#f4f1ea] font-bold text-sm"
                        >
                          ◀
                        </button>
                        <span className="font-extrabold text-base text-[#f4f1ea] capitalize tracking-wide">
                          {calendarViewDate.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(d.getMonth() + 1);
                            setCalendarViewDate(d);
                          }}
                          className="p-2 rounded-lg hover:bg-[#121212] text-[#f4f1ea]/80 hover:text-[#f4f1ea] font-bold text-sm"
                        >
                          ▶
                        </button>
                      </div>

                      <div className="grid grid-cols-7 text-center text-xs font-bold uppercase text-[#f4f1ea]/60 mb-2">
                        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map((d) => (
                          <span key={d} className="py-1">{d}</span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-1.5">
                        {calendarDays.map((cd, idx) => {
                          if (!cd.isCurrentMonth) {
                            return <div key={`empty-${idx}`} className="h-10" />;
                          }

                          const isStart = tempStart === cd.dateStr;
                          const isEnd = tempEnd === cd.dateStr;
                          const isInRange =
                            tempStart && tempEnd && cd.dateStr > tempStart && cd.dateStr < tempEnd;

                          return (
                            <div
                              key={cd.dateStr}
                              className={`h-10 flex items-center justify-center relative ${
                                isInRange ? 'bg-[#b58e45]/20' : ''
                              } ${isStart && tempEnd ? 'bg-gradient-to-r from-transparent to-[#b58e45]/20 rounded-l-lg' : ''} ${
                                isEnd ? 'bg-gradient-to-l from-transparent to-[#b58e45]/20 rounded-r-lg' : ''
                              }`}
                            >
                              <button
                                onClick={() => handleCalendarDayClick(cd.dateStr)}
                                className={`h-9 w-9 rounded-lg text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${
                                  isStart || isEnd
                                    ? 'bg-[#b58e45] text-[#121212] font-black shadow-md scale-105'
                                    : 'text-[#f4f1ea] hover:bg-[#121212]'
                                }`}
                              >
                                {cd.dayNum}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[#b58e45]/20 text-sm">
                    <div className="text-xs text-[#f4f1ea]/75 font-mono">
                      {tempStart ? `${tempStart} ${tempEnd ? `➔ ${tempEnd}` : ''}` : 'Elige rango'}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setTempStart('');
                          setTempEnd('');
                        }}
                        className="px-3 py-1.5 text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={() => setIsCalendarOpen(false)}
                        className="px-3 py-1.5 text-[#f4f1ea]/80 hover:text-[#f4f1ea]"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={applyCustomDateRange}
                        disabled={!tempStart}
                        className="px-5 py-2 bg-[#b58e45] hover:bg-[#9d7938] text-[#121212] font-black rounded-xl transition-all disabled:opacity-40"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-base text-[#f4f1ea]/80 font-medium flex items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-[#b58e45]/15">
            <span>Operaciones en el rango:</span>
            <span className="font-mono font-extrabold text-[#b58e45] bg-[#2c2e30] px-4 py-1.5 rounded-xl border border-[#b58e45]/30 text-lg">
              {sanitizedDateFilteredTransactions.length}
            </span>
          </div>
        </div>

        {/* VALORES USDT DEL DÍA (FONDO ORIGINAL #121212) */}
        <CurrencyRatesManager />

        {/* 6 TARJETAS DE KPIS PRINCIPALES (FONDO ORIGINAL #121212) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-xl min-h-[160px]">
            <span className="text-sm uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Volumen Cotizado</span>
            <div className="text-2xl sm:text-3xl font-black text-[#b58e45] my-2 font-mono">
              ${totalVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-sm text-[#f4f1ea]/60 font-medium truncate">Equivalente Ref. USD</span>
          </div>

          <div
            onClick={() => {
              setFilterOnlyConfirmed(!filterOnlyConfirmed);
              setCurrentPage(1);
            }}
            className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-xl min-h-[160px] group ${
              filterOnlyConfirmed
                ? 'bg-emerald-950/50 border-emerald-500 scale-[1.02] shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : 'bg-[#121212] border-[#b58e45]/20 hover:border-emerald-500/50'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Confirmado</span>
              <span className={`text-xs font-black px-2.5 py-1 rounded transition-all ${filterOnlyConfirmed ? 'bg-emerald-500 text-[#121212]' : 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-[#121212]'}`}>
                {filterOnlyConfirmed ? 'FILTRANDO' : 'FILTRAR'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 my-2 font-mono">
              ${confirmedVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-sm text-emerald-400/90 font-medium truncate">
              {confirmedTransactions.length} cierres
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-xl min-h-[160px]">
            <span className="text-sm uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Ticket Promedio</span>
            <div className="text-2xl sm:text-3xl font-black text-[#cdead2] my-2 font-mono">
              ${averageTicketUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-sm text-[#f4f1ea]/60 font-medium truncate">Por cotización (USD)</span>
          </div>

          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-xl min-h-[160px]">
            <span className="text-sm uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Cliente Más Fiel</span>
            <div className="text-lg font-bold text-[#f4f1ea] truncate my-2" title={mostLoyalClient.name}>
              {mostLoyalClient.name}
            </div>
            <span className="text-sm text-[#b58e45] font-extrabold truncate">{mostLoyalClient.count} cotizaciones</span>
          </div>

          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-xl min-h-[160px]">
            <span className="text-sm uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Cliente Top (Cerrado)</span>
            <div className="text-lg font-bold text-[#f4f1ea] truncate my-1" title={topVolumeClient.name}>
              {topVolumeClient.name}
            </div>
            <div className="flex flex-col">
              <span className="text-base text-emerald-400 font-black truncate font-mono">
                ${topVolumeClient.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
              <span className="text-xs text-[#f4f1ea]/60 font-medium truncate">
                {topVolumeClient.ops > 0 ? `${topVolumeClient.ops} ops cerradas` : 'Sin transacciones'}
              </span>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-xl min-h-[160px]">
            <span className="text-sm uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Tasa Handover</span>
            <div className="text-2xl sm:text-3xl font-black text-[#f4f1ea] my-2 font-mono">
              {conversionRate.toFixed(1)}%
            </div>
            <span className="text-sm text-[#f4f1ea]/60 font-medium truncate">Pase a atención humana</span>
          </div>
        </section>

        {/* DISTRIBUCIÓN DE RUTAS Y PICOS (FONDO ORIGINAL #121212) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#2c2e30]/60">
              <div>
                <h3 className="text-lg font-bold text-[#f4f1ea]">Distribución Operativa por Ruta</h3>
                <p className="text-sm text-[#f4f1ea]/70">Demanda e interés comercial en corredores</p>
              </div>

              <div className="flex items-center gap-1.5 bg-[#2c2e30] p-1.5 rounded-xl border border-[#b58e45]/30">
                <button
                  onClick={() => setRouteViewMode('confirmed')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                    routeViewMode === 'confirmed'
                      ? 'bg-emerald-500 text-[#121212] shadow'
                      : 'text-[#f4f1ea]/80 hover:text-[#f4f1ea]'
                  }`}
                >
                  ✓ Confirmadas
                </button>
                <button
                  onClick={() => setRouteViewMode('quoted')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer ${
                    routeViewMode === 'quoted'
                      ? 'bg-[#b58e45] text-[#121212] shadow'
                      : 'text-[#f4f1ea]/80 hover:text-[#f4f1ea]'
                  }`}
                >
                  📊 Cotizadas
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
              {routeDistribution.length === 0 ? (
                <p className="text-base text-[#f4f1ea]/50 py-10 text-center">
                  No hay operaciones {routeViewMode === 'confirmed' ? 'confirmadas' : 'cotizadas'} para el rango seleccionado.
                </p>
              ) : (
                routeDistribution.map((item, idx) => (
                  <div key={item.route} className="space-y-2">
                    <div className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-[#b58e45] font-black">#{idx + 1}</span>
                        <span className="font-extrabold text-[#f4f1ea]">{item.route}</span>
                      </div>
                      <span className="text-[#f4f1ea]/90 font-mono text-sm">
                        <strong className={routeViewMode === 'confirmed' ? 'text-emerald-400' : 'text-[#b58e45]'}>
                          {item.count} ops
                        </strong> ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#2c2e30] h-3 rounded-full overflow-hidden border border-[#b58e45]/20">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          routeViewMode === 'confirmed'
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                            : 'bg-gradient-to-r from-[#b58e45] to-[#cdead2]'
                        }`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between space-y-5 shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-[#f4f1ea]">Picos de Concurrencia</h3>
              <p className="text-sm text-[#f4f1ea]/70">Momentos con mayor tráfico y solicitudes en Cyra</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2c2e30] p-5 rounded-xl border border-[#b58e45]/20 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Día Pico</span>
                  <span className="text-base">📅</span>
                </div>
                <div className="my-3">
                  <p className="text-xl font-black text-[#b58e45] truncate">{peakStats.peakDay}</p>
                  <p className="text-sm text-[#f4f1ea]/70 font-mono mt-1">{peakStats.peakDayOps} operaciones</p>
                </div>
                <span className="text-xs text-[#f4f1ea]/50">Histórico real</span>
              </div>

              <div className="bg-[#2c2e30] p-5 rounded-xl border border-[#b58e45]/20 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold text-[#f4f1ea]/70 tracking-wider">Hora Pico</span>
                  <span className="text-base">⏰</span>
                </div>
                <div className="my-3">
                  <p className="text-xl font-black text-[#cdead2] truncate">{peakStats.peakHour}</p>
                  <p className="text-sm text-[#f4f1ea]/70 font-mono mt-1">{peakStats.peakHourOps} operaciones</p>
                </div>
                <span className="text-xs text-[#f4f1ea]/50">GMT-4 (Caracas)</span>
              </div>
            </div>

            <p className="text-sm text-[#f4f1ea]/60 text-center font-medium pt-3 border-t border-[#2c2e30]">
              Basado en timestamps reales de mensajes en Supabase
            </p>
          </div>
        </section>

        {/* DIRECTORIO DE CLIENTES (CON FONDO DESTACADO #2c2e30) */}
        <section className="p-7 rounded-2xl bg-[#2c2e30] border border-[#b58e45]/25 space-y-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-3.5">
                <h2 className="text-xl sm:text-2xl font-black text-[#f4f1ea]">Directorio de Clientes Autorizados</h2>
                {filterOnlyConfirmed && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm font-bold">
                    Solo Cierres Exitosos
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-[#f4f1ea]/70 mt-1">Haz clic en cualquier cliente para filtrar su historial específico abajo</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por teléfono o nombre..."
                value={searchTerm}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^a-zA-Z0-9\s+áéíóúÁÉÍÓÚñÑ]/g, '');
                  setSearchTerm(sanitized);
                  setCurrentPage(1);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 focus:border-[#b58e45] text-base text-[#f4f1ea] outline-none w-64"
              />

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 text-base text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Modos (Todos)</option>
                <option value="bot">🤖 Bot</option>
                <option value="human">👤 Humano</option>
              </select>

              <select
                value={originCountryFilter}
                onChange={(e) => { setOriginCountryFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 text-base text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Origen (Todos)</option>
                {VALID_COUNTRIES.map((c) => (
                  <option key={`orig-${c}`} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={destCountryFilter}
                onChange={(e) => { setDestCountryFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 text-base text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Destino (Todos)</option>
                {VALID_COUNTRIES.map((c) => (
                  <option key={`dest-${c}`} value={c}>{c}</option>
                ))}
              </select>

              {hasActiveClientFilters && (
                <button
                  onClick={handleClearClientFilters}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-sm font-bold transition-all cursor-pointer flex items-center gap-2"
                  title="Restablecer buscador, origen, destino y modo"
                >
                  <span>↺</span>
                  <span>Limpiar</span>
                </button>
              )}

              {filterOnlyConfirmed && (
                <button
                  onClick={() => setFilterOnlyConfirmed(false)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-base font-bold transition-all cursor-pointer"
                >
                  Ver Todas ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#b58e45]/25">
            <table className="w-full text-left text-base text-[#f4f1ea]">
              <thead className="bg-[#121212] border-b border-[#b58e45]/25 text-[#f4f1ea]/80 uppercase text-sm font-extrabold tracking-wider">
                <tr>
                  <th className="py-4 px-6">Contacto</th>
                  <th className="py-4 px-6">Ruta Habitual</th>
                  <th className="py-4 px-6 text-center">Operaciones</th>
                  <th className="py-4 px-6 text-right">Volumen USD</th>
                  <th className="py-4 px-6 text-center">Estado Cyra</th>
                  <th className="py-4 px-6 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#b58e45]/15 bg-[#121212]/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-base text-[#f4f1ea]/50">
                      Cargando datos de Supabase...
                    </td>
                  </tr>
                ) : consolidatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-base text-[#f4f1ea]/50">
                      No se encontraron clientes autorizados con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  consolidatedClients.map((client) => {
                    const isSelected = selectedClientPhone === client.phone;
                    return (
                      <tr
                        key={client.phone}
                        onClick={() => setSelectedClientPhone(isSelected ? null : client.phone)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#b58e45]/25 border-l-4 border-[#b58e45]' : 'hover:bg-[#b58e45]/15'
                        }`}
                      >
                        <td className="py-4 px-6 font-medium">
                          <div className="font-bold text-lg text-[#f4f1ea]">{client.full_name || 'Sin Nombre'}</div>
                          <div className="text-sm text-[#f4f1ea]/70 font-semibold mt-1">+{client.phone}</div>
                        </td>
                        <td className="py-4 px-6 text-base text-[#f4f1ea]/95 font-medium">
                          {client.preferred_origin_country || 'N/A'} ➔ {client.preferred_dest_country || 'N/A'}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-lg text-[#f4f1ea] font-mono">
                          {client.txCount}
                        </td>
                        <td className="py-4 px-6 text-right font-black text-lg text-[#b58e45] font-mono">
                          ${client.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide ${
                              client.status === 'bot'
                                ? 'bg-[#b58e45]/20 text-[#b58e45] border border-[#b58e45]/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {client.status === 'bot' ? '🤖 BOT' : '👤 HUMANO'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="text-sm text-[#b58e45] hover:underline font-bold">
                            {isSelected ? 'Ver Todos' : 'Filtrar ➔'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* AUDITORÍA DE TRANSACCIONES (CON FONDO DESTACADO #2c2e30) */}
        <section className="p-7 rounded-2xl bg-[#2c2e30] border border-[#b58e45]/25 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-3.5">
                <h2 className="text-xl sm:text-2xl font-black text-[#f4f1ea]">
                  Auditoría de Transacciones ({filteredTransactions.length} registros)
                </h2>
                {filterOnlyConfirmed && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm font-bold">
                    Solo Confirmadas
                  </span>
                )}
              </div>
              {selectedClientPhone && (
                <p className="text-base text-[#b58e45] font-bold mt-1">
                  Filtrando: {clientMap[selectedClientPhone] ? `${clientMap[selectedClientPhone]} (+${selectedClientPhone})` : `+${selectedClientPhone}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 text-base text-[#f4f1ea]/85 font-medium">
              <span>Mostrar:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-4 py-2 rounded-xl bg-[#121212] border border-[#b58e45]/30 text-base text-[#f4f1ea] outline-none font-bold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>por página</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#b58e45]/25">
            <table className="w-full text-left text-base text-[#f4f1ea]">
              <thead className="bg-[#121212] border-b border-[#b58e45]/25 text-[#f4f1ea]/80 uppercase text-sm font-extrabold tracking-wider">
                <tr>
                  <th className="py-4 px-6">Fecha / Hora</th>
                  <th className="py-4 px-6">Cliente</th>
                  <th className="py-4 px-6">Corredor</th>
                  <th className="py-4 px-6 text-right">Envía</th>
                  <th className="py-4 px-6 text-right">Recibe</th>
                  <th className="py-4 px-6 text-right">Tasa Aplicada</th>
                  <th className="py-4 px-6 text-right">Ref. USD</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#b58e45]/15 bg-[#121212]/70">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-base text-[#f4f1ea]/50">
                      Cargando historial...
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-base text-[#f4f1ea]/50">
                      No hay transacciones que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#b58e45]/15 transition-colors">
                      <td className="py-4 px-6 text-sm font-semibold text-[#f4f1ea]/80 font-mono">
                        {new Date(tx.created_at).toLocaleString('es-VE', {
                          timeZone: 'America/Caracas',
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="py-4 px-6 font-medium">
                        <div className="font-bold text-base text-[#f4f1ea]">
                          {clientMap[tx.client_phone] || 'Sin Nombre'}
                        </div>
                        <div className="text-sm text-[#f4f1ea]/70 font-semibold mt-1">
                          +{tx.client_phone}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-base text-[#f4f1ea]/95 font-medium">
                        {tx.origin_country} ➔ {tx.dest_country}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-base text-[#f4f1ea] font-mono">
                        {tx.amount_sent.toLocaleString()} {tx.origin_currency}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-base text-emerald-400 font-mono">
                        {tx.amount_received.toLocaleString()} {tx.dest_currency}
                      </td>
                      <td className="py-4 px-6 text-right text-sm font-medium text-[#f4f1ea]/80">
                        {tx.rate_applied || 'Tasa estándar'}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-base text-[#b58e45] font-mono">
                        ${(tx.usd_equivalent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            tx.status && tx.status.toLowerCase() !== 'quoted'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35'
                              : 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/35'
                          }`}
                        >
                          {tx.status && tx.status.toLowerCase() !== 'quoted' ? 'Confirmada' : 'Cotizada'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-5 pt-5 border-t border-[#b58e45]/15 text-base text-[#f4f1ea]/80 font-medium">
            <span>
              Página <strong className="text-[#f4f1ea] font-bold">{currentPage}</strong> de <strong className="text-[#f4f1ea] font-bold">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-5 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 hover:border-[#b58e45] text-base font-bold text-[#f4f1ea] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-5 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 hover:border-[#b58e45] text-base font-bold text-[#f4f1ea] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}