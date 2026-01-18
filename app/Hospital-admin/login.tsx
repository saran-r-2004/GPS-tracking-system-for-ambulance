import { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  ScrollView
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function HospitalAdminLoginScreen() {
  const [credentials, setCredentials] = useState({
    hospitalId: '',
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = () => {
    if (!credentials.hospitalId || !credentials.username || !credentials.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    // Simulate login process
    setTimeout(() => {
      setLoading(false);
      
      // Simple validation - in real app, this would call your API
      if (credentials.username === 'hospital' && credentials.password === 'hospital123') {
        Alert.alert('Success', 'Hospital admin login successful!');
        router.replace('/Hospital-admin/dashboard');
      } else {
        Alert.alert('Error', 'Invalid hospital admin credentials');
      }
    }, 1500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.logo}
        />
        <ThemedText style={styles.title}>Hospital Admin Portal</ThemedText>
        <ThemedText style={styles.subtitle}>Manage your hospital's ambulance services</ThemedText>
      </View>

      <ThemedView style={styles.formCard}>
        <ThemedText style={styles.formTitle}>Hospital Administrator Login</ThemedText>
        <ThemedText style={styles.formDescription}>
          Access your hospital's emergency service dashboard
        </ThemedText>

        <View style={styles.inputContainer}>
          <MaterialIcons name="local-hospital" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Hospital ID"
            value={credentials.hospitalId}
            onChangeText={(text) => setCredentials({...credentials, hospitalId: text})}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Admin Username"
            value={credentials.username}
            onChangeText={(text) => setCredentials({...credentials, username: text})}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={credentials.password}
            onChangeText={(text) => setCredentials({...credentials, password: text})}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.loginButton, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <MaterialIcons name="medical-services" size={20} color="#FFF" />
          <ThemedText style={styles.loginButtonText}>
            {loading ? "Signing In..." : "Login as Hospital Admin"}
          </ThemedText>
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
      </ThemedView>

      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <MaterialIcons name="arrow-back" size={20} color="#666" />
        <ThemedText style={styles.backButtonText}>Back to Main Login</ThemedText>
      </TouchableOpacity>
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
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
  },
  formDescription: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    fontSize: 14,
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
    backgroundColor: '#1976D2',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
    gap: 8,
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
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#E9ECEF',
    gap: 8,
  },
  backButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  });