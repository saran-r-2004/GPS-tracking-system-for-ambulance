import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Text,
  Modal,
  TextInput,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons, FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const SOCKET_URL = 'https://gps-tracking-system-for-ambulance-1.onrender.com';

interface LocationType {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

interface Ambulance {
  ambulanceId: string;
  driverName: string;
  phone: string;
  vehicleType: string;
  location: LocationType;
  lastUpdate: Date;
  distance?: string;
  eta?: string;
}

export default function TrackScreen() {
  const [ambulanceLocation, setAmbulanceLocation] = useState<LocationType | null>(null);
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState<string>('');
  const [onlineAmbulances, setOnlineAmbulances] = useState<Ambulance[]>([]);
  const [showAmbulanceList, setShowAmbulanceList] = useState(false);
  const [emergencyModal, setEmergencyModal] = useState(false);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string | null>(null);
  const [distance, setDistance] = useState<string>('--');
  const [eta, setEta] = useState<string>('--');
  
  const [patientDetails, setPatientDetails] = useState({
    name: '',
    phone: '',
    condition: 'Stable'
  });
  
  const [shareLocationModal, setShareLocationModal] = useState(false);
  
  const socketRef = useRef<any>(null);
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  
  const params = useLocalSearchParams();
  const userPhone = (params.userPhone as string) || '9876543210';
  const userId = `user_${userPhone}`;
  
  const ambulanceId = params.ambulanceId as string || null;

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        console.log("✅ Location permission granted");
        return true;
      } else {
        Alert.alert(
          "Location Permission Required",
          "This app needs location access to track ambulances.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
    } catch (error) {
      console.error("Permission error:", error);
      return false;
    }
  };

  const shareLocationWithDriver = () => {
    if (!socketRef.current || !selectedAmbulanceId || !userLocation) {
      Alert.alert('Error', 'Please select an ambulance first');
      return;
    }

    socketRef.current.emit('share-location-with-driver', {
      userId,
      ambulanceId: selectedAmbulanceId,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      timestamp: new Date().toISOString()
    });

    setShareLocationModal(false);
    
    Alert.alert(
      '📍 Location Shared',
      'Your location has been shared with the ambulance driver. Hospitals have also been notified.',
      [{ text: 'OK' }]
    );
  };

  const sendPatientDetails = () => {
    if (!socketRef.current || !selectedAmbulanceId || !userLocation) {
      Alert.alert('Error', 'Please select an ambulance first');
      return;
    }

    if (!patientDetails.name || !patientDetails.phone) {
      Alert.alert('Error', 'Please enter patient details');
      return;
    }

    socketRef.current.emit('patient-details-update', {
      userId,
      ambulanceId: selectedAmbulanceId,
      userName: patientDetails.name,
      phone: patientDetails.phone,
      location: userLocation,
      patientCondition: patientDetails.condition,
      timestamp: new Date().toISOString()
    });

    setEmergencyModal(false);
    
    Alert.alert(
      '✅ Patient Details Sent',
      'Patient information has been updated in the ambulance and hospital system.',
      [{ text: 'OK' }]
    );
  };

  const sendEmergencyRequest = () => {
    if (!socketRef.current || !userLocation) {
      Alert.alert('Error', 'Please wait for connection');
      return;
    }

    if (!patientDetails.name || !patientDetails.phone) {
      Alert.alert('Error', 'Please enter patient details first');
      return;
    }

    socketRef.current.emit('emergency-request', {
      userId,
      userName: patientDetails.name,
      phone: patientDetails.phone,
      location: userLocation,
      emergencyType: 'Medical Emergency',
      patientCondition: patientDetails.condition,
      timestamp: new Date().toISOString()
    });

    setEmergencyModal(false);
    
    Alert.alert(
      '🚨 Emergency Request Sent',
      'Emergency request has been sent to all available ambulances and hospitals.',
      [{ text: 'OK' }]
    );
  };

