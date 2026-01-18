import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

// Mock data for hospital admin dashboard
const mockHospitalData = {
  name: 'City Medical Center',
  id: 'HOSP-001',
  address: '123 Medical Drive, Malampichampatti',
  phone: '+91 44 2656 7890',
  emergencyContact: '+91 44 2656 7891'
};

const mockHospitalAmbulances = [
  {
    id: 'AMB-001',
    driver: 'Rajesh Kumar',
    status: 'On Duty',
    currentLocation: '10.904214, 76.998148',
    lastUpdate: '2 min ago',
    currentPatient: 'Rahul Sharma',
    destination: 'City Medical Center'
  },
  {
    id: 'AMB-002',
    driver: 'Suresh Patel',
    status: 'Available',
    currentLocation: '10.883455, 77.007358',
    lastUpdate: '5 min ago',
    currentPatient: 'None',
    destination: 'Standby'
  },
  {
    id: 'AMB-003',
    driver: 'Vikram Singh',
    status: 'Maintenance',
    currentLocation: 'Hospital Garage',
    lastUpdate: '1 hour ago',
    currentPatient: 'None',
    destination: 'Service Center'
  }
];

const mockPatientAdmissions = [
  {
    id: 'ADM-001',
    patientName: 'Rahul Sharma',
    age: '45',
    gender: 'Male',
    condition: 'Heart Attack',
    admissionTime: '2024-01-15 10:45',
    status: 'Critical',
    ambulanceId: 'AMB-001',
    doctor: 'Dr. Priya Menon'
  },
  {
    id: 'ADM-002',
    patientName: 'Priya Patel',
    age: '32',
    gender: 'Female',
    condition: 'Accident Injuries',
    admissionTime: '2024-01-15 09:30',
    status: 'Stable',
    ambulanceId: 'AMB-002',
    doctor: 'Dr. Arjun Kumar'
  },
  {
    id: 'ADM-003',
    patientName: 'Amit Kumar',
    age: '68',
    gender: 'Male',
    condition: 'Respiratory Distress',
    admissionTime: '2024-01-15 11:20',
    status: 'Serious',
    ambulanceId: 'AMB-001',
    doctor: 'Dr. Nisha Rao'
  }
];

const mockEmergencyCases = [
  {
    id: 'EC-001',
    patientName: 'Rahul Sharma',
    emergencyType: 'Cardiac Arrest',
    priority: 'Critical',
    ambulanceId: 'AMB-001',
    eta: '5 min',
    status: 'En Route'
  },
  {
    id: 'EC-002',
    patientName: 'Priya Patel',
    emergencyType: 'Vehicle Accident',
    priority: 'High',
    ambulanceId: 'AMB-002',
    eta: '8 min',
    status: 'At Scene'
  },
  {
    id: 'EC-003',
    patientName: 'Amit Kumar',
    emergencyType: 'Respiratory Failure',
    priority: 'Critical',
    ambulanceId: 'AMB-003',
    eta: '12 min',
    status: 'Dispatched'
  }
];

