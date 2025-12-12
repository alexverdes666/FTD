import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": process.env,
  },
  build: {
    outDir: "dist",
    sourcemap: false, // Disabled for production performance
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          mui: [
            "@mui/material",
            "@mui/icons-material",
            "@mui/x-data-grid",
            "@mui/x-date-pickers",
          ],
          redux: ["@reduxjs/toolkit", "react-redux", "redux-persist"],
          charts: ["chart.js", "react-chartjs-2", "recharts"],
          utils: ["axios", "dayjs", "date-fns", "lodash.debounce", "yup"],
          ui: [
            "framer-motion",
            "react-hook-form",
            "@hookform/resolvers",
            "react-hot-toast",
            "emoji-picker-react",
            "react-dropzone",
          ],
          router: ["react-router-dom"],
          socket: ["socket.io-client"],
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
    port: 3000,
    open: false,
    allowedHosts: [".ngrok.io", ".ngrok-free.app", "localhost", "127.0.0.1"],
  },
  preview: {
    host: true,
    port: 3000,
  },
  define: {
    __API_URL__: JSON.stringify(
      process.env.VITE_API_URL || "https://ftd-backend.onrender.com/api"
    ),
  },
});
