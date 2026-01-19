// lib/socket.ts
import { Platform } from 'react-native';

// Your Render URL
export const SOCKET_URL = 'https://gps-tracking-system-for-ambulance-1.onrender.com';

// For local development vs production
export const getSocketUrl = () => {
  return SOCKET_URL;
};