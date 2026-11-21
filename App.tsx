import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import AdminIndex from '@/app/(admin)';
import LibraryScreen from '@/app/(admin)/library';
import SetlistsScreen from '@/app/(admin)/setlists';
import SetlistDetailScreen from '@/app/(admin)/setlist-detail';
import SettingsScreen from '@/app/(admin)/settings';
import LiveScreen from '@/features/live/screens/live-screen';
import { colors } from '@/shared/theme/colors';
import type { RootStackParamList } from '@/app/(admin)/param-list';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.dark.background },
        }}
      >
        <Stack.Screen name="Admin" component={AdminIndex} />
        <Stack.Screen name="Library" component={LibraryScreen} />
        <Stack.Screen name="Setlists" component={SetlistsScreen} />
        <Stack.Screen name="SetlistDetail" component={SetlistDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Live" component={LiveScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
