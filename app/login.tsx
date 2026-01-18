import { useState, useEffect } from 'react';
import { StyleSheet, View, Image, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState('user');
  const [userCredentials, setUserCredentials] = useState({ phone: '' });
  const [driverCredentials, setDriverCredentials] = useState({ id: '', password: '' });
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [hospitalCredentials, setHospitalCredentials] = useState({ 
    hospitalId: '', 
    username: '', 
    password: '' 
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Request location permission on component mount
  useEffect(() => {
    if (activeTab === 'user') {
      requestLocationPermission();
    }
  }, [activeTab]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted yet');
      } else {
        console.log('Location permission granted');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const handleUserLogin = async () => {
    if (!userCredentials.phone || userCredentials.phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    
    try {
      // Request location permission if not already granted
      let { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to track ambulances. Please enable location services.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
        setLoading(false);
        return;
      }

      // Get user's location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      console.log('User location obtained:', location.coords);
      
      // Directly navigate to track page with user info
      router.push({
        pathname: '/(tabs)/track',
        params: { 
          userPhone: userCredentials.phone,
          userLat: location.coords.latitude,
          userLng: location.coords.longitude
        }
      });
      
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDriverLogin = async () => {
    if (!driverCredentials.id || !driverCredentials.password) {
      Alert.alert('Error', 'Please enter both Driver ID and phone number');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('http://10.98.28.101:5000/api/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambulanceId: driverCredentials.id,
          phone: driverCredentials.password
        })
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', 'Driver login successful!');
        router.push({
          pathname: '/driver/dashboard',
          params: { driverData: JSON.stringify(data.driver) }
        });
      } else {
        Alert.alert('Error', data.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleHospitalLogin = () => {
    if (!hospitalCredentials.hospitalId || !hospitalCredentials.username || !hospitalCredentials.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    // Simple hospital admin validation
    setTimeout(() => {
      setLoading(false);
      if (hospitalCredentials.username === 'hospital' && hospitalCredentials.password === 'hospital123') {
        Alert.alert('Success', 'Hospital admin login successful!');
        router.push('/Hospital-admin/dashboard');
      } else {
        Alert.alert('Error', 'Invalid hospital admin credentials');
      }
    }, 1500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Image
          source={require('../assets/images/ambulance_blue.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText style={styles.title}>MediRescue</ThemedText>
        <ThemedText style={styles.subtitle}>Emergency Ambulance Service</ThemedText>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'user' && styles.activeTab]}
          onPress={() => setActiveTab('user')}
        >
          <MaterialIcons 
            name="person" 
            size={16} 
            color={activeTab === 'user' ? '#D32F2F' : '#666'} 
          />
          <ThemedText style={[styles.tabText, activeTab === 'user' && styles.activeTabText]}>
            User
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'driver' && styles.activeTab]}
          onPress={() => setActiveTab('driver')}
        >
          <MaterialIcons 
            name="local-shipping" 
            size={16} 
            color={activeTab === 'driver' ? '#1976D2' : '#666'} 
          />
          <ThemedText style={[styles.tabText, activeTab === 'driver' && styles.activeTabText]}>
            Driver
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'hospital' && styles.activeTab]}
          onPress={() => setActiveTab('hospital')}
        >
          <MaterialIcons 
            name="local-hospital" 
            size={16} 
            color={activeTab === 'hospital' ? '#7B1FA2' : '#666'} 
          />
          <ThemedText style={[styles.tabText, activeTab === 'hospital' && styles.activeTabText]}>
            Hospital
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.formContainer}>
        {activeTab === 'user' ? (
          <View style={styles.form}>
            <ThemedText style={styles.formTitle}>User Access</ThemedText>
            <ThemedText style={styles.formDescription}>
              Enter your phone number to track ambulances in real-time
            </ThemedText>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                value={userCredentials.phone}
                onChangeText={(text) => setUserCredentials({...userCredentials, phone: text})}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleUserLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <ThemedText style={styles.loginButtonText}>
                  Track Ambulance
                </ThemedText>
              )}
            </TouchableOpacity>

            <View style={styles.features}>
              <ThemedText style={styles.featuresTitle}>Features:</ThemedText>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Track ambulance in real-time</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>See ambulance driver location</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Share your location with driver</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Send emergency requests</ThemedText>
              </View>
            </View>
          </View>
        ) : activeTab === 'driver' ? (
          <View style={styles.form}>
            <ThemedText style={styles.formTitle}>Driver Login</ThemedText>
            <ThemedText style={styles.formDescription}>
              Enter your ambulance ID and phone number
            </ThemedText>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="badge" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ambulance ID (e.g., AMB-001)"
                value={driverCredentials.id}
                onChangeText={(text) => setDriverCredentials({...driverCredentials, id: text})}
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="phone" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={driverCredentials.password}
                onChangeText={(text) => setDriverCredentials({...driverCredentials, password: text})}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.loginButton, styles.driverLoginButton, loading && styles.buttonDisabled]}
              onPress={handleDriverLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="local-shipping" size={20} color="#FFF" />
                  <ThemedText style={styles.loginButtonText}>
                    Login as Driver
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.features}>
              <ThemedText style={styles.featuresTitle}>Driver Features:</ThemedText>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Accept emergency requests</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Track patient location in real-time</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Navigate to patient location</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Share your location with patients</ThemedText>
              </View>
            </View>
            
            <View style={styles.registerInfo}>
              <MaterialIcons name="info" size={16} color="#1976D2" />
              <ThemedText style={styles.registerText}>
                Not registered? Contact administration or use Postman to register
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <ThemedText style={styles.formTitle}>Hospital Admin Login</ThemedText>
            <ThemedText style={styles.formDescription}>
              Enter hospital credentials to access hospital dashboard
            </ThemedText>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="local-hospital" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Hospital ID"
                value={hospitalCredentials.hospitalId}
                onChangeText={(text) => setHospitalCredentials({...hospitalCredentials, hospitalId: text})}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Admin Username"
                value={hospitalCredentials.username}
                onChangeText={(text) => setHospitalCredentials({...hospitalCredentials, username: text})}
                autoCapitalize="none"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={hospitalCredentials.password}
                onChangeText={(text) => setHospitalCredentials({...hospitalCredentials, password: text})}
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.loginButton, styles.hospitalLoginButton, loading && styles.buttonDisabled]}
              onPress={handleHospitalLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="local-hospital" size={20} color="#FFF" />
                  <ThemedText style={styles.loginButtonText}>
                    Login as Hospital Admin
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.features}>
              <ThemedText style={styles.featuresTitle}>Hospital Admin Features:</ThemedText>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Manage hospital ambulances</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>View patient admissions</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Monitor emergency cases</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={styles.featureText}>Generate hospital reports</ThemedText>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <ThemedText style={styles.emergencyText}>🚑 Emergency Contact: 108</ThemedText>
        <ThemedText style={styles.footerText}>Available 24/7 • Immediate Response • Professional Care</ThemedText>
        
        <View style={styles.contactInfo}>
          <ThemedText style={styles.contactText}>
            📍 Malampichampatti Area • 📞 +91 44 2656 7890
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    padding: 4,
    marginVertical: 20,
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
    color: '#D32F2F',
  },
  formContainer: {
    width: '100%',
    marginBottom: 30,
  },
  form: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2C3E50',
    textAlign: 'center',
  },
  formDescription: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D32F2F',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
    gap: 8,
  },
  driverLoginButton: {
    backgroundColor: '#1976D2',
  },
  hospitalLoginButton: {
    backgroundColor: '#7B1FA2',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  features: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 20,
  },
  featuresTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#2C3E50',
    fontSize: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  featureText: {
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  registerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 10,
  },
  registerText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emergencyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 8,
    textAlign: 'center',
  },
  footerText: {
    color: '#95A5A6',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  contactInfo: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  contactText: {
    color: '#2E7D32',
    fontSize: 12,
    textAlign: 'center',
  },
});