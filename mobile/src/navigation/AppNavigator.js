import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ActivityIndicator, View } from 'react-native'
import { initApi } from '../services/api'

import LoginScreen from '../screens/LoginScreen'
import AgendaScreen from '../screens/AgendaScreen'
import ScheduleScreen from '../screens/ScheduleScreen'
import ServicesScreen from '../screens/ServicesScreen'
import ConfigScreen from '../screens/ConfigScreen'
import { colors } from '../services/theme'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Agenda:    focused ? 'calendar'         : 'calendar-outline',
            Horarios:  focused ? 'time'             : 'time-outline',
            Servicios: focused ? 'cut'              : 'cut-outline',
            Config:    focused ? 'settings'         : 'settings-outline',
          }
          return <Ionicons name={icons[route.name]} size={22} color={color} />
        }
      })}
    >
      <Tab.Screen name="Agenda"    component={AgendaScreen}   options={{ title: 'Agenda' }} />
      <Tab.Screen name="Horarios"  component={ScheduleScreen} options={{ title: 'Horarios' }} />
      <Tab.Screen name="Servicios" component={ServicesScreen} options={{ title: 'Servicios' }} />
      <Tab.Screen name="Config"    component={ConfigScreen}   options={{ title: 'Config' }} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null)

  useEffect(() => {
    async function checkSession() {
      try {
        const apiUrl = await AsyncStorage.getItem('API_URL')
        const apiKey = await AsyncStorage.getItem('API_KEY')
        if (apiUrl && apiKey) {
          await initApi()
          setInitialRoute('Main')
        } else {
          setInitialRoute('Login')
        }
      } catch {
        setInitialRoute('Login')
      }
    }
    checkSession()
  }, [])

  if (!initialRoute) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main"  component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
