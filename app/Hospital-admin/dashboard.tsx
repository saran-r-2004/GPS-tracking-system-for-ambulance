// app/Hospital-admin/dashboard.tsx - UPDATED VERSION
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import io from 'socket.io-client';

const SOCKET_URL = 'https://gps-tracking-system-for-ambulance-1.onrender.com';
const { width, height } = Dimensions.get('window');

interface Ambulance {
  ambulanceId: string;
  driverName: string;
  phone: string;
  vehicleType: string;
  location: { latitude: number; longitude: number };
  status: string;
  lastUpdate: Date;
  currentPatient?: string;
  distance?: string;
}

interface Emergency {
  type: string;
  patientName: string;
  ambulanceId: string;
  location: { latitude: number; longitude: number };
  timestamp: Date;
  condition: string;
}

export default function HospitalAdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState('map');
  const [refreshing, setRefreshing] = useState(false);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState<Ambulance | null>(null);
  const [dispatchModal, setDispatchModal] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState({
    latitude: 10.904214,
    longitude: 76.998148
  });
  
  const socketRef = useRef<any>(null);
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  const hospitalId = 'HOSP-001';
  const hospitalName = 'City Medical Center';

  useEffect(() => {
    connectSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🏥 Hospital connected to server');
      
      socket.emit('hospital-join', {
        hospitalId,
        hospitalName,
        location: hospitalLocation
      });
      
      // Request initial data
      socket.emit('hospital-request-ambulances', { hospitalId });
    });

    socket.on('hospital-ambulances-update', (data: Ambulance[]) => {
      console.log('🚑 Ambulances update received:', data.length);
      setAmbulances(data);
    });

    socket.on('ambulance-location-update', (data: any) => {
      console.log('📍 Ambulance location update:', data);
      
      setAmbulances(prev => prev.map(amb => 
        amb.ambulanceId === data.ambulanceId 
          ? { ...amb, location: data.location, lastUpdate: new Date(data.timestamp) }
          : amb
      ));
    });

    socket.on('hospital-emergency-alert', (data: any) => {
      console.log('🚨 Emergency alert:', data);
      
      const newEmergency: Emergency = {
        type: 'Emergency',
        patientName: data.patientName,
        ambulanceId: data.ambulanceId,
        location: data.location,
        timestamp: new Date(data.timestamp),
        condition: data.patientCondition
      };
      
      setEmergencies(prev => [newEmergency, ...prev.slice(0, 9)]);
      
      Alert.alert(
        '🚨 NEW EMERGENCY',
        `${data.patientName} - ${data.patientCondition}\nAmbulance: ${data.ambulanceId}`,
        [{ text: 'OK' }]
      );
    });

    socket.on('hospital-emergencies-update', (data: Emergency[]) => {
      setEmergencies(data.slice(0, 10));
    });

    socket.on('hospital-patient-update', (data: any) => {
      console.log('📋 Patient update:', data);
      
      const newEmergency: Emergency = {
        type: 'Patient Details',
        patientName: data.userName,
        ambulanceId: data.ambulanceId,
        location: data.location,
        timestamp: new Date(data.timestamp),
        condition: data.condition
      };
      
      setEmergencies(prev => [newEmergency, ...prev.slice(0, 9)]);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (socketRef.current?.connected) {
      socketRef.current.emit('hospital-request-ambulances', { hospitalId });
    }
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleDispatch = () => {
    if (!selectedAmbulance) {
      Alert.alert('Error', 'Please select an ambulance first');
      return;
    }
    setDispatchModal(true);
  };

  const confirmDispatch = () => {
    if (socketRef.current?.connected && selectedAmbulance) {
      socketRef.current.emit('hospital-dispatch-ambulance', {
        hospitalId,
        ambulanceId: selectedAmbulance.ambulanceId,
        destination: 'Hospital Emergency',
        patientInfo: 'Emergency case'
      });
      
      Alert.alert('Success', `Ambulance ${selectedAmbulance.ambulanceId} dispatched`);
      setDispatchModal(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: () => router.replace('/login') }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'on-duty': return '#2196F3';
      case 'busy': return '#FF9800';
      case 'offline': return '#9E9E9E';
      default: return '#666';
    }
  };

  const fitMapToLocations = () => {
    if (ambulances.length > 0 && mapRef.current) {
      const locations = ambulances
        .filter(amb => amb.location)
        .map(amb => amb.location);
      
      if (locations.length > 0) {
        locations.push(hospitalLocation);
        mapRef.current.fitToCoordinates(locations, {
          edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
          animated: true,
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialIcons name="local-hospital" size={32} color="#FFF" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Hospital Dashboard</Text>
            <Text style={styles.headerSubtitle}>{hospitalName} • {hospitalId}</Text>
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <FontAwesome5 name="ambulance" size={16} color="#FFF" />
            <Text style={styles.statValue}>{ambulances.length}</Text>
            <Text style={styles.statLabel}>Ambulances</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statCard}>
            <MaterialIcons name="emergency" size={16} color="#FFF" />
            <Text style={styles.statValue}>{emergencies.length}</Text>
            <Text style={styles.statLabel}>Emergencies</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statCard}>
            <MaterialIcons name="wifi" size={16} color={socketRef.current?.connected ? '#4CD964' : '#FFF'} />
            <Text style={styles.statValue}>{socketRef.current?.connected ? 'ON' : 'OFF'}</Text>
            <Text style={styles.statLabel}>Live</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'map' && styles.activeTab]}
          onPress={() => setActiveTab('map')}
        >
          <MaterialIcons name="map" size={20} color={activeTab === 'map' ? '#1976D2' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'map' && styles.activeTabText]}>
            Map View
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'ambulances' && styles.activeTab]}
          onPress={() => setActiveTab('ambulances')}
        >
          <FontAwesome5 name="ambulance" size={16} color={activeTab === 'ambulances' ? '#1976D2' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'ambulances' && styles.activeTabText]}>
            Ambulances
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'emergencies' && styles.activeTab]}
          onPress={() => setActiveTab('emergencies')}
        >
          <MaterialIcons name="emergency" size={20} color={activeTab === 'emergencies' ? '#1976D2' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'emergencies' && styles.activeTabText]}>
            Emergencies
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'map' && (
          <View style={styles.mapSection}>
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: hospitalLocation.latitude,
                  longitude: hospitalLocation.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onLayout={fitMapToLocations}
              >
                {/* Hospital Marker */}
                <Marker
                  coordinate={hospitalLocation}
                  title="City Medical Center"
                  description="Hospital Location"
                >
                  <View style={styles.hospitalMarker}>
                    <MaterialIcons name="local-hospital" size={24} color="#1976D2" />
                  </View>
                </Marker>

                {/* Ambulance Markers */}
                {ambulances.map((ambulance, index) => (
                  <Marker
                    key={index}
                    coordinate={ambulance.location}
                    title={`${ambulance.driverName} - ${ambulance.ambulanceId}`}
                    description={ambulance.vehicleType}
                    onPress={() => setSelectedAmbulance(ambulance)}
                  >
                    <View style={[
                      styles.ambulanceMarker,
                      { backgroundColor: getStatusColor(ambulance.status) }
                    ]}>
                      <FontAwesome5 name="ambulance" size={14} color="#FFF" />
                    </View>
                  </Marker>
                ))}

                {/* Lines to selected ambulance */}
                {selectedAmbulance && (
                  <Polyline
                    coordinates={[hospitalLocation, selectedAmbulance.location]}
                    strokeColor="#1976D2"
                    strokeWidth={2}
                    lineDashPattern={[5, 5]}
                  />
                )}
              </MapView>

              <View style={styles.mapControls}>
                <TouchableOpacity 
                  style={styles.mapControlButton}
                  onPress={fitMapToLocations}
                >
                  <Feather name="target" size={20} color="#1976D2" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedAmbulance && (
              <View style={styles.selectedCard}>
                <View style={styles.selectedHeader}>
                  <FontAwesome5 name="ambulance" size={20} color="#1976D2" />
                  <View style={styles.selectedInfo}>
                    <Text style={styles.selectedTitle}>{selectedAmbulance.driverName}</Text>
                    <Text style={styles.selectedId}>{selectedAmbulance.ambulanceId}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.dispatchButton}
                    onPress={handleDispatch}
                  >
                    <MaterialIcons name="send" size={16} color="#FFF" />
                    <Text style={styles.dispatchButtonText}>Dispatch</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.selectedDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="phone" size={14} color="#666" />
                    <Text style={styles.detailText}>{selectedAmbulance.phone}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="location-on" size={14} color="#666" />
                    <Text style={styles.detailText}>
                      {selectedAmbulance.location.latitude.toFixed(4)}, {selectedAmbulance.location.longitude.toFixed(4)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="update" size={14} color="#666" />
                    <Text style={styles.detailText}>
                      {Math.round((Date.now() - selectedAmbulance.lastUpdate.getTime()) / 60000)} min ago
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {activeTab === 'ambulances' && (
          <View style={styles.listSection}>
            {ambulances.length === 0 ? (
              <View style={styles.emptyState}>
                <FontAwesome5 name="ambulance" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No ambulances available</Text>
              </View>
            ) : (
              ambulances.map((ambulance, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[
                    styles.ambulanceCard,
                    selectedAmbulance?.ambulanceId === ambulance.ambulanceId && styles.selectedCardStyle
                  ]}
                  onPress={() => setSelectedAmbulance(ambulance)}
                >
                  <View style={styles.ambulanceHeader}>
                    <View style={styles.ambulanceIcon}>
                      <FontAwesome5 name="ambulance" size={20} color="#1976D2" />
                    </View>
                    <View style={styles.ambulanceInfo}>
                      <Text style={styles.ambulanceName}>{ambulance.driverName}</Text>
                      <Text style={styles.ambulanceId}>{ambulance.ambulanceId}</Text>
                      <Text style={styles.ambulanceType}>{ambulance.vehicleType}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(ambulance.status) }
                    ]}>
                      <Text style={styles.statusText}>{ambulance.status}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.ambulanceDetails}>
                    <View style={styles.detailItem}>
                      <MaterialIcons name="phone" size={14} color="#666" />
                      <Text style={styles.detailLabel}>{ambulance.phone}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <MaterialIcons name="access-time" size={14} color="#666" />
                      <Text style={styles.detailLabel}>
                        Updated: {Math.round((Date.now() - ambulance.lastUpdate.getTime()) / 60000)} min ago
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.ambulanceActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => setSelectedAmbulance(ambulance)}
                    >
                      <MaterialIcons name="visibility" size={16} color="#1976D2" />
                      <Text style={styles.actionText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.dispatchAction]}
                      onPress={() => {
                        setSelectedAmbulance(ambulance);
                        handleDispatch();
                      }}
                    >
                      <MaterialIcons name="send" size={16} color="#FFF" />
                      <Text style={[styles.actionText, styles.dispatchActionText]}>Dispatch</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'emergencies' && (
          <View style={styles.listSection}>
            {emergencies.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="emergency" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No active emergencies</Text>
              </View>
            ) : (
              emergencies.map((emergency, index) => (
                <View key={index} style={styles.emergencyCard}>
                  <View style={styles.emergencyHeader}>
                    <MaterialIcons 
                      name={emergency.type === 'Emergency' ? 'emergency' : 'person'} 
                      size={20} 
                      color={emergency.type === 'Emergency' ? '#F44336' : '#1976D2'} 
                    />
                    <View style={styles.emergencyInfo}>
                      <Text style={styles.emergencyTitle}>{emergency.type}</Text>
                      <Text style={styles.emergencyPatient}>{emergency.patientName}</Text>
                      <Text style={styles.emergencyCondition}>Condition: {emergency.condition}</Text>
                    </View>
                    <Text style={styles.emergencyTime}>
                      {Math.round((Date.now() - emergency.timestamp.getTime()) / 60000)} min ago
                    </Text>
                  </View>
                  
                  <View style={styles.emergencyDetails}>
                    <View style={styles.emergencyDetail}>
                      <FontAwesome5 name="ambulance" size={12} color="#666" />
                      <Text style={styles.emergencyDetailText}>Ambulance: {emergency.ambulanceId}</Text>
                    </View>
                    <View style={styles.emergencyDetail}>
                      <MaterialIcons name="location-on" size={12} color="#666" />
                      <Text style={styles.emergencyDetailText}>
                        Location: {emergency.location.latitude.toFixed(4)}, {emergency.location.longitude.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Hospital Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Hospital Information</Text>
          <View style={styles.infoContent}>
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={16} color="#666" />
              <Text style={styles.infoText}>123 Medical Drive, Malampichampatti</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={16} color="#666" />
              <Text style={styles.infoText}>+91 44 2656 7890</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="emergency" size={16} color="#666" />
              <Text style={styles.infoText}>Emergency: +91 44 2656 7891</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Dispatch Modal */}
      <Modal
        visible={dispatchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDispatchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dispatch Ambulance</Text>
              <TouchableOpacity onPress={() => setDispatchModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalText}>
                Dispatch ambulance {selectedAmbulance?.ambulanceId} to:
              </Text>
              
              <TextInput
                style={styles.modalInput}
                placeholder="Enter destination or emergency type"
                multiline
              />
              
              <TextInput
                style={styles.modalInput}
                placeholder="Additional instructions (optional)"
                multiline
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setDispatchModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={confirmDispatch}
                >
                  <MaterialIcons name="send" size={18} color="#FFF" />
                  <Text style={styles.confirmButtonText}>Confirm Dispatch</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Button */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <MaterialIcons name="logout" size={20} color="#666" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Add Text component import at the top if not present
import { Text } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#1976D2',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
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
    fontSize: 20,
    fontWeight: 'bold',
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#1976D2',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  mapSection: {
    marginBottom: 20,
  },
  mapContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
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
  hospitalMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  ambulanceMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  selectedCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  selectedId: {
    fontSize: 14,
    color: '#666',
  },
  dispatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  dispatchButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  listSection: {
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  ambulanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedCardStyle: {
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  ambulanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ambulanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(25, 118, 210, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ambulanceInfo: {
    flex: 1,
  },
  ambulanceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  ambulanceId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  ambulanceType: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ambulanceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  ambulanceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  dispatchAction: {
    backgroundColor: '#1976D2',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  dispatchActionText: {
    color: '#FFF',
  },
  emergencyCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  emergencyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  emergencyPatient: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  emergencyCondition: {
    fontSize: 12,
    color: '#999',
  },
  emergencyTime: {
    fontSize: 12,
    color: '#999',
  },
  emergencyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emergencyDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emergencyDetailText: {
    fontSize: 12,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  infoContent: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
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
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    gap: 8,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});