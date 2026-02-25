import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../../services/api";
import { useDebounce } from "./ordersUtils";

const useOrdersData = ({ user, searchParams, setSearchParams, setNotification }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalOrders, setTotalOrders] = useState(0);

  // Initialize filters from URL params (for global search integration)
  const [filters, setFilters] = useState(() => {
    const urlSearch = searchParams.get("search") || "";
    return {
      startDate: "",
      endDate: "",
      search: urlSearch,
      emailSearch: "",
      createdMonth: "",
      createdYear: "",
    };
  });

  // Clear URL params after initial load to avoid persisting
  useEffect(() => {
    if (searchParams.get("search")) {
      // Clear the search param from URL after a short delay
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const debouncedFilters = useDebounce(filters, 150);

  const fetchAbortControllerRef = useRef(null);
  const hasDataRef = useRef(false);

  const fetchOrders = useCallback(async () => {
    // Cancel any in-flight request
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;

    // Only show full spinner on initial load (no data yet)
    // Otherwise keep previous results visible (stale-while-revalidate)
    if (!hasDataRef.current) {
      setLoading(true);
    } else {
      setSearching(true);
    }
    setNotification({ message: "", severity: "info" });
    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
      });
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value) {
          // Skip search queries shorter than 2 characters
          if ((key === "search" || key === "emailSearch") && value.trim().length < 2) {
            return;
          }
          params.append(key, value);
        }
      });
      const response = await api.get(`/orders?${params}`, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setOrders(response.data.data);
        setTotalOrders(response.data.pagination.total);
        hasDataRef.current = true;
      }
    } catch (err) {
      // Ignore abort errors - they are expected when a newer request supersedes
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        return;
      }
      setNotification({
        message: err.response?.data?.message || "Failed to fetch orders",
        severity: "error",
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setSearching(false);
      }
    }
  }, [page, rowsPerPage, debouncedFilters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
    };
  }, []);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleFilterChange = useCallback(
    (field) => (event) => {
      const value = event.target.value;
      setFilters((prev) => ({ ...prev, [field]: value }));
      setPage(0);
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({ search: "", emailSearch: "", startDate: "", endDate: "", createdMonth: "", createdYear: "" });
    setPage(0);
  }, []);

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => key !== "search" && value !== "").length;
  }, [filters]);

  return {
    orders,
    setOrders,
    loading,
    setLoading,
    searching,
    setSearching,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    totalOrders,
    setTotalOrders,
    filters,
    setFilters,
    debouncedFilters,
    fetchOrders,
    handleChangePage,
    handleChangeRowsPerPage,
    handleFilterChange,
    clearFilters,
    activeFilterCount,
  };
};

export default useOrdersData;
