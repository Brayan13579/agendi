import { Alert, Platform } from 'react-native'

// En react-native-web, Alert.alert no hace nada y Alert.prompt ni siquiera existe
// (son APIs nativas de iOS/Android). Este wrapper usa diálogos del navegador en web
// y la API nativa en móvil, para que confirmaciones y prompts funcionen en ambos.

function alert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    return Alert.alert(title, message, buttons)
  }

  const text = message ? `${title}\n\n${message}` : title
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }]

  if (list.length === 1) {
    window.alert(text)
    list[0].onPress?.()
    return
  }

  const confirmBtn = list.find(b => b.style !== 'cancel') || list[list.length - 1]
  const cancelBtn = list.find(b => b.style === 'cancel')

  if (window.confirm(text)) {
    confirmBtn.onPress?.()
  } else {
    cancelBtn?.onPress?.()
  }
}

function prompt(title, message, buttons, type = 'plain-text', defaultValue = '') {
  if (Platform.OS !== 'web') {
    return Alert.prompt(title, message, buttons, type, defaultValue)
  }

  const text = message ? `${title}\n\n${message}` : title
  const value = window.prompt(text, defaultValue)
  const list = buttons || []
  const cancelBtn = list.find(b => b.style === 'cancel')
  const confirmBtn = list.find(b => b.style !== 'cancel') || list[list.length - 1]

  if (value === null) {
    cancelBtn?.onPress?.(value)
  } else {
    confirmBtn?.onPress?.(value)
  }
}

export default { alert, prompt }
