import React, { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { NotificationContext } from './notificationContext'

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([])
    const fetchSequence = useRef(0)

    const fetchNotifications = () => {
        const requestSequence = ++fetchSequence.current
        api.get('/notifications').then(data => {
            if (Array.isArray(data) && requestSequence === fetchSequence.current) {
                const visibleNotifications = data.filter(notification =>
                    String(notification.title || '').trim().toLowerCase() !== 'equipment currently in use'
                )
                setNotifications(previous => {
                    const previouslyRead = new Set(
                        previous
                            .filter(notification => notification.read)
                            .map(notification => String(notification.id))
                    )
                    return visibleNotifications.map(notification => previouslyRead.has(String(notification.id))
                        ? { ...notification, read: true }
                        : notification)
                })
            }
        }).catch(() => {})
    }

    useEffect(() => {
        fetchNotifications()
        // Auto-refresh notifications every 15 seconds so admin sees live alerts & staff actions
        const timer = setInterval(fetchNotifications, 15000)
        return () => clearInterval(timer)
    }, [])

    const markAsRead = async (id) => {
        await api.put(`/notifications/${id}/read`, {})
        fetchSequence.current += 1
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    }

    const markAllAsRead = async () => {
        await api.put('/notifications/mark-all-read', {
            notificationIds: notifications
                .filter(n => n.id != null)
                .map(n => String(n.id))
        })
        fetchSequence.current += 1
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const deleteNotifications = async (ids) => {
        const uniqueIds = [...new Set(ids.map(id => String(id)))]
        await api.delete('/notifications', { notificationIds: uniqueIds })
        fetchSequence.current += 1
        const deletedIds = new Set(uniqueIds)
        setNotifications(prev => prev.filter(n => !deletedIds.has(String(n.id))))
    }

    const unreadCount = notifications.filter(n => !n.read).length

    return (
        <NotificationContext.Provider value={{ notifications, setNotifications, markAsRead, markAllAsRead, deleteNotifications, unreadCount, refreshNotifications: fetchNotifications }}>
            {children}
        </NotificationContext.Provider>
    )
}
