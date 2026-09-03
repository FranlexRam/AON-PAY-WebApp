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
  rate_to_usdt: number;
  updated_at?: string;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

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
      }
    } catch (err: any) {
      console.error('Error cargando currency_rates:', err);
      setErrorMessage('No se pudieron cargar las paridades USDT.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleRateChange = (country: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates((prev) =>
      prev.map((r) => (r.country === country ? { ...r, rate_to_usdt: numValue } : r))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const nowIso = new Date().toISOString();
      const updates = rates.map((r) => ({
        country: r.country,
        currency_code: r.currency_code,
        rate_to_usdt: r.rate_to_usdt,
        updated_at: nowIso,
      }));

      const { error } = await supabase
        .from('currency_rates')
        .upsert(updates, { onConflict: 'country' });

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error guardando currency_rates:', err);
      setErrorMessage('Hubo un error al guardar las paridades.');
    } finally {
      setSaving(false);
    }
  };

  const editableCurrencies = rates.filter(
    (r) => !['Estados Unidos', 'Ecuador'].includes(r.country)
  );

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-[#f4f1ea]">
              Paridades USDT del Día (P2P Referencial)
            </h3>
          </div>
          <p className="text-xs text-[#f4f1ea]/60 mt-0.5 font-medium">
            Tasa operativa en moneda local para calcular Ref. USD universal sobre el capital recibido.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md ${
            saveSuccess
              ? 'bg-emerald-500 text-[#0d0d0d]'
              : 'bg-[#b58e45] hover:bg-[#9d7938] text-[#0d0d0d] disabled:opacity-40 disabled:pointer-events-none'
          }`}
        >
          {saving ? 'Guardando...' : saveSuccess ? '✓ Paridades Actualizadas' : 'Guardar Paridades'}
        </button>
      </div>

      {errorMessage && (
        <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="py-4 text-center text-xs text-[#f4f1ea]/40">Cargando paridades configuradas...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {editableCurrencies.map((item) => (
            <div
              key={item.country}
              className="bg-[#0d0d0d] border border-[#b58e45]/20 hover:border-[#b58e45]/40 rounded-xl p-3 flex flex-col justify-between transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#f4f1ea]">{item.country}</span>
                <span className="text-[10px] font-mono font-bold text-[#b58e45] bg-[#b58e45]/10 px-1.5 py-0.5 rounded border border-[#b58e45]/30">
                  {item.currency_code}
                </span>
              </div>
              <input
                type="number"
                step="any"
                value={item.rate_to_usdt || ''}
                onChange={(e) => handleRateChange(item.country, e.target.value)}
                className="w-full bg-[#121212] border border-[#b58e45]/30 focus:border-[#b58e45] focus:outline-none text-[#f4f1ea] text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 transition-colors"
                placeholder="0.00"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminCrmPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originCountryFilter, setOriginCountryFilter] = useState<string>('all');
  const [destCountryFilter, setDestCountryFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);
  const [filterOnlyConfirmed, setFilterOnlyConfirmed] = useState<boolean>(false);

  // Popover de Calendario Personalizado
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [tempStart, setTempStart] = useState<string>('');
  const [tempEnd, setTempEnd] = useState<string>('');
  const calendarRef = useRef<HTMLDivElement>(null);

  // Toggle de distribución de rutas
  const [routeViewMode, setRouteViewMode] = useState<'confirmed' | 'quoted'>('confirmed');

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

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
      peakDay: topDayEntry && topDayEntry[1] > 0 ? `${topDayEntry[0]} (${topDayEntry[1]} ops)` : 'Sin datos',
      peakHour: topHourEntry ? `${formatHour(topHourEntry[0])} (${topHourEntry[1]} ops)` : 'Sin datos'
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

    return clients
      .filter((c) => c.contact_type === 'client')
      .map((c) => ({
        ...c,
        txCount: txMap[c.phone]?.count || 0,
        totalVolume: txMap[c.phone]?.totalUsd || 0
      }))
      .filter((c) => {
        if (filterOnlyConfirmed && c.txCount === 0) return false;
        const matchesSearch =
          c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.full_name && c.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        const matchesOrigin = originCountryFilter === 'all' || (c.preferred_origin_country && c.preferred_origin_country.includes(originCountryFilter));
        const matchesDest = destCountryFilter === 'all' || (c.preferred_dest_country && c.preferred_dest_country.includes(destCountryFilter));

        return matchesSearch && matchesStatus && matchesOrigin && matchesDest;
      })
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clients, sanitizedDateFilteredTransactions, confirmedTransactions, filterOnlyConfirmed, searchTerm, statusFilter, originCountryFilter, destCountryFilter]);

  const filteredTransactions = useMemo(() => {
    return sanitizedDateFilteredTransactions.filter((tx) => {
      if (filterOnlyConfirmed && (!tx.status || tx.status.toLowerCase() === 'quoted')) return false;
      if (selectedClientPhone && tx.client_phone !== selectedClientPhone) return false;
      if (searchTerm) {
        const matchesPhone = tx.client_phone.includes(searchTerm);
        const matchesRoute = `${tx.origin_country} ${tx.dest_country}`.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesPhone && !matchesRoute) return false;
      }
      if (originCountryFilter !== 'all' && tx.origin_country !== originCountryFilter) return false;
      if (destCountryFilter !== 'all' && tx.dest_country !== destCountryFilter) return false;
      return true;
    });
  }, [sanitizedDateFilteredTransactions, filterOnlyConfirmed, selectedClientPhone, searchTerm, originCountryFilter, destCountryFilter]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f4f1ea] p-4 sm:p-8 lg:p-10 font-sans antialiased selection:bg-[#b58e45] selection:text-[#121212]">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#b58e45]/20 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#f4f1ea] flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-[#b58e45] inline-block shadow-[0_0_14px_#b58e45]" />
              AON Pay — BI & CRM Operativo
            </h1>
            <p className="text-sm sm:text-base text-[#f4f1ea]/70 mt-1 font-medium">
              Telemetría determinista de Cyra, fidelidad y analítica multidivisa
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="px-4 py-2.5 rounded-xl bg-[#121212] border border-[#b58e45]/30 hover:border-[#b58e45] text-sm font-bold text-[#f4f1ea] transition-all"
            >
              ← Gestor de Tasas
            </Link>
            <button
              onClick={fetchCrmData}
              className="px-5 py-2.5 rounded-xl bg-[#b58e45] hover:bg-[#9d7938] text-sm font-black text-[#0d0d0d] transition-all shadow-[0_4px_16px_rgba(181,142,69,0.3)] cursor-pointer"
            >
              Actualizar Datos
            </button>
          </div>
        </header>

        {/* GESTOR DE PARIDADES USDT */}
        <CurrencyRatesManager />

        {/* BARRA DE FILTRO TEMPORAL GLOBAL Y DATEPICKER POPOVER MEJORADO */}
        <div className="relative flex flex-wrap items-center justify-between gap-4 bg-[#121212] p-4 rounded-2xl border border-[#b58e45]/20">
          <div className="text-sm font-bold text-[#f4f1ea]/80 flex items-center gap-2">
            <span className="text-base">📅</span>
            <span>Rango de Análisis:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  dateRangeFilter === btn.id
                    ? 'bg-[#b58e45] text-[#121212] shadow-md scale-105'
                    : 'bg-[#0d0d0d] text-[#f4f1ea]/70 hover:text-[#f4f1ea] border border-[#b58e45]/20'
                }`}
              >
                {btn.label}
              </button>
            ))}

            {/* BOTÓN CON POPOVER FLOTANTE REDISEÑADO */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsCalendarOpen(!isCalendarOpen);
                  if (!tempStart && customStartDate) {
                    setTempStart(customStartDate);
                    setTempEnd(customEndDate);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  dateRangeFilter === 'custom'
                    ? 'bg-[#b58e45] text-[#121212] shadow-md scale-105'
                    : 'bg-[#0d0d0d] text-[#f4f1ea]/70 hover:text-[#f4f1ea] border border-[#b58e45]/20'
                }`}
              >
                <span>📅</span>
                <span>
                  {dateRangeFilter === 'custom' && customStartDate
                    ? `${customStartDate.split('-').slice(1).reverse().join('/')} al ${customEndDate.split('-').slice(1).reverse().join('/')}`
                    : 'Personalizado'}
                </span>
                <span className="text-[10px] opacity-70">▼</span>
              </button>

              {/* CALENDARIO FLOTANTE EXPANDIDO CON BARRA LATERAL DE ATAJOS */}
              {isCalendarOpen && (
                <div
                  ref={calendarRef}
                  className="absolute right-0 top-full mt-3 z-50 w-[440px] max-w-[95vw] bg-[#121212] border border-[#b58e45]/40 rounded-2xl p-4 shadow-[0_15px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl flex flex-col gap-3"
                >
                  <div className="flex gap-4">
                    {/* Barra lateral de accesos rápidos */}
                    <div className="hidden sm:flex flex-col gap-1.5 w-32 border-r border-[#b58e45]/20 pr-3">
                      <span className="text-[10px] font-black uppercase text-[#f4f1ea]/40 tracking-wider mb-1">
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
                          className="text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#f4f1ea]/70 hover:text-[#f4f1ea] hover:bg-[#b58e45]/15 transition-colors cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Contenedor del mes interactivo */}
                    <div className="flex-1">
                      {/* Cabecera del mes y controles */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#b58e45]/15">
                        <button
                          onClick={() => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(d.getMonth() - 1);
                            setCalendarViewDate(d);
                          }}
                          className="p-1.5 rounded-lg hover:bg-[#0d0d0d] text-[#f4f1ea]/60 hover:text-[#f4f1ea] font-bold text-xs"
                        >
                          ◀
                        </button>
                        <span className="font-extrabold text-sm text-[#f4f1ea] capitalize tracking-wide">
                          {calendarViewDate.toLocaleString('es-VE', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(d.getMonth() + 1);
                            setCalendarViewDate(d);
                          }}
                          className="p-1.5 rounded-lg hover:bg-[#0d0d0d] text-[#f4f1ea]/60 hover:text-[#f4f1ea] font-bold text-xs"
                        >
                          ▶
                        </button>
                      </div>

                      {/* Nombres de los días */}
                      <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-[#f4f1ea]/50 mb-1">
                        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map((d) => (
                          <span key={d} className="py-1">{d}</span>
                        ))}
                      </div>

                      {/* Cuadrícula de días con continuidad de rango */}
                      <div className="grid grid-cols-7 gap-y-1">
                        {calendarDays.map((cd, idx) => {
                          if (!cd.isCurrentMonth) {
                            return <div key={`empty-${idx}`} className="h-9" />;
                          }

                          const isStart = tempStart === cd.dateStr;
                          const isEnd = tempEnd === cd.dateStr;
                          const isInRange =
                            tempStart && tempEnd && cd.dateStr > tempStart && cd.dateStr < tempEnd;

                          return (
                            <div
                              key={cd.dateStr}
                              className={`h-9 flex items-center justify-center relative ${
                                isInRange ? 'bg-[#b58e45]/15' : ''
                              } ${isStart && tempEnd ? 'bg-gradient-to-r from-transparent to-[#b58e45]/15 rounded-l-lg' : ''} ${
                                isEnd ? 'bg-gradient-to-l from-transparent to-[#b58e45]/15 rounded-r-lg' : ''
                              }`}
                            >
                              <button
                                onClick={() => handleCalendarDayClick(cd.dateStr)}
                                className={`h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                                  isStart || isEnd
                                    ? 'bg-[#b58e45] text-[#121212] font-black shadow-md scale-105'
                                    : 'text-[#f4f1ea]/80 hover:bg-[#0d0d0d] hover:text-[#f4f1ea]'
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

                  {/* Pie de acciones y rango temporal */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#b58e45]/20 text-xs">
                    <div className="text-[11px] text-[#f4f1ea]/60 font-mono">
                      {tempStart ? (
                        <span>
                          {tempStart} {tempEnd ? `➔ ${tempEnd}` : '(elige fin)'}
                        </span>
                      ) : (
                        <span>Selecciona rango</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTempStart('');
                          setTempEnd('');
                        }}
                        className="px-2.5 py-1 text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={() => setIsCalendarOpen(false)}
                        className="px-2.5 py-1 text-[#f4f1ea]/60 hover:text-[#f4f1ea] font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={applyCustomDateRange}
                        disabled={!tempStart}
                        className="px-4 py-1.5 bg-[#b58e45] hover:bg-[#9d7938] text-[#0d0d0d] font-black rounded-xl transition-all disabled:opacity-40 shadow-sm"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6 TARJETAS DE KPIS PRINCIPALES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Volumen Cotizado</span>
            <div className="text-2xl lg:text-3xl font-black text-[#b58e45] my-2">
              ${totalVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Equivalente global USD</span>
          </div>

          <div
            onClick={() => {
              setFilterOnlyConfirmed(!filterOnlyConfirmed);
              setCurrentPage(1);
            }}
            className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-lg group ${
              filterOnlyConfirmed
                ? 'bg-emerald-950/40 border-emerald-500 scale-[1.02] shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-[#121212] border-[#b58e45]/20 hover:border-emerald-500/50'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Volumen Confirmado</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded transition-all ${filterOnlyConfirmed ? 'bg-emerald-500 text-[#0d0d0d]' : 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-[#0d0d0d]'}`}>
                {filterOnlyConfirmed ? 'FILTRANDO' : 'VER TRANS.'}
              </span>
            </div>
            <div className="text-2xl lg:text-3xl font-black text-emerald-400 my-2">
              ${confirmedVolumeUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-emerald-400/80 font-medium">
              {confirmedTransactions.length} operaciones cerradas
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Ticket Promedio</span>
            <div className="text-2xl lg:text-3xl font-black text-[#cdead2] my-2">
              ${averageTicketUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Por cotización (USD)</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Cliente Más Fiel</span>
            <div className="text-sm font-bold text-[#f4f1ea] truncate my-2" title={mostLoyalClient.name}>
              {mostLoyalClient.name}
            </div>
            <span className="text-xs text-[#b58e45] font-bold">{mostLoyalClient.count} cotizaciones</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Cliente Top (Cerrado)</span>
            <div className="text-sm font-bold text-[#f4f1ea] truncate my-2" title={topVolumeClient.name}>
              {topVolumeClient.name}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-emerald-400 font-bold">
                ${topVolumeClient.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
              <span className="text-[10px] text-[#f4f1ea]/40 font-medium">
                {topVolumeClient.ops > 0 ? `${topVolumeClient.ops} ops confirmadas` : 'Sin transacciones'}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between shadow-lg">
            <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Tasa de Handover</span>
            <div className="text-2xl lg:text-3xl font-black text-[#f4f1ea] my-2">
              {conversionRate.toFixed(1)}%
            </div>
            <span className="text-xs text-[#f4f1ea]/50 font-medium">Pase a atención humana</span>
          </div>
        </section>

        {/* DISTRIBUCIÓN DE RUTAS Y PICOS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#f4f1ea]">Distribución de Operaciones por Ruta</h3>
                <p className="text-xs text-[#f4f1ea]/60">
                  {routeViewMode === 'confirmed' 
                    ? 'Efectividad y volumen en operaciones cerradas por corredor' 
                    : 'Demanda e interés comercial sobre la matriz de rutas oficiales'}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#0d0d0d] p-1 rounded-xl border border-[#b58e45]/30">
                <button
                  onClick={() => setRouteViewMode('confirmed')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    routeViewMode === 'confirmed'
                      ? 'bg-emerald-500 text-[#0d0d0d] shadow'
                      : 'text-[#f4f1ea]/60 hover:text-[#f4f1ea]'
                  }`}
                >
                  ✓ Confirmadas
                </button>
                <button
                  onClick={() => setRouteViewMode('quoted')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    routeViewMode === 'quoted'
                      ? 'bg-[#b58e45] text-[#0d0d0d] shadow'
                      : 'text-[#f4f1ea]/60 hover:text-[#f4f1ea]'
                  }`}
                >
                  📊 Cotizadas
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {routeDistribution.length === 0 ? (
                <p className="text-sm text-[#f4f1ea]/40 py-6 text-center">
                  No hay operaciones {routeViewMode === 'confirmed' ? 'confirmadas' : 'cotizadas'} para el rango seleccionado.
                </p>
              ) : (
                routeDistribution.map((item) => (
                  <div key={item.route} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-[#f4f1ea]">{item.route}</span>
                      <span className="text-[#f4f1ea]/70">
                        <strong className={routeViewMode === 'confirmed' ? 'text-emerald-400' : 'text-[#b58e45]'}>
                          {item.count}
                        </strong> ops ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#0d0d0d] h-3 rounded-full overflow-hidden border border-[#b58e45]/20">
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

          <div className="p-6 rounded-2xl bg-[#121212] border border-[#b58e45]/20 flex flex-col justify-between space-y-5 shadow-lg">
            <div>
              <h3 className="text-base font-bold text-[#f4f1ea]">Picos de Mayor Demanda</h3>
              <p className="text-xs text-[#f4f1ea]/60">Horarios y días con mayor concurrencia en Cyra</p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0d0d0d] p-4 rounded-xl border border-[#b58e45]/20">
                <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Día Pico de la Semana</span>
                <p className="text-lg font-black text-[#b58e45] mt-1">{peakStats.peakDay}</p>
              </div>

              <div className="bg-[#0d0d0d] p-4 rounded-xl border border-[#b58e45]/20">
                <span className="text-xs uppercase font-bold text-[#f4f1ea]/60 tracking-wider">Hora Pico del Día (GMT-4)</span>
                <p className="text-lg font-black text-[#cdead2] mt-1">{peakStats.peakHour}</p>
              </div>
            </div>

            <p className="text-xs text-[#f4f1ea]/50 text-center font-medium">
              Basado en timestamps reales de mensajes en Supabase
            </p>
          </div>
        </section>

        {/* DIRECTORIO DE CLIENTES Y SEGMENTACIÓN */}
        <section className="p-6 sm:p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-[#f4f1ea]">Directorio de Clientes Autorizados</h2>
                {filterOnlyConfirmed && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold">
                    Solo Clientes con Cierres Exitosos
                  </span>
                )}
              </div>
              <p className="text-sm text-[#f4f1ea]/60">Haz clic en cualquier cliente para filtrar su historial específico abajo</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por teléfono o nombre..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 focus:border-[#b58e45] text-sm text-[#f4f1ea] outline-none w-56"
              />

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="px-3.5 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Modos (Todos)</option>
                <option value="bot">🤖 Modo Bot</option>
                <option value="human">👤 Modo Humano</option>
              </select>

              <select
                value={originCountryFilter}
                onChange={(e) => { setOriginCountryFilter(e.target.value); setCurrentPage(1); }}
                className="px-3.5 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Origen (Todos)</option>
                {VALID_COUNTRIES.map((c) => (
                  <option key={`orig-${c}`} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={destCountryFilter}
                onChange={(e) => { setDestCountryFilter(e.target.value); setCurrentPage(1); }}
                className="px-3.5 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-medium"
              >
                <option value="all">Destino (Todos)</option>
                {VALID_COUNTRIES.map((c) => (
                  <option key={`dest-${c}`} value={c}>{c}</option>
                ))}
              </select>

              {filterOnlyConfirmed && (
                <button
                  onClick={() => setFilterOnlyConfirmed(false)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold transition-all cursor-pointer"
                >
                  Ver Todas las Cotizaciones ✕
                </button>
              )}

              {selectedClientPhone && (
                <button
                  onClick={() => setSelectedClientPhone(null)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-bold transition-all cursor-pointer"
                >
                  Limpiar Filtro Cliente ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#b58e45]/15">
            <table className="w-full text-left text-sm text-[#f4f1ea]">
              <thead className="bg-[#0d0d0d] border-b border-[#b58e45]/20 text-[#f4f1ea]/70 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="py-4 px-5">Contacto</th>
                  <th className="py-4 px-5">Ruta Habitual</th>
                  <th className="py-4 px-5 text-center">Operaciones</th>
                  <th className="py-4 px-5 text-right">Volumen USD</th>
                  <th className="py-4 px-5 text-center">Estado Cyra</th>
                  <th className="py-4 px-5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#b58e45]/10 bg-[#121212]/40">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      Cargando datos de Supabase...
                    </td>
                  </tr>
                ) : consolidatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-[#f4f1ea]/40">
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
                          isSelected ? 'bg-[#b58e45]/20 border-l-4 border-[#b58e45]' : 'hover:bg-[#b58e45]/5'
                        }`}
                      >
                        <td className="py-4 px-5 font-medium">
                          <div className="font-bold text-base text-[#f4f1ea]">{client.full_name || 'Sin Nombre'}</div>
                          <div className="text-xs text-[#f4f1ea]/60 font-semibold mt-0.5">+{client.phone}</div>
                        </td>
                        <td className="py-4 px-5 text-sm text-[#f4f1ea]/90 font-medium">
                          {client.preferred_origin_country || 'N/A'} ➔ {client.preferred_dest_country || 'N/A'}
                        </td>
                        <td className="py-4 px-5 text-center font-bold text-base text-[#f4f1ea]">
                          {client.txCount}
                        </td>
                        <td className="py-4 px-5 text-right font-black text-base text-[#b58e45]">
                          ${client.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                              client.status === 'bot'
                                ? 'bg-[#b58e45]/15 text-[#b58e45] border border-[#b58e45]/40'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {client.status === 'bot' ? '🤖 BOT' : '👤 HUMANO'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className="text-xs text-[#b58e45] hover:underline font-bold">
                            {isSelected ? 'Ver Todos' : 'Filtrar Historial ➔'}
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

        {/* AUDITORÍA DE TRANSACCIONES */}
        <section className="p-6 sm:p-7 rounded-2xl bg-[#121212] border border-[#b58e45]/20 space-y-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-[#f4f1ea]">
                  Auditoría de Transacciones ({filteredTransactions.length} registros)
                </h2>
                {filterOnlyConfirmed && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold">
                    Filtro: Solo Cierres Confirmados
                  </span>
                )}
              </div>
              {selectedClientPhone && (
                <p className="text-sm text-[#b58e45] font-bold mt-1">
                  Mostrando únicamente transacciones de: +{selectedClientPhone}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-[#f4f1ea]/80 font-medium">
              <span>Mostrar:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="px-3 py-1.5 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 text-sm text-[#f4f1ea] outline-none font-bold"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>por página</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#b58e45]/15">
            <table className="w-full text-left text-sm text-[#f4f1ea]">
              <thead className="bg-[#0d0d0d] border-b border-[#b58e45]/20 text-[#f4f1ea]/70 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="py-4 px-5">Fecha / Hora</th>
                  <th className="py-4 px-5">Cliente</th>
                  <th className="py-4 px-5">Corredor</th>
                  <th className="py-4 px-5 text-right">Envía</th>
                  <th className="py-4 px-5 text-right">Recibe</th>
                  <th className="py-4 px-5 text-right">Tasa Aplicada</th>
                  <th className="py-4 px-5 text-right">Ref. USD</th>
                  <th className="py-4 px-5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#b58e45]/10 bg-[#121212]/40">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      Cargando historial...
                    </td>
                  </tr>
                ) : paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-[#f4f1ea]/40">
                      No hay transacciones que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#b58e45]/5 transition-colors">
                      <td className="py-4 px-5 text-xs font-semibold text-[#f4f1ea]/70">
                        {new Date(tx.created_at).toLocaleString('es-VE', {
                          timeZone: 'America/Caracas',
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="py-4 px-5 font-bold text-sm text-[#f4f1ea]">+{tx.client_phone}</td>
                      <td className="py-4 px-5 text-sm text-[#f4f1ea]/90 font-medium">
                        {tx.origin_country} ➔ {tx.dest_country}
                      </td>
                      <td className="py-4 px-5 text-right font-bold text-sm text-[#f4f1ea]">
                        {tx.amount_sent.toLocaleString()} {tx.origin_currency}
                      </td>
                      <td className="py-4 px-5 text-right font-bold text-sm text-emerald-400">
                        {tx.amount_received.toLocaleString()} {tx.dest_currency}
                      </td>
                      <td className="py-4 px-5 text-right text-xs font-medium text-[#f4f1ea]/70">
                        {tx.rate_applied || 'Tasa estándar'}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-sm text-[#b58e45]">
                        ${(tx.usd_equivalent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            tx.status && tx.status.toLowerCase() !== 'quoted'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/30'
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

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-5 border-t border-[#b58e45]/15 text-sm text-[#f4f1ea]/70 font-medium">
            <span>
              Página <strong className="text-[#f4f1ea] font-bold">{currentPage}</strong> de <strong className="text-[#f4f1ea] font-bold">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 hover:border-[#b58e45] text-sm font-bold text-[#f4f1ea] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl bg-[#0d0d0d] border border-[#b58e45]/30 hover:border-[#b58e45] text-sm font-bold text-[#f4f1ea] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
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