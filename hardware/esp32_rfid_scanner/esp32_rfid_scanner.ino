
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// Phone Hotspot Credentials
const char* WIFI_SSID     = "ayaw ko nga.";
const char* WIFI_PASSWORD = "123456789";

// Server API Endpoint (Laptop IP on Hotspot)
const char* SERVER_URL    = "http://10.234.140.195:5000/api/attendance/scan";

// RFID API Key (Matches server/.env)
const char* RFID_API_KEY  = "fd3f275475be3609826b4932bb1e3a3db5de796fbcf499e503f6e3de6dde829c";

// Terminal Name
const char* TERMINAL_ID   = "ESP32-GATE-TERMINAL";

// ==================== PIN DEFINITIONS ====================
#define SS_PIN     5
#define RST_PIN    22
#define BUZZER_PIN 2   // Onboard LED or Active Buzzer (optional)

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Prevent repeat reads within 3 seconds for the same card
String lastScannedUid = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_DELAY_MS = 3000;

// ==================== BEEP / SOUND FEEDBACK ====================
void feedbackSuccess() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
}

void feedbackError() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(80);
  }
}

void feedbackUnregistered() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}

// ==================== WIFI CONNECT ====================
void connectToWiFi() {
  Serial.print("Connecting to Hotspot: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected to Hotspot!");
    Serial.print("[Wi-Fi] ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
    feedbackSuccess();
  } else {
    Serial.println("\n[Wi-Fi] Connection Failed. Will retry automatically.");
  }
}

// ==================== SEND SCAN TO BUILDTRACK SERVER ====================
void sendScanToServer(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Reconnecting to Wi-Fi...");
    WiFi.disconnect();
    WiFi.reconnect();
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) {
      delay(200);
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[HTTP] Wi-Fi unavailable.");
      feedbackError();
      return;
    }
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-rfid-api-key", RFID_API_KEY);
  http.setTimeout(8000);

  StaticJsonDocument<256> doc;
  doc["rfid_uid"] = uid;
  doc["scan_source"] = "RFID";
  doc["terminal_id"] = TERMINAL_ID;

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.println("\n--- [CARD TAPPED] ---");
  Serial.print("UID: ");
  Serial.println(uid);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.print("[HTTP Status]: ");
    Serial.println(httpCode);
    Serial.print("[Response]: ");
    Serial.println(response);

    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);

    if (!error) {
      bool success = resDoc["success"] | false;
      const char* workerName = resDoc["worker_name"] | "Worker";
      const char* action = resDoc["action"] | "";
      const char* errMsg = resDoc["error"] | "";

      if (success) {
        Serial.print(">>> SUCCESS: ");
        Serial.print(workerName);
        Serial.print(" - ");
        Serial.println(action);
        feedbackSuccess();
      } else if (httpCode == 404) {
        Serial.print(">>> UNREGISTERED CARD: ");
        Serial.println(errMsg);
        feedbackUnregistered();
      } else {
        Serial.print(">>> NOTICE: ");
        Serial.println(errMsg);
        feedbackError();
      }
    } else {
      feedbackSuccess();
    }
  } else {
    Serial.print("[HTTP] Request failed: ");
    Serial.println(http.errorToString(httpCode).c_str());
    feedbackError();
  }

  http.end();
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("\n==========================================");
  Serial.println("  BuildTrack RFID Scanner Starting        ");
  Serial.println("==========================================");

  SPI.begin();
  mfrc522.PCD_Init();
  delay(50);

  connectToWiFi();

  Serial.println("\n>> Ready! Waiting for RFID cards...");
}

// ==================== MAIN LOOP ====================
void loop() {
  // Check for new card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    delay(50);
    return;
  }
  // Read card serial
  if (!mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  // Convert UID to clean uppercase hex string
  String uidString = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uidString += "0";
    uidString += String(mfrc522.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  // 3-second debounce per card
  unsigned long now = millis();
  if (uidString == lastScannedUid && (now - lastScanTime < DEBOUNCE_DELAY_MS)) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }

  lastScannedUid = uidString;
  lastScanTime = now;

  // Send tap to BuildTrack server
  sendScanToServer(uidString);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
