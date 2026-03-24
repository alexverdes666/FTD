import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone as PhoneIcon,
  CardGiftcard as BonusIcon,
  AccountTree as TreeIcon,
  ListAlt as ListIcon,
  PendingActions as PendingIcon,
} from '@mui/icons-material';

const NODE_COLORS = {
  agentCalls: { bg: '#e3f2fd', border: '#1976d2', icon: '#1565c0', glow: 'rgba(25, 118, 210, 0.25)' },
  callBonuses: { bg: '#e8f5e9', border: '#2e7d32', icon: '#1b5e20', glow: 'rgba(46, 125, 50, 0.25)' },
  allDeclarations: { bg: '#e8f5e9', border: '#43a047', icon: '#2e7d32', glow: 'rgba(67, 160, 71, 0.2)' },
  pendingApprovals: { bg: '#fff3e0', border: '#ef6c00', icon: '#e65100', glow: 'rgba(239, 108, 0, 0.2)' },
};

const NODE_ICONS = {
  agentCalls: PhoneIcon,
  callBonuses: BonusIcon,
  allDeclarations: ListIcon,
  pendingApprovals: PendingIcon,
};

const PayrollTreeNav = ({ sections, onSelect, pendingCount = 0 }) => {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const rootRef = useRef(null);
  const nodeRefs = useRef({});
  const [lines, setLines] = useState([]);

  // Build edges for lines
  const edges = [];
  sections.forEach((section) => {
    edges.push({ from: 'root', to: section.id });
    if (section.children) {
      section.children.forEach((child) => {
        edges.push({ from: section.id, to: child.id });
      });
    }
  });

  const calculateLines = useCallback(() => {
    const containerEl = document.querySelector('[data-tree-container]');
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();

    const getRect = (id) => {
      const el = id === 'root' ? rootRef.current : nodeRefs.current[id];
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - containerRect.left,
        yTop: rect.top - containerRect.top,
        yBottom: rect.top + rect.height - containerRect.top,
      };
    };

    const newLines = edges.map((edge) => {
      const from = getRect(edge.from);
      const to = getRect(edge.to);
      if (!from || !to) return null;
      return {
        x1: from.x,
        y1: from.yBottom,
        x2: to.x,
        y2: to.yTop,
        id: `${edge.from}-${edge.to}`,
        toId: edge.to,
        fromId: edge.from,
      };
    }).filter(Boolean);

    setLines(newLines);
  }, [edges.length]);

  // Recalculate lines multiple times to catch nodes mid-animation and after settling
  useEffect(() => {
    const timers = [
      setTimeout(calculateLines, 100),
      setTimeout(calculateLines, 350),
      setTimeout(calculateLines, 700),
    ];
    window.addEventListener('resize', calculateLines);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', calculateLines);
    };
  }, [calculateLines]);

  const handleNodeClick = (nodeId) => {
    setSelectedNode(nodeId);
    setTimeout(() => onSelect(nodeId), 450);
  };

  const renderNode = (node, delay, isChild = false) => {
    const colors = NODE_COLORS[node.id] || NODE_COLORS.agentCalls;
    const IconComp = NODE_ICONS[node.id] || PhoneIcon;
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;
    const showBadge = node.id === 'pendingApprovals' && pendingCount > 0;

    return (
      <motion.div
        key={node.id}
        ref={(el) => (nodeRefs.current[node.id] = el)}
        initial={{ opacity: 0, y: 20 }}
        animate={
          isSelected
            ? { opacity: 0, scale: 1.15, y: -10 }
            : selectedNode && selectedNode !== node.id
              ? { opacity: 0, scale: 0.95, y: 10 }
              : { opacity: 1, y: 0, scale: 1 }
        }
        transition={{
          duration: isSelected || selectedNode ? 0.3 : 0.35,
          delay: isSelected || selectedNode ? 0 : delay,
          ease: 'easeOut',
        }}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={() => handleNodeClick(node.id)}
        style={{ cursor: 'pointer', zIndex: 1, position: 'relative' }}
      >
        <Paper
          elevation={isHovered ? 6 : 0}
          sx={{
            px: isChild ? 2.5 : 3,
            py: isChild ? 1.5 : 2,
            borderRadius: 2.5,
            border: `1.5px solid ${isHovered ? colors.border : '#e0e0e0'}`,
            bgcolor: isHovered ? colors.bg : '#fff',
            transition: 'all 0.2s ease',
            boxShadow: isHovered ? `0 6px 24px ${colors.glow}` : '0 1px 4px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            minWidth: isChild ? 120 : 140,
            position: 'relative',
            overflow: 'hidden',
            '&::after': isHovered ? {
              content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
              background: colors.border, borderRadius: '2.5px 2.5px 0 0',
            } : {},
          }}
        >
          <Box
            sx={{
              width: isChild ? 34 : 40,
              height: isChild ? 34 : 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: isHovered ? colors.border : colors.bg,
              transition: 'all 0.2s ease',
            }}
          >
            <IconComp sx={{ fontSize: isChild ? 17 : 20, color: isHovered ? '#fff' : colors.icon, transition: 'color 0.2s ease' }} />
          </Box>
          <Typography
            variant="body2"
            fontWeight={600}
            color={isHovered ? colors.border : 'text.primary'}
            sx={{ fontSize: isChild ? '0.78rem' : '0.82rem', textAlign: 'center', transition: 'color 0.2s ease', lineHeight: 1.3 }}
          >
            {node.label}
          </Typography>
          {node.description && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', textAlign: 'center', lineHeight: 1.2 }}>
              {node.description}
            </Typography>
          )}
          {showBadge && (
            <Chip label={pendingCount} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', mt: -0.5 }} />
          )}
        </Paper>
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {!selectedNode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
        >
          <Box
            data-tree-container
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: { xs: 3, sm: 5 },
              minHeight: 300,
              userSelect: 'none',
            }}
          >
            {/* SVG connecting lines */}
            <svg
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none', overflow: 'visible',
              }}
            >
              {lines.map((line, i) => {
                const midY = line.y1 + (line.y2 - line.y1) * 0.45;
                const path = `M ${line.x1} ${line.y1} C ${line.x1} ${midY}, ${line.x2} ${midY}, ${line.x2} ${line.y2}`;
                const isHovered = hoveredNode === line.toId;
                const hoverColor = NODE_COLORS[line.toId]?.border || '#78909c';
                return (
                  <motion.path
                    key={line.id}
                    d={path}
                    fill="none"
                    stroke={isHovered ? hoverColor : '#90a4ae'}
                    strokeWidth={isHovered ? 2.5 : 2}
                    strokeLinecap="round"
                    strokeOpacity={isHovered ? 1 : 0.55}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease: 'easeOut' }}
                  />
                );
              })}
            </svg>

            {/* Root Node */}
            <motion.div
              ref={rootRef}
              initial={{ opacity: 0, y: -15 }}
              animate={selectedNode ? { opacity: 0 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: 2.5, py: 1, borderRadius: 2.5,
                  bgcolor: '#fff', border: '1.5px solid #e0e0e0',
                  boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
                }}
              >
                <TreeIcon sx={{ fontSize: 18, color: '#546e7a' }} />
                <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ letterSpacing: 0.3 }}>
                  Payroll
                </Typography>
              </Box>
            </motion.div>

            {/* Level 1 spacer */}
            <Box sx={{ height: { xs: 40, sm: 55 } }} />

            {/* Level 1: Main branches */}
            <Box sx={{ display: 'flex', gap: { xs: 3, sm: 5 }, flexWrap: 'wrap', justifyContent: 'center' }}>
              {sections.map((section, i) => {
                if (section.children && section.children.length > 0) {
                  return (
                    <Box key={section.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {renderNode(section, 0.15 + i * 0.08)}
                      <Box sx={{ height: { xs: 35, sm: 45 } }} />
                      <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3 }, justifyContent: 'center' }}>
                        {section.children.map((child, j) => renderNode(child, 0.3 + j * 0.08, true))}
                      </Box>
                    </Box>
                  );
                }
                return renderNode(section, 0.15 + i * 0.08);
              })}
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PayrollTreeNav;