  const getInitialLocation = async (): Promise<LocationType | null> => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      if (params.userLat && params.userLng) {
        const userLat = parseFloat(params.userLat as string);
        const userLng = parseFloat(params.userLng as string);
        
        console.log('📍 Using location from login:', userLat, userLng);
        
        return {
          latitude: userLat,
          longitude: userLng,
          timestamp: Date.now()
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      });

      console.log('📍 Got current location:', location.coords);
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      };
    } catch (error: any) {
      console.error("Initial location error:", error);
      
      const defaultLocation = {
        latitude: 10.8998,
        longitude: 76.9962,
        timestamp: Date.now()
      };
      
      console.log('📍 Using default location:', defaultLocation);
      return defaultLocation;
    }
  };

  const startWatchingLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3000,
        },
        (newLocation) => {
          const updatedLocation: LocationType = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy,
            timestamp: newLocation.timestamp
          };
          
          setUserLocation(updatedLocation);
          
          if (socketRef.current?.connected && selectedAmbulanceId) {
            socketRef.current.emit('user-location-update', {
              userId,
              ambulanceId: selectedAmbulanceId,
              latitude: updatedLocation.latitude,
              longitude: updatedLocation.longitude,
              timestamp: new Date().toISOString()
            });
          }
        }
      );
      
      console.log("📍 Started watching location");
    } catch (error) {
      console.error("Watch location error:", error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return '--';
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    
    return distanceKm.toFixed(1);
  };

  const calculateETA = (distanceKm: number): string => {
    if (!distanceKm || distanceKm <= 0) return '--';
    
    const avgSpeed = 40;
    const etaMinutes = Math.round((distanceKm / avgSpeed) * 60);
    return etaMinutes > 0 ? etaMinutes.toString() : '5';
  };

  const initialize = async () => {
    try {
      setLoading(true);
      
      const initialLocation = await getInitialLocation();
      setUserLocation(initialLocation);
      
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ Connected to server');
        setConnected(true);
        
        socket.emit('user-join', {
          userId,
          userData: {
            phone: userPhone,
            name: 'User'
          }
        });
        
        startWatchingLocation();
      });

      socket.on('connect_error', (error) => {
        console.log('❌ Connection failed:', error.message);
        setConnected(false);
      });

      socket.on('online-ambulances', (data: Ambulance[]) => {
        console.log('🚑 Online ambulances received:', data.length);
        const ambulancesWithDistance = data.map(ambulance => {
          if (initialLocation && ambulance.location) {
            const dist = calculateDistance(
              initialLocation.latitude,
              initialLocation.longitude,
              ambulance.location.latitude,
              ambulance.location.longitude
            );
            return {
              ...ambulance,
              distance: dist,
              eta: calculateETA(parseFloat(dist))
            };
          }
          return ambulance;
        });
        setOnlineAmbulances(ambulancesWithDistance);
      });

      socket.on('online-ambulances-update', (data: Ambulance[]) => {
        const ambulancesWithDistance = data.map(ambulance => {
          if (userLocation && ambulance.location) {
            const dist = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              ambulance.location.latitude,
              ambulance.location.longitude
            );
            return {
              ...ambulance,
              distance: dist,
              eta: calculateETA(parseFloat(dist))
            };
          }
          return ambulance;
        });
        setOnlineAmbulances(ambulancesWithDistance);
      });

      socket.on('driver-location', (data: any) => {
        console.log('📍 Driver location update received:', data);
        
        if (data.latitude && data.longitude) {
          const newAmbulanceLocation: LocationType = {
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: Date.now()
          };
          
          setAmbulanceLocation(newAmbulanceLocation);
          
          if (data.driverName) {
            setDriverName(data.driverName);
          }
          
          if (data.ambulanceId && selectedAmbulanceId === data.ambulanceId) {
            setTrackingStarted(true);
          }
          
          if (userLocation) {
            const dist = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              newAmbulanceLocation.latitude,
              newAmbulanceLocation.longitude
            );
            
            setDistance(dist);
            setEta(calculateETA(parseFloat(dist)));
            
            if (mapRef.current) {
              mapRef.current.fitToCoordinates(
                [userLocation, newAmbulanceLocation],
                {
                  edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
                  animated: true,
                }
              );
            }
          }
        }
      });

      socket.on('emergency-accepted', (data: any) => {
        console.log('✅ Emergency accepted by driver:', data);
        
        Alert.alert(
          '🚑 Ambulance Accepted!',
          `${data.driverName} is on the way!\nETA: ${data.eta || '21 min'}\nDistance: ${data.distance || '14.3 km'}`,
          [{ text: 'OK', onPress: () => {
            if (data.ambulanceId) {
              selectAmbulanceById(data.ambulanceId);
            }
          }}]
        );
      });

      socket.on('ambulance-selected', (data: any) => {
        console.log('✅ Ambulance selected:', data);
        setDriverName(data.driverName);
        setAmbulanceLocation(data.location);
        setSelectedAmbulanceId(data.ambulanceId);
        setTrackingStarted(true);
        
        Alert.alert(
          'Ambulance Selected',
          `Now tracking ${data.driverName}`,
          [{ text: 'OK' }]
        );
      });

      socket.on('driver-disconnected', (data: any) => {
        Alert.alert(
          'Ambulance Offline',
          `${driverName || 'The ambulance'} stopped sharing location.`,
          [{ text: 'OK' }]
        );
        
        setAmbulanceLocation(null);
        setTrackingStarted(false);
        setSelectedAmbulanceId(null);
      });

      socket.on('distance-update', (data: any) => {
        console.log('📏 Distance update:', data);
        setDistance(data.distance);
        setEta(data.eta);
      });

      socket.on('emergency-request-confirmed', (data: any) => {
        Alert.alert(
          '🚨 Emergency Sent',
          'Your emergency request has been sent to all available ambulances and hospitals.',
          [{ text: 'OK' }]
        );
      });

      setLoading(false);
      
    } catch (error) {
      console.error('Initialization error:', error);
      setLoading(false);
      
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const selectAmbulanceById = (ambulanceId: string) => {
    const ambulance = onlineAmbulances.find(amb => amb.ambulanceId === ambulanceId);
    if (ambulance && socketRef.current) {
      socketRef.current.emit('user-select-ambulance', {
        userId,
        ambulanceId
      });
      
      setDriverName(ambulance.driverName);
      setAmbulanceLocation(ambulance.location);
      setSelectedAmbulanceId(ambulanceId);
      setShowAmbulanceList(false);
      setTrackingStarted(true);
      
      if (userLocation) {
        socketRef.current.emit('user-location-update', {
          userId,
          ambulanceId,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const selectAmbulance = (ambulance: Ambulance) => {
    if (socketRef.current) {
      socketRef.current.emit('user-select-ambulance', {
        userId,
        ambulanceId: ambulance.ambulanceId
      });
      
      setDriverName(ambulance.driverName);
      setAmbulanceLocation(ambulance.location);
      setSelectedAmbulanceId(ambulance.ambulanceId);
      setShowAmbulanceList(false);
      setTrackingStarted(true);
      
      if (userLocation) {
        socketRef.current.emit('user-location-update', {
          userId,
          ambulanceId: ambulance.ambulanceId,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const unselectAmbulance = () => {
    setSelectedAmbulanceId(null);
    setAmbulanceLocation(null);
    setDriverName('');
    setTrackingStarted(false);
    setDistance('--');
    setEta('--');
    
    Alert.alert(
      'Ambulance Unselected',
      'You have stopped tracking the ambulance.',
      [{ text: 'OK' }]
    );
  };

  const openGoogleMaps = () => {
    if (!ambulanceLocation) {
      Alert.alert('No Location', 'Waiting for ambulance location...');
      return;
    }
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${ambulanceLocation.latitude},${ambulanceLocation.longitude}&travelmode=driving`;
    
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Cannot open Google Maps');
    });
  };

  const callDriver = () => {
    if (!selectedAmbulanceId) {
      Alert.alert('No Ambulance', 'Please select an ambulance first');
      return;
    }
    
    const ambulance = onlineAmbulances.find(amb => amb.ambulanceId === selectedAmbulanceId);
    const phoneNumber = ambulance?.phone || '+919876543210';
    
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`).catch(() => {
        Alert.alert('Error', 'Cannot make phone call');
      });
    } else {
      Alert.alert('No Phone', 'Driver phone number not available');
    }
  };

  const getInitialRegion = (): Region => {
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
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

  const fitMapToLocations = () => {
    if (userLocation && ambulanceLocation && mapRef.current) {
      mapRef.current.fitToCoordinates(
        [userLocation, ambulanceLocation],
        {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        }
      );
    }
  };

  useEffect(() => {
    initialize();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (userLocation && ambulanceLocation) {
      const dist = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        ambulanceLocation.latitude,
        ambulanceLocation.longitude
      );
      
      setDistance(dist);
      setEta(calculateETA(parseFloat(dist)));
      
      const timer = setTimeout(() => {
        fitMapToLocations();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [userLocation, ambulanceLocation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={styles.loadingText}>Initializing Tracker...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF3B30" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Track Ambulance</Text>
            <Text style={styles.headerSubtitle}>Phone: {userPhone}</Text>
          </View>
          
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: connected ? '#4CD964' : '#FF3B30' }]} />
            <Text style={styles.statusText}>
              {connected ? 'Connected' : 'Offline'}
            </Text>
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Feather name="truck" size={18} color="#FFF" />
            <Text style={styles.statValue}>{onlineAmbulances.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statCard}>
            <Feather name="map-pin" size={18} color={userLocation ? "#4CD964" : "#FFF"} />
            <Text style={styles.statValue}>{userLocation ? 'ON' : 'OFF'}</Text>
            <Text style={styles.statLabel}>GPS</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statCard}>
            <Feather name="shield" size={18} color="#FFF" />
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
              showsScale={true}
              zoomEnabled={true}
              zoomControlEnabled={false}
            >
              {/* User Marker */}
              {userLocation && (
                <Marker
                  coordinate={userLocation}
                  title="Your Location"
                  description="Patient"
                  identifier="user-marker"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.userMarker}>
                    <Feather name="user" size={16} color="#FFF" />
                  </View>
                </Marker>
              )}

              {/* Ambulance Markers */}
              {onlineAmbulances.map((ambulance, index) => (
                <Marker
                  key={`amb-${index}`}
                  coordinate={ambulance.location}
                  title={`${ambulance.driverName} - ${ambulance.ambulanceId}`}
                  description={`${ambulance.vehicleType}`}
                  identifier={`ambulance-${ambulance.ambulanceId}`}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[
                    styles.ambulanceMarker,
                    selectedAmbulanceId === ambulance.ambulanceId && styles.selectedAmbulanceMarker
                  ]}>
                    <FontAwesome5 name="ambulance" size={14} color="#FFF" />
                  </View>
                </Marker>
              ))}

              {/* Selected Ambulance Line */}
              {userLocation && ambulanceLocation && selectedAmbulanceId && (
                <Polyline
                  coordinates={[userLocation, ambulanceLocation]}
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
                  if (userLocation && mapRef.current) {
                    mapRef.current.animateToRegion({
                      ...userLocation,
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
          
          {/* Distance & ETA Card */}
          {selectedAmbulanceId && ambulanceLocation && distance !== '--' && (
            <View style={styles.distanceCard}>
              <View style={styles.distanceHeader}>
                <Feather name="navigation" size={16} color="#FF3B30" />
                <Text style={styles.distanceLabel}>Distance to Ambulance</Text>
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

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, !selectedAmbulanceId && styles.actionButtonDisabled]}
            onPress={() => setEmergencyModal(true)}
            disabled={!selectedAmbulanceId}
          >
            <View style={[styles.actionIconContainer, styles.patientIcon]}>
              <Feather name="user" size={22} color="#FFF" />
            </View>
            <Text style={[styles.actionText, !selectedAmbulanceId && styles.actionTextDisabled]}>
              Patient Details
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => setShowAmbulanceList(true)}
          >
            <View style={[styles.actionIconContainer, styles.trackIcon]}>
              <FontAwesome5 name="ambulance" size={20} color="#FFF" />
            </View>
            <Text style={styles.actionText}>
              {selectedAmbulanceId ? 'Change' : 'Track'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, !selectedAmbulanceId && styles.actionButtonDisabled]}
            onPress={() => setShareLocationModal(true)}
            disabled={!selectedAmbulanceId}
          >
            <View style={[styles.actionIconContainer, styles.shareIcon]}>
              <Feather name="share-2" size={22} color="#FFF" />
            </View>
            <Text style={[styles.actionText, !selectedAmbulanceId && styles.actionTextDisabled]}>
              Share Location
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, !selectedAmbulanceId && styles.actionButtonDisabled]}
            onPress={callDriver}
            disabled={!selectedAmbulanceId}
          >
            <View style={[styles.actionIconContainer, styles.callIcon]}>
              <Feather name="phone" size={20} color="#FFF" />
            </View>
            <Text style={[styles.actionText, !selectedAmbulanceId && styles.actionTextDisabled]}>
              Call Driver
            </Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Button */}
        <TouchableOpacity 
          style={styles.emergencyButton}
          onPress={() => setEmergencyModal(true)}
        >
          <View style={styles.emergencyButtonContent}>
            <Feather name="alert-circle" size={24} color="#FFF" />
            <Text style={styles.emergencyButtonText}>Emergency Request</Text>
          </View>
          <Text style={styles.emergencyButtonSubtext}>
            Send emergency to all ambulances & hospitals  fdsds
          </Text>
        </TouchableOpacity>

        {/* Selected Ambulance Details */}
        {selectedAmbulanceId ? (
          <View style={styles.ambulanceDetails}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected Ambulance</Text>
              <TouchableOpacity 
                style={styles.unselectButton}
                onPress={unselectAmbulance}
              >
                <Feather name="x-circle" size={16} color="#FF3B30" />
                <Text style={styles.unselectText}>Unselect</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.ambulanceCard}>
              <View style={styles.ambulanceCardHeader}>
                <View style={styles.ambulanceIconContainer}>
                  <FontAwesome5 name="ambulance" size={20} color="#FF3B30" />
                </View>
                <View style={styles.ambulanceInfo}>
                  <Text style={styles.ambulanceName}>{driverName || 'Loading...'}</Text>
                  <Text style={styles.ambulanceId}>{selectedAmbulanceId}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: trackingStarted ? '#4CD964' : '#FF9500' }
                  ]}>
                    <Text style={styles.statusBadgeText}>
                      {trackingStarted ? 'Live Tracking' : 'Connecting...'}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.ambulanceStats}>
                <View style={styles.statBox}>
                  <Feather name="navigation" size={14} color="#8E8E93" />
                  <Text style={styles.statBoxLabel}>Distance</Text>
                  <Text style={styles.statBoxValue}>{distance} km</Text>
                </View>
                
                <View style={styles.statBox}>
                  <Feather name="clock" size={14} color="#8E8E93" />
                  <Text style={styles.statBoxLabel}>ETA</Text>
                  <Text style={styles.statBoxValue}>{eta} min</Text>
                </View>
                
                <View style={styles.statBox}>
                  <Feather name="activity" size={14} color="#8E8E93" />
                  <Text style={styles.statBoxLabel}>Status</Text>
                  <Text style={[styles.statBoxValue, { color: trackingStarted ? '#4CD964' : '#FF9500' }]}>
                    {trackingStarted ? 'Active' : 'Waiting'}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.navigateButton}
                onPress={openGoogleMaps}
              >
                <Feather name="navigation" size={18} color="#FFF" />
                <Text style={styles.navigateButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noSelection}>
            <View style={styles.promptCard}>
              <FontAwesome5 name="ambulance" size={48} color="#C7C7CC" />
              <Text style={styles.promptTitle}>No Ambulance Selected</Text>
              <Text style={styles.promptText}>
                Select an ambulance from available options to start real-time tracking
              </Text>
              <TouchableOpacity 
                style={styles.selectAmbulanceButton}
                onPress={() => setShowAmbulanceList(true)}
              >
                <Text style={styles.selectAmbulanceButtonText}>Track Ambulance</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Available Ambulances Preview */}
        {onlineAmbulances.length > 0 && (
          <View style={styles.ambulancesPreview}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Ambulances</Text>
              <TouchableOpacity onPress={() => setShowAmbulanceList(true)}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.ambulancesScroll}
            >
              {onlineAmbulances.slice(0, 3).map((ambulance, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[
                    styles.ambulancePreviewCard,
                    selectedAmbulanceId === ambulance.ambulanceId && styles.selectedPreviewCard
                  ]}
                  onPress={() => selectAmbulance(ambulance)}
                >
                  <View style={styles.previewHeader}>
                    <View style={styles.previewIcon}>
                      <FontAwesome5 name="ambulance" size={16} color="#FF3B30" />
                    </View>
                    <Text style={styles.previewName}>{ambulance.driverName}</Text>
                  </View>
                  <Text style={styles.previewId}>{ambulance.ambulanceId}</Text>
                  <Text style={styles.previewDistance}>
                    {ambulance.distance || '--'} km away
                  </Text>
                  <Text style={styles.previewETA}>
                    ETA: {ambulance.eta || '--'} min
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Location Information */}
        <View style={styles.locationInfo}>
          <Text style={styles.sectionTitle}>Your Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={18} color="#FF3B30" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>Current Position</Text>
                <Text style={styles.locationValue}>
                  {userLocation 
                    ? `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`
                    : 'Getting location...'
                  }
                </Text>
              </View>
            </View>
            
            <View style={styles.locationRow}>
              <Feather name="wifi" size={18} color="#FF3B30" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>Connection Status</Text>
                <Text style={[
                  styles.locationValue, 
                  { color: connected ? '#4CD964' : '#FF3B30' }
                ]}>
                  {connected ? 'Connected to server' : 'Disconnected'}
                </Text>
              </View>
            </View>
            
            <View style={styles.locationRow}>
              <Feather name="share-2" size={18} color="#FF3B30" />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>Location Sharing</Text>
                <Text style={styles.locationValue}>
                  {selectedAmbulanceId 
                    ? `Location shared with ${driverName || 'ambulance'}`
                    : 'Not sharing location'
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Patient/Emergency Details Modal */}
      <Modal
        visible={emergencyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEmergencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Feather name="user" size={24} color="#FF3B30" />
                <Text style={styles.modalTitle}>
                  {selectedAmbulanceId ? 'Patient Details' : 'Emergency Request'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEmergencyModal(false)}>
                <Feather name="x" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                {selectedAmbulanceId 
                  ? 'Share patient information with the ambulance driver.'
                  : 'Send emergency request to all available ambulances and hospitals.'}
              </Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Patient Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter patient name"
                  placeholderTextColor="#999"
                  value={patientDetails.name}
                  onChangeText={(text) => setPatientDetails({...patientDetails, name: text})}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Phone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone number"
                  placeholderTextColor="#999"
                  value={patientDetails.phone}
                  onChangeText={(text) => setPatientDetails({...patientDetails, phone: text})}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Patient Condition</Text>
                <View style={styles.conditionTypes}>
                  {['Stable', 'Serious', 'Critical', 'Unknown'].map((condition) => (
                    <TouchableOpacity
                      key={condition}
                      style={[
                        styles.conditionType,
                        patientDetails.condition === condition && styles.conditionTypeActive
                      ]}
                      onPress={() => setPatientDetails({...patientDetails, condition})}
                    >
                      <Text style={[
                        styles.conditionTypeText,
                        patientDetails.condition === condition && styles.conditionTypeTextActive
                      ]}>
                        {condition}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.locationNote}>
                <Feather name="info" size={16} color="#FF3B30" />
                <Text style={styles.locationNoteText}>
                  {selectedAmbulanceId 
                    ? 'This information will be shared with the ambulance driver and hospital'
                    : 'Emergency request will be sent to all available ambulances and hospitals'}
                </Text>
              </View>
              
              <View style={styles.modalActions}>
                {selectedAmbulanceId ? (
                  <>
                    <TouchableOpacity 
                      style={[styles.modalActionButton, styles.sendDetailsButton]}
                      onPress={sendPatientDetails}
                      disabled={!patientDetails.name || !patientDetails.phone}
                    >
                      <Feather name="send" size={20} color="#FFF" />
                      <Text style={styles.modalActionButtonText}>Share Patient Details</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.modalActionButton, styles.emergencyButtonModal]}
                      onPress={sendEmergencyRequest}
                      disabled={!patientDetails.name || !patientDetails.phone}
                    >
                      <Feather name="alert-circle" size={20} color="#FFF" />
                      <Text style={styles.modalActionButtonText}>Send Emergency Request</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={[styles.modalActionButton, styles.emergencyButtonModal]}
                    onPress={sendEmergencyRequest}
                    disabled={!patientDetails.name || !patientDetails.phone}
                  >
                    <Feather name="alert-circle" size={20} color="#FFF" />
                    <Text style={styles.modalActionButtonText}>Send Emergency to All</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Share Location Modal */}
      <Modal
        visible={shareLocationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShareLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.shareModal]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Feather name="share-2" size={24} color="#FF3B30" />
                <Text style={styles.modalTitle}>Share Location</Text>
              </View>
              <TouchableOpacity onPress={() => setShareLocationModal(false)}>
                <Feather name="x" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.shareLocationContent}>
                <Feather name="map-pin" size={48} color="#FF3B30" />
                <Text style={styles.shareTitle}>Share your location?</Text>
                <Text style={styles.shareDescription}>
                  Your current location will be shared with {driverName || 'the ambulance driver'} and hospital for navigation.
                </Text>
                
                {userLocation && (
                  <View style={styles.locationPreview}>
                    <Feather name="map" size={16} color="#8E8E93" />
                    <Text style={styles.locationPreviewText}>
                      {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}
                
                <View style={styles.shareButtons}>
                  <TouchableOpacity 
                    style={[styles.shareButton, styles.cancelShareButton]}
                    onPress={() => setShareLocationModal(false)}
                  >
                    <Text style={styles.cancelShareText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.shareButton, styles.confirmShareButton]}
                    onPress={shareLocationWithDriver}
                  >
                    <Feather name="share-2" size={18} color="#FFF" />
                    <Text style={styles.confirmShareText}>Share Location</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ambulance List Modal */}
      <Modal
        visible={showAmbulanceList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAmbulanceList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <FontAwesome5 name="ambulance" size={20} color="#FF3B30" />
                <Text style={styles.modalTitle}>Available Ambulances</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAmbulanceList(false)}>
                <Feather name="x" size={24} color="#8E8E93" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {onlineAmbulances.length === 0 ? (
                <View style={styles.emptyState}>
                  <FontAwesome5 name="ambulance" size={48} color="#C7C7CC" />
                  <Text style={styles.emptyStateTitle}>No Ambulances Available</Text>
                  <Text style={styles.emptyStateText}>
                    Please wait for ambulances to come online or try again later.
                  </Text>
                </View>
              ) : (
                <>
                  {onlineAmbulances.map((ambulance, index) => (
                    <TouchableOpacity 
                      key={index}
                      style={[
                        styles.ambulanceListItem,
                        selectedAmbulanceId === ambulance.ambulanceId && styles.selectedListItem
                      ]}
                      onPress={() => selectAmbulance(ambulance)}
                    >
                      <View style={styles.listItemHeader}>
                        <View style={styles.listItemIcon}>
                          <FontAwesome5 name="ambulance" size={20} color="#FF3B30" />
                        </View>
                        <View style={styles.listItemInfo}>
                          <Text style={styles.listItemName}>{ambulance.driverName}</Text>
                          <Text style={styles.listItemId}>{ambulance.ambulanceId}</Text>
                          <Text style={styles.listItemType}>{ambulance.vehicleType}</Text>
                        </View>
                        {selectedAmbulanceId === ambulance.ambulanceId ? (
                          <View style={styles.selectedIndicator}>
                            <Feather name="check-circle" size={20} color="#4CD964" />
                          </View>
                        ) : null}
                      </View>
                      
                      <View style={styles.listItemStats}>
                        <View style={styles.listItemStat}>
                          <Feather name="navigation" size={12} color="#8E8E93" />
                          <Text style={styles.listItemStatText}>{ambulance.distance || '--'} km</Text>
                        </View>
                        
                        <View style={styles.listItemStat}>
                          <Feather name="clock" size={12} color="#8E8E93" />
                          <Text style={styles.listItemStatText}>ETA: {ambulance.eta || '--'} min</Text>
                        </View>
                        
                        <View style={styles.listItemStat}>
                          <Feather name="phone" size={12} color="#8E8E93" />
                          <Text style={styles.listItemStatText}>{ambulance.phone}</Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={[
                          styles.listItemButton,
                          selectedAmbulanceId === ambulance.ambulanceId && styles.listItemButtonSelected
                        ]}
                        onPress={() => selectAmbulance(ambulance)}
                      >
                        <Text style={[
                          styles.listItemButtonText,
                          selectedAmbulanceId === ambulance.ambulanceId && styles.listItemButtonTextSelected
                        ]}>
                          {selectedAmbulanceId === ambulance.ambulanceId ? 'Selected' : 'Select'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  
                  {selectedAmbulanceId && (
                    <TouchableOpacity 
                      style={styles.unselectAllButton}
                      onPress={unselectAmbulance}
                    >
                      <Feather name="x-circle" size={18} color="#FF3B30" />
                      <Text style={styles.unselectAllText}>Unselect Ambulance</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
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
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  connectionStatus: {
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
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
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
    marginTop: 16,
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
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  ambulanceMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  selectedAmbulanceMarker: {
    backgroundColor: '#FF3B30',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  patientIcon: {
    backgroundColor: '#FF9500',
  },
  trackIcon: {
    backgroundColor: '#FF3B30',
  },
  shareIcon: {
    backgroundColor: '#007AFF',
  },
  callIcon: {
    backgroundColor: '#4CD964',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  actionTextDisabled: {
    color: '#C7C7CC',
  },
  emergencyButton: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF3B30',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  emergencyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  emergencyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF3B30',
  },
  emergencyButtonSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  ambulanceDetails: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  unselectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
  unselectText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  ambulanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  ambulanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ambulanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,59,48,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ambulanceInfo: {
    flex: 1,
  },
  ambulanceName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  ambulanceId: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  ambulanceStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 2,
  },
  statBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  navigateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noSelection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  promptCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  promptText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  selectAmbulanceButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  selectAmbulanceButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ambulancesPreview: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  viewAllText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  ambulancesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  ambulancePreviewCard: {
    width: 180,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  selectedPreviewCard: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  previewId: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  previewDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  previewETA: {
    fontSize: 12,
    color: '#8E8E93',
  },
  locationInfo: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  locationCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
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
  shareModal: {
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
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalContent: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
  },
  conditionTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionType: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
  },
  conditionTypeActive: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  conditionTypeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  conditionTypeTextActive: {
    color: '#FFF',
  },
  locationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  locationNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#FF3B30',
  },
  modalActions: {
    gap: 12,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  sendDetailsButton: {
    backgroundColor: '#FF3B30',
  },
  emergencyButtonModal: {
    backgroundColor: '#FF3B30',
  },
  modalActionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareLocationContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  shareTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  shareDescription: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
    gap: 8,
  },
  locationPreviewText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  shareButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  shareButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelShareButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelShareText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF3B30',
  },
  confirmShareText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  ambulanceListItem: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  selectedListItem: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderColor: '#FF3B30',
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  listItemId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  listItemType: {
    fontSize: 12,
    color: '#666',
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  listItemStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  listItemStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  listItemStatText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  listItemButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  listItemButtonSelected: {
    backgroundColor: '#4CD964',
  },
  listItemButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listItemButtonTextSelected: {
    color: '#FFF',
  },
  unselectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  unselectAllText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});