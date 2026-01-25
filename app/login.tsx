import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ScrollView, 
  ActivityIndicator,
  Platform,
  Linking 
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState('user');
  const [userCredentials, setUserCredentials] = useState({ phone: '' });
  const [driverCredentials, setDriverCredentials] = useState({ id: '', password: '' });
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
        // Don't block login if location fails
        Alert.alert(
          'Location Access',
          'Location access not granted. You can still track ambulances but with limited features.',
          [
            { 
              text: 'Continue Anyway', 
              onPress: () => {
                router.push({
                  pathname: '/(tabs)/track',
                  params: { 
                    userPhone: userCredentials.phone,
                    // Use default location
                    userLat: 10.8998,
                    userLng: 76.9962
                  }
                });
              }
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        setLoading(false);
        return;
      }

      // Get location with timeout
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Faster than High
          timeInterval: 5000,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Location timeout')), 8000)
        )
      ]) as any;

      console.log('📍 Location obtained');
      
      // Navigate immediately
      router.push({
        pathname: '/(tabs)/track',
        params: { 
          userPhone: userCredentials.phone,
          userLat: location.coords.latitude,
          userLng: location.coords.longitude
        }
      });
      
    } catch (error: any) {
      console.error('Location error:', error);
      
      // Continue with default location
      Alert.alert(
        'Location Issue',
        'Using default location. You can update location later.',
        [{ 
          text: 'Continue', 
          onPress: () => {
            router.push({
              pathname: '/(tabs)/track',
              params: { 
                userPhone: userCredentials.phone,
                userLat: 10.8998,
                userLng: 76.9962
              }
            });
          }
        }]
      );
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
      // FOR RENDER - Always use HTTPS
      const API_URL = 'https://gps-tracking-system-for-ambulance-1.onrender.com';
      
      console.log('🌐 Connecting to:', API_URL);
      console.log('📱 Login attempt:', driverCredentials.id);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      
      const response = await fetch(`${API_URL}/api/driver/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ambulanceId: driverCredentials.id,
          phone: driverCredentials.password
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('✅ Response received, status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Response data:', data);

      if (data.success) {
        console.log('🎉 Login successful, navigating to dashboard');
        Alert.alert('Success', 'Driver login successful!');
        
        // Navigate to dashboard
        router.push({
          pathname: '/driver/dashboard',
          params: { driverData: JSON.stringify(data.driver) }
        });
        
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
      }
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      if (error.name === 'AbortError') {
        Alert.alert(
          'Timeout Error', 
          'Server is taking too long to respond. This happens sometimes on Render free tier.\n\nPlease wait 30 seconds and try again.'
        );
      } else if (error.message.includes('Network request failed')) {
        Alert.alert(
          'Network Error', 
          'Cannot connect to server. Please:\n1. Check your internet connection\n2. Make sure the server is running on Render\n3. Try refreshing the page'
        );
      } else if (error.message.includes('Server error')) {
        Alert.alert(
          'Server Error', 
          'The server returned an error. Try using demo credentials:\n\nAmbulance ID: AMB-001\nPhone: 9876543210'
        );
      } else {
        Alert.alert('Error', 'Login failed. Please try again.');
      }
      
    } finally {
      setLoading(false);
    }
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
        ) : (
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