'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { isInterfaceOnline, getOfflineThresholdSeconds, getTimeDifference } from '@/lib/utils';

// Get refresh interval from environment variable (default: 30 seconds)
// Ensure it's a valid number between 5 and 300 seconds
const REFRESH_INTERVAL = Math.max(5, Math.min(300, parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '30', 10)));

export default function Home() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [interfaces, setInterfaces] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hoveredInterface, setHoveredInterface] = useState(null);
  const [hoveredInterfaceData, setHoveredInterfaceData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState(() => {
    // Restore last tab immediately (prevents briefly writing default "desa")
    if (typeof window === 'undefined') return 'desa';
    try {
      const cached = sessionStorage.getItem('simoner_active_tab');
      if (cached === 'desa' || cached === 'opd' || cached === 'system') return cached;
    } catch (e) {
      // ignore
    }
    return 'desa';
  }); // 'desa', 'opd', or 'system'
  const [allInterfaces, setAllInterfaces] = useState([]); // Store all interfaces for tab filtering
  const [itemsPerPage, setItemsPerPage] = useState(30); // Items per page: 10, 30, 50, 100, or 'all'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' for A-Z, 'desc' for Z-A
  const [expandedKecamatans, setExpandedKecamatans] = useState(new Set()); // Track which kecamatans are expanded
  const [groupByKecamatan, setGroupByKecamatan] = useState(false); // Group DESA interfaces by kecamatan
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'online', or 'offline'
  const [kecamatanStatuses, setKecamatanStatuses] = useState({}); // Store online/offline counts per kecamatan: { kecamatan: { online: 0, offline: 0 } }
  const [interfaceStatuses, setInterfaceStatuses] = useState({}); // Store lastUpdate for each interface: { interfaceName: lastUpdate }
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL); // Countdown timer for auto-refresh
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now()); // Track last refresh time
  const [isPageVisible, setIsPageVisible] = useState(true); // Track if page/tab is visible
  const hiddenTimeRef = useRef(null); // Track when page was hidden
  const countdownWhenHiddenRef = useRef(REFRESH_INTERVAL); // Store countdown value when hidden
  const refreshCountdownRef = useRef(REFRESH_INTERVAL); // Store current countdown value for access in event handler

  // Offline/online threshold dari env (DESA, OPD, SYSTEM semua pakai env)
  const offlineThresholdSeconds = useMemo(
    () => getOfflineThresholdSeconds(activeTab),
    [activeTab]
  );

  // Load cached data on mount for smooth navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedData = sessionStorage.getItem('simoner_interfaces_cache');
        const cachedAllInterfaces = sessionStorage.getItem('simoner_all_interfaces_cache');
        const cachedStatuses = sessionStorage.getItem('simoner_statuses_cache');
        const cachedKecamatanStatuses = sessionStorage.getItem('simoner_kecamatan_statuses_cache');
        
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setInterfaces(parsed.interfaces || []);
          setTotal(parsed.total || 0);
          setTotalPages(parsed.totalPages || 1);
          if (parsed.currentPage) {
            setCurrentPage(parsed.currentPage);
          }
          setLoading(false); // Don't show loading if we have cached data
        }
        
        if (cachedAllInterfaces) {
          setAllInterfaces(JSON.parse(cachedAllInterfaces));
        }
        
        if (cachedStatuses) {
          setInterfaceStatuses(JSON.parse(cachedStatuses));
        }
        
        if (cachedKecamatanStatuses) {
          setKecamatanStatuses(JSON.parse(cachedKecamatanStatuses));
        }
        
        // Always reset countdown to REFRESH_INTERVAL on mount
        setRefreshCountdown(REFRESH_INTERVAL);
        refreshCountdownRef.current = REFRESH_INTERVAL;
      } catch (err) {
        console.error('Error loading cached data:', err);
      }
    }
  }, []); // Only run on mount

  // Persist active tab so returning from detail keeps the previous tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('simoner_active_tab', activeTab);
      } catch (err) {
        // ignore
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (searchTerm.trim()) {
      // Debounce search
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      // If search is cleared, fetch normal page
      setSearchResults([]);
      // Reset status filter when search is cleared
      setStatusFilter('all');
      // Only show loading if we don't have cached data
      const hasCachedData = typeof window !== 'undefined' && sessionStorage.getItem('simoner_interfaces_cache');
      fetchInterfaces(!hasCachedData);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      // Only show loading if we don't have cached data
      const hasCachedData = typeof window !== 'undefined' && sessionStorage.getItem('simoner_interfaces_cache');
      fetchInterfaces(!hasCachedData); // Show loading only if no cached data
    }
  }, [currentPage]);

  // Fetch all interfaces when tab changes to get accurate counts
  useEffect(() => {
    if (!searchTerm.trim()) {
      fetchAllInterfaces();
    }
  }, [activeTab]);

  // Handle page visibility (pause when tab is not active)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageVisible(isVisible);
      
      if (!isVisible) {
        // When page becomes hidden, store current countdown and time
        countdownWhenHiddenRef.current = refreshCountdownRef.current;
        hiddenTimeRef.current = Date.now();
      } else {
        // When page becomes visible again, calculate remaining time
        if (hiddenTimeRef.current !== null && countdownWhenHiddenRef.current !== null) {
          const timeHidden = Date.now() - hiddenTimeRef.current;
          const secondsHidden = Math.floor(timeHidden / 1000);
          const remainingCountdown = Math.max(0, countdownWhenHiddenRef.current - secondsHidden);
          setRefreshCountdown(remainingCountdown);
          refreshCountdownRef.current = remainingCountdown; // Update ref
        }
        hiddenTimeRef.current = null;
        countdownWhenHiddenRef.current = REFRESH_INTERVAL;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Set initial visibility state
    setIsPageVisible(!document.hidden);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer for auto-refresh (only when page is visible)
  useEffect(() => {
    // Ensure countdown starts with correct value
    if (refreshCountdown !== REFRESH_INTERVAL && refreshCountdown > REFRESH_INTERVAL) {
      setRefreshCountdown(REFRESH_INTERVAL);
      refreshCountdownRef.current = REFRESH_INTERVAL;
    }
    
    if (!searchTerm.trim() && isPageVisible) {
      const countdownInterval = setInterval(() => {
        setRefreshCountdown((prev) => {
          // Ensure countdown never exceeds REFRESH_INTERVAL
          if (prev > REFRESH_INTERVAL) {
            refreshCountdownRef.current = REFRESH_INTERVAL;
            return REFRESH_INTERVAL;
          }
          const newValue = prev <= 1 ? REFRESH_INTERVAL : prev - 1;
          refreshCountdownRef.current = newValue; // Update ref with latest value
          return newValue;
        });
      }, 1000); // Update every second
      
      return () => clearInterval(countdownInterval);
    } else {
      if (!isPageVisible) {
        // Pause countdown when page is not visible
        return;
      }
      setRefreshCountdown(REFRESH_INTERVAL); // Reset countdown when searching
      refreshCountdownRef.current = REFRESH_INTERVAL; // Update ref
    }
  }, [searchTerm, isPageVisible, refreshCountdown]);

  // Auto-refresh at configured interval (silent refresh, no loading state)
  // Only active when page is visible
  useEffect(() => {
    if (!searchTerm.trim() && isPageVisible) {
      const interval = setInterval(() => {
        fetchInterfaces(false); // Silent refresh without loading spinner
        fetchAllInterfaces(); // Also refresh all interfaces
        // Don't reset statuses - let useEffect handle re-fetching only missing ones
        // This prevents total online/offline and status dots from disappearing
        setLastRefreshTime(Date.now()); // Update last refresh time to trigger status refresh
        setRefreshCountdown(REFRESH_INTERVAL); // Reset countdown after refresh
        refreshCountdownRef.current = REFRESH_INTERVAL; // Update ref
      }, REFRESH_INTERVAL * 1000); // Convert seconds to milliseconds
      
      return () => clearInterval(interval);
    }
  }, [currentPage, searchTerm, isPageVisible]);

  const performSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error('Failed to search interfaces');
      }
      const data = await response.json();
      setSearchResults(data.interfaces || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error searching interfaces:', err);
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchInterfaces = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const response = await fetch(`/api/interfaces?page=${currentPage}`);
      if (!response.ok) {
        throw new Error('Failed to fetch interfaces');
      }
      const data = await response.json();
      setInterfaces(data.interfaces || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      
      // Cache data to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('simoner_interfaces_cache', JSON.stringify({
            interfaces: data.interfaces || [],
            total: data.total || 0,
            totalPages: data.totalPages || 1,
            currentPage: currentPage,
            timestamp: Date.now()
          }));
        } catch (err) {
          console.error('Error caching data:', err);
        }
      }
    } catch (err) {
      console.error('Error fetching interfaces:', err);
      setError(err.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchAllInterfaces = async () => {
    try {
      // Fetch first page to get total pages
      const firstPageResponse = await fetch(`/api/interfaces?page=1`);
      if (!firstPageResponse.ok) {
        return;
      }
      const firstPageData = await firstPageResponse.json();
      const totalPages = firstPageData.totalPages || 1;
      
      // Fetch all pages in parallel (limit to first 10 pages for performance)
      const maxPages = Math.min(totalPages, 10);
      const fetchPromises = [];
      
      for (let page = 1; page <= maxPages; page++) {
        fetchPromises.push(
          fetch(`/api/interfaces?page=${page}`)
            .then(res => res.json())
            .then(data => data.interfaces || [])
            .catch(() => [])
        );
      }
      
      const results = await Promise.all(fetchPromises);
      const allInterfacesList = results.flat();
      setAllInterfaces(allInterfacesList);
      
      // Cache all interfaces to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('simoner_all_interfaces_cache', JSON.stringify(allInterfacesList));
        } catch (err) {
          console.error('Error caching all interfaces:', err);
        }
      }
    } catch (err) {
      console.error('Error fetching all interfaces:', err);
      // Silently fail, use current page data instead
    }
  };

  // Remove PPPoE prefix from interface name for display
  const getDisplayName = (interfaceName) => {
    if (!interfaceName) return interfaceName;
    // Remove "PPPoE - " or "PPPoE " prefix
    return interfaceName.replace(/^PPPoE\s*-\s*/i, '').replace(/^PPPoE\s+/i, '').trim();
  };

  // Filter interfaces based on active tab
  // OPD: starts with "PPPoE" or contains "PPPoE -"
  // SYSTEM: contains system/infrastructure interfaces (VLAN, BRIDGE, ether, lo, sfp, numbers with underscore)
  // DESA: everything else (not OPD and not SYSTEM)
  // Exclude interfaces that contain l2tp in any form (like <l2tp-...>, l2tp-..., etc.)
  const filterByTab = (interfaceList) => {
    // First, filter out invalid interfaces (those with l2tp or <...> format)
    const validInterfaces = interfaceList.filter(iface => {
      if (!iface || typeof iface !== 'string') {
        return false;
      }
      
      const ifaceLower = iface.toLowerCase();
      
      // Exclude interfaces that start with < (may or may not end with >)
      if (iface.startsWith('<')) {
        return false;
      }
      
      // Exclude interfaces that end with >
      if (iface.endsWith('>')) {
        return false;
      }
      
      // Exclude interfaces that contain l2tp anywhere (case insensitive)
      if (ifaceLower.includes('l2tp')) {
        return false;
      }
      
      // Exclude interfaces that contain HTML entities for < or >
      if (iface.includes('&lt;') || iface.includes('&gt;')) {
        return false;
      }
      
      return true;
    });

    if (activeTab === 'opd') {
      return validInterfaces.filter(iface => 
        iface.startsWith('PPPoE') || iface.includes('PPPoE -')
      );
    } else if (activeTab === 'system') {
      return validInterfaces.filter(iface => {
        const name = iface.toUpperCase();
        const displayName = getDisplayName(iface).toUpperCase();
        return (
          name.startsWith('VLAN') ||
          name.startsWith('BRIDGE') ||
          name.startsWith('ETHER') ||
          name === 'LO' ||
          name.startsWith('SFP') ||
          displayName.startsWith('POSPAM') || // Include POSPAM in SYSTEM
          /^\d+[_-]/.test(iface) || // Starts with numbers followed by _ or -
          /^[A-Z0-9]+_[A-Z0-9]+$/.test(name) // Pattern like 272_TIS, 1457_CGS
        );
      });
    } else {
      // DESA: everything that's not OPD and not SYSTEM
      return validInterfaces.filter(iface => {
        const name = iface.toUpperCase();
        const displayName = getDisplayName(iface).toUpperCase();
        const isOPD = iface.startsWith('PPPoE') || iface.includes('PPPoE -');
        const isSystem = (
          name.startsWith('VLAN') ||
          name.startsWith('BRIDGE') ||
          name.startsWith('ETHER') ||
          name === 'LO' ||
          name.startsWith('SFP') ||
          displayName.startsWith('POSPAM') || // Exclude POSPAM from DESA
          /^\d+[_-]/.test(iface) ||
          /^[A-Z0-9]+_[A-Z0-9]+$/.test(name)
        );
        return !isOPD && !isSystem;
      });
    }
  };

  // Use all interfaces for tab filtering if available, otherwise use current page
  const interfacesForFiltering = searchTerm.trim() 
    ? searchResults 
    : (allInterfaces.length > 0 ? allInterfaces : interfaces);
  
  // When searching, don't filter by tab - show all search results
  // When not searching, filter by active tab
  const filteredByTab = searchTerm.trim() 
    ? interfacesForFiltering // Show all search results regardless of tab
    : filterByTab(interfacesForFiltering);
  
  // Filter interfaces by status (online/offline)
  // Only apply status filter when not searching
  const filteredByStatus = useMemo(() => {
    if (statusFilter === 'all' || searchTerm.trim()) {
      return filteredByTab;
    }
    
    return filteredByTab.filter(iface => {
      const lastUpdate = interfaceStatuses[iface];
      if (!lastUpdate) {
        // If no status data, count as offline
        return statusFilter === 'offline';
      }
      
      const isOnline = isInterfaceOnline(lastUpdate, offlineThresholdSeconds);
      return statusFilter === 'online' ? isOnline : !isOnline;
    });
  }, [filteredByTab, statusFilter, interfaceStatuses, offlineThresholdSeconds, searchTerm]);

  // Sort interfaces alphabetically (A-Z or Z-A)
  const sortedInterfaces = [...filteredByStatus].sort((a, b) => {
    // Use display names for sorting (without PPPoE prefix)
    const nameA = getDisplayName(a).toLowerCase();
    const nameB = getDisplayName(b).toLowerCase();
    const comparison = nameA.localeCompare(nameB);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const tabTotal = sortedInterfaces.length;

  // Group interfaces by kecamatan for DESA tab
  const groupInterfacesByKecamatan = (interfaceList) => {
    if (activeTab !== 'desa' || !groupByKecamatan || searchTerm.trim()) {
      return null; // No grouping for non-DESA tabs, when grouping is disabled, or when searching
    }

    const groups = {};
    interfaceList.forEach(iface => {
      const displayName = getDisplayName(iface);
      // Extract kecamatan (part before first "-")
      const kecamatan = displayName.includes('-') 
        ? displayName.split('-')[0].trim()
        : 'Lainnya';
      
      if (!groups[kecamatan]) {
        groups[kecamatan] = [];
      }
      groups[kecamatan].push(iface);
    });

    // Sort kecamatan names based on sortOrder
    const sortedKecamatans = Object.keys(groups).sort((a, b) => {
      const comparison = a.localeCompare(b);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    // Sort interfaces within each kecamatan based on sortOrder
    sortedKecamatans.forEach(kecamatan => {
      groups[kecamatan].sort((a, b) => {
        const nameA = getDisplayName(a).toLowerCase();
        const nameB = getDisplayName(b).toLowerCase();
        const comparison = nameA.localeCompare(nameB);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    });

    return { groups, sortedKecamatans };
  };

  const displayedGroups = groupInterfacesByKecamatan(sortedInterfaces);
  
  // Fetch statuses for all kecamatans when grouped view is active
  useEffect(() => {
    if (displayedGroups !== null && activeTab === 'desa' && groupByKecamatan && !searchTerm.trim()) {
      // Always refresh to keep statuses up-to-date
      displayedGroups.sortedKecamatans.forEach((kecamatan) => {
        const interfaces = displayedGroups.groups[kecamatan];
        if (interfaces.length > 0) {
          fetchKecamatanStatuses(kecamatan, interfaces, true);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedGroups?.sortedKecamatans?.join(','), activeTab, groupByKecamatan, searchTerm, lastRefreshTime]);
  
  let displayedInterfaces;

  // Handle pagination based on itemsPerPage setting (only for non-grouped view)
  if (displayedGroups !== null && activeTab === 'desa' && groupByKecamatan && !searchTerm.trim()) {
    // For grouped view, show all interfaces (no pagination)
    displayedInterfaces = [];
  } else {
    // Regular pagination for non-grouped view
    if (itemsPerPage === 'all') {
      displayedInterfaces = sortedInterfaces;
    } else {
      const pageSize = parseInt(itemsPerPage);
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      displayedInterfaces = sortedInterfaces.slice(startIndex, endIndex);
    }
  }
  
  const isLoading = searchTerm.trim() ? isSearching : loading;
  
  // Calculate total online and offline from interfaceStatuses (all interfaces in tab, not just displayed)
  const calculateTotalStatus = () => {
    let totalOnline = 0;
    let totalOffline = 0;
    
    // Get all interfaces from current tab using filterByTab on allInterfaces
    const allInterfacesInTab = filterByTab(allInterfaces.length > 0 ? allInterfaces : interfaces);
    
    allInterfacesInTab.forEach((iface) => {
      const lastUpdate = interfaceStatuses[iface];
      if (lastUpdate) {
        if (isInterfaceOnline(lastUpdate, offlineThresholdSeconds)) {
          totalOnline++;
        } else {
          totalOffline++;
        }
      }
    });
    
    return { totalOnline, totalOffline };
  };
  
  const { totalOnline, totalOffline } = calculateTotalStatus();
  
  // Calculate total pages for filtered results
  const filteredTotalPages = itemsPerPage === 'all' 
    ? 1 
    : Math.ceil(tabTotal / parseInt(itemsPerPage)) || 1;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleRefresh = () => {
    // Reset interface statuses to force re-fetch
    setInterfaceStatuses({});
    setKecamatanStatuses({});
    setRefreshCountdown(REFRESH_INTERVAL); // Reset countdown
    refreshCountdownRef.current = REFRESH_INTERVAL; // Update ref
    fetchInterfaces(true); // Manual refresh with loading spinner
    fetchAllInterfaces(); // Also refresh all interfaces
  };

  const fetchInterfaceQuickInfo = async (interfaceName) => {
    try {
      const response = await fetch(`/api/interface/${encodeURIComponent(interfaceName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch interface info');
      }
      const data = await response.json();
      setHoveredInterfaceData({
        lastUpdate: data.lastUpdate
      });
    } catch (err) {
      console.error('Error fetching interface quick info:', err);
      // Silently fail, don't show error in tooltip
    }
  };

  // Fetch statuses for all interfaces in a kecamatan
  const fetchKecamatanStatuses = async (kecamatan, interfaces, forceRefresh = false) => {
    // Skip if already fetched and not forcing refresh
    if (kecamatanStatuses[kecamatan] && !forceRefresh) {
      return;
    }

    try {
      // Batch fetch in chunks of 20 (API limit)
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < interfaces.length; i += chunkSize) {
        chunks.push(interfaces.slice(i, i + chunkSize));
      }

      const allStatuses = {};
      for (const chunk of chunks) {
        const response = await fetch('/api/interface-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ interfaces: chunk }),
        });

        if (response.ok) {
          const data = await response.json();
          Object.assign(allStatuses, data.statuses || {});
        }
      }

      // Calculate online/offline counts
      let online = 0;
      let offline = 0;
      interfaces.forEach(iface => {
        const lastUpdate = allStatuses[iface];
        if (lastUpdate) {
          if (isInterfaceOnline(lastUpdate, offlineThresholdSeconds)) {
            online++;
          } else {
            offline++;
          }
        } else {
          // If no data, count as offline
          offline++;
        }
      });

      setKecamatanStatuses(prev => {
        const updated = {
          ...prev,
          [kecamatan]: { online, offline }
        };
        // Cache kecamatan statuses
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('simoner_kecamatan_statuses_cache', JSON.stringify(updated));
          } catch (err) {
            console.error('Error caching kecamatan statuses:', err);
          }
        }
        return updated;
      });

      // Also store individual interface statuses for dot colors
      setInterfaceStatuses(prev => {
        const updated = {
          ...prev,
          ...allStatuses
        };
        // Cache interface statuses
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('simoner_statuses_cache', JSON.stringify(updated));
          } catch (err) {
            console.error('Error caching interface statuses:', err);
          }
        }
        return updated;
      });
    } catch (err) {
      console.error('Error fetching kecamatan statuses:', err);
      // Silently fail
    }
  };

  // Fetch statuses for ALL interfaces in active tab (not just displayed ones)
  // Also refresh existing statuses when countdown resets (at configured interval)
  useEffect(() => {
    if (searchTerm.trim()) {
      // Don't fetch for search results
      return;
    }

    // Get all interfaces in active tab
    const allInterfacesInTab = filterByTab(allInterfaces.length > 0 ? allInterfaces : interfaces);
    const interfacesToFetch = [];
    
    // Always fetch all interfaces to refresh their statuses
    // This ensures statuses are always up-to-date without disappearing
    allInterfacesInTab.forEach((iface) => {
      interfacesToFetch.push(iface);
    });

    // Fetch in batches of 20
    if (interfacesToFetch.length > 0) {
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < interfacesToFetch.length; i += chunkSize) {
        chunks.push(interfacesToFetch.slice(i, i + chunkSize));
      }

      chunks.forEach((chunk) => {
        fetch('/api/interface-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ interfaces: chunk }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.statuses) {
              setInterfaceStatuses((prev) => {
                const updated = {
                  ...prev,
                  ...data.statuses,
                };
                // Cache interface statuses
                if (typeof window !== 'undefined') {
                  try {
                    sessionStorage.setItem('simoner_statuses_cache', JSON.stringify(updated));
                  } catch (err) {
                    console.error('Error caching interface statuses:', err);
                  }
                }
                return updated;
              });
            }
          })
          .catch((err) => {
            console.error('Error fetching interface statuses:', err);
          });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInterfaces, activeTab, searchTerm, lastRefreshTime]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-xl border border-blue-500/20 overflow-hidden">
            <div className="bg-white/5 backdrop-blur-sm p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-2xl border border-white/20">
                      <img src="/favicon.svg" alt="SiMoner Logo" className="w-12 h-12" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">
                        SiMoner
          </h1>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold text-white border border-white/30">
                        v1.0
                      </span>
                    </div>
                    <p className="text-blue-100 text-sm sm:text-base mb-2 font-medium">
                      Sistem Monitoring dan Reporting
                    </p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 text-blue-100 text-xs">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Mikrotik & PPPoE</span>
                      </div>
                      <a 
                        href="https://npma.my.id" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 text-blue-100 hover:text-white text-xs font-medium transition-colors group"
                      >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>By: NPMA</span>
                        <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2.5 font-semibold text-sm group"
                  >
                    <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {isLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  {!searchTerm.trim() && (
                    <div className="px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl border border-white/20 flex items-center gap-2 text-xs font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Auto-refresh in {refreshCountdown}s</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Switcher */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 p-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveTab('desa');
                  setCurrentPage(1);
                  setStatusFilter('all');
                }}
                className={`relative flex-1 px-4 sm:px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                  activeTab === 'desa'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-lg transform scale-[1.02]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className={`w-5 h-5 ${activeTab === 'desa' ? 'text-blue-600 dark:text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="hidden sm:inline">DESA</span>
                </span>
                {activeTab === 'desa' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-full"></div>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('opd');
                  setCurrentPage(1);
                  setStatusFilter('all');
                }}
                className={`relative flex-1 px-4 sm:px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                  activeTab === 'opd'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-lg transform scale-[1.02]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className={`w-5 h-5 ${activeTab === 'opd' ? 'text-blue-600 dark:text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="hidden sm:inline">OPD</span>
                </span>
                {activeTab === 'opd' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-full"></div>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('system');
                  setCurrentPage(1);
                  setStatusFilter('all');
                }}
                className={`relative flex-1 px-4 sm:px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                  activeTab === 'system'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-lg transform scale-[1.02]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className={`w-5 h-5 ${activeTab === 'system' ? 'text-blue-600 dark:text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <span className="hidden sm:inline">SYSTEM</span>
                </span>
                {activeTab === 'system' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-full"></div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full"></div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {searchTerm.trim() 
                      ? 'Search Results' 
                      : `Network Interfaces`
                    }
                  </h2>
                  {!searchTerm.trim() && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                      {activeTab.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                  {/* Left: chips */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setCurrentPage(1);
                      }}
                      className={`group relative transition-all duration-200 ${
                        statusFilter === 'all' ? 'scale-105' : 'hover:scale-105'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl transition-opacity duration-300 ${
                        statusFilter === 'all' ? 'opacity-20 blur' : 'opacity-0 group-hover:opacity-20 blur'
                      }`}></div>
                      <div className={`relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 border-blue-300 dark:border-blue-700 shadow-md'
                          : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <p className={`text-xs sm:text-sm font-bold ${
                            statusFilter === 'all'
                              ? 'text-blue-800 dark:text-blue-300'
                              : 'text-blue-700 dark:text-blue-400'
                          }`}>
                            {searchTerm.trim() 
                              ? `${tabTotal} ${tabTotal === 1 ? 'result' : 'results'} found`
                              : `${tabTotal} ${tabTotal === 1 ? 'Interface' : 'Interfaces'}`
                            }
                          </p>
                        </div>
                      </div>
                    </button>
                    {!searchTerm.trim() && (totalOnline > 0 || totalOffline > 0) && (
                      <>
                        <button
                          onClick={() => {
                            setStatusFilter('online');
                            setCurrentPage(1);
                          }}
                          className={`group relative transition-all duration-200 ${
                            statusFilter === 'online' ? 'scale-105' : 'hover:scale-105'
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl transition-opacity duration-300 ${
                            statusFilter === 'online' ? 'opacity-20 blur' : 'opacity-0 group-hover:opacity-20 blur'
                          }`}></div>
                          <div className={`relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer ${
                            statusFilter === 'online'
                              ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 border-green-300 dark:border-green-700 shadow-md'
                              : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <p className={`text-xs sm:text-sm font-bold ${
                                statusFilter === 'online'
                                  ? 'text-green-800 dark:text-green-300'
                                  : 'text-green-700 dark:text-green-400'
                              }`}>
                                {totalOnline} Online
                              </p>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setStatusFilter('offline');
                            setCurrentPage(1);
                          }}
                          className={`group relative transition-all duration-200 ${
                            statusFilter === 'offline' ? 'scale-105' : 'hover:scale-105'
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-r from-red-500 to-rose-500 rounded-xl transition-opacity duration-300 ${
                            statusFilter === 'offline' ? 'opacity-20 blur' : 'opacity-0 group-hover:opacity-20 blur'
                          }`}></div>
                          <div className={`relative px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer ${
                            statusFilter === 'offline'
                              ? 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 border-red-300 dark:border-red-700 shadow-md'
                              : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800'
                          }`}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <p className={`text-xs sm:text-sm font-bold ${
                                statusFilter === 'offline'
                                  ? 'text-red-800 dark:text-red-300'
                                  : 'text-red-700 dark:text-red-400'
                              }`}>
                                {totalOffline} Offline
                              </p>
                            </div>
                          </div>
                        </button>
                      </>
                    )}
                    {searchTerm.trim() && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        {isSearching ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Searching...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">Search complete</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: search + controls */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 lg:ml-auto w-full lg:w-auto">
                    <div className="w-full sm:w-auto">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.5 10.5a7.5 7.5 0 0013.15 6.15z" />
                          </svg>
                        </div>
                        <input
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Search interface..."
                          className="w-full sm:w-72 pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                        {searchTerm.trim() && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            aria-label="Clear search"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {searchTerm.trim() && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Searching across all interfaces (tab filter is ignored while searching)
                        </p>
                      )}
                    </div>

                    {!searchTerm.trim() && (
                      <div className="flex flex-wrap items-center gap-3 justify-start sm:justify-end">
                        <div className="flex items-center gap-2">
                          <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            Show:
                          </label>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => handleItemsPerPageChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value="all">All</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            Sort:
                          </label>
                          <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-1.5"
                          >
                            {sortOrder === 'asc' ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                </svg>
                                <span>A-Z</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                </svg>
                                <span>Z-A</span>
                              </>
                            )}
                          </button>
                        </div>
                        {activeTab === 'desa' && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              Group by:
                            </label>
                            <button
                              onClick={() => setGroupByKecamatan(!groupByKecamatan)}
                              className={`px-3 py-2 text-xs sm:text-sm rounded-lg border transition-all ${
                                groupByKecamatan
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              Kecamatan
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">
              Error: {error}
            </p>
          </div>
        )}

        {/* Interface List */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-visible">
          {isLoading ? (
            <div className="p-16 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
              <p className="mt-4 text-base text-gray-600 dark:text-gray-400 font-medium">
                {searchTerm.trim() ? 'Searching interfaces...' : 'Loading interfaces...'}
              </p>
            </div>
          ) : (
            <>
              <div className="p-6 overflow-visible">
                {displayedGroups !== null && activeTab === 'desa' && groupByKecamatan && !searchTerm.trim() ? (
                  // Grouped view by kecamatan with accordion
                  <div className="space-y-3">
                    {displayedGroups.sortedKecamatans.map((kecamatan) => {
                      const isExpanded = expandedKecamatans.has(kecamatan);
                      const interfaces = displayedGroups.groups[kecamatan];
                      const status = kecamatanStatuses[kecamatan] || { online: 0, offline: 0 };

                      return (
                        <div key={kecamatan} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedKecamatans);
                              if (isExpanded) {
                                newExpanded.delete(kecamatan);
                              } else {
                                newExpanded.add(kecamatan);
                              }
                              setExpandedKecamatans(newExpanded);
                            }}
                            className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full flex-shrink-0"></div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                  Kecamatan {kecamatan}
                                </h3>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                                  {interfaces.length} {interfaces.length === 1 ? 'Interface' : 'Interfaces'}
                                </span>
                                {status.online > 0 || status.offline > 0 ? (
                                  <>
                                    <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                      {status.online} Online
                                    </span>
                                    <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                      {status.offline} Offline
                                    </span>
                                  </>
                                ) : (
                                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
                                    Loading...
                                  </span>
                                )}
                              </div>
                            </div>
                            <svg 
                              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isExpanded && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-3 relative auto-rows-fr">
                                {displayedGroups.groups[kecamatan].map((iface, index) => (
                            <div
                              key={index}
                              className="relative"
                              onMouseEnter={(e) => {
                                setHoveredInterface(iface);
                                fetchInterfaceQuickInfo(iface);
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
                              }}
                              onMouseLeave={() => {
                                setHoveredInterface(null);
                                setHoveredInterfaceData(null);
                              }}
                              onMouseMove={(e) => {
                                if (hoveredInterface === iface) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
                                }
                              }}
                            >
                              <Link
                                href={`/interface/${encodeURIComponent(iface)}`}
                                className="group relative block p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 h-16 flex items-center"
                              >
                                <div className="flex items-start gap-2 w-full">
                                  <div className={`flex-shrink-0 w-2 h-2 rounded-full transition-colors mt-1.5 ${
                                    interfaceStatuses[iface] 
                                      ? (isInterfaceOnline(interfaceStatuses[iface], offlineThresholdSeconds)
                                          ? 'bg-green-500 group-hover:bg-green-600'
                                          : 'bg-red-500 group-hover:bg-red-600')
                                      : 'bg-gray-400 group-hover:bg-gray-500'
                                  }`}></div>
                                  <div className="flex-1 min-w-0 pr-2">
                                    <p className="text-xs font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words leading-tight line-clamp-2">
                                      {getDisplayName(iface)}
                                    </p>
                                  </div>
                                  <svg className="flex-shrink-0 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </Link>
                              
                              {/* Tooltip */}
                              {hoveredInterface === iface && hoveredInterfaceData && (
                                <div className="fixed z-[9999] w-64 p-4 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-700 pointer-events-none" style={{
                                  left: `${tooltipPosition.x}px`,
                                  top: `${tooltipPosition.y - 8}px`,
                                  transform: 'translate(-50%, -100%)'
                                }}>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700 rotate-45"></div>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">Interface</p>
                                      <p className="text-sm font-semibold truncate">{getDisplayName(iface)}</p>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${
                                          isInterfaceOnline(hoveredInterfaceData.lastUpdate, offlineThresholdSeconds)
                                            ? 'bg-green-500 animate-pulse'
                                            : 'bg-red-500'
                                        }`}></div>
                                        <span className={`text-xs font-semibold ${
                                          isInterfaceOnline(hoveredInterfaceData.lastUpdate, offlineThresholdSeconds)
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                        }`}>
                                          {isInterfaceOnline(hoveredInterfaceData.lastUpdate, offlineThresholdSeconds) ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t border-gray-700">
                                      <p className="text-xs text-gray-400 mb-1">Last Update</p>
                                      <p className="text-xs text-gray-300">{hoveredInterfaceData.lastUpdate}</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        ({getTimeDifference(hoveredInterfaceData.lastUpdate)})
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {hoveredInterface === iface && !hoveredInterfaceData && (
                                <div className="fixed z-[9999] w-64 p-4 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-700 pointer-events-none" style={{
                                  left: `${tooltipPosition.x}px`,
                                  top: `${tooltipPosition.y - 8}px`,
                                  transform: 'translate(-50%, -100%)'
                                }}>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700 rotate-45"></div>
                                  <div className="flex items-center justify-center py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    <span className="ml-2 text-xs text-gray-400">Loading...</span>
                                  </div>
                                </div>
                              )}
                            </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Regular grid view
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-3 relative auto-rows-fr">
                    {displayedInterfaces.length === 0 ? (
                      <div className="col-span-full text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                          {searchTerm.trim() ? 'No interface found' : 'No interfaces available'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {searchTerm.trim() ? 'Try a different search term' : 'Please check back later'}
                        </p>
                      </div>
                    ) : (
                      displayedInterfaces.map((iface, index) => (
                      <div
                        key={index}
                        className="relative"
                        onMouseEnter={(e) => {
                          setHoveredInterface(iface);
                          fetchInterfaceQuickInfo(iface);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => {
                          setHoveredInterface(null);
                          setHoveredInterfaceData(null);
                        }}
                        onMouseMove={(e) => {
                          if (hoveredInterface === iface) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });
                          }
                        }}
                      >
                        <Link
                          href={`/interface/${encodeURIComponent(iface)}`}
                          className="group relative block p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200 h-16 flex items-center"
                        >
                          <div className="flex items-start gap-2 w-full">
                            <div className={`flex-shrink-0 w-2 h-2 rounded-full transition-colors mt-1.5 ${
                              interfaceStatuses[iface] 
                                ? (isInterfaceOnline(interfaceStatuses[iface], offlineThresholdSeconds)
                                    ? 'bg-green-500 group-hover:bg-green-600'
                                    : 'bg-red-500 group-hover:bg-red-600')
                                : 'bg-gray-400 group-hover:bg-gray-500'
                            }`}></div>
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="text-xs font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words leading-tight line-clamp-2">
                                {getDisplayName(iface)}
                              </p>
                            </div>
                            <svg className="flex-shrink-0 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                        
                        {/* Tooltip */}
                        {hoveredInterface === iface && hoveredInterfaceData && (
                          <div className="fixed z-[9999] w-64 p-4 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-700 pointer-events-none" style={{
                            left: `${tooltipPosition.x}px`,
                            top: `${tooltipPosition.y - 8}px`,
                            transform: 'translate(-50%, -100%)'
                          }}>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700 rotate-45"></div>
                            
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Interface</p>
                                <p className="text-sm font-semibold truncate">{getDisplayName(iface)}</p>
                              </div>
                              
                              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2.5 h-2.5 rounded-full ${
                                    isInterfaceOnline(hoveredInterfaceData.lastUpdate, offlineThresholdSeconds)
                                      ? 'bg-green-500 animate-pulse'
                                      : 'bg-red-500'
                                  }`}></div>
                                  <span className={`text-xs font-semibold ${
                                    isInterfaceOnline(hoveredInterfaceData.lastUpdate, offlineThresholdSeconds)
                                      ? 'text-green-400'
                                      : 'text-red-400'
                                  }`}>
                                    {isInterfaceOnline(hoveredInterfaceData.lastUpdate, offlineThresholdSeconds) ? 'ONLINE' : 'OFFLINE'}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="pt-2 border-t border-gray-700">
                                <p className="text-xs text-gray-400 mb-1">Last Update</p>
                                <p className="text-xs text-gray-300">{hoveredInterfaceData.lastUpdate}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  ({getTimeDifference(hoveredInterfaceData.lastUpdate)})
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Loading state */}
                        {hoveredInterface === iface && !hoveredInterfaceData && (
                          <div className="fixed z-[9999] w-64 p-4 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-2xl border border-gray-700 pointer-events-none" style={{
                            left: `${tooltipPosition.x}px`,
                            top: `${tooltipPosition.y - 8}px`,
                            transform: 'translate(-50%, -100%)'
                          }}>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700 rotate-45"></div>
                            <div className="flex items-center justify-center py-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              <span className="ml-2 text-xs text-gray-400">Loading...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Pagination - Only show if not searching and has interfaces, and not in grouped view */}
          {!searchTerm.trim() && displayedInterfaces.length > 0 && !(displayedGroups !== null && activeTab === 'desa' && groupByKecamatan) && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
                  Showing <span className="font-bold text-gray-900 dark:text-white">{displayedInterfaces.length}</span> of <span className="font-bold text-gray-900 dark:text-white">{tabTotal}</span> {activeTab.toUpperCase()} interfaces
                  {filteredTotalPages > 1 && itemsPerPage !== 'all' && (
                    <> • Page <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-bold text-gray-900 dark:text-white">{filteredTotalPages}</span></>
                  )}
                </p>
                {filteredTotalPages > 1 && itemsPerPage !== 'all' && (
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center order-1 sm:order-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">Prev</span>
                    </button>
                    
                    <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
                      {Array.from({ length: Math.min(5, filteredTotalPages) }, (_, i) => {
                        let pageNum;
                        if (filteredTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= filteredTotalPages - 2) {
                          pageNum = filteredTotalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg border transition-all duration-200 min-w-[2.5rem] sm:min-w-0 ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === filteredTotalPages}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 flex items-center gap-1 sm:gap-1.5"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <span className="sm:hidden">Next</span>
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
