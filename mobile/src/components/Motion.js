import React, { useRef, useEffect } from 'react'
import { Animated, TouchableOpacity, Easing } from 'react-native'

/**
 * Envuelve contenido con una entrada de fade + slide-up.
 * Usa `delay` para escalonar listas (efecto "stagger").
 */
export function FadeInUp({ children, delay = 0, distance = 16, duration = 420, scale = false, style }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [])

  const transform = [
    {
      translateY: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [distance, 0],
      }),
    },
  ]
  if (scale) {
    transform.push({
      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
    })
  }

  return (
    <Animated.View style={[style, { opacity: anim, transform }]}>
      {children}
    </Animated.View>
  )
}

/**
 * Botón táctil con un leve "press scale" para sensación más dinámica.
 */
export function PressScale({ children, onPress, style, scaleTo = 0.96, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current

  function pressIn() {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start()
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      style={style}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}
