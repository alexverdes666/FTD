import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Box,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  AttachMoney as MoneyIcon,
  Refresh as RefreshIcon,
  Star as StarIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const EnhancedBonusCard = ({ 
  enhancedBonuses, 
  bonusBreakdown = [], 
  showComparison = true,
  onRefresh 
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Provide safe defaults for enhancedBonuses
  const safeEnhancedBonuses = {
    grandTotal: enhancedBonuses?.grandTotal ?? 0,
    recommendation: enhancedBonuses?.recommendation ?? 'legacy',
    savings: enhancedBonuses?.savings ?? 0,
    legacy: {
      total: enhancedBonuses?.legacy?.total ?? 0,
      ...enhancedBonuses?.legacy
    },
    external: {
      total: enhancedBonuses?.external?.total ?? 0,
      uniqueDays: enhancedBonuses?.external?.uniqueDays ?? 0,
      ...enhancedBonuses?.external
    },
    ...enhancedBonuses
  };

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const getBonusSystemColor = (system) => {
    return system === 'external' ? theme.palette.success.main : theme.palette.primary.main;
  };

  const getBonusSystemIcon = (system) => {
    return system === 'external' ? <StarIcon /> : <MoneyIcon />;
  };

  // Safe number formatting function
  const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toFixed(2);
  };

  // If no bonus data is provided, show a loading or empty state
  if (!enhancedBonuses) {
    return (
      <Card elevation={3} sx={{ mt: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <Typography variant="body2" color="text.secondary">
              No bonus data available
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={3} sx={{ mt: 2 }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">Enhanced Bonus System</Typography>
            <Chip
              label={safeEnhancedBonuses.recommendation === 'external' ? 'External System' : 'Legacy System'}
              color={safeEnhancedBonuses.recommendation === 'external' ? 'success' : 'primary'}
              size="small"
              icon={getBonusSystemIcon(safeEnhancedBonuses.recommendation)}
            />
            {safeEnhancedBonuses.savings > 0 && (
              <Chip
                label={`+$${formatCurrency(safeEnhancedBonuses.savings)} saved`}
                color="success"
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        }
        action={
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh external data">
              <IconButton onClick={onRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={handleExpandClick}
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: theme.transitions.create('transform', {
                  duration: theme.transitions.duration.shortest,
                }),
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
        }
      />
      
      <CardContent>
        {/* Main Bonus Display */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                p: 2,
                bgcolor: theme.palette.grey[50],
                borderRadius: 1,
                border: `2px solid ${getBonusSystemColor(safeEnhancedBonuses.recommendation)}`,
              }}
            >
              <Typography variant="h4" color={getBonusSystemColor(safeEnhancedBonuses.recommendation)}>
                ${formatCurrency(safeEnhancedBonuses.grandTotal)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Bonus ({safeEnhancedBonuses.recommendation === 'external' ? 'External' : 'Legacy'} System)
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Legacy System:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  ${formatCurrency(safeEnhancedBonuses.legacy.total)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">External System:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  ${formatCurrency(safeEnhancedBonuses.external.total)}
                </Typography>
              </Box>
              {safeEnhancedBonuses.external.uniqueDays > 0 && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Unique Call Days:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {safeEnhancedBonuses.external.uniqueDays}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* System Comparison Alert */}
        {showComparison && safeEnhancedBonuses.recommendation === 'external' && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <AlertTitle>Better Bonus Found!</AlertTitle>
            The external bonus system provides ${formatCurrency(safeEnhancedBonuses.savings)} more than the legacy system 
            based on unique call days pattern.
          </Alert>
        )}

        {/* Detailed Breakdown */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            
            {/* Bonus Breakdown Table */}
            <Typography variant="h6" gutterBottom>
              Bonus Breakdown
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bonus Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>System</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bonusBreakdown.map((bonus, index) => (
                    <TableRow key={index}>
                      <TableCell>{bonus?.label || 'Unknown'}</TableCell>
                      <TableCell align="right">
                        <Typography
                          color={getBonusSystemColor(bonus?.system || 'legacy')}
                          fontWeight="bold"
                        >
                          ${formatCurrency(bonus?.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={bonus?.system || 'legacy'}
                          size="small"
                          color={bonus?.system === 'external' ? 'success' : 'primary'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Progress Indicators */}
            {safeEnhancedBonuses.external.uniqueDays > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Bonus Progress
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Unique Call Days Progress</Typography>
                    <Typography variant="body2">
                      {safeEnhancedBonuses.external.uniqueDays}/4 days
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(safeEnhancedBonuses.external.uniqueDays / 4) * 100}
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  Complete calls on {4 - safeEnhancedBonuses.external.uniqueDays} more unique days to maximize your bonus!
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default EnhancedBonusCard; 