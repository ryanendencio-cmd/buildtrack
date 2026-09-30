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

    useEffect(() => {
        api.get('/notifications').then(data => {
            const readIds = getReadIds()
            setNotifications(data.map(n => ({ ...n, read: readIds.includes(n.id) })))
        }).catch(() => {})
    }, [])

    const markAsRead = (id) => {
        const readIds = getReadIds()
        if (!readIds.includes(id)) saveReadIds([...readIds, id])
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    }

    const markAllAsRead = () => {
        const allIds = notifications.map(n => n.id)
        saveReadIds(allIds)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const unreadCount = notifications.filter(n => !n.read).length

    return (
        <NotificationContext.Provider value={{ notifications, setNotifications, markAsRead, markAllAsRead, unreadCount }}>
            {children}
        </NotificationContext.Provider>
    )
}
