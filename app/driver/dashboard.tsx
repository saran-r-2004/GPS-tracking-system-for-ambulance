import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const SOCKET_URL = 'http://10.98.28.101:5000';

interface LocationType {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export default function DriverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [driverData, setDriverData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationType | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState<any>(null);
  const [trackingUser, setTrackingUser] = useState<any>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('emergencies');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distance, setDistance] = useState<string>('--');
  const [eta, setEta] = useState<string>('--');
  const [patientDetails, setPatientDetails] = useState<any>(null);
  const [locationShared, setLocationShared] = useState(false);
  
  const socketRef = useRef<any>(null);
  const mapRef = useRef<MapView>(null);
  const locationInterval = useRef<any>(null);

  const ambulanceId = driverData?.ambulanceId || 'AMB-001';

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'Please enable location services to use the ambulance tracking.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      setLocationError(null);
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      setLocationError('Location service error');
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Unable to get location');
      return null;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return '--';
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  const calculateETA = (distanceKm: number): string => {
    if (!distanceKm || distanceKm <= 0) return '--';
    
    const avgSpeed = 40;
    const etaMinutes = Math.round((distanceKm / avgSpeed) * 60);
    return etaMinutes > 0 ? etaMinutes.toString() : '5';
  };

  useEffect(() => {
    const initDriver = async () => {
      const data = params.driverData 
        ? (typeof params.driverData === 'string' ? JSON.parse(params.driverData) : params.driverData)
        : {
            ambulanceId: 'AMB-001',
            driverName: 'Siva',
            phone: '9876543210',
            vehicleType: 'Advanced Life Support'
          };
      
      setDriverData(data);
      
      const initialLocation = await getCurrentLocation();
      if (initialLocation) {
        setDriverLocation(initialLocation);
        connectToServer(data, initialLocation);
      } else {
        const defaultLocation = {
          latitude: 10.8998,
          longitude: 76.9962,
          timestamp: Date.now(),
        };
        setDriverLocation(defaultLocation);
        connectToServer(data, defaultLocation);
      }
    };

    initDriver();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, []);

  useEffect(() => {
    if (driverLocation && userLocation) {
      const dist = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        userLocation.latitude,
        userLocation.longitude
      );
      setDistance(dist);
      setEta(calculateETA(parseFloat(dist)));
    }
  }, [driverLocation, userLocation]);

  const connectToServer = (driverInfo: any, initialLocation: any) => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Driver connected to server');
      setConnected(true);
      
      socket.emit('driver-join', {
        ambulanceId: driverInfo.ambulanceId,
        driverName: driverInfo.driverName,
        location: initialLocation,
        phone: driverInfo.phone
      });
      
