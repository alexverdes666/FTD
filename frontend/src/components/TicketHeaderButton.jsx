import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { IconButton, Badge, Tooltip } from "@mui/material";
import { SupportAgent as TicketIcon } from "@mui/icons-material";
import { selectUser } from "../store/slices/authSlice";
import { getTicketStats } from "../services/tickets";

const TicketHeaderButton = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const [openCount, setOpenCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const response = await getTicketStats();
      setOpenCount(response.data?.summary?.open || 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchCount();
      const interval = setInterval(fetchCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.role, fetchCount]);

  const handleClick = () => {
    if (user?.role === "admin") {
      navigate("/admin", { state: { tab: 3 } });
    } else {
      navigate("/tickets");
    }
  };

  return (
    <Tooltip title="Tickets">
      <IconButton size="small" color="inherit" onClick={handleClick}>
        <Badge
          badgeContent={openCount}
          color="error"
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              fontSize: "0.65rem",
              height: 16,
              minWidth: 16,
            },
          }}
        >
          <TicketIcon sx={{ fontSize: 22 }} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default TicketHeaderButton;
