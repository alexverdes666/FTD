import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography
} from '@mui/material';
import dayjs from 'dayjs';

const MonthYearSelector = ({ 
  selectedDate, 
  onDateChange, 
  label = "Month & Year",
  showCurrentSelection = true,
  size = "small"
}) => {
  // Generate months array
  const months = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' }
  ];

  // Generate years array (current year - 5 to current year + 1)
  const currentYear = dayjs().year();
  const years = [];
  for (let year = currentYear - 5; year <= currentYear + 1; year++) {
    years.push(year);
  }

  const handleMonthChange = (event) => {
    const newMonth = event.target.value;
    const newDate = selectedDate.month(newMonth);
    onDateChange(newDate);
  };

  const handleYearChange = (event) => {
    const newYear = event.target.value;
    const newDate = selectedDate.year(newYear);
    onDateChange(newDate);
  };

  return (
    <Grid container spacing={2} alignItems="center">
      <Grid item xs={6}>
        <FormControl fullWidth size={size}>
          <InputLabel>Month</InputLabel>
          <Select
            value={selectedDate.month()}
            onChange={handleMonthChange}
            label="Month"
          >
            {months.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6}>
        <FormControl fullWidth size={size}>
          <InputLabel>Year</InputLabel>
          <Select
            value={selectedDate.year()}
            onChange={handleYearChange}
            label="Year"
          >
            {years.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      {showCurrentSelection && (
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary">
            Selected: {selectedDate.format('MMMM YYYY')}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default MonthYearSelector;
