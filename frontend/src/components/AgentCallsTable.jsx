import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Box,
  Typography,
} from '@mui/material';
import {
  Person,
} from '@mui/icons-material';

const COMPACT_TABLE_SX = {
  tableLayout: "fixed",
  "& .MuiTableHead-root .MuiTableCell-head": {
    background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "2px solid #3b82f6",
    py: 0.6,
    px: 1,
    lineHeight: 1.2,
  },
  "& .MuiTableBody-root .MuiTableCell-root": {
    py: 0.4,
    px: 1,
    fontSize: "0.78rem",
    lineHeight: 1.3,
  },
  "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
    bgcolor: "rgba(0, 0, 0, 0.015)",
  },
  "& .MuiTableBody-root .MuiTableRow-root:hover": {
    bgcolor: "rgba(25, 118, 210, 0.06)",
    transition: "background-color 0.15s ease",
  },
};

const AgentCallsTable = ({ agentCalls, loading = false, agentBonusesData = [], agentFinesData = [], declarationTotals = [] }) => {
  const getSuccessRateColor = (rate) => {
    const numRate = parseFloat(rate);
    if (numRate >= 80) return 'success';
    if (numRate >= 60) return 'warning';
    return 'error';
  };

  // Calculate talk time pay (rate per second)
  const calculateTalkTimePay = (talkTimeStr) => {
    if (!talkTimeStr || talkTimeStr === "00:00:00") return 0;
    const [hours, minutes, seconds] = talkTimeStr.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const ratePerSecond = 0.00278; // $0.00278 per second
    return totalSeconds * ratePerSecond;
  };

  const getAgentBonus = (agentName) => {
    // Use approved declaration totals if available
    const declTotal = declarationTotals.find(d => d.agentName === agentName);
    if (declTotal) return declTotal.totalBonus || 0;

    // Fallback to manual call counts data
    const agentBonus = agentBonusesData.find(bonus => bonus.agent.fullName === agentName);
    if (!agentBonus) return 0;

    const callCounts = agentBonus.callCounts || {};
    const bonusRates = agentBonus.bonusRates || {
      firstCall: 5.0,
      secondCall: 10.0,
      thirdCall: 15.0,
      fourthCall: 20.0,
      fifthCall: 25.0,
      verifiedAcc: 5.0,
    };

    return (callCounts.firstCalls || 0) * bonusRates.firstCall +
           (callCounts.secondCalls || 0) * bonusRates.secondCall +
           (callCounts.thirdCalls || 0) * bonusRates.thirdCall +
           (callCounts.fourthCalls || 0) * bonusRates.fourthCall +
           (callCounts.fifthCalls || 0) * bonusRates.fifthCall +
           (callCounts.verifiedAccounts || 0) * bonusRates.verifiedAcc;
  };

  const getAgentFines = (agentName) => {
    // Only count approved and admin_approved fines as active deductions
    const agentFines = agentFinesData.filter(fine =>
      fine.agent.fullName === agentName &&
      ['approved', 'admin_approved', 'active'].includes(fine.status) // Include 'active' for backward compatibility
    );
    return agentFines.reduce((total, fine) => total + fine.amount, 0);
  };

  const calculateTotalPayable = (agent) => {
    const talkTimePay = calculateTalkTimePay(agent.totalTalkTime);
    const monthlyBonus = getAgentBonus(agent.agentName);
    const fines = getAgentFines(agent.agentName);
    
    return talkTimePay + monthlyBonus - fines;
  };

  if (loading) {
    return (
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" sx={COMPACT_TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell align="center">Total Calls</TableCell>
              <TableCell align="center">Incoming</TableCell>
              <TableCell align="center">Outgoing</TableCell>
              <TableCell align="center">Success Rate</TableCell>
              <TableCell align="center">Talk Time</TableCell>
              <TableCell align="center">Talk Pay</TableCell>
              <TableCell align="center">Bonus</TableCell>
              <TableCell align="center">Fines</TableCell>
              <TableCell align="center">Total Payable</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                {[...Array(10)].map((_, i) => (
                  <TableCell key={i}><Typography variant="caption" color="text.disabled">...</Typography></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  // Build the display list: use external call data if available, otherwise
  // fall back to agents from bonuses/fines so the table still renders
  const displayAgents = React.useMemo(() => {
    if (agentCalls && agentCalls.length > 0) return agentCalls;

    // No external call data - build entries from bonus/fines data
    const agentMap = new Map();

    agentBonusesData.forEach((bonus) => {
      const name = bonus.agent?.fullName;
      if (name && !agentMap.has(name)) {
        agentMap.set(name, {
          agentName: name,
          agentNumber: bonus.agent?.fourDigitCode || "",
          totalCalls: 0,
          incomingCalls: 0,
          outgoingCalls: 0,
          successRate: "0.0",
          totalTalkTime: "00:00:00",
        });
      }
    });

    agentFinesData.forEach((fine) => {
      const name = fine.agent?.fullName;
      if (name && !agentMap.has(name)) {
        agentMap.set(name, {
          agentName: name,
          agentNumber: "",
          totalCalls: 0,
          incomingCalls: 0,
          outgoingCalls: 0,
          successRate: "0.0",
          totalTalkTime: "00:00:00",
        });
      }
    });

    declarationTotals.forEach((decl) => {
      const name = decl.agentName;
      if (name && !agentMap.has(name)) {
        agentMap.set(name, {
          agentName: name,
          agentNumber: "",
          totalCalls: 0,
          incomingCalls: 0,
          outgoingCalls: 0,
          successRate: "0.0",
          totalTalkTime: "00:00:00",
        });
      }
    });

    return Array.from(agentMap.values()).sort((a, b) =>
      a.agentName.localeCompare(b.agentName)
    );
  }, [agentCalls, agentBonusesData, agentFinesData, declarationTotals]);

  if (displayAgents.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          No agent call data available for this period
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small" sx={COMPACT_TABLE_SX}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '18%' }}>Agent</TableCell>
            <TableCell align="center" sx={{ width: '8%' }}>Total Calls</TableCell>
            <TableCell align="center" sx={{ width: '8%' }}>Incoming</TableCell>
            <TableCell align="center" sx={{ width: '8%' }}>Outgoing</TableCell>
            <TableCell align="center" sx={{ width: '10%' }}>Success Rate</TableCell>
            <TableCell align="center" sx={{ width: '10%' }}>Talk Time</TableCell>
            <TableCell align="center" sx={{ width: '10%' }}>Talk Pay</TableCell>
            <TableCell align="center" sx={{ width: '10%' }}>Bonus</TableCell>
            <TableCell align="center" sx={{ width: '8%' }}>Fines</TableCell>
            <TableCell align="center" sx={{ width: '10%' }}>Total Payable</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayAgents.map((agent) => {
            const agentBonus = getAgentBonus(agent.agentName);
            const agentFines = getAgentFines(agent.agentName);
            const talkTimePay = calculateTalkTimePay(agent.totalTalkTime);
            const totalPayable = calculateTotalPayable(agent);

            return (
              <TableRow key={agent.id || agent.agentName}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Person sx={{ fontSize: 15, color: 'primary.main' }} />
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.78rem' }}>
                      {agent.agentName}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell align="center">
                  <Chip label={agent.totalCalls} color="primary" variant="outlined" size="small" sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }} />
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{agent.incomingCalls}</Typography>
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{agent.outgoingCalls}</Typography>
                </TableCell>

                <TableCell align="center">
                  <Chip label={`${agent.successRate}%`} color={getSuccessRateColor(agent.successRate)} size="small" sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }} />
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>{agent.totalTalkTime}</Typography>
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" fontWeight={600} color="info.main" sx={{ fontSize: '0.78rem' }}>
                    ${talkTimePay.toFixed(2)}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" fontWeight={600} color="success.main" sx={{ fontSize: '0.78rem' }}>
                    ${agentBonus.toFixed(2)}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" fontWeight={600} color={agentFines > 0 ? "error.main" : "text.disabled"} sx={{ fontSize: '0.78rem' }}>
                    ${agentFines.toFixed(2)}
                  </Typography>
                </TableCell>

                <TableCell align="center">
                  <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ fontSize: '0.82rem' }}>
                    ${totalPayable.toFixed(2)}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AgentCallsTable;
