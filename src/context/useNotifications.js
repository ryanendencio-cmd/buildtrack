import { useContext } from 'react'
import { NotificationContext } from './notificationContext'

export const useNotifications = () => useContext(NotificationContext)
