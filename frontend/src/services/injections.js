import api from "./api";

export const createInjections = (data) =>
  api.post("/injections", data);

export const getInjections = (params = {}) =>
  api.get("/injections", { params });

export const updateInjectionStatus = (id, data) =>
  api.patch(`/injections/${id}/status`, data);

export const getInjectionStatusesByOrder = (orderId) =>
  api.get(`/injections/by-order/${orderId}`);
