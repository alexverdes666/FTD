import React from "react";
import {
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

// Generic Info List Dialog - replaces 4 near-identical display dialogs
const InfoListDialog = ({
  open,
  onClose,
  title,
  subtitle,
  items,
  columns,
  emptyMessage,
}) => {
  if (!open) return null;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {title}
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            for {subtitle}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {items.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.header}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Typography
                          variant="body2"
                          color={col.secondary ? "text.secondary" : undefined}
                        >
                          {col.render ? col.render(item) : (item[col.key] || "-")}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Client Brokers Display Dialog
export const ClientBrokersDisplayDialog = ({ dialog, onClose }) => (
  <InfoListDialog
    open={dialog.open}
    onClose={onClose}
    title="Client Brokers"
    subtitle={dialog.leadName}
    items={dialog.brokers}
    columns={[
      { key: "name", header: "Broker Name", render: (broker) => broker.name || "-" },
      { key: "domain", header: "Domain", secondary: true, render: (broker) => broker.domain || "-" },
    ]}
    emptyMessage="No client brokers assigned"
  />
);

// Client Networks Display Dialog
export const ClientNetworksDisplayDialog = ({ dialog, onClose }) => (
  <InfoListDialog
    open={dialog.open}
    onClose={onClose}
    title="Client Networks"
    subtitle={dialog.leadName}
    items={dialog.networks}
    columns={[
      { key: "name", header: "Network Name", render: (entry) => entry.clientNetwork?.name || "-" },
      {
        key: "assignedAt",
        header: "Assigned At",
        secondary: true,
        render: (entry) => entry.assignedAt ? new Date(entry.assignedAt).toLocaleString() : "-",
      },
    ]}
    emptyMessage="No client networks assigned"
  />
);

// Our Networks Display Dialog
export const OurNetworksDisplayDialog = ({ dialog, onClose }) => (
  <InfoListDialog
    open={dialog.open}
    onClose={onClose}
    title="Our Networks"
    subtitle={dialog.leadName}
    items={dialog.networks}
    columns={[
      { key: "name", header: "Network Name", render: (entry) => entry.ourNetwork?.name || "-" },
      {
        key: "assignedAt",
        header: "Assigned At",
        secondary: true,
        render: (entry) => entry.assignedAt ? new Date(entry.assignedAt).toLocaleString() : "-",
      },
    ]}
    emptyMessage="No our networks assigned"
  />
);

// Campaigns Display Dialog
export const CampaignsDisplayDialog = ({ dialog, onClose }) => (
  <InfoListDialog
    open={dialog.open}
    onClose={onClose}
    title="Campaigns"
    subtitle={dialog.leadName}
    items={dialog.campaigns}
    columns={[
      { key: "name", header: "Campaign Name", render: (entry) => entry.campaign?.name || "-" },
      {
        key: "assignedAt",
        header: "Assigned At",
        secondary: true,
        render: (entry) => entry.assignedAt ? new Date(entry.assignedAt).toLocaleString() : "-",
      },
    ]}
    emptyMessage="No campaigns assigned"
  />
);
