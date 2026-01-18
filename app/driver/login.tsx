import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Alert, 
  View, 
  Switch, 
  TouchableOpacity, 
  Linking,
  ScrollView,
  TextInput,
  Modal,
  RefreshControl
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { Button } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';

// Calculate distance between two coordinates in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Mock requests data
const mockRequests = [
  {
    id: 'REQ-001',
    patientName: 'Rahul Sharma',
    patientPhone: '+91 6379363796',
    patientAge: '45',
    patientGender: 'Male',
    emergencyType: 'Heart Attack',
    location: {
      latitude: 10.904214,
      longitude: 76.998148,
    },
    address: '123 Main Street, Malampichampatti',
    timestamp: new Date(),
    status: 'pending',
    priority: 'High'
  },
  {
    id: 'REQ-002', 
    patientName: 'Priya Patel',
    patientPhone: '+91 6369387596',
    patientAge: '32',
    patientGender: 'Female',
    emergencyType: 'Accident',
    location: {
      latitude: 10.883455,
      longitude: 77.007358,
    },
    address: '456 Oak Avenue, Near City Hospital',
    timestamp: new Date(Date.now() - 300000),
    status: 'pending',
    priority: 'Medium'
  },
  {
    id: 'REQ-003',
    patientName: 'Amit Kumar',
    patientPhone: '+91 9876543210',
    patientAge: '68',
    patientGender: 'Male',
    emergencyType: 'Respiratory Distress',
    location: {
      latitude: 10.917828,
      longitude: 76.986005,
    },
    address: '789 Gandhi Road, Apartment 5B',
    timestamp: new Date(Date.now() - 600000),
    status: 'pending',
    priority: 'High'
  }
];

