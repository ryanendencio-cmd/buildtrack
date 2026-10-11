import React, { useState, useEffect } from 'react'
import { api } from '../api'
import { NotificationContext } from './notificationContext'

const STORAGE_KEY = 'readNotificationIds'

function getReadIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveReadIds(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([])

    const fetchNotifications = () => {
        api.get('/notifications').then(data => {
            if (Array.isArray(data)) {
                const readIds = getReadIds()
                setNotifications(data.map(n => ({
                    ...n,
                    read: Boolean(n.read) || readIds.includes(n.id)
                })))
            }
        }).catch(() => {})
    }

    useEffect(() => {
        fetchNotifications()
        // Auto-refresh notifications every 15 seconds so admin sees live alerts & staff actions
        const timer = setInterval(fetchNotifications, 15000)
        return () => clearInterval(timer)
    }, [])

    const markAsRead = (id) => {
        const readIds = getReadIds()
        if (!readIds.includes(id)) saveReadIds([...readIds, id])
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        api.put(`/notifications/${id}/read`, {}).catch(() => {})
    }

    const markAllAsRead = () => {
        const allIds = notifications.map(n => n.id)
        saveReadIds(allIds)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        api.put('/notifications/mark-all-read', {}).catch(() => {})
    }

    const unreadCount = notifications.filter(n => !n.read).length

    return (
        <NotificationContext.Provider value={{ notifications, setNotifications, markAsRead, markAllAsRead, unreadCount, refreshNotifications: fetchNotifications }}>
            {children}
        </NotificationContext.Provider>
    )
}
