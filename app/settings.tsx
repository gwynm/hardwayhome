import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { kvGet, kvSet } from '@/src/db/queries';
import {
  KV_WEBDAV_URL,
  KV_WEBDAV_USERNAME,
  KV_WEBDAV_PASSWORD,
  testWebdavConnection,
  initBackupStatus,
} from '@/src/services/backup';

export default function SettingsScreen() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setUrl(kvGet(KV_WEBDAV_URL) || '');
    setUsername(kvGet(KV_WEBDAV_USERNAME) || '');
    setPassword(kvGet(KV_WEBDAV_PASSWORD) || '');
  }, []);

  const handleSave = () => {
    kvSet(KV_WEBDAV_URL, url.trim());
    kvSet(KV_WEBDAV_USERNAME, username.trim());
    kvSet(KV_WEBDAV_PASSWORD, password);

    // Re-evaluate backup status
    initBackupStatus();

    setHasChanges(false);
    Alert.alert('Saved', 'Backup settings updated.');
  };

  const handleTest = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      Alert.alert('No URL', 'Enter a WebDAV URL first.');
      return;
    }

    setIsTesting(true);
    const ok = await testWebdavConnection(trimmedUrl, username.trim() || null, password || null);
    setIsTesting(false);

    if (ok) {
      Alert.alert('Success', 'WebDAV server responded OK.');
    } else {
      Alert.alert('Failed', 'Could not reach the WebDAV server. Check the URL and token.');
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Clear Settings',
      'Remove WebDAV backup configuration? Local backups will still be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setUrl('');
            setUsername('');
            setPassword('');
            kvSet(KV_WEBDAV_URL, '');
            kvSet(KV_WEBDAV_USERNAME, '');
            kvSet(KV_WEBDAV_PASSWORD, '');
            initBackupStatus();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Settings</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* WebDAV Section */}
          <Text style={styles.sectionTitle}>REMOTE BACKUP (WEBDAV)</Text>

          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={(v) => { setUrl(v); setHasChanges(true); }}
            placeholder="https://mywebdav.example/hardwayhome/backups"
            placeholderTextColor="#636366"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(v) => { setUsername(v); setHasChanges(true); }}
            placeholder="WebDAV username"
            placeholderTextColor="#636366"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(v) => { setPassword(v); setHasChanges(true); }}
            placeholder="WebDAV password"
            placeholderTextColor="#636366"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Text style={styles.hint}>
            After each workout, the database is uploaded via HTTP PUT to this URL.
            A local backup is always saved to Files.app regardless of this setting.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={handleTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Test Connection</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton, !hasChanges && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={!hasChanges}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>

          {url.trim() !== '' && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear WebDAV Settings</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    color: '#0A84FF',
    fontSize: 17,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  hint: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#2C2C2E',
  },
  saveButton: {
    backgroundColor: '#0A84FF',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