export default function DriverDashboardScreen() {
  const [isAvailable, setIsAvailable] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [distanceToPatient, setDistanceToPatient] = useState('');
  const [etaToPatient, setEtaToPatient] = useState('');
  const [patientLocation, setPatientLocation] = useState<any>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>(mockRequests);
  const [showPatientReport, setShowPatientReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [ambulanceMoving, setAmbulanceMoving] = useState(false);
  const router = useRouter();

  // Patient report state
  const [patientReport, setPatientReport] = useState({
    patientName: '',
    patientAge: '',
    patientGender: 'Male',
    condition: '',
    vitalSigns: '',
    treatmentGiven: '',
    hospitalAdmitted: '',
    additionalNotes: ''
  });

  // Driver location
  const driverLocation = {
    latitude: 10.9905,
    longitude: 76.9615,
  };

  // Mock route coordinates
  const mockRoute = [
    driverLocation,
    { latitude: 10.9850, longitude: 76.9650 },
    { latitude: 10.9800, longitude: 76.9700 },
    { latitude: 10.9750, longitude: 76.9750 },
    { latitude: 10.9700, longitude: 76.9800 },
  ];

  useEffect(() => {
    setCurrentLocation(driverLocation);
    setMapRegion({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
    setRouteCoordinates(mockRoute);

    // Simulate location updates
    const interval = setInterval(() => {
      setAmbulanceMoving(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate API call to refresh requests
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('Updated', 'Requests list has been refreshed');
    }, 1500);
  };

  const acceptRequest = (request: any) => {
    setActiveRequest(request);
    setPatientLocation(request.location);
    
    // Add patient location to route
    const completeRoute = [...mockRoute, request.location];
    setRouteCoordinates(completeRoute);
    
    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      request.location.latitude,
      request.location.longitude
    );
    setDistanceToPatient(`${distance.toFixed(1)} km`);
    
    const etaMinutes = Math.max(1, Math.floor((distance / 40) * 60));
    setEtaToPatient(`${etaMinutes} minutes`);
    
    // Update map region to show entire route
    const allCoordinates = [driverLocation, request.location];
    const lats = allCoordinates.map(coord => coord.latitude);
    const lngs = allCoordinates.map(coord => coord.longitude);
    
    setMapRegion({
      latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
      longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
      latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 2,
      longitudeDelta: (Math.max(...lngs) - Math.min(...lngs)) * 2,
    });
    
    setPendingRequests(pendingRequests.filter(req => req.id !== request.id));
    
    Alert.alert(
      'Request Accepted', 
      `You are now en route to ${request.patientName}. Emergency: ${request.emergencyType}`,
      [{ text: 'OK' }]
    );
  };

  const rejectRequest = (requestId: string) => {
    setPendingRequests(pendingRequests.filter(req => req.id !== requestId));
    Alert.alert('Request Rejected', 'The request has been removed from your list.');
  };

  const submitPatientReport = () => {
    if (!patientReport.patientName || !patientReport.condition || !patientReport.vitalSigns) {
      Alert.alert('Error', 'Please fill in patient name, condition, and vital signs');
      return;
    }

    // In real app, this would send to backend and admin dashboard
    Alert.alert(
      'Report Submitted Successfully', 
      'Patient medical report has been sent to the admin dashboard.',
      [
        {
          text: 'OK',
          onPress: () => {
            setShowPatientReport(false);
            setActiveRequest(null);
            setPatientLocation(null);
            // Reset form
            setPatientReport({
              patientName: '',
              patientAge: '',
              patientGender: 'Male',
              condition: '',
              vitalSigns: '',
              treatmentGiven: '',
              hospitalAdmitted: '',
              additionalNotes: ''
            });
          }
        }
      ]
    );
  };

  const completeRequest = () => {
    if (activeRequest) {
      // Pre-fill patient report with request data
      setPatientReport({
        ...patientReport,
        patientName: activeRequest.patientName,
        patientAge: activeRequest.patientAge,
        patientGender: activeRequest.patientGender
      });
      setShowPatientReport(true);
    }
  };

  const callPatient = () => {
    if (activeRequest?.patientPhone) {
      Linking.openURL(`tel:${activeRequest.patientPhone}`);
    }
  };

  const navigateToPatient = () => {
    if (activeRequest?.location) {
      const url = `https://www.google.com/maps/dir/${currentLocation.latitude},${currentLocation.longitude}/${activeRequest.location.latitude},${activeRequest.location.longitude}`;
      Linking.openURL(url);
    }
  };

  const toggleAvailability = () => {
    const newStatus = !isAvailable;
    setIsAvailable(newStatus);
    Alert.alert(
      'Status Updated', 
      `You are now ${newStatus ? 'on' : 'off'} duty`,
      [{ text: 'OK' }]
    );
  };

  const toggleSharing = () => {
    const newSharingStatus = !isSharing;
    setIsSharing(newSharingStatus);
    Alert.alert(
      'Location Sharing', 
      `Location sharing ${newSharingStatus ? 'enabled' : 'disabled'}`,
      [{ text: 'OK' }]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return '#F44336';
      case 'Medium': return '#FF9800';
      case 'Low': return '#4CAF50';
      default: return '#666';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'High': return 'warning';
      case 'Medium': return 'error-outline';
      case 'Low': return 'info-outline';
      default: return 'help-outline';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section */}
      <ThemedView style={styles.header}>
        <ThemedText style={styles.title}>Driver Dashboard</ThemedText>
        <ThemedText style={styles.subtitle}>AMB-001 • Rajesh Kumar • Malampichampatti Area</ThemedText>
        
        {/* Status Indicators */}
        <View style={styles.statusIndicators}>
          <View style={styles.statusItem}>
            <MaterialIcons name="circle" size={12} color={isAvailable ? '#4CAF50' : '#F44336'} />
            <ThemedText style={styles.statusText}>
              {isAvailable ? 'Available' : 'Off Duty'}
            </ThemedText>
          </View>
          <View style={styles.statusItem}>
            <MaterialIcons name="location-on" size={12} color={isSharing ? '#2196F3' : '#666'} />
            <ThemedText style={styles.statusText}>
              {isSharing ? 'Sharing Location' : 'Location Off'}
            </ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && !activeRequest && (
        <ThemedView style={styles.card}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Emergency Requests ({pendingRequests.length})</ThemedText>
            <TouchableOpacity onPress={onRefresh}>
              <MaterialIcons name="refresh" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {pendingRequests.map((request) => (
            <View key={request.id} style={styles.requestItem}>
              <View style={styles.requestInfo}>
                <View style={styles.requestHeader}>
                  <ThemedText style={styles.requestId}>Request #{request.id.split('-')[1]}</ThemedText>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(request.priority) }]}>
                    <MaterialIcons name={getPriorityIcon(request.priority) as any} size={14} color="#FFF" />
                    <ThemedText style={styles.priorityText}>{request.priority}</ThemedText>
                  </View>
                </View>
                
                <ThemedText style={styles.patientName}>{request.patientName}</ThemedText>
                <ThemedText style={styles.patientDetails}>
                  {request.patientAge} • {request.patientGender} • {request.emergencyType}
                </ThemedText>
                <ThemedText style={styles.patientPhone}>{request.patientPhone}</ThemedText>
                <ThemedText style={styles.patientAddress}>{request.address}</ThemedText>
                <ThemedText style={styles.requestTime}>
                  Received: {new Date(request.timestamp).toLocaleTimeString()}
                </ThemedText>
              </View>
              
              <View style={styles.requestActions}>
                <Button
                  title="Accept"
                  onPress={() => acceptRequest(request)}
                  color="#34C759"
                />
                <Button
                  title="Reject"
                  onPress={() => rejectRequest(request.id)}
                  color="#DC3545"
                />
              </View>
            </View>
          ))}
        </ThemedView>
      )}

      {/* Active Request Section */}
      {activeRequest && (
        <>
          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>Active Emergency</ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: '#2196F3' }]}>
                <ThemedText style={styles.statusText}>En Route</ThemedText>
              </View>
            </View>
            
            <View style={styles.patientInfo}>
              <ThemedText style={styles.patientName}>{activeRequest.patientName}</ThemedText>
              <ThemedText style={styles.patientDetails}>
                {activeRequest.patientAge} • {activeRequest.patientGender} • {activeRequest.emergencyType}
              </ThemedText>
              
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <MaterialIcons name="phone" size={16} color="#007AFF" />
                  <ThemedText style={styles.infoText}>{activeRequest.patientPhone}</ThemedText>
                </View>
                <View style={styles.infoItem}>
                  <MaterialIcons name="location-on" size={16} color="#007AFF" />
                  <ThemedText style={styles.infoText}>{distanceToPatient}</ThemedText>
                </View>
                <View style={styles.infoItem}>
                  <MaterialIcons name="access-time" size={16} color="#007AFF" />
                  <ThemedText style={styles.infoText}>{etaToPatient}</ThemedText>
                </View>
                <View style={styles.infoItem}>
                  <MaterialIcons name="home" size={16} color="#007AFF" />
                  <ThemedText style={styles.infoText}>{activeRequest.address}</ThemedText>
                </View>
              </View>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={callPatient}
              >
                <MaterialIcons name="phone" size={20} color="#FFF" />
                <ThemedText style={styles.actionButtonText}>Call Patient</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.navigationButton]}
                onPress={navigateToPatient}
              >
                <MaterialIcons name="navigation" size={20} color="#FFF" />
                <ThemedText style={styles.actionButtonText}>Navigate</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.completeButton]}
                onPress={completeRequest}
              >
                <MaterialIcons name="check-circle" size={20} color="#FFF" />
                <ThemedText style={styles.actionButtonText}>Complete</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Map Section */}
          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardTitle}>Navigation Map</ThemedText>
            <ThemedText style={styles.cardDescription}>
              Real-time route to patient location
            </ThemedText>
            
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                region={mapRegion}
                provider={PROVIDER_GOOGLE}
                showsUserLocation={true}
                showsMyLocationButton={true}
              >
                {/* Driver location marker */}
                <Marker
                  coordinate={currentLocation}
                  title="Your Location"
                  description="Ambulance current location"
                >
                  <View style={[styles.ambulanceMarker, ambulanceMoving && styles.movingAmbulance]}>
                    <MaterialIcons name="local-hospital" size={30} color="#007AFF" />
                  </View>
                </Marker>
                
                {/* Patient location marker */}
                <Marker
                  coordinate={patientLocation}
                  title="Patient Location"
                  description="Emergency location"
                  pinColor="#FF3B30"
                />
                
                {/* Route polyline */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#007AFF"
                  strokeWidth={4}
                  lineDashPattern={[10, 10]}
                />
              </MapView>
              
              <View style={styles.mapOverlay}>
                <ThemedText style={styles.mapOverlayText}>
                  Distance: {distanceToPatient} • ETA: {etaToPatient}
                </ThemedText>
              </View>
            </View>
          </ThemedView>
        </>
      )}

      {/* Driver Status Controls */}
      <ThemedView style={styles.card}>
        <ThemedText style={styles.cardTitle}>Driver Status & Controls</ThemedText>
        
        <View style={styles.controlSection}>
          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <MaterialIcons name="work" size={20} color="#666" />
              <ThemedText style={styles.switchLabel}>Available for emergencies</ThemedText>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isAvailable ? '#1976D2' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.switchContainer}>
            <View style={styles.switchInfo}>
              <MaterialIcons name="location-on" size={20} color="#666" />
              <ThemedText style={styles.switchLabel}>Share my location</ThemedText>
            </View>
            <Switch
              value={isSharing}
              onValueChange={toggleSharing}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isSharing ? '#1976D2' : '#f4f3f4'}
            />
          </View>
        </View>
        
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <MaterialIcons name="emergency" size={24} color="#D32F2F" />
            <ThemedText style={styles.quickActionText}>Emergency</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <MaterialIcons name="report" size={24} color="#FF9800" />
            <ThemedText style={styles.quickActionText}>Report Issue</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <MaterialIcons name="support" size={24} color="#2196F3" />
            <ThemedText style={styles.quickActionText}>Support</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      {/* Driver Information */}
      <ThemedView style={styles.card}>
        <ThemedText style={styles.cardTitle}>Driver Information</ThemedText>
        
        <View style={styles.driverInfo}>
          <View style={styles.infoRow}>
            <MaterialIcons name="person" size={18} color="#666" />
            <ThemedText style={styles.infoLabel}>Name:</ThemedText>
            <ThemedText style={styles.infoValue}>Rajesh Kumar</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="badge" size={18} color="#666" />
            <ThemedText style={styles.infoLabel}>Driver ID:</ThemedText>
            <ThemedText style={styles.infoValue}>DRV-001</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="local-shipping" size={18} color="#666" />
            <ThemedText style={styles.infoLabel}>Ambulance ID:</ThemedText>
            <ThemedText style={styles.infoValue}>AMB-001</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={18} color="#666" />
            <ThemedText style={styles.infoLabel}>Contact:</ThemedText>
            <ThemedText style={styles.infoValue}>+91 98765 43210</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={18} color="#666" />
            <ThemedText style={styles.infoLabel}>Shift:</ThemedText>
            <ThemedText style={styles.infoValue}>08:00 - 20:00</ThemedText>
          </View>
          
          <View style={styles.infoRow}>
            <MaterialIcons name="location-city" size={18} color="#666" />
            <ThemedText style={styles.infoLabel}>Area:</ThemedText>
            <ThemedText style={styles.infoValue}>Malampichampatti & Surrounding</ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Patient Report Modal */}
      <Modal
        visible={showPatientReport}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPatientReport(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Patient Medical Report</ThemedText>
              <ThemedText style={styles.modalSubtitle}>Submit report to admin dashboard</ThemedText>
            </View>
            
            <ScrollView style={styles.reportForm} showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.sectionTitle}>Patient Information</ThemedText>
              
              <TextInput
                style={styles.textInput}
                placeholder="Patient Name *"
                value={patientReport.patientName}
                onChangeText={(text) => setPatientReport({...patientReport, patientName: text})}
              />
              
              <TextInput
                style={styles.textInput}
                placeholder="Patient Age"
                value={patientReport.patientAge}
                onChangeText={(text) => setPatientReport({...patientReport, patientAge: text})}
                keyboardType="numeric"
              />
              
              <View style={styles.genderContainer}>
                <ThemedText style={styles.genderLabel}>Gender:</ThemedText>
                <TouchableOpacity 
                  style={[styles.genderButton, patientReport.patientGender === 'Male' && styles.genderSelected]}
                  onPress={() => setPatientReport({...patientReport, patientGender: 'Male'})}
                >
                  <ThemedText style={patientReport.patientGender === 'Male' ? styles.genderSelectedText : styles.genderText}>Male</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderButton, patientReport.patientGender === 'Female' && styles.genderSelected]}
                  onPress={() => setPatientReport({...patientReport, patientGender: 'Female'})}
                >
                  <ThemedText style={patientReport.patientGender === 'Female' ? styles.genderSelectedText : styles.genderText}>Female</ThemedText>
                </TouchableOpacity>
              </View>

              <ThemedText style={styles.sectionTitle}>Medical Details</ThemedText>
              
              <TextInput
                style={[styles.textInput, { height: 80 }]}
                placeholder="Patient Condition *"
                value={patientReport.condition}
                onChangeText={(text) => setPatientReport({...patientReport, condition: text})}
                multiline
                textAlignVertical="top"
              />
              
              <TextInput
                style={styles.textInput}
                placeholder="Vital Signs (BP, Pulse, Oxygen) *"
                value={patientReport.vitalSigns}
                onChangeText={(text) => setPatientReport({...patientReport, vitalSigns: text})}
              />
              
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                placeholder="Treatment Given"
                value={patientReport.treatmentGiven}
                onChangeText={(text) => setPatientReport({...patientReport, treatmentGiven: text})}
                multiline
                textAlignVertical="top"
              />
              
              <TextInput
                style={styles.textInput}
                placeholder="Hospital Admitted To"
                value={patientReport.hospitalAdmitted}
                onChangeText={(text) => setPatientReport({...patientReport, hospitalAdmitted: text})}
              />
              
              <TextInput
                style={[styles.textInput, { height: 100 }]}
                placeholder="Additional Notes & Observations"
                value={patientReport.additionalNotes}
                onChangeText={(text) => setPatientReport({...patientReport, additionalNotes: text})}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowPatientReport(false)}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitPatientReport}
              >
                <MaterialIcons name="send" size={20} color="#FFF" />
                <ThemedText style={styles.submitButtonText}>Submit to Admin</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Section */}
      <ThemedView style={styles.card}>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => router.replace('/login')}
        >
          <MaterialIcons name="logout" size={20} color="#666" />
          <ThemedText style={styles.logoutButtonText}>Sign Out</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  statusIndicators: {
    flexDirection: 'row',
    gap: 20,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  requestInfo: {
    flex: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestId: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#666',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  patientPhone: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  patientAddress: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  requestTime: {
    fontSize: 11,
    color: '#999',
  },
  requestActions: {
    gap: 8,
    marginLeft: 12,
  },
  patientInfo: {
    marginBottom: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '45%',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  navigationButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  ambulanceMarker: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  movingAmbulance: {
    transform: [{ scale: 1.1 }],
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
  },
  mapOverlayText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  controlSection: {
    gap: 16,
    marginBottom: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    minWidth: '30%',
  },
  quickActionText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  driverInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#666',
    minWidth: 100,
  },
  infoValue: {
    color: '#1C1C1E',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#666',
    fontSize: 14,
  },
  reportForm: {
    maxHeight: 400,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 12,
    marginTop: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  genderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  genderLabel: {
    fontWeight: '600',
    color: '#666',
  },
  genderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  genderSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderText: {
    color: '#666',
  },
  genderSelectedText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
    flexDirection: 'row',
    gap: 8,
  },
  modalButtonText: {
    fontWeight: '600',
    color: '#666',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  logoutButtonText: {
    fontWeight: '600',
    color: '#666',
  },
});