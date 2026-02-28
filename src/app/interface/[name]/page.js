'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import GraphImage from '@/components/GraphImage';
import { getInterfaceCategory, getInterfaceDisplayName, getOfflineThresholdSeconds, isInterfaceOnline, getTimeDifference } from '@/lib/utils';

// Get refresh interval from environment variable (default: 10 seconds)
const REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '10', 10);

export default function InterfacePage({ params }) {
  // Handle params as Promise (Next.js 15+) or direct object
  const resolvedParams = params && typeof params.then === 'function' ? use(params) : params;
  const name = resolvedParams?.name || '';
  const decodedName = decodeURIComponent(name);
  
  const [interfaceData, setInterfaceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL);

  const fetchInterfaceData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const response = await fetch(`/api/interface/${encodeURIComponent(decodedName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch interface data');
      }
      const data = await response.json();
      setInterfaceData(data);
    } catch (err) {
      console.error('Error fetching interface data:', err);
      setError(err.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [decodedName]);

  useEffect(() => {
    // Initial load with loading spinner
    fetchInterfaceData(true);
    
    // Auto-refresh at configured interval without loading spinner
    const interval = setInterval(() => {
      fetchInterfaceData(false);
      setRefreshCountdown(REFRESH_INTERVAL); // Reset countdown after refresh
    }, REFRESH_INTERVAL * 1000); // Convert seconds to milliseconds
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchInterfaceData]);

  // Countdown timer for auto-refresh
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          return REFRESH_INTERVAL; // Reset to configured interval
        }
        return prev - 1;
      });
    }, 1000); // Update every second
    
    return () => clearInterval(countdownInterval);
  }, []);

  // Update current time every second to refresh online/offline status
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timeInterval);
  }, []);

  const handleRefresh = () => {
    fetchInterfaceData(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
            <p className="mt-4 text-base text-gray-600 dark:text-gray-400 font-medium">Loading interface data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !interfaceData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-red-200 dark:border-red-800 p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Error Loading Data
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {error || 'Failed to load interface data'}
              </p>
              <button
                onClick={handleRefresh}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const category = getInterfaceCategory(interfaceData?.name || decodedName);
  const offlineThresholdSeconds = getOfflineThresholdSeconds(category);
  const isOnline = interfaceData.lastUpdate && isInterfaceOnline(interfaceData.lastUpdate, offlineThresholdSeconds);
  const displayName = getInterfaceDisplayName(interfaceData?.name || decodedName);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl">
        {/* Header with Glassmorphism */}
        <header className="mb-6 sm:mb-8">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 dark:border-gray-800/50 p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <Link 
                href="/"
                className="inline-flex items-center gap-2.5 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 text-sm font-semibold group"
              >
                <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Interfaces
              </Link>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Auto-refresh in {refreshCountdown}s</span>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2.5 font-semibold text-sm group"
                >
                  <svg className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            
            {/* Interface Info Card */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 sm:p-8 border border-gray-200/50 dark:border-gray-700/50 shadow-inner overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white whitespace-normal break-words [overflow-wrap:anywhere] leading-tight min-w-0 w-full">
                      {displayName}
                    </h1>
                  </div>
                  
                   <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 w-full">
                     {/* Status Indicator */}
                     {interfaceData.lastUpdate && (
                       <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 shadow-md border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
                         <div className={`relative w-4 h-4 rounded-full ${
                           isOnline
                             ? 'bg-green-500 shadow-lg shadow-green-500/50' 
                             : 'bg-red-500 shadow-lg shadow-red-500/50'
                         }`}>
                           {isOnline && (
                             <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
                           )}
                         </div>
                         <div>
                           <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status</p>
                           <p className={`text-sm font-bold ${
                             isOnline
                               ? 'text-green-600 dark:text-green-400'
                               : 'text-red-600 dark:text-red-400'
                           }`}>
                             {isOnline ? 'ONLINE' : 'OFFLINE'}
                           </p>
                         </div>
                       </div>
                     )}
                     
                     {/* Last Update */}
                     <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 shadow-md border border-gray-200 dark:border-gray-700 w-full sm:w-auto min-w-0">
                       <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                       <div className="min-w-0">
                         <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Last Update</p>
                         <p className="text-sm font-semibold text-gray-900 dark:text-white">
                           {interfaceData.lastUpdate && getTimeDifference(interfaceData.lastUpdate)}
                         </p>
                         <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 break-words">
                           {interfaceData.lastUpdate}
                         </p>
                       </div>
                     </div>

                    </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Daily Chart */}
          <GraphImage
            title="Daily"
            subtitle="Graph (5 Minute Average)"
            imageUrl={interfaceData.graphImages?.daily}
            stats={interfaceData.stats.daily}
            fallbackData={interfaceData.chartData.daily}
            xKey="time"
            yAxisLabel="Bits per second"
          />

          {/* Weekly Chart */}
          <GraphImage
            title="Weekly"
            subtitle="Graph (30 Minute Average)"
            imageUrl={interfaceData.graphImages?.weekly}
            stats={interfaceData.stats.weekly}
            fallbackData={interfaceData.chartData.weekly}
            xKey="day"
            yAxisLabel="Bits per second"
          />

          {/* Monthly Chart */}
          <GraphImage
            title="Monthly"
            subtitle="Graph (2 Hour Average)"
            imageUrl={interfaceData.graphImages?.monthly}
            stats={interfaceData.stats.monthly}
            fallbackData={interfaceData.chartData.monthly}
            xKey="week"
            yAxisLabel="Bits per second"
          />

          {/* Yearly Chart */}
          <GraphImage
            title="Yearly"
            subtitle="Graph (1 Day Average)"
            imageUrl={interfaceData.graphImages?.yearly}
            stats={interfaceData.stats.yearly}
            fallbackData={interfaceData.chartData.yearly}
            xKey="month"
            yAxisLabel="Bits per second"
          />
        </div>
      </div>
    </div>
  );
}

