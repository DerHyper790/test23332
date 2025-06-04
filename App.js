import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, getDocs } from 'firebase/firestore';
import {
  Play, Pause, SkipForward, Music, Bell, Youtube, Twitch, X, PlusCircle, Trash2, Loader2, User,
  Volume2, VolumeX, MessageSquare, Link as LinkIcon // Renamed Link to LinkIcon to avoid conflict
} from 'lucide-react';

// Globale Variablen, die vom Canvas-Environment bereitgestellt werden
// Diese Variablen ermöglichen die Verbindung zu Firebase und sind für die Funktion der App unerlässlich.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialisiere Firebase außerhalb der Komponente, um Mehrfachinitialisierung zu vermeiden.
// Dies stellt sicher, dass Firebase nur einmal initialisiert wird, auch bei Re-Rendern der Komponente.
let firebaseApp;
let db;
let auth;

try {
  firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);
} catch (error) {
  console.error("Fehler beim Initialisieren von Firebase:", error);
  // Hier könnte man eine Benachrichtigung für den Benutzer einbauen, dass Firebase nicht geladen werden konnte.
}

function App() {
  // Zustandsvariablen für die Benutzeroberfläche und die simulierten Bot-Daten
  const [isBotOnline, setIsBotOnline] = useState(false); // Simuliert den Online-Status des Bots
  const [currentSong, setCurrentSong] = useState(null); // Simuliert den aktuell spielenden Song
  const [musicQueue, setMusicQueue] = useState([]); // Simuliert die Musikwarteschlange
  const [socialAccounts, setSocialAccounts] = useState([]); // Liste der zu verfolgenden Social-Media-Konten
  const [socialUpdates, setSocialUpdates] = useState([]); // Simulierte Social-Media-Updates
  const [newMusicUrl, setNewMusicUrl] = useState(''); // Eingabefeld für neue Musik-URL
  const [newSocialAccountUrl, setNewSocialAccountUrl] = useState(''); // Eingabefeld für neue Social-Media-URL
  const [newSocialAccountType, setNewSocialAccountType] = useState('YouTube'); // Auswahl des Social-Media-Typs
  const [message, setMessage] = useState(''); // Für temporäre Nachrichten an den Benutzer (z.B. "Song hinzugefügt")
  const [userId, setUserId] = useState(null); // Die Firebase-Benutzer-ID für die Datenspeicherung
  const [isAuthReady, setIsAuthReady] = useState(false); // Zeigt an, ob die Firebase-Authentifizierung abgeschlossen ist
  const [isLoading, setIsLoading] = useState(true); // Zeigt an, ob die Initialdaten geladen werden

  const messageTimeoutRef = useRef(null); // Referenz für den Timeout der Nachrichtenanzeige

  // Funktion zum Anzeigen von temporären Nachrichten am oberen Bildschirmrand
  const showMessage = (msg, duration = 3000) => {
    setMessage(msg);
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current); // Vorherigen Timeout löschen, falls vorhanden
    }
    messageTimeoutRef.current = setTimeout(() => {
      setMessage(''); // Nachricht nach 'duration' Millisekunden ausblenden
    }, duration);
  };

  // Effekt-Hook für die Firebase-Authentifizierung und Initialisierung
  useEffect(() => {
    const setupFirebase = async () => {
      // Prüfe, ob Firebase-Instanzen verfügbar sind
      if (!db || !auth) {
        showMessage("Firebase ist nicht korrekt initialisiert. Überprüfe die Konfiguration.");
        setIsLoading(false);
        return;
      }

      try {
        // Versuche, sich mit dem bereitgestellten Initial-Auth-Token anzumelden
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          // Wenn kein Token vorhanden ist, melde dich anonym an
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Fehler bei der Firebase-Authentifizierung:", error);
        showMessage(`Fehler bei der Authentifizierung: ${error.message}`);
      } finally {
        setIsAuthReady(true); // Setze den Authentifizierungsstatus auf bereit
      }
    };

    setupFirebase(); // Rufe die Setup-Funktion auf

    // Listener für Änderungen im Authentifizierungsstatus
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid); // Setze die Benutzer-ID, wenn ein Benutzer angemeldet ist
        console.log("Benutzer angemeldet:", user.uid);
      } else {
        setUserId(null); // Setze die Benutzer-ID auf null, wenn kein Benutzer angemeldet ist
        console.log("Benutzer abgemeldet.");
      }
      setIsLoading(false); // Beende den Ladezustand, sobald der Auth-Status geprüft wurde
    });

    // Cleanup-Funktion: Entfernt den Auth-Listener, wenn die Komponente unmontiert wird
    return () => unsubscribeAuth();
  }, []); // Leeres Abhängigkeits-Array bedeutet, dieser Effekt läuft nur einmal beim Mounten

  // Effekt-Hook für den Firestore-Listener für Bot-Daten
  useEffect(() => {
    // Führe den Listener nur aus, wenn Authentifizierung bereit und Benutzer-ID vorhanden ist
    if (!isAuthReady || !userId || !db) {
      return;
    }

    // Referenz zum Firestore-Dokument, in dem die Bot-Daten gespeichert sind
    // Pfad: artifacts/{appId}/users/{userId}/bot_data/config
    const botDataDocRef = doc(db, `artifacts/${appId}/users/${userId}/bot_data`, 'config');

    // onSnapshot: Echtzeit-Listener für Änderungen im Dokument
    const unsubscribe = onSnapshot(botDataDocRef, (docSnap) => {
      if (docSnap.exists()) {
        // Wenn das Dokument existiert, lade die Daten und aktualisiere den Zustand
        const data = docSnap.data();
        setIsBotOnline(data.isBotOnline || false);
        setMusicQueue(data.musicQueue || []);
        setCurrentSong(data.currentSong || null);
        setSocialAccounts(data.socialAccounts || []);
        setSocialUpdates(data.socialUpdates || []); // Simulierte letzte Updates
      } else {
        // If the document does not exist, initialize it with default values
        // This ensures that a fresh user or app starts with a clean slate.
        setDoc(botDataDocRef, {
          isBotOnline: false,
          musicQueue: [],
          currentSong: null,
          socialAccounts: [],
          socialUpdates: []
        }, { merge: true }).catch(e => console.error("Fehler beim Initialisieren der Bot-Daten:", e));
      }
    }, (error) => {
      console.error("Fehler beim Abrufen der Bot-Daten:", error);
      showMessage(`Fehler beim Laden der Daten: ${error.message}`);
    });

    // Cleanup-Funktion: Entfernt den Firestore-Listener, wenn die Komponente unmontiert wird
    return () => unsubscribe();
  }, [isAuthReady, userId, db]); // Abhängigkeiten: Effekt läuft bei Änderungen dieser Variablen

  // Funktion zum Speichern der Bot-Daten in Firestore
  const saveBotData = async (dataToUpdate) => {
    if (!userId || !db) {
      showMessage("Benutzer nicht authentifiziert oder Firestore nicht verfügbar.");
      return;
    }
    const botDataDocRef = doc(db, `artifacts/${appId}/users/${userId}/bot_data`, 'config');
    try {
      await setDoc(botDataDocRef, dataToUpdate, { merge: true }); // Daten zusammenführen (merge: true)
      console.log("Bot-Daten gespeichert.");
    } catch (e) {
      console.error("Fehler beim Speichern der Bot-Daten:", e);
      showMessage(`Fehler beim Speichern der Daten: ${e.message}`);
    }
  };

  // Funktion zum Umschalten des Bot-Status (Online/Offline)
  const toggleBotStatus = () => {
    const newStatus = !isBotOnline;
    setIsBotOnline(newStatus);
    saveBotData({ isBotOnline: newStatus }); // Speichere den neuen Status in Firestore
    showMessage(`Bot ist jetzt ${newStatus ? 'online' : 'offline'}.`);
  };

  // --- Musikfunktionen (simuliert) ---
  const addMusicToQueue = () => {
    if (newMusicUrl.trim() === '') {
      showMessage("Bitte eine URL eingeben.");
      return;
    }
    // Erstelle ein neues Song-Objekt und füge es der Warteschlange hinzu
    const newQueue = [...musicQueue, { id: Date.now(), url: newMusicUrl, title: `Song von ${newMusicUrl.substring(0, 30)}...` }];
    setMusicQueue(newQueue);
    setNewMusicUrl(''); // Eingabefeld leeren
    saveBotData({ musicQueue: newQueue }); // Speichere die aktualisierte Warteschlange
    showMessage("Song zur Warteschlange hinzugefügt.");
  };

  const playNextSong = () => {
    if (musicQueue.length > 0) {
      const nextSong = musicQueue[0]; // Nächsten Song aus der Warteschlange nehmen
      const remainingQueue = musicQueue.slice(1); // Restliche Warteschlange
      setCurrentSong(nextSong); // Setze den aktuell spielenden Song
      setMusicQueue(remainingQueue); // Aktualisiere die Warteschlange
      saveBotData({ currentSong: nextSong, musicQueue: remainingQueue }); // Speichere den Zustand
      showMessage(`Spiele jetzt: ${nextSong.title}`);
    } else {
      setCurrentSong(null); // Wenn Warteschlange leer, setze aktuellen Song auf null
      saveBotData({ currentSong: null });
      showMessage("Warteschlange ist leer.");
    }
  };

  const skipSong = () => {
    playNextSong(); // Simuliert das Überspringen, indem einfach der nächste Song abgespielt wird
  };

  const stopMusic = () => {
    setCurrentSong(null); // Aktuellen Song stoppen
    setMusicQueue([]); // Warteschlange leeren
    saveBotData({ currentSong: null, musicQueue: [] }); // Speichere den Zustand
    showMessage("Musikwiedergabe gestoppt und Warteschlange geleert.");
  };

  // --- Social Media Funktionen (simuliert) ---
  const addSocialAccount = () => {
    if (newSocialAccountUrl.trim() === '') {
      showMessage("Bitte eine URL eingeben.");
      return;
    }
    // Erstelle ein neues Social-Media-Konto-Objekt
    const newAccount = {
      id: Date.now(),
      type: newSocialAccountType,
      url: newSocialAccountUrl,
      lastFetched: null // Simuliert den Zeitpunkt des letzten Abrufs
    };
    const updatedAccounts = [...socialAccounts, newAccount]; // Füge das neue Konto hinzu
    setSocialAccounts(updatedAccounts);
    setNewSocialAccountUrl(''); // Eingabefeld leeren
    showMessage(`Social-Media-Konto hinzugefügt: ${newSocialAccountType} - ${newSocialAccountUrl}`);
    saveBotData({ socialAccounts: updatedAccounts }); // Speichere die aktualisierte Liste
  };

  const removeSocialAccount = (id) => {
    const updatedAccounts = socialAccounts.filter(acc => acc.id !== id); // Entferne das Konto
    setSocialAccounts(updatedAccounts);
    showMessage("Social-Media-Konto entfernt.");
    saveBotData({ socialAccounts: updatedAccounts }); // Speichere die aktualisierte Liste
  };

  const simulateFetchUpdates = () => {
    if (socialAccounts.length === 0) {
      showMessage("Keine Social-Media-Konten zum Abrufen.");
      return;
    }

    // Simuliere neue Updates basierend auf den verfolgten Konten
    const newUpdates = socialAccounts.map(account => {
      const updateText = `Neuer Beitrag von ${account.type} (${account.url}) - ${new Date().toLocaleTimeString()}`;
      return { id: Date.now() + Math.random(), accountId: account.id, text: updateText, timestamp: Date.now() };
    });

    // Füge neue Updates hinzu und zeige nur die letzten 10 an
    setSocialUpdates(prevUpdates => [...newUpdates, ...prevUpdates].slice(0, 10));
    saveBotData({ socialUpdates: [...newUpdates, ...socialUpdates].slice(0, 10) }); // Speichere die Updates
    showMessage("Simulierte Updates abgerufen.");
  };

  // Zeige einen Ladebildschirm an, während die Firebase-Initialisierung läuft
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <Loader2 className="animate-spin mr-2" size={24} />
        Lade Bot-Konfiguration...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-inter p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-6 text-purple-400">
          Discord Bot Simulator
        </h1>

        {/* Benutzer-ID Anzeige */}
        {userId && (
          <div className="bg-gray-700 text-gray-300 p-3 rounded-lg mb-6 flex items-center justify-center text-sm break-all">
            <User className="mr-2" size={18} />
            Deine Benutzer-ID: <span className="font-mono ml-2">{userId}</span>
          </div>
        )}

        {/* Nachrichtenanzeige */}
        {message && (
          <div className="bg-blue-600 text-white px-4 py-3 rounded-lg mb-6 text-center shadow-md">
            {message}
          </div>
        )}

        {/* Bot Status Umschalter */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-700 p-4 rounded-xl mb-8 shadow-inner">
          <div className="flex items-center mb-4 sm:mb-0">
            <span className={`h-4 w-4 rounded-full mr-3 ${isBotOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-lg font-semibold">Bot Status: {isBotOnline ? 'Online' : 'Offline'}</span>
          </div>
          <button
            onClick={toggleBotStatus}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-md
              ${isBotOnline
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
          >
            {isBotOnline ? 'Bot ausschalten' : 'Bot einschalten'}
          </button>
        </div>

        {/* Musiksteuerung Sektion */}
        <div className="bg-gray-700 p-6 rounded-xl mb-8 shadow-inner">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-blue-400">
            <Music className="mr-2" /> Musiksteuerung (Simuliert)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            <span className="font-bold">Hinweis:</span> Die tatsächliche Musikwiedergabe in Discord erfordert einen Backend-Server, der mit der Discord-API und Audio-Tools wie FFmpeg interagiert. Dies ist eine Frontend-Simulation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="YouTube/Twitch URL hier einfügen"
              value={newMusicUrl}
              onChange={(e) => setNewMusicUrl(e.target.value)}
              className="flex-grow p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-purple-500 focus:ring focus:ring-purple-500 focus:ring-opacity-50 text-white placeholder-gray-400"
            />
            <button
              onClick={addMusicToQueue}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300 shadow-md flex items-center justify-center"
            >
              <PlusCircle className="mr-2" size={20} /> Zur Warteschlange hinzufügen
            </button>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mb-6">
            <button
              onClick={playNextSong}
              disabled={musicQueue.length === 0 && !currentSong}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Play className="mr-2" size={20} /> Spielen
            </button>
            <button
              onClick={skipSong}
              disabled={musicQueue.length === 0}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <SkipForward className="mr-2" size={20} /> Überspringen
            </button>
            <button
              onClick={stopMusic}
              disabled={!currentSong && musicQueue.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <VolumeX className="mr-2" size={20} /> Stoppen
            </button>
          </div>

          {/* Aktuell spielender Song und Warteschlange Anzeige */}
          <div className="bg-gray-800 p-4 rounded-lg shadow-inner">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Aktuell spielt:</h3>
            {currentSong ? (
              <p className="text-green-400 flex items-center">
                <Volume2 className="mr-2" size={18} /> {currentSong.title}
              </p>
            ) : (
              <p className="text-gray-400">Nichts spielt gerade.</p>
            )}

            <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-300">Warteschlange:</h3>
            {musicQueue.length > 0 ? (
              <ul className="list-disc list-inside text-gray-300 max-h-40 overflow-y-auto custom-scrollbar">
                {musicQueue.map((song) => (
                  <li key={song.id} className="py-1 flex items-center">
                    <LinkIcon size={16} className="mr-2 text-gray-500" />
                    {song.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">Warteschlange ist leer.</p>
            )}
          </div>
        </div>

        {/* Social Media Updates Sektion */}
        <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
          <h2 className="text-2xl font-bold mb-4 flex items-center text-orange-400">
            <Bell className="mr-2" /> Social Media Updates (Simuliert)
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            <span className="font-bold">Hinweis:</span> Das Abrufen von Live-Updates erfordert API-Zugriff auf die jeweiligen Social-Media-Plattformen (z.B. YouTube Data API, Twitch API, Twitter API) und einen Backend-Dienst. Dies ist eine Frontend-Simulation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <select
              value={newSocialAccountType}
              onChange={(e) => setNewSocialAccountType(e.target.value)}
              className="p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-orange-500 focus:ring focus:ring-orange-500 focus:ring-opacity-50 text-white"
            >
              <option value="YouTube">YouTube</option>
              <option value="Twitch">Twitch</option>
              <option value="X">X (Twitter)</option>
              <option value="Other">Andere</option>
            </select>
            <input
              type="text"
              placeholder="Profil-URL oder Benutzername"
              value={newSocialAccountUrl}
              onChange={(e) => setNewSocialAccountUrl(e.target.value)}
              className="flex-grow p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-orange-500 focus:ring focus:ring-orange-500 focus:ring-opacity-50 text-white placeholder-gray-400"
            />
            <button
              onClick={addSocialAccount}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300 shadow-md flex items-center justify-center"
            >
              <PlusCircle className="mr-2" size={20} /> Konto hinzufügen
            </button>
          </div>

          {/* Verfolgte Konten Anzeige */}
          <div className="bg-gray-800 p-4 rounded-lg shadow-inner mb-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Verfolgte Konten:</h3>
            {socialAccounts.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto custom-scrollbar">
                {socialAccounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between py-1 border-b border-gray-700 last:border-b-0 text-gray-300">
                    <span className="flex items-center">
                      {account.type === 'YouTube' && <Youtube size={18} className="mr-2 text-red-500" />}
                      {account.type === 'Twitch' && <Twitch size={18} className="mr-2 text-purple-500" />}
                      {account.type === 'X' && <X size={18} className="mr-2 text-blue-400" />}
                      {account.type === 'Other' && <MessageSquare size={18} className="mr-2 text-gray-400" />}
                      {account.type}: {account.url}
                    </span>
                    <button
                      onClick={() => removeSocialAccount(account.id)}
                      className="text-red-400 hover:text-red-500 transition-colors duration-200 p-1 rounded-full hover:bg-gray-700"
                      title="Konto entfernen"
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">Keine Konten verfolgt.</p>
            )}
          </div>

          <button
            onClick={simulateFetchUpdates}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300 shadow-md w-full flex items-center justify-center mb-6"
          >
            <Bell className="mr-2" size={20} /> Simulierte Updates abrufen
          </button>

          {/* Neueste simulierte Updates Anzeige */}
          <div className="bg-gray-800 p-4 rounded-lg shadow-inner">
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Neueste simulierte Updates:</h3>
            {socialUpdates.length > 0 ? (
              <ul className="list-disc list-inside text-gray-300 max-h-40 overflow-y-auto custom-scrollbar">
                {socialUpdates.map((update) => (
                  <li key={update.id} className="py-1">
                    {update.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">Keine Updates vorhanden.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
