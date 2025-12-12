import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
const EULA_TEXT = {
  title: 'End-User License Agreement (EULA)',
  paragraphs: [
    'This End-User License Agreement ("EULA") is a legal agreement between you and the developers of this platform, Daniel Angelov, Nikola Dimitrov, and Ivailo Minev ("the Developers").',
    'This EULA governs your acquisition and use of our Lead Management Platform software ("the Software") directly from the Developers or indirectly through a reseller or distributor authorized by the Developers.',
    'Please read this EULA carefully before completing the installation process and using the Software. It provides a license to use the Software and contains warranty information and liability disclaimers.',
    'By clicking "I Agree" or by installing and/or using the software, you are confirming your acceptance of the Software and agreeing to become bound by the terms of this EULA.',
    'If you are entering into this EULA on behalf of a company or other legal entity, you represent that you have the authority to bind such entity and its affiliates to these terms and conditions. If you do not have such authority or if you do not agree with the terms and conditions of this EULA, do not install or use the Software, and you must not accept this EULA.',
    'This EULA shall apply only to the Software supplied by the Developers herewith regardless of whether other software is referred to or described herein. The terms also apply to any updates, supplements, Internet-based services, and support services for the Software, unless other terms accompany those items on delivery. If so, those terms apply.',
    {
      heading: '1. License Grant',
      points: [
        'The Developers hereby grant you a personal, non-transferable, non-exclusive licence to use the Software on your devices in accordance with the terms of this EULA.',
        'You are permitted to load the Software (for example on a PC, laptop, or server) under your control. You are responsible for ensuring your device meets the minimum requirements of the Software.',
        'You are not permitted to:',
        [
          'Edit, alter, modify, adapt, translate or otherwise change the whole or any part of the Software nor permit the whole or any part of the Software to be combined with or become incorporated in any other software, nor decompile, disassemble or reverse engineer the Software or attempt to do any such things,',
          'Reproduce, copy, distribute, resell or otherwise use the Software for any commercial purpose,',
          'Allow any third party to use the Software on behalf of or for the benefit of any third party,',
          'Use the Software in any way which breaches any applicable local, national or international law,',
          'Use the Software for any purpose that the Developers consider is a breach of this EULA agreement.',
        ],
      ],
    },
    {
      heading: '2. Disclaimer of Liability and Responsibility',
      points: [
        'The Developers have created and delivered the Software under a service contract. Upon delivery, full administrative control is transferred to the client or end-user.',
        'The Developers do not operate, administer, manage, host, or maintain the Software after delivery and have no access to, control over, or knowledge of the content uploaded, processed, or managed within the Software.',
        'You, the user, assume full and sole legal responsibility as the owner and controller of the Software and its use. This includes, but is not limited to:',
        [
          'The processing of any personal, sensitive, or identifying data. You confirm that you have obtained all necessary consents and legal bases for processing any personal data within this system and that you act as the Data Controller where applicable.',
          'The use of any automation scripts or systems that interact with third-party platforms. You are responsible for complying with their terms of use and applicable laws.',
          'Full compliance with all applicable data protection laws (e.g., GDPR, CCPA), intellectual property rights, and other regulations.',
        ],
        'The Developers are not a Data Controller or a Data Processor under GDPR or similar laws and shall not be held liable for any misuse, illegal activity, or unethical practice committed through or with the Software.',
        'By using the Software, you explicitly release the Developers from any and all civil, administrative, or criminal liability related to your use or misuse of the Software.',
      ],
    },
    {
      heading: '3. Termination',
      points: [
        'This EULA is effective from the moment you agree to it and shall continue until terminated. You may terminate it at any time upon written notice to the Developers.',
        'It will also terminate immediately if you fail to comply with any term of this EULA. Upon such termination, the licenses granted by this EULA will immediately terminate and you agree to stop all access and use of the Software.',
      ],
    },
    {
      heading: '4. Governing Law',
      points: [
        'This EULA, and any dispute arising out of or in connection with this EULA, shall be governed by and construed in accordance with the laws of the jurisdiction in which the Developers are based.',
      ],
    },
    'LEGAL DISCLAIMER: This is a template and not legal advice. The Developers are not lawyers. You are advised to consult with a legal professional to ensure this EULA meets your specific needs and is in full compliance with all applicable laws.',
  ],
};
const renderList = (points, level = 0) => {
  return (
    <Box component="ul" sx={{ p: 0, pl: level > 0 ? 2 : 0, m: 0, listStylePosition: 'inside' }}>
      {points.map((point, index) => {
        if (typeof point === 'string') {
          return (
            <Box component="li" key={index} sx={{ display: 'list-item', listStyleType: level % 2 === 0 ? 'disc' : 'circle', pl: 1, mb: 1 }}>
              <Typography variant="body2" component="span">
                {point}
              </Typography>
            </Box>
          );
        }
        if (Array.isArray(point)) {
          return (
             <Box key={index} sx={{ pl: 2, mt: 1 }}>
                {renderList(point, level + 1)}
             </Box>
          );
        }
        return null;
      })}
    </Box>
  );
};
const renderContent = (content) => {
  return content.map((item, index) => {
    if (typeof item === 'string') {
      const isDisclaimer = item.startsWith('LEGAL DISCLAIMER');
      return (
        <Typography key={index} variant="body2" paragraph
          sx={{
            fontWeight: isDisclaimer ? 'bold' : 'normal',
            color: isDisclaimer ? 'secondary.main' : 'text.primary',
            mt: isDisclaimer ? 2 : 0
          }}>
          {item}
        </Typography>
      );
    }
    if (item.heading) {
      return (
        <Box key={index} sx={{ mt: 2, mb: 1 }}>
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.1rem' }} gutterBottom>
            {item.heading}
          </Typography>
          {item.points && renderList(item.points)}
        </Box>
      );
    }
    return null;
  });
};
const DisclaimerModal = ({ open, onAgree }) => {
  return (
    <Dialog open={open} aria-labelledby="disclaimer-dialog-title" maxWidth="md" fullWidth>
      <DialogTitle id="disclaimer-dialog-title">{EULA_TEXT.title}</DialogTitle>
      <DialogContent dividers>
        {renderContent(EULA_TEXT.paragraphs)}
      </DialogContent>
      <DialogActions>
        <Button onClick={onAgree} color="primary" variant="contained">
          I Agree and Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default DisclaimerModal;