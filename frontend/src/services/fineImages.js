import api from "./api";
import { store } from "../store/store";

// Get API URL
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
};

// Get auth token for image URLs
const getAuthToken = () => {
  const state = store.getState();
  return state.auth.token;
};

// Upload fine image
export const uploadFineImage = async (imageFile, fineId = null, onUploadProgress = null) => {
  try {
    const formData = new FormData();
    formData.append("image", imageFile);
    if (fineId) {
      formData.append("fineId", fineId);
    }

    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    };

    if (onUploadProgress) {
      config.onUploadProgress = onUploadProgress;
    }

    const response = await api.post("/fine-images/upload", formData, config);
    return response.data;
  } catch (error) {
    console.error("Error uploading fine image:", error);
    throw error;
  }
};

// Get fine images list
export const getFineImages = async (fineId) => {
  try {
    const response = await api.get(`/fine-images/fine/${fineId}`);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching fine images:", error);
    throw error;
  }
};

// Get image info
export const getFineImageInfo = async (imageId) => {
  try {
    const response = await api.get(`/fine-images/${imageId}/info`);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching fine image info:", error);
    throw error;
  }
};

// Delete fine image
export const deleteFineImage = async (imageId) => {
  try {
    const response = await api.delete(`/fine-images/${imageId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting fine image:", error);
    throw error;
  }
};

// Get image URL with auth token
export const getFineImageUrl = (imageId) => {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  return `${apiUrl}/fine-images/${imageId}?token=${encodeURIComponent(token)}`;
};

// Get thumbnail URL with auth token
export const getFineImageThumbnailUrl = (imageId) => {
  const token = getAuthToken();
  const apiUrl = getApiUrl();
  return `${apiUrl}/fine-images/${imageId}/thumbnail?token=${encodeURIComponent(token)}`;
};

// Validate image file before upload
export const validateImageFile = (file) => {
  const errors = [];
  const maxSize = 50 * 1024 * 1024; // 50MB
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (!file) {
    errors.push("No file selected");
    return { valid: false, errors };
  }

  if (!allowedTypes.includes(file.type)) {
    errors.push("Invalid file type. Allowed: JPEG, PNG, GIF, WebP");
  }

  if (file.size > maxSize) {
    errors.push("File size exceeds 50MB limit");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export default {
  uploadFineImage,
  getFineImages,
  getFineImageInfo,
  deleteFineImage,
  getFineImageUrl,
  getFineImageThumbnailUrl,
  validateImageFile,
  formatFileSize,
};
