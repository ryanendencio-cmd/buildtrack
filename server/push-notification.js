// push-notification.js
// Universal Push Notification Dispatcher for Mobile Devices
// Supports Firebase Cloud Messaging (FCM for Flutter / Native) and Expo Push Service (React Native)

const https = require('https');
const path = require('path');
const fs = require('fs');

let fcmMessaging = null;

// Initialize Firebase Admin Messaging for Native OS push notifications (works when app is completely closed)
try {
  const serviceAccountPath = path.resolve(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    // Use the modular firebase-admin API (v10+)
    const { cert, initializeApp, getApps, getApp } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    const pushAppName = 'push-notification-app';
    const existingApps = getApps();
    const existingApp = existingApps.find(a => a.name === pushAppName);
    let app;
    if (existingApp) {
      app = existingApp;
    } else {
      app = initializeApp({
        credential: cert(serviceAccount)
      }, pushAppName);
    }
    fcmMessaging = getMessaging(app);
    console.log('Firebase Messaging initialized successfully for push notifications.');
  } else {
    console.warn('Firebase service account file not found — push notifications disabled.');
  }
} catch (err) {
  console.warn('Firebase Messaging not initialized for push notifications:', err.message);
}

/**
 * Validates whether a token is an Expo Push Token: ExponentPushToken[...] or ExpoPushToken[...]
 */
function isExpoPushToken(token) {
  return typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token.trim());
}

/**
 * Sends push notification via Firebase Cloud Messaging (FCM)
 * Delivers directly to Android/iOS system notification trays even when the app is completely CLOSED/TERMINATED.
 */
async function sendFcmNotification({ token, title, message, data = {} }) {
  if (!fcmMessaging) {
    return { success: false, error: 'FCM messaging service is not initialized' };
  }

  // Format string values for FCM data payload
  const stringData = {};
  for (const [key, val] of Object.entries(data)) {
    stringData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
  }

  const payload = {
    token: token.trim(),
    notification: {
      title: title || 'BuildTrack Alert',
      body: message || ''
    },
    data: stringData,
    android: {
      priority: 'high',
      notification: {
        channelId: 'buildtrack_alerts',
        sound: 'default',
        priority: 'max',
        defaultVibrateTimings: true,
        visibility: 'public'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1
        }
      }
    }
  };

  try {
    const response = await fcmMessaging.send(payload);
    return { success: true, messageId: response };
  } catch (err) {
    console.error('FCM push notification send failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a push notification payload to Expo's Push Gateway
 */
async function sendExpoPushNotification({ token, title, message, data = {} }) {
  if (!isExpoPushToken(token)) return { success: false, error: 'Invalid Expo push token' };

  const payload = JSON.stringify({
    to: token.trim(),
    sound: 'default',
    title: title || 'BuildTrack Notification',
    body: message || '',
    data,
    priority: 'high',
    channelId: 'default'
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 6000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
        } catch {
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, raw: body });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Expo push notification request failed:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout sending push notification' });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Dispatches push notifications to all registered device tokens for a worker or admin
 * Automatically detects whether the token is Expo or Firebase Cloud Messaging (FCM)
 */
async function sendPushNotificationToTokens(tokens = [], { title, message, data = {} }) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];

  const results = [];
  for (const tokenItem of tokens) {
    const tokenStr = typeof tokenItem === 'string' ? tokenItem : (tokenItem?.token || tokenItem?.device_token || tokenItem?.fcm_token);
    if (!tokenStr || typeof tokenStr !== 'string') continue;

    if (isExpoPushToken(tokenStr)) {
      const res = await sendExpoPushNotification({ token: tokenStr, title, message, data });
      results.push(res);
    } else {
      // Standard FCM Device Token (used by Flutter app)
      const res = await sendFcmNotification({ token: tokenStr, title, message, data });
      results.push(res);
    }
  }
  return results;
}

module.exports = {
  isExpoPushToken,
  sendFcmNotification,
  sendExpoPushNotification,
  sendPushNotificationToTokens
};
