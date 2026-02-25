import { useState, useCallback } from "react";
import api from "../../services/api";

export default function useDropdownData(user, setNotification) {
  const [clientNetworks, setClientNetworks] = useState([]);
  const [loadingClientNetworks, setLoadingClientNetworks] = useState(false);
  const [ourNetworks, setOurNetworks] = useState([]);
  const [loadingOurNetworks, setLoadingOurNetworks] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [clientBrokers, setClientBrokers] = useState([]);
  const [loadingClientBrokers, setLoadingClientBrokers] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [filteredAgentsLoading, setFilteredAgentsLoading] = useState(false);
  const [unassignedLeadsStats, setUnassignedLeadsStats] = useState({
    ftd: null,
    filler: null,
  });
  const [allAgents, setAllAgents] = useState([]);

  const fetchClientNetworks = useCallback(async () => {
    // Both admins and affiliate managers can access all client networks
    if (user?.role !== "admin" && user?.role !== "affiliate_manager") return;
    setLoadingClientNetworks(true);
    try {
      const response = await api.get(
        "/client-networks?isActive=true&limit=1000"
      );
      setClientNetworks(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client networks:", err);
      setNotification({
        message: "Failed to load client networks",
        severity: "warning",
      });
    } finally {
      setLoadingClientNetworks(false);
    }
  }, [user?.role]);

  const fetchOurNetworks = useCallback(async () => {
    if (user?.role !== "affiliate_manager" && user?.role !== "admin") return;
    setLoadingOurNetworks(true);
    try {
      const endpoint =
        user?.role === "affiliate_manager"
          ? "/our-networks/my-networks"
          : "/our-networks?isActive=true&limit=1000";
      const response = await api.get(endpoint);
      setOurNetworks(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch our networks:", err);
      setNotification({
        message: "Failed to load our networks",
        severity: "warning",
      });
    } finally {
      setLoadingOurNetworks(false);
    }
  }, [user?.role]);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const endpoint =
        user?.role === "affiliate_manager"
          ? "/campaigns/my-campaigns"
          : "/campaigns?isActive=true&status=active&limit=1000";
      const response = await api.get(endpoint);
      setCampaigns(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
      setNotification({
        message: "Failed to load campaigns",
        severity: "warning",
      });
    } finally {
      setLoadingCampaigns(false);
    }
  }, [user?.role]);

  const fetchClientBrokers = useCallback(async () => {
    setLoadingClientBrokers(true);
    try {
      const response = await api.get(
        "/client-brokers?isActive=true&limit=1000"
      );
      setClientBrokers(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch client brokers:", err);
      setNotification({
        message: "Failed to load client brokers",
        severity: "warning",
      });
    } finally {
      setLoadingClientBrokers(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const response = await api.get("/users/agents-with-lead-stats");
      setAgents(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
      setNotification({
        message: "Failed to load agents",
        severity: "warning",
      });
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  // Fetch agents with lead stats filtered by specific criteria
  const fetchFilteredAgents = useCallback(
    async (leadType, country, clientNetwork, clientBrokers = []) => {
      if (!leadType || !country || !clientNetwork) {
        return;
      }

      setFilteredAgentsLoading(true);
      try {
        const response = await api.post(
          "/users/agents-with-filtered-lead-stats",
          {
            leadType,
            country,
            clientNetwork,
            clientBrokers,
          }
        );

        setFilteredAgents(response.data.data || []);

        // Store unassigned leads stats by lead type
        setUnassignedLeadsStats((prev) => ({
          ...prev,
          [leadType]: response.data.unassignedLeads || null,
        }));

        return response.data;
      } catch (err) {
        console.error("Failed to fetch filtered agents:", err);
        setNotification({
          message:
            err.response?.data?.message ||
            "Failed to load agents with matching leads",
          severity: "warning",
        });
        return null;
      } finally {
        setFilteredAgentsLoading(false);
      }
    },
    []
  );

  // Fetch all agents for manual lead selection
  const fetchAllAgents = useCallback(async () => {
    try {
      const response = await api.get("/users?role=agent&limit=1000");
      setAllAgents(response.data.data || []);
    } catch (err) {
      console.error("Failed to fetch all agents:", err);
    }
  }, []);

  return {
    clientNetworks,
    setClientNetworks,
    loadingClientNetworks,
    setLoadingClientNetworks,
    ourNetworks,
    setOurNetworks,
    loadingOurNetworks,
    setLoadingOurNetworks,
    campaigns,
    setCampaigns,
    loadingCampaigns,
    setLoadingCampaigns,
    clientBrokers,
    setClientBrokers,
    loadingClientBrokers,
    setLoadingClientBrokers,
    agents,
    setAgents,
    loadingAgents,
    setLoadingAgents,
    filteredAgents,
    setFilteredAgents,
    filteredAgentsLoading,
    setFilteredAgentsLoading,
    unassignedLeadsStats,
    setUnassignedLeadsStats,
    allAgents,
    setAllAgents,
    fetchClientNetworks,
    fetchOurNetworks,
    fetchCampaigns,
    fetchClientBrokers,
    fetchAgents,
    fetchFilteredAgents,
    fetchAllAgents,
  };
}
