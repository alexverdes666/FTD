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
  Tooltip
} from '@mui/material';
import {
  Phone,
  PhoneCallback,
  AccessTime,
  Person,
  Star,
  Warning,
  AttachMoney
} from '@mui/icons-material';

const AgentCallsTable = ({ agentCalls, loading = false, agentBonusesData = [], agentFinesData = [] }) => {
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
    const agentBonus = agentBonusesData.find(bonus => bonus.agent.fullName === agentName);
    if (!agentBonus) return 0;
    
    const callCounts = agentBonus.callCounts || {};
    const bonusRates = agentBonus.bonusRates || {
      firstCall: 5.0,
      secondCall: 10.0,
      thirdCall: 15.0,
      fourthCall: 20.0,
      fifthCall: 25.0,
      verifiedAcc: 50.0,
    };
    
    return (callCounts.firstCalls || 0) * bonusRates.firstCall +
           (callCounts.secondCalls || 0) * bonusRates.secondCall +
           (callCounts.thirdCalls || 0) * bonusRates.thirdCall +
           (callCounts.fourthCalls || 0) * bonusRates.fourthCall +
           (callCounts.fifthCalls || 0) * bonusRates.fifthCall +
           (callCounts.verifiedAccounts || 0) * bonusRates.verifiedAcc;
  };

  const getAgentFines = (agentName) => {
    const agentFines = agentFinesData.filter(fine => fine.agent.fullName === agentName && fine.status === 'active');
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
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell align="center">Total Calls</TableCell>
              <TableCell align="center">Incoming</TableCell>
              <TableCell align="center">Outgoing</TableCell>
              <TableCell align="center">Success Rate</TableCell>
              <TableCell align="center">Talk Time</TableCell>
              <TableCell align="center">Money from Calls</TableCell>
              <TableCell align="center">Monthly Bonus</TableCell>
              <TableCell align="center">Active Fines</TableCell>
              <TableCell align="center">Total Payable</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
                <TableCell>Loading...</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (!agentCalls || agentCalls.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          No agent call data available for this period
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Agent</TableCell>
            <TableCell align="center">Total Calls</TableCell>
            <TableCell align="center">Incoming</TableCell>
            <TableCell align="center">Outgoing</TableCell>
            <TableCell align="center">Success Rate</TableCell>
            <TableCell align="center">Talk Time</TableCell>
            <TableCell align="center">Money from Calls</TableCell>
            <TableCell align="center">Monthly Bonus</TableCell>
            <TableCell align="center">Active Fines</TableCell>
            <TableCell align="center">Total Payable</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {agentCalls.map((agent) => {
            const agentBonus = getAgentBonus(agent.agentName);
            const agentFines = getAgentFines(agent.agentName);
            const talkTimePay = calculateTalkTimePay(agent.totalTalkTime);
            const totalPayable = calculateTotalPayable(agent);
            
            return (
              <TableRow key={agent.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person fontSize="small" color="primary" />
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {agent.agentName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        #{agent.agentNumber}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                
                <TableCell align="center">
                  <Chip 
                    label={agent.totalCalls} 
                    color="primary" 
                    variant="outlined" 
                    size="small"
                  />
                </TableCell>
                
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <Phone fontSize="small" color="success" />
                    <Typography variant="body2">{agent.incomingCalls}</Typography>
                  </Box>
                </TableCell>
                
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <PhoneCallback fontSize="small" color="info" />
                    <Typography variant="body2">{agent.outgoingCalls}</Typography>
                  </Box>
                </TableCell>
                
                <TableCell align="center">
                  <Chip 
                    label={`${agent.successRate}%`}
                    color={getSuccessRateColor(agent.successRate)}
                    size="small"
                  />
                </TableCell>
                
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <AccessTime fontSize="small" color="action" />
                    <Typography variant="body2">{agent.totalTalkTime}</Typography>
                  </Box>
                </TableCell>
                
                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <AttachMoney fontSize="small" color="info" />
                    <Typography variant="body2" fontWeight="bold" color="info.main">
                      ${talkTimePay.toFixed(2)}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <Star fontSize="small" color="success" />
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      ${agentBonus.toFixed(2)}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <Warning fontSize="small" color="error" />
                    <Typography variant="body2" fontWeight="bold" color="error.main">
                      ${agentFines.toFixed(2)}
                    </Typography>
                  </Box>
                </TableCell>

                <TableCell align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <AttachMoney fontSize="small" color="primary" />
                    <Typography variant="body2" fontWeight="bold" color="primary.main">
                      ${totalPayable.toFixed(2)}
                    </Typography>
                  </Box>
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
