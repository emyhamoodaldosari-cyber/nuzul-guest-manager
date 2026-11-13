import { useState } from 'react';
import { View, Image, Pressable, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import App from '../App';

export default function Home() {
  const [started, setStarted] = useState(false);
  if (started) return <App />;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F6E8D5', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', width: '100%', maxWidth: 420 }}>
          <Image source={require('../assets/images/logo.png')} resizeMode="contain" style={{ width: '100%', aspectRatio: 1, maxWidth: 360, borderRadius: 24 }} />
          <Text style={{ color: '#071A32', fontSize: 20, fontWeight: '700', marginTop: 24, textAlign: 'center' }}>إدارة النزلاء والإقامة</Text>
          <Text style={{ color: '#504E51', fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 24 }}>سجّل الدخول إلى إدارة استراحة المحمدي</Text>
          <Pressable onPress={() => setStarted(true)} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 26, backgroundColor: '#071A32', minHeight: 52, width: '100%', borderRadius: 14, justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ color: '#FAF2E5', fontSize: 16, fontWeight: '700' }}>ابدأ الآن</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