export default function HospitalAdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('Updated', 'Hospital data has been refreshed');
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return '#4CAF50';
      case 'On Duty': return '#2196F3';
      case 'Maintenance': return '#FF9800';
      case 'Critical': return '#F44336';
      case 'Serious': return '#FF9800';
      case 'Stable': return '#4CAF50';
      case 'En Route': return '#2196F3';
      case 'At Scene': return '#FF9800';
      case 'Dispatched': return '#9C27B0';
      default: return '#666';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'warning';
      case 'High': return 'error-outline';
      case 'Medium': return 'info-outline';
      default: return 'help-outline';
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

  const handleAmbulanceAction = (ambulanceId: string, action: string) => {
    Alert.alert(
      `${action} Ambulance`,
      `Are you sure you want to ${action.toLowerCase()} ${ambulanceId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => {
          Alert.alert('Success', `${ambulanceId} has been ${action.toLowerCase()}ed`);
        }}
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <View style={styles.hospitalInfo}>
          <MaterialIcons name="local-hospital" size={32} color="#1976D2" />
          <View style={styles.hospitalDetails}>
            <ThemedText style={styles.hospitalName}>{mockHospitalData.name}</ThemedText>
            <ThemedText style={styles.hospitalId}>{mockHospitalData.id}</ThemedText>
          </View>
        </View>
        <ThemedText style={styles.welcomeText}>Hospital Admin Dashboard</ThemedText>
      </ThemedView>

      {/* Tabs */}
      <ThemedView style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <MaterialIcons name="dashboard" size={18} color={activeTab === 'overview' ? '#1976D2' : '#666'} />
          <ThemedText style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ambulances' && styles.activeTab]}
          onPress={() => setActiveTab('ambulances')}
        >
          <MaterialIcons name="local-shipping" size={18} color={activeTab === 'ambulances' ? '#1976D2' : '#666'} />
          <ThemedText style={[styles.tabText, activeTab === 'ambulances' && styles.activeTabText]}>
            Ambulances
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'patients' && styles.activeTab]}
          onPress={() => setActiveTab('patients')}
        >
          <MaterialIcons name="people" size={18} color={activeTab === 'patients' ? '#1976D2' : '#666'} />
          <ThemedText style={[styles.tabText, activeTab === 'patients' && styles.activeTabText]}>
            Patients
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'emergencies' && styles.activeTab]}
          onPress={() => setActiveTab('emergencies')}
        >
          <MaterialIcons name="emergency" size={18} color={activeTab === 'emergencies' ? '#1976D2' : '#666'} />
          <ThemedText style={[styles.tabText, activeTab === 'emergencies' && styles.activeTabText]}>
            Emergencies
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && (
          <View>
            {/* Statistics Cards */}
            <View style={styles.statsContainer}>
              <ThemedView style={styles.statCard}>
                <MaterialIcons name="local-shipping" size={24} color="#2196F3" />
                <ThemedText style={styles.statNumber}>{mockHospitalAmbulances.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Ambulances</ThemedText>
                <ThemedText style={styles.statSubtext}>
                  {mockHospitalAmbulances.filter(a => a.status === 'Available').length} available
                </ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.statCard}>
                <MaterialIcons name="healing" size={24} color="#4CAF50" />
                <ThemedText style={styles.statNumber}>{mockPatientAdmissions.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Today's Admissions</ThemedText>
                <ThemedText style={styles.statSubtext}>
                  {mockPatientAdmissions.filter(p => p.status === 'Critical').length} critical
                </ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.statCard}>
                <MaterialIcons name="emergency" size={24} color="#F44336" />
                <ThemedText style={styles.statNumber}>{mockEmergencyCases.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Active Emergencies</ThemedText>
                <ThemedText style={styles.statSubtext}>
                  {mockEmergencyCases.filter(e => e.priority === 'Critical').length} critical
                </ThemedText>
              </ThemedView>
            </View>

            {/* Hospital Information */}
            <ThemedView style={styles.card}>
              <ThemedText style={styles.cardTitle}>Hospital Information</ThemedText>
              <View style={styles.hospitalInfoList}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="location-on" size={16} color="#666" />
                  <ThemedText style={styles.infoLabel}>Address:</ThemedText>
                  <ThemedText style={styles.infoValue}>{mockHospitalData.address}</ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={16} color="#666" />
                  <ThemedText style={styles.infoLabel}>Phone:</ThemedText>
                  <ThemedText style={styles.infoValue}>{mockHospitalData.phone}</ThemedText>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="emergency" size={16} color="#666" />
                  <ThemedText style={styles.infoLabel}>Emergency:</ThemedText>
                  <ThemedText style={styles.infoValue}>{mockHospitalData.emergencyContact}</ThemedText>
                </View>
              </View>
            </ThemedView>

            {/* Recent Admissions */}
            <ThemedView style={styles.card}>
              <ThemedText style={styles.cardTitle}>Recent Patient Admissions</ThemedText>
              {mockPatientAdmissions.slice(0, 3).map(patient => (
                <View key={patient.id} style={styles.patientItem}>
                  <View style={styles.patientInfo}>
                    <ThemedText style={styles.patientName}>{patient.patientName}</ThemedText>
                    <ThemedText style={styles.patientDetails}>
                      {patient.age} • {patient.gender} • {patient.condition}
                    </ThemedText>
                    <ThemedText style={styles.admissionTime}>
                      Admitted: {patient.admissionTime} • {patient.ambulanceId}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(patient.status) }]}>
                    <ThemedText style={styles.statusText}>{patient.status}</ThemedText>
                  </View>
                </View>
              ))}
            </ThemedView>
          </View>
        )}

        {activeTab === 'ambulances' && (
          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardTitle}>Hospital Ambulance Fleet</ThemedText>
            <ThemedText style={styles.cardDescription}>
              Manage and monitor your hospital's ambulance services
            </ThemedText>
            
            {mockHospitalAmbulances.map(ambulance => (
              <View key={ambulance.id} style={styles.ambulanceCard}>
                <View style={styles.ambulanceHeader}>
                  <View>
                    <ThemedText style={styles.ambulanceId}>{ambulance.id}</ThemedText>
                    <ThemedText style={styles.ambulanceDriver}>{ambulance.driver}</ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ambulance.status) }]}>
                    <ThemedText style={styles.statusText}>{ambulance.status}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.ambulanceDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="location-on" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>{ambulance.currentLocation}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="person" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>Patient: {ambulance.currentPatient}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="place" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>To: {ambulance.destination}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcons name="access-time" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>Updated: {ambulance.lastUpdate}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.ambulanceActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleAmbulanceAction(ambulance.id, 'Dispatch')}
                  >
                    <MaterialIcons name="send" size={16} color="#FFF" />
                    <ThemedText style={styles.actionButtonText}>Dispatch</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.secondaryAction]}
                    onPress={() => handleAmbulanceAction(ambulance.id, 'Maintain')}
                  >
                    <MaterialIcons name="build" size={16} color="#FFF" />
                    <ThemedText style={styles.actionButtonText}>Maintain</ThemedText>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.infoAction]}
                    onPress={() => Alert.alert('Details', `Details for ${ambulance.id}`)}
                  >
                    <MaterialIcons name="info" size={16} color="#FFF" />
                    <ThemedText style={styles.actionButtonText}>Details</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ThemedView>
        )}

        {activeTab === 'patients' && (
          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardTitle}>Patient Admissions</ThemedText>
            <ThemedText style={styles.cardDescription}>
              Current patients admitted via ambulance services
            </ThemedText>
            
            {mockPatientAdmissions.map(patient => (
              <View key={patient.id} style={styles.patientCard}>
                <View style={styles.patientCardHeader}>
                  <View>
                    <ThemedText style={styles.patientCardName}>{patient.patientName}</ThemedText>
                    <ThemedText style={styles.patientCardDetails}>
                      {patient.age} • {patient.gender} • {patient.condition}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(patient.status) }]}>
                    <ThemedText style={styles.statusText}>{patient.status}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.patientCardInfo}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="local-shipping" size={14} color="#666" />
                    <ThemedText style={styles.infoText}>Ambulance: {patient.ambulanceId}</ThemedText>
                  </View>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="medical-services" size={14} color="#666" />
                    <ThemedText style={styles.infoText}>Doctor: {patient.doctor}</ThemedText>
                  </View>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="access-time" size={14} color="#666" />
                    <ThemedText style={styles.infoText}>Admitted: {patient.admissionTime}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.patientActions}>
                  <TouchableOpacity style={styles.patientAction}>
                    <MaterialIcons name="visibility" size={16} color="#1976D2" />
                    <ThemedText style={styles.patientActionText}>View Details</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.patientAction}>
                    <MaterialIcons name="assignment" size={16} color="#4CAF50" />
                    <ThemedText style={styles.patientActionText}>Medical Record</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ThemedView>
        )}

        {activeTab === 'emergencies' && (
          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardTitle}>Emergency Cases</ThemedText>
            <ThemedText style={styles.cardDescription}>
              Active emergency cases being handled
            </ThemedText>
            
            {mockEmergencyCases.map(emergency => (
              <View key={emergency.id} style={styles.emergencyCard}>
                <View style={styles.emergencyHeader}>
                  <View>
                    <ThemedText style={styles.emergencyId}>Case #{emergency.id.split('-')[1]}</ThemedText>
                    <ThemedText style={styles.emergencyPatient}>{emergency.patientName}</ThemedText>
                    <ThemedText style={styles.emergencyType}>{emergency.emergencyType}</ThemedText>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: getStatusColor(emergency.priority) }]}>
                    <MaterialIcons name={getPriorityIcon(emergency.priority) as any} size={14} color="#FFF" />
                    <ThemedText style={styles.priorityText}>{emergency.priority}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.emergencyDetails}>
                  <View style={styles.emergencyDetail}>
                    <MaterialIcons name="local-shipping" size={14} color="#666" />
                    <ThemedText style={styles.emergencyDetailText}>Ambulance: {emergency.ambulanceId}</ThemedText>
                  </View>
                  <View style={styles.emergencyDetail}>
                    <MaterialIcons name="access-time" size={14} color="#666" />
                    <ThemedText style={styles.emergencyDetailText}>ETA: {emergency.eta}</ThemedText>
                  </View>
                  <View style={styles.emergencyDetail}>
                    <MaterialIcons name="location-on" size={14} color="#666" />
                    <ThemedText style={styles.emergencyDetailText}>Status: {emergency.status}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.emergencyActions}>
                  <TouchableOpacity style={styles.emergencyAction}>
                    <MaterialIcons name="call" size={16} color="#1976D2" />
                    <ThemedText style={styles.emergencyActionText}>Contact</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.emergencyAction}>
                    <MaterialIcons name="update" size={16} color="#4CAF50" />
                    <ThemedText style={styles.emergencyActionText}>Update</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.emergencyAction}>
                    <MaterialIcons name="track-changes" size={16} color="#FF9800" />
                    <ThemedText style={styles.emergencyActionText}>Track</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ThemedView>
        )}

        {/* Hospital Management Actions */}
        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardTitle}>Hospital Management</ThemedText>
          <View style={styles.managementActions}>
            <TouchableOpacity style={styles.managementAction}>
              <MaterialIcons name="add" size={24} color="#1976D2" />
              <ThemedText style={styles.managementActionText}>Add Ambulance</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.managementAction}>
              <MaterialIcons name="assignment" size={24} color="#4CAF50" />
              <ThemedText style={styles.managementActionText}>Generate Report</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.managementAction}>
              <MaterialIcons name="settings" size={24} color="#7B1FA2" />
              <ThemedText style={styles.managementActionText}>Hospital Settings</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ScrollView>

      {/* Logout Button */}
      <ThemedView style={styles.card}>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={20} color="#666" />
          <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </View>
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
  hospitalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  hospitalDetails: {
    alignItems: 'center',
  },
  hospitalName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  hospitalId: {
    fontSize: 14,
    color: '#666',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontWeight: '600',
    color: '#666',
    fontSize: 12,
  },
  activeTabText: {
    color: '#1976D2',
  },
  content: {
    flex: 1,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#1C1C1E',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
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
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  hospitalInfoList: {
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
    minWidth: 80,
  },
  infoValue: {
    color: '#1C1C1E',
    flex: 1,
  },
  patientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  patientDetails: {
    color: '#666',
    marginBottom: 4,
  },
  admissionTime: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ambulanceCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  ambulanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ambulanceId: {
    fontWeight: 'bold',
    color: '#666',
    fontSize: 14,
  },
  ambulanceDriver: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  ambulanceDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
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
    backgroundColor: '#1976D2',
    padding: 8,
    borderRadius: 6,
    gap: 4,
  },
  secondaryAction: {
    backgroundColor: '#FF9800',
  },
  infoAction: {
    backgroundColor: '#6C757D',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  patientCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  patientCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  patientCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  patientCardDetails: {
    color: '#666',
    fontSize: 14,
  },
  patientCardInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
  patientActions: {
    flexDirection: 'row',
    gap: 16,
  },
  patientAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  patientActionText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  emergencyCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  emergencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  emergencyId: {
    fontWeight: 'bold',
    color: '#666',
    fontSize: 12,
  },
  emergencyPatient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  emergencyType: {
    color: '#666',
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  emergencyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
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
  emergencyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emergencyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emergencyActionText: {
    color: '#1976D2',
    fontSize: 12,
    fontWeight: '600',
  },
  managementActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  managementAction: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    minWidth: '30%',
  },
  managementActionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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