      startLocationSharing(driverInfo.ambulanceId);
    });

    socket.on('connect_error', (error) => {
      console.log('❌ Connection error:', error);
      setConnected(false);
    });

    socket.on('new-emergency', (data) => {
      console.log('🚨 New emergency received:', data);
      setEmergencies(prev => [data, ...prev.slice(0, 9)]);
      
      Alert.alert(
        '🚨 NEW EMERGENCY',
        `${data.userName || 'Patient'} needs assistance`,
        [
          { text: 'View Details', onPress: () => {
            setSelectedEmergency(data);
            setShowEmergencyModal(true);
          }},
          { text: 'Ignore', style: 'cancel' }
        ]
      );
    });

    // Add these event listeners in the dashboard socket connection:
    socket.on('patient-location-shared', (data: any) => {
      console.log('📍 Patient location shared:', data);
      
      // Add to emergencies list for display
      setEmergencies(prev => [{
        emergencyId: `LOC-${Date.now()}`,
        userId: data.userId,
        userName: data.userName,
        phone: 'Not provided',
        location: data.location,
        emergencyType: 'Patient Location Shared',
        patientCondition: 'Unknown',
        isLocationOnly: true,
        timestamp: data.timestamp
      }, ...prev]);
      
      Alert.alert(
        '📍 Patient Location Shared',
        `${data.userName || 'A patient'} has shared their location with you.`,
        [
          { 
            text: 'View Location', 
            onPress: () => {
              setUserLocation(data.location);
              setTrackingUser({
                userId: data.userId,
                name: data.userName || 'Patient',
                phone: 'Not provided',
                condition: 'Location shared'
              });
              setActiveTab('patient');
              
              // Update map view
              if (driverLocation && mapRef.current) {
                setTimeout(() => {
                  mapRef.current?.fitToCoordinates(
                    [driverLocation, data.location],
                    {
                      edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                      animated: true,
                    }
                  );
                }, 500);
              }
            }
          },
          { text: 'OK' }
        ]
      );
    });

    socket.on('patient-details-updated', (data: any) => {
      console.log('📋 Patient details updated:', data);
      
      // Update existing patient info without alert
      if (trackingUser?.userId === data.userId) {
        setTrackingUser(prev => ({
          ...prev,
          name: data.userName,
          phone: data.phone,
          condition: data.patientCondition
        }));
      }
      
      // Update patient details state
      setPatientDetails(data);
      
      // Show subtle notification instead of alert
      console.log('Patient details updated:', data.userName);
    });

    socket.on('patient-details-update', (data) => {
      console.log('📋 Patient details received:', data);
      setPatientDetails(data);
      
      Alert.alert(
        '📋 Patient Information',
        `${data.userName} has shared their details.\nCondition: ${data.patientCondition}`,
        [
          { text: 'View', onPress: () => {
            setTrackingUser({
              userId: data.userId,
              name: data.userName,
              phone: data.phone,
              condition: data.patientCondition
            });
            setActiveTab('patient');
          }},
          { text: 'OK' }
        ]
      );
    });

    socket.on('distance-update-driver', (data: any) => {
      console.log('📍 Distance update received:', data);
      setDistance(data.distance);
      setEta(data.eta);
      
      if (data.userLocation && mapRef.current) {
        // Update map view
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [driverLocation, data.userLocation],
            {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            }
          );
        }, 500);
      }
    });

    socket.on('user-location', (data) => {
      console.log('📍 User location update:', data);
      const newUserLocation = {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp
      };
      setUserLocation(newUserLocation);
      
      if (selectedEmergency) {
        setTrackingUser({
          userId: selectedEmergency.userId,
          name: selectedEmergency.userName || 'Patient',
          phone: selectedEmergency.phone || 'Unknown',
          condition: selectedEmergency.patientCondition || 'Unknown'
        });
      }
      
      if (driverLocation && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [driverLocation, newUserLocation],
            {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            }
          );
        }, 1000);
      }
    });

    socket.on('emergency-accepted-driver', (data) => {
      Alert.alert('✅ Emergency Accepted', `You are now tracking ${data.userName || 'the patient'}.`, [
        { text: 'OK' }
      ]);
      setActiveTab('patient');
    });

    setLoading(false);
  };

  const startLocationSharing = async (ambulanceId: string) => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Location Error', 'Cannot start sharing location without permission');
      return;
    }

    locationInterval.current = setInterval(async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        const locData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        };
        
        setDriverLocation(locData);
        
        if (socketRef.current?.connected) {
          socketRef.current.emit('driver-location-update', {
            ambulanceId,
            latitude: locData.latitude,
            longitude: locData.longitude,
            timestamp: locData.timestamp,
            driverName: driverData?.driverName
          });
          console.log('📍 Location shared:', locData);
        }
      } catch (error) {
        console.error('Location sharing error:', error);
      }
    }, 3000);

    setSharing(true);
    Alert.alert('Location Sharing', 'Your location is now being shared with patients');
  };

  const stopLocationSharing = () => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
    setSharing(false);
    Alert.alert('Location Sharing', 'Location sharing stopped');
  };

  const acceptEmergency = async (emergency: any) => {
    if (!socketRef.current || !driverData) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    try {
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        setDriverLocation(currentLocation);
      }

      socketRef.current.emit('accept-emergency', {
        emergencyId: emergency.emergencyId,
        ambulanceId: driverData.ambulanceId,
        driverName: driverData.driverName,
        driverLocation: currentLocation || driverLocation
      });

      socketRef.current.emit('start-tracking-user', {
        ambulanceId: driverData.ambulanceId,
        userId: emergency.userId
      });

      setTrackingUser({
        userId: emergency.userId,
        name: emergency.userName || 'Patient',
        phone: emergency.phone || 'Unknown',
        condition: emergency.patientCondition || 'Unknown'
      });

      setUserLocation(emergency.location);
      setSelectedEmergency(null);
      setShowEmergencyModal(false);
      setActiveTab('patient');

      Alert.alert(
        '✅ Emergency Accepted',
        `You are now tracking ${emergency.userName || 'the patient'}.`,
        [{ text: 'OK' }]
      );

      if (emergency.location && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [driverLocation || currentLocation, emergency.location],
            {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            }
          );
        }, 500);
      }
    } catch (error) {
      console.error('Accept emergency error:', error);
      Alert.alert('Error', 'Failed to accept emergency');
    }
  };

  const navigateToPatient = () => {
    if (!userLocation) {
      Alert.alert('No Destination', 'Patient location not available');
      return;
    }
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${userLocation.latitude},${userLocation.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Cannot open navigation app');
    });
  };

  const callPatient = () => {
    const phoneNumber = trackingUser?.phone || patientDetails?.phone || '+919876543210';
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Cannot make phone call');
    });
  };

  const handleLogout = () => {
    if (socketRef.current) socketRef.current.disconnect();
    if (locationInterval.current) clearInterval(locationInterval.current);
    router.replace('/driver/login');
  };

  const getInitialRegion = (): Region => {
    if (driverLocation) {
      return {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };
    }
    
    return {
      latitude: 10.8998,
      longitude: 76.9962,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={styles.loadingText}>Initializing Dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF3B30" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Ambulance Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              {driverData?.ambulanceId} • {driverData?.driverName}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.statusIndicator}
            onPress={() => sharing ? stopLocationSharing() : startLocationSharing(ambulanceId)}
          >
            <View style={[styles.statusDot, { backgroundColor: sharing ? '#4CD964' : '#FF3B30' }]} />
            <Text style={styles.statusText}>{sharing ? 'ONLINE' : 'OFFLINE'}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Feather name="alert-triangle" size={18} color="#FFF" />
            <Text style={styles.statValue}>{emergencies.length}</Text>
            <Text style={styles.statLabel}>Emergencies</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statCard}>
            <Feather name="map-pin" size={18} color={sharing ? '#4CD964' : '#FFF'} />
            <Text style={styles.statValue}>{sharing ? 'ON' : 'OFF'}</Text>
            <Text style={styles.statLabel}>Sharing</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statCard}>
            <Feather name="clock" size={18} color="#FFF" />
            <Text style={styles.statValue}>24/7</Text>
            <Text style={styles.statLabel}>Service</Text>
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Map Section */}
        <View style={styles.mapSection}>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={getInitialRegion()}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
            >
              {/* Driver Marker - FIXED CENTERED CIRCLE */}
              {driverLocation && (
                <Marker
                  coordinate={driverLocation}
                  title="Your Location"
                  description={`Ambulance: ${driverData?.ambulanceId}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.marker, styles.driverMarker]}>
                      <FontAwesome5 name="ambulance" size={18} color="#FFF" />
                    </View>
                  </View>
                </Marker>
              )}

              {/* Patient Marker - FIXED CENTERED CIRCLE */}
              {userLocation && (
                <Marker
                  coordinate={userLocation}
                  title="Patient Location"
                  description={trackingUser?.name || 'Emergency'}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.marker, styles.patientMarker]}>
                      <Feather name="user" size={18} color="#FFF" />
                    </View>
                  </View>
                </Marker>
              )}

              {/* Connection Line */}
              {driverLocation && userLocation && (
                <Polyline
                  coordinates={[driverLocation, userLocation]}
                  strokeColor="#FF3B30"
                  strokeWidth={3}
                  lineDashPattern={[10, 10]}
                />
              )}
            </MapView>

            {/* Map Controls */}
            <View style={styles.mapControls}>
              <TouchableOpacity 
                style={styles.mapControlButton}
                onPress={() => {
                  if (driverLocation && mapRef.current) {
                    mapRef.current.animateToRegion({
                      ...driverLocation,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }, 500);
                  }
                }}
              >
                <Feather name="target" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Distance Info - ADDED SPACING */}
          {userLocation && driverLocation && (
            <View style={styles.distanceCard}>
              <View style={styles.distanceHeader}>
                <Feather name="navigation" size={16} color="#FF3B30" />
                <Text style={styles.distanceLabel}>Distance to Patient</Text>
              </View>
              <View style={styles.distanceContent}>
                <Text style={styles.distanceValue}>{distance} km</Text>
                <View style={styles.etaContainer}>
                  <Feather name="clock" size={12} color="#8E8E93" />
                  <Text style={styles.etaText}>ETA: {eta} min</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ADDED SPACING BETWEEN DISTANCE CARD AND TAB NAVIGATION */}
        <View style={{ height: 16 }} />

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'emergencies' && styles.activeTab]}
            onPress={() => setActiveTab('emergencies')}
          >
            <Feather 
              name="alert-triangle" 
              size={20} 
              color={activeTab === 'emergencies' ? '#FF3B30' : '#8E8E93'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'emergencies' && styles.activeTabText
            ]}>
              Emergencies
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'patient' && styles.activeTab]}
            onPress={() => setActiveTab('patient')}
            disabled={!trackingUser && !patientDetails}
          >
            <Feather 
              name="user" 
              size={20} 
              color={activeTab === 'patient' ? '#FF3B30' : '#8E8E93'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'patient' && styles.activeTabText
            ]}>
              Patient
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'status' && styles.activeTab]}
            onPress={() => setActiveTab('status')}
          >
            <Feather 
              name="activity" 
              size={20} 
              color={activeTab === 'status' ? '#FF3B30' : '#8E8E93'} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'status' && styles.activeTabText
            ]}>
              Status
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'emergencies' && (
          <View style={styles.tabContent}>
            {emergencies.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={48} color="#4CD964" />
                <Text style={styles.emptyStateTitle}>No Active Emergencies</Text>
                <Text style={styles.emptyStateText}>You're all caught up!</Text>
              </View>
            ) : (
              emergencies.map((emergency, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.emergencyItem}
                  onPress={() => {
                    setSelectedEmergency(emergency);
                    setShowEmergencyModal(true);
                  }}
                >
                  <View style={styles.emergencyHeader}>
                    <View style={styles.emergencyIcon}>
                      <Feather name="alert-triangle" size={16} color="#FF9500" />
                    </View>
                    <View style={styles.emergencyInfo}>
                      <Text style={styles.emergencyTitle}>Emergency Request</Text>
                      <Text style={styles.emergencyPatient}>
                        {emergency.userName || 'Unknown Patient'}
                      </Text>
                      <Text style={styles.emergencyPhone}>{emergency.phone || 'No phone'}</Text>
                    </View>
                    <Text style={styles.emergencyTime}>
                      {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </View>
                  <View style={styles.emergencyActions}>
                    <TouchableOpacity 
                      style={styles.acceptButton}
                      onPress={() => acceptEmergency(emergency)}
                    >
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        
        {activeTab === 'patient' && (trackingUser || patientDetails) && (
          <View style={styles.tabContent}>
            <View style={styles.patientSection}>
              <View style={styles.patientHeader}>
                <View style={styles.patientAvatar}>
                  <Feather name="user" size={24} color="#FF3B30" />
                </View>
                <View style={styles.patientDetails}>
                  <Text style={styles.patientName}>{trackingUser?.name || patientDetails?.userName}</Text>
                  <Text style={styles.patientPhone}>{trackingUser?.phone || patientDetails?.phone}</Text>
                  <View style={styles.conditionBadge}>
                    <Feather name="heart" size={12} color="#FFF" />
                    <Text style={styles.conditionBadgeText}>
                      Condition: {trackingUser?.condition || patientDetails?.patientCondition || 'Unknown'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {patientDetails && (
                <View style={styles.patientInfoCard}>
                  <Text style={styles.patientInfoTitle}>Patient Information</Text>
                  <View style={styles.infoRow}>
                    <Feather name="user" size={14} color="#8E8E93" />
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>{patientDetails.userName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="phone" size={14} color="#8E8E93" />
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{patientDetails.phone}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="activity" size={14} color="#8E8E93" />
                    <Text style={styles.infoLabel}>Condition:</Text>
                    <Text style={styles.infoValue}>{patientDetails.patientCondition}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="clock" size={14} color="#8E8E93" />
                    <Text style={styles.infoLabel}>Shared:</Text>
                    <Text style={styles.infoValue}>
                      {new Date(patientDetails.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              )}
              
              <View style={styles.patientActions}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.callButton]}
                  onPress={callPatient}
                >
                  <Feather name="phone" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Call Patient</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, styles.navigateButton]}
                  onPress={navigateToPatient}
                  disabled={!userLocation}
                >
                  <Feather name="navigation" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Navigate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        
        {activeTab === 'status' && (
          <View style={styles.tabContent}>
            <View style={styles.statusSection}>
              <View style={styles.statusCard}>
                <Feather name="wifi" size={24} color={connected ? '#4CD964' : '#FF3B30'} />
                <Text style={styles.statusCardTitle}>Connection</Text>
                <Text style={styles.statusCardValue}>{connected ? 'Connected' : 'Disconnected'}</Text>
              </View>
              
              <View style={styles.statusCard}>
                <Feather name="map-pin" size={24} color={sharing ? '#4CD964' : '#FF9500'} />
                <Text style={styles.statusCardTitle}>Location Sharing</Text>
                <Text style={styles.statusCardValue}>{sharing ? 'Active' : 'Inactive'}</Text>
              </View>
              
              <View style={styles.statusCard}>
                <Feather name="truck" size={24} color="#FF3B30" />
                <Text style={styles.statusCardTitle}>Ambulance ID</Text>
                <Text style={styles.statusCardValue}>{driverData?.ambulanceId}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={() => setShowLogoutConfirm(true)}
              >
                <Feather name="log-out" size={20} color="#FF3B30" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Emergency Details Modal */}
      <Modal
        visible={showEmergencyModal}
        transparent={true}
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Emergency Details</Text>
              <TouchableOpacity onPress={() => setShowEmergencyModal(false)}>
                <Feather name="x" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            {selectedEmergency && (
              <ScrollView style={styles.modalContent}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Patient Information</Text>
                  <View style={styles.detailRow}>
                    <Feather name="user" size={18} color="#8E8E93" />
                    <Text style={styles.detailValue}>
                      {selectedEmergency.userName || 'Not specified'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Feather name="phone" size={18} color="#8E8E93" />
                    <Text style={styles.detailValue}>
                      {selectedEmergency.phone || 'Not specified'}
                    </Text>
                  </View>
                </View>
                
                {driverLocation && selectedEmergency.location && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={styles.distanceLarge}>
                      {calculateDistance(
                        driverLocation.latitude,
                        driverLocation.longitude,
                        selectedEmergency.location.latitude,
                        selectedEmergency.location.longitude
                      )} km away
                    </Text>
                  </View>
                )}
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowEmergencyModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.acceptButton]}
                    onPress={() => acceptEmergency(selectedEmergency)}
                  >
                    <Feather name="check-circle" size={18} color="#FFF" />
                    <Text style={styles.acceptButtonText}>Accept Emergency</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.logoutModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Logout</Text>
              <TouchableOpacity onPress={() => setShowLogoutConfirm(false)}>
                <Feather name="x" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.logoutContent}>
              <Feather name="log-out" size={48} color="#FF3B30" />
              <Text style={styles.logoutTitle}>Are you sure?</Text>
              <Text style={styles.logoutMessage}>
                You will stop receiving emergency requests and location sharing will be disabled.
              </Text>
              
              <View style={styles.logoutActions}>
                <TouchableOpacity 
                  style={[styles.logoutActionButton, styles.cancelLogoutButton]}
                  onPress={() => setShowLogoutConfirm(false)}
                >
                  <Text style={styles.cancelLogoutText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.logoutActionButton, styles.confirmLogoutButton]}
                  onPress={handleLogout}
                >
                  <Text style={styles.confirmLogoutText}>Yes, Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: 'System',
  },
  header: {
    backgroundColor: '#FF3B30',
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: 'System',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    fontFamily: 'System',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    fontFamily: 'System',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginVertical: 4,
    fontFamily: 'System',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'System',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  mapSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mapContainer: {
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    gap: 8,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  distanceCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginTop: 16, // INCREASED SPACING
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  distanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: 'System',
  },
  distanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FF3B30',
    fontFamily: 'System',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  etaText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: 'System',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  driverMarker: {
    backgroundColor: '#FF3B30',
  },
  patientMarker: {
    backgroundColor: '#007AFF',
  },
  tabNavigation: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    fontFamily: 'System',
  },
  activeTabText: {
    color: '#FF3B30',
  },
  tabContent: {
    marginHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'System',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: 'System',
  },
  emergencyItem: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,149,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emergencyInfo: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
    fontFamily: 'System',
  },
  emergencyPatient: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
    fontFamily: 'System',
  },
  emergencyPhone: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'System',
  },
  emergencyTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: 'System',
  },
  emergencyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  acceptButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'System',
  },
  patientSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  patientAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,59,48,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: 'System',
  },
  patientPhone: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
    fontFamily: 'System',
  },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  conditionBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'System',
  },
  patientInfoCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  patientInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: 'System',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    minWidth: 70,
    fontFamily: 'System',
  },
  infoValue: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
    fontFamily: 'System',
  },
  patientActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  callButton: {
    backgroundColor: '#4CD964',
  },
  navigateButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  statusSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statusCard: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    marginBottom: 16,
  },
  statusCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'System',
  },
  statusCardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: 'System',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  logoutModal: {
    maxHeight: 'auto',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: 'System',
  },
  modalContent: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: 'System',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  detailValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: 'System',
  },
  distanceLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF3B30',
    fontFamily: 'System',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  acceptButton: {
    backgroundColor: '#FF3B30',
  },
  logoutContent: {
    padding: 40,
    alignItems: 'center',
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 20,
    marginBottom: 12,
    fontFamily: 'System',
  },
  logoutMessage: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    fontFamily: 'System',
  },
  logoutActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutActionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelLogoutButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelLogoutText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  confirmLogoutButton: {
    backgroundColor: '#FF3B30',
  },
  confirmLogoutText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
});