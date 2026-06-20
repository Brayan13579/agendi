import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ActivityIndicator, View, Text, Platform, Image } from 'react-native'
import { initApi } from '../services/api'

import LoginScreen from '../screens/LoginScreen'
import AgendaScreen from '../screens/AgendaScreen'
import ScheduleScreen from '../screens/ScheduleScreen'
import ServicesScreen from '../screens/ServicesScreen'
import ConfigScreen from '../screens/ConfigScreen'
import { colors, fonts } from '../services/theme'

const logoGold = require('../assets/images/logo-gold.png')

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

const SCREEN_TITLES = {
  Agenda: 'Agenda',
  Horarios: 'Horarios',
  Servicios: 'Servicios',
  Config: 'Ajustes',
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1 },
        headerShadowVisible: false,
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={logoGold} style={{ height: 36, width: 36 }} resizeMode="contain" />
            <Text style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: 1, color: colors.textPrimary }}>
              {SCREEN_TITLES[route.name]}
            </Text>
          </View>
        ),
        headerTitleAlign: 'left',
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 24 : 16,
          height: 64,
          borderRadius: 24,
          backgroundColor: colors.bgElevated,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          paddingBottom: 0,
          paddingTop: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
        },
        tabBarItemStyle: {
          height: 64,
          justifyContent: 'center',
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.5 },
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
      <Tab.Screen name="Agenda"    component={AgendaScreen}   options={{ title: SCREEN_TITLES.Agenda }} />
      <Tab.Screen name="Horarios"  component={ScheduleScreen} options={{ title: SCREEN_TITLES.Horarios }} />
      <Tab.Screen name="Servicios" component={ServicesScreen} options={{ title: SCREEN_TITLES.Servicios }} />
      <Tab.Screen name="Config"    component={ConfigScreen}   options={{ title: SCREEN_TITLES.Config }} />
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
