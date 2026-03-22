import React from 'react';
import { Box, Typography, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 1.5,
        px: 3,
        mt: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        borderTop: '1px solid',
        borderColor: 'rgba(0, 0, 0, 0.06)',
        bgcolor: 'transparent',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 12 }}>
        {'© '}
        {new Date().getFullYear()}
        {' FTD Hub. All rights reserved.'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          component={RouterLink}
          to="/disclaimer"
          variant="caption"
          sx={{
            color: 'text.disabled',
            fontSize: 12,
            textDecoration: 'none',
            '&:hover': { color: 'text.secondary' },
            transition: 'color 0.2s ease',
          }}
        >
          Disclaimer
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 11 }}>
          v2.0
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
