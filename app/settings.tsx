import { useState, useEffect, useRef } from 'react';
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
  backupWithLogs,
  initBackupStatus,
} from '@/src/services/backup';

export default function SettingsScreen() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setUrl(kvGet(KV_WEBDAV_URL) || '');
    setUsername(kvGet(KV_WEBDAV_USERNAME) || '');
    setPassword(kvGet(KV_WEBDAV_PASSWORD) || '');
  }, []);

  const handleSave = () => {
    kvSet(KV_WEBDAV_URL, url.trim());
    kvSet(KV_WEBDAV_USERNAME, username.trim());
    kvSet(KV_WEBDAV_PASSWORD, password);

    initBackupStatus();

    setHasChanges(false);
    Alert.alert('Saved', 'Backup settings updated.');
  };

  const handleBackupNow = async () => {
    // Save current values first so the backup uses them
    kvSet(KV_WEBDAV_URL, url.trim());
    kvSet(KV_WEBDAV_USERNAME, username.trim());
    kvSet(KV_WEBDAV_PASSWORD, password);
    initBackupStatus();
    setHasChanges(false);

    setLogs([]);
    setIsRunning(true);

    await backupWithLogs(
      url.trim(),
      username.trim() || null,
      password || null,
      (line) => {
        setLogs((prev) => [...prev, line]);
        // Scroll to bottom after each log line
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      },
    );

    setIsRunning(false);
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
            setLogs([]);
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
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
              style={[styles.button, styles.backupButton]}
              onPress={handleBackupNow}
              disabled={isRunning}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Backup Now</Text>
              )}
            </TouchableOpacity>

            {hasChanges && (
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Log output */}
          {logs.length > 0 && (
            <View style={styles.logContainer}>
              <Text style={styles.logTitle}>BACKUP LOG</Text>
              {logs.map((line, i) => (
                <Text
                  key={i}
                  style={[
                    styles.logLine,
                    line.startsWith('ERROR') && styles.logError,
                    line.startsWith('FAILED') && styles.logError,
                    line === 'SUCCESS' && styles.logSuccess,
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>
          )}

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
    paddingBottom: 40,
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
  backupButton: {
    backgroundColor: '#0A84FF',
  },
  saveButton: {
    backgroundColor: '#2C2C2E',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  logTitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  logLine: {
    color: '#AEAEB2',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  logError: {
    color: '#EF4444',
  },
  logSuccess: {
    color: '#22C55E',
    fontWeight: '700',
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
