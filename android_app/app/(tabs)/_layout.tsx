import { Tabs } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';

function TabIcon({ name, color }: { name: string; color: string }) {
  return <FontAwesome5 name={name} size={20} color={color} solid />;
}

export default function TabLayout() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBarBackground,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: Colors.navBackground },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          headerTitle: '🚜 KrishiYantra',
        }}
      />
      <Tabs.Screen
        name="equipment/index"
        options={{
          title: 'Equipment',
          tabBarIcon: ({ color }) => <TabIcon name="tractor" color={color} />,
          headerTitle: 'Browse Equipment',
        }}
      />
      <Tabs.Screen
        name="rentals"
        options={{
          title: 'My Rentals',
          tabBarIcon: ({ color }) => <TabIcon name="calendar-check" color={color} />,
          headerTitle: 'My Rentals',
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: 'Contact',
          tabBarIcon: ({ color }) => <TabIcon name="envelope" color={color} />,
          headerTitle: 'Contact Us',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="user-circle" color={color} />,
          headerTitle: 'My Profile',
        }}
      />
    </Tabs>
  );
}